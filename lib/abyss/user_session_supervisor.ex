defmodule Abyss.UserSessionSupervisor do
  @moduledoc """
  DynamicSupervisor for managing UserSession processes.
  Spawns a new UserSession GenServer for each user that connects.
  """
  use DynamicSupervisor

  def start_link(init_arg) do
    DynamicSupervisor.start_link(__MODULE__, init_arg, name: __MODULE__)
  end

  @impl true
  def init(_init_arg) do
    DynamicSupervisor.init(strategy: :one_for_one)
  end

  @doc """
  Starts a new UserSession for the given user_id.
  """
  def start_session(user_id) do
    spec = {Abyss.UserSession, user_id}
    DynamicSupervisor.start_child(__MODULE__, spec)
  end

  @doc """
  Terminates a UserSession for the given user_id.
  """
  def stop_session(user_id) do
    case Abyss.UserSession.get_session(user_id) do
      nil -> :ok
      pid -> DynamicSupervisor.terminate_child(__MODULE__, pid)
    end
  end

  @doc """
  Lists all active UserSession PIDs.
  """
  def list_sessions do
    DynamicSupervisor.which_children(__MODULE__)
  end
end
