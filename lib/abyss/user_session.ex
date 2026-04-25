defmodule Abyss.UserSession do
  @moduledoc """
  GenServer for managing individual user sessions.
  Each connected user has their own UserSession process.

  This will eventually handle:
  - User state (position, stats, inventory, etc.)
  - Connection management
  - State serialization to database
  - Real-time game logic
  """
  use GenServer
  require Logger

  alias Abyss.{Accounts, Equipment}

  @cleanup_time Application.compile_env(:abyss, :user_session_cleanup_time, 10_000)
  @persist_delay Application.compile_env(:abyss, :user_session_persist_delay, 5_000)

  defstruct [
    :user_id,
    :channel_pid,
    # `equipment` is %{slot_atom => %Abyss.Board.Item{}} — the live runtime
    # equipment for this user. Items here are also registered in the Board's
    # items map (via register_item) so they share the global instance-id
    # space.
    equipment: %{},
    # Set to true when there's a pending :persist_equipment timer running.
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

    state = %__MODULE__{
      user_id: user_id,
      channel_pid: nil,
      equipment: %{}
    }

    {:ok, state, {:continue, :load_equipment}}
  end

  @impl true
  def handle_continue(:load_equipment, state) do
    equipment =
      try do
        case Accounts.get_user(state.user_id) do
          nil -> %{}
          user -> Equipment.from_persisted(user.equipment || %{})
        end
      rescue
        # In tests UserSessions can be started by processes that don't own the
        # SQL sandbox; equipment load fails harmlessly with an empty map.
        DBConnection.OwnershipError -> %{}
        e ->
          Logger.warning("UserSession #{state.user_id} could not load equipment: #{inspect(e)}")
          %{}
      end

    {:noreply, %{state | equipment: equipment}}
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

  def handle_info(:persist_equipment, state) do
    persist_equipment(state)
    {:noreply, %{state | persist_pending: false}}
  end

  @impl true
  def terminate(_reason, state) do
    if state.persist_pending do
      persist_equipment(state)
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

  # Schedule a persist to disk @persist_delay milliseconds from now. If a
  # timer is already pending we just leave it — further changes within the
  # window will all flush together when it fires.
  defp schedule_persist(%{persist_pending: true} = state), do: state

  defp schedule_persist(state) do
    Process.send_after(self(), :persist_equipment, @persist_delay)
    %{state | persist_pending: true}
  end

  defp persist_equipment(%{user_id: user_id, equipment: equipment}) do
    case Accounts.get_user(user_id) do
      nil ->
        :ok

      user ->
        case Accounts.update_user(user, %{equipment: Equipment.to_persisted(equipment)}) do
          {:ok, _} ->
            :ok

          {:error, changeset} ->
            Logger.error("Failed to persist equipment for user #{user_id}: #{inspect(changeset)}")
            :error
        end
    end
  end
end
