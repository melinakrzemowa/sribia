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

  defstruct [
    :user_id,
    :channel_pid,
    # Future state fields (not used yet, but ready for migration)
    :position,
    :stats,
    :inventory,
    :last_db_sync
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

  defp get_session(user_id) do
    case Registry.lookup(Abyss.UserSessionRegistry, user_id) do
      [{pid, _}] -> pid
      [] -> nil
    end
  end

  # SERVER CALLBACKS

  @impl true
  def init(user_id) do
    Logger.info("Starting UserSession for user #{user_id}")

    state = %__MODULE__{
      user_id: user_id,
      channel_pid: nil
    }

    {:ok, state}
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
  def handle_info(:session_cleanup, state) do
    if state.channel_pid == nil do
      Logger.info("Cleaning up disconnected UserSession for user #{state.user_id}")
      {:stop, :shutdown, state}
    else
      Logger.info("User #{state.user_id} reconnected, canceling session cleanup")
      {:noreply, state}
    end
  end

  # PRIVATE FUNCTIONS

  defp via_tuple(user_id) do
    {:via, Registry, {Abyss.UserSessionRegistry, user_id}}
  end

  defp schedule_session_cleanup do
    Process.send_after(self(), :session_cleanup, 10_000)
  end
end
