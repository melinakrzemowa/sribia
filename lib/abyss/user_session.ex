defmodule Abyss.UserSession do
  @moduledoc """
  GenServer that owns the live state for one connected player.

  In-memory state is the source of truth while the user is online — every
  read of position / equipment / health / speed / last_move goes through
  this process, never the database. Writes (movement, equip, take damage,
  …) update the session and schedule a single debounced UPDATE that
  flushes everything together. The DB is just a snapshot we restore from
  on next login or after a server crash.
  """
  use GenServer
  require Logger

  alias Abyss.{Accounts, Equipment}

  @starting_position {32097, 32219}

  @cleanup_time Application.compile_env(:abyss, :user_session_cleanup_time, 10_000)
  @persist_delay Application.compile_env(:abyss, :user_session_persist_delay, 5_000)

  defstruct [
    :user_id,
    :name,
    :channel_pid,
    # Position / last_move / speed / health / max_health are mirrored from
    # the user row at init and then maintained in-memory. Game.move,
    # Game.move_item, equip / unequip, etc. all read from here and only
    # write to the DB through the debounced persist path.
    position: nil,
    last_move: nil,
    speed: 1,
    health: 100,
    max_health: 100,
    # `equipment` is %{slot_atom => %Abyss.Board.Item{}} — the live runtime
    # equipment for this user. Items here are also registered in the Board's
    # items map (via register_item) so they share the global instance-id
    # space.
    equipment: %{},
    # Bumped to true whenever any persisted field changes; cleared after the
    # next :persist_state flush.
    persist_pending: false
  ]

  # CLIENT API

  @doc """
  Starts a new user session GenServer.
  """
  def start_link(user_id) do
    GenServer.start_link(__MODULE__, user_id, name: via_tuple(user_id))
  end

  @doc """
  Defines child_spec with transient restart so the process doesn't restart
  when it terminates normally (shutdown).
  """
  def child_spec(user_id) do
    %{
      id: {__MODULE__, user_id},
      start: {__MODULE__, :start_link, [user_id]},
      restart: :transient
    }
  end

  @doc """
  Returns the PID of the session process for the given user_id, or nil if there is no session.
  """
  def get_session(user_id) do
    case Registry.lookup(Abyss.UserSessionRegistry, user_id) do
      [{pid, _}] -> pid
      [] -> nil
    end
  end

  @doc """
  Registers a channel connection for this user.
  Returns {:ok, :new_session} or {:ok, :replaced_session}
  """
  def register_connection(user_id, channel_pid) do
    case get_or_start(user_id) do
      {:ok, _pid} ->
        GenServer.call(via_tuple(user_id), {:register_connection, channel_pid})

      error ->
        error
    end
  end

  @doc """
  Unregisters a channel connection.
  """
  def unregister_connection(user_id, channel_pid) do
    case get_session(user_id) do
      nil -> :ok
      _pid -> GenServer.call(via_tuple(user_id), {:unregister_connection, channel_pid})
    end
  end

  @doc """
  Returns the live in-memory state for this user. Always go through here —
  never re-read the user row from the database for connected players.
  """
  def get_state(user_id) do
    case get_or_start(user_id) do
      {:ok, _pid} -> GenServer.call(via_tuple(user_id), :get_state)
      _ -> nil
    end
  end

  @doc """
  Returns the live in-memory state if a session is already running for this
  user, or `nil` otherwise. Use this when you DON'T want to spin up a
  session for an offline player (e.g. iterating users visible on the
  board — they're guaranteed to have a live session because that's how
  they got added in the first place, but we keep it guarded so a stray
  read of an unknown id doesn't materialise an empty session).
  """
  def get_state_if_running(user_id) do
    case get_session(user_id) do
      nil -> nil
      _pid -> GenServer.call(via_tuple(user_id), :get_state)
    end
  end

  @doc """
  Update the player's tile position and the timestamp of their last move.
  Schedules a debounced DB flush.
  """
  def update_position(user_id, {_x, _y} = position, %NaiveDateTime{} = last_move) do
    case get_or_start(user_id) do
      {:ok, _pid} ->
        GenServer.call(via_tuple(user_id), {:update_position, position, last_move})

      err ->
        err
    end
  end

  @doc """
  Returns the entire equipment map for `user_id`. Starts the session if it
  isn't running yet.
  """
  def get_equipment(user_id) do
    case get_or_start(user_id) do
      {:ok, _pid} -> GenServer.call(via_tuple(user_id), :get_equipment)
      _ -> %{}
    end
  end

  def get_equipment_slot(user_id, slot) do
    case get_or_start(user_id) do
      {:ok, _pid} -> GenServer.call(via_tuple(user_id), {:get_slot, slot})
      _ -> nil
    end
  end

  @doc """
  Replace `slot` with `item` (an `%Abyss.Board.Item{}` or `nil` to clear).
  Returns the previously held item (or `nil`). Schedules a debounced DB write.
  """
  def set_equipment_slot(user_id, slot, item) do
    case get_or_start(user_id) do
      {:ok, _pid} -> GenServer.call(via_tuple(user_id), {:set_slot, slot, item})
      err -> err
    end
  end

  defp get_or_start(user_id) do
    case get_session(user_id) do
      nil ->
        case Abyss.UserSessionSupervisor.start_session(user_id) do
          {:ok, pid} -> {:ok, pid}
          {:error, {:already_started, pid}} -> {:ok, pid}
          error -> error
        end

      pid ->
        {:ok, pid}
    end
  end

  # SERVER CALLBACKS

  @impl true
  def init(user_id) do
    Logger.info("Starting UserSession for user #{user_id}")

    state = %__MODULE__{user_id: user_id}

    {:ok, state, {:continue, :load_state}}
  end

  @impl true
  def handle_continue(:load_state, state) do
    state =
      try do
        case Accounts.get_user(state.user_id) do
          nil ->
            state

          user ->
            position =
              cond do
                is_nil(user.x) or is_nil(user.y) -> @starting_position
                true -> {user.x, user.y}
              end

            last_move = user.last_move || NaiveDateTime.utc_now()

            persist_pending? =
              is_nil(user.x) or is_nil(user.y) or is_nil(user.last_move)

            state = %{
              state
              | name: user.name,
                position: position,
                last_move: last_move,
                speed: user.speed || 1,
                health: user.health || 100,
                max_health: user.max_health || 100,
                equipment: Equipment.from_persisted(user.equipment || %{})
            }

            if persist_pending?, do: schedule_persist(state), else: state
        end
      rescue
        # In tests UserSessions can be started by processes that don't own
        # the SQL sandbox; load fails harmlessly with the default struct.
        DBConnection.OwnershipError -> state

        e ->
          Logger.warning("UserSession #{state.user_id} could not load state: #{inspect(e)}")
          state
      catch
        # Same protection for the case where the sandbox owner exits while
        # the load query is in flight (manifests as `:exit` on Repo.get).
        :exit, _ -> state
      end

    monitor_board()
    {:noreply, state}
  end

  @impl true
  def handle_call({:register_connection, new_channel_pid}, _from, state) do
    case state.channel_pid do
      nil ->
        # No existing connection
        state = %{state | channel_pid: new_channel_pid}
        Logger.info("User #{state.user_id} connected (new session)")
        {:reply, {:ok, :new_session}, state}

      old_pid when old_pid == new_channel_pid ->
        # Same PID, already registered
        {:reply, {:ok, :already_registered}, state}

      old_pid ->
        # Different connection exists, disconnect old one
        Logger.info("User #{state.user_id} connecting from new client, disconnecting old client")

        # Check if old PID is still alive before sending message
        if Process.alive?(old_pid) do
          send(old_pid, :force_disconnect)
        end

        state = %{state | channel_pid: new_channel_pid}
        {:reply, {:ok, :replaced_session}, state}
    end
  end

  @impl true
  def handle_call({:unregister_connection, channel_pid}, _from, state) do
    cond do
      # The disconnecting channel is the current one
      state.channel_pid == channel_pid ->
        Logger.info("User #{state.user_id} disconnected")
        state = %{state | channel_pid: nil}

        # Schedule session cleanup after disconnect
        schedule_session_cleanup()

        {:reply, :ok, state}

      # Current channel PID is set but process is dead
      state.channel_pid != nil and not Process.alive?(state.channel_pid) ->
        Logger.info("User #{state.user_id} has dead channel PID, clearing it")
        state = %{state | channel_pid: nil}

        # Schedule session cleanup
        schedule_session_cleanup()

        {:reply, :ok, state}

      # Not the current connection or different PID, ignore
      true ->
        {:reply, :ok, state}
    end
  end

  @impl true
  def handle_call(:get_state, _from, state) do
    {:reply, public_state(state), state}
  end

  def handle_call({:update_position, position, last_move}, _from, state) do
    state =
      schedule_persist(%{state | position: position, last_move: last_move})

    {:reply, :ok, state}
  end

  def handle_call(:get_equipment, _from, state) do
    {:reply, state.equipment, state}
  end

  def handle_call({:get_slot, slot}, _from, state) do
    {:reply, Map.get(state.equipment, slot), state}
  end

  def handle_call({:set_slot, slot, nil}, _from, state) do
    {prev, equipment} = Map.pop(state.equipment, slot)
    state = schedule_persist(%{state | equipment: equipment})
    {:reply, prev, state}
  end

  def handle_call({:set_slot, slot, item}, _from, state) do
    prev = Map.get(state.equipment, slot)
    state = schedule_persist(%{state | equipment: Map.put(state.equipment, slot, item)})
    {:reply, prev, state}
  end

  @impl true
  def handle_info(:session_cleanup, state) do
    if state.channel_pid == nil do
      Logger.info("Cleaning up disconnected UserSession for user #{state.user_id}")
      {:stop, :shutdown, state}
    else
      Logger.info("User #{state.user_id} reconnected, canceling session cleanup")
      {:noreply, state}
    end
  end

  def handle_info(:persist_state, state) do
    persist_state(state)
    {:noreply, %{state | persist_pending: false}}
  end

  # Board GenServer died. The supervisor will restart it, but every %Item{}
  # in our equipment map now references an id that's gone with the old
  # container, AND this user is no longer registered on the new Board.
  # Defer a resync so the new Board has time to come up before we try to
  # re-add the user / re-register the items.
  def handle_info({:DOWN, _ref, :process, _pid, _reason}, state) do
    Process.send_after(self(), :resync_with_board, 100)
    {:noreply, state}
  end

  def handle_info(:resync_with_board, state) do
    case Process.whereis(Abyss.Board) do
      nil ->
        # Board not back yet — try again shortly.
        Process.send_after(self(), :resync_with_board, 100)
        {:noreply, state}

      _pid ->
        monitor_board()
        re_add_user_to_board(state, state.user_id)

        # Re-register only items the new Board doesn't recognise. An item
        # whose id is still valid is either:
        #   - The same Board never crashed (we got a stale :DOWN somehow)
        #     → keep the existing %Item{} as-is.
        #   - Already re-registered earlier in this session → keep it.
        # In both cases re-registering would create a duplicate item in the
        # Board's items map; the get_item gate prevents that.
        equipment =
          Map.new(state.equipment, fn {slot, item} ->
            case Abyss.Board.get_item(item.id) do
              %Abyss.Board.Item{} ->
                {slot, item}

              _ ->
                {:ok, fresh} = Abyss.Board.register_item(item.item_id, item.count)
                {slot, fresh}
            end
          end)

        {:noreply, %{state | equipment: equipment}}
    end
  end

  @impl true
  def terminate(_reason, state) do
    if state.persist_pending do
      persist_state(state)
    end

    :ok
  end

  # PRIVATE FUNCTIONS

  defp via_tuple(user_id) do
    {:via, Registry, {Abyss.UserSessionRegistry, user_id}}
  end

  defp schedule_session_cleanup do
    Process.send_after(self(), :session_cleanup, @cleanup_time)
  end

  # Watch the Board so we can rebind equipment items whenever it crashes
  # and the supervisor restarts it. Safe to call repeatedly; multiple
  # monitors on the same pid each fire one :DOWN.
  defp monitor_board do
    case Process.whereis(Abyss.Board) do
      nil -> :ok
      pid -> Process.monitor(pid)
    end
  end

  # Best-effort re-add this user to a freshly-restarted Board so the next
  # move call doesn't have to wait for Game.move's auto-recovery path.
  # Container.put inside Board.add_user is idempotent (it deletes any prior
  # registration before inserting), so this is safe to call even when the
  # user is already on the board.
  defp re_add_user_to_board(%__MODULE__{position: {x, y}}, user_id) do
    Abyss.Board.add_user({x, y}, user_id)
  end

  defp re_add_user_to_board(_, _), do: :ok

  # Schedule a persist to disk @persist_delay milliseconds from now. If a
  # timer is already pending we just leave it — further changes within the
  # window will all flush together when it fires.
  defp schedule_persist(%{persist_pending: true} = state), do: state

  defp schedule_persist(state) do
    Process.send_after(self(), :persist_state, @persist_delay)
    %{state | persist_pending: true}
  end

  # The DB is a snapshot of the in-memory state. We always reload the user
  # row before writing so a cross-session DB edit (e.g. an admin script)
  # isn't silently overwritten by stale fields we never touched.
  defp persist_state(%{user_id: user_id} = state) do
    case Accounts.get_user(user_id) do
      nil ->
        :ok

      user ->
        attrs = %{
          equipment: Equipment.to_persisted(state.equipment),
          last_move: state.last_move
        }

        attrs =
          case state.position do
            {x, y} -> Map.merge(attrs, %{x: x, y: y})
            _ -> attrs
          end

        attrs = Map.merge(attrs, %{health: state.health, max_health: state.max_health})

        case Accounts.update_user(user, attrs) do
          {:ok, _} ->
            :ok

          {:error, changeset} ->
            Logger.error("Failed to persist state for user #{user_id}: #{inspect(changeset)}")
            :error
        end
    end
  end

  # Strip internal fields (channel_pid, persist_pending) from the snapshot
  # we hand out via :get_state.
  defp public_state(state) do
    %{
      user_id: state.user_id,
      name: state.name,
      position: state.position,
      last_move: state.last_move,
      speed: state.speed,
      health: state.health,
      max_health: state.max_health,
      equipment: state.equipment
    }
  end
end
