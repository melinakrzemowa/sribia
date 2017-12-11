defmodule Sribia.Board do
  use GenServer
  alias Sribia.Board.{Directions, Moves}

  # CLIENT

  def start_link() do
    GenServer.start_link(__MODULE__, %{board: %{}, users: %{}}, name: __MODULE__)
  end

  def get_position(user_id) do
    GenServer.call(__MODULE__, {:get_position, user_id})
  end

  def join(user_id, position) do
    GenServer.call(__MODULE__, {:join, user_id, position})
  end

  def move(user_id, direction) do
    GenServer.call(__MODULE__, {:move, user_id, direction})
  end

  # SERVER

  def handle_call({:get_position, user_id}, _from, %{board: _board, users: users} = state) do
    {:reply, Map.get(users, user_id), state}
  end

  def handle_call({:join, user_id, position}, _from, %{board: board, users: users}) do
    case Map.get(board, position) do
      nil ->
        board = Map.put(board, position, user_id)
        users = Map.put(users, user_id, position)
        {:reply, :ok, %{board: board, users: users}}
      ^user_id ->
        {:reply, :ok, %{board: board, users: users}}
      _ -> raise "TODO: Occupied place"
    end
  end

  def handle_call({:move, user_id, direction}, _from, %{board: board, users: users} = state) do
    user_position = Map.get(users, user_id)
    new_position = Moves.add(user_position, Directions.calc(direction))

    case Map.get(board, new_position) do
      nil ->
        board =
          board
          |> Map.delete(user_position)
          |> Map.put(new_position, user_id)
        users = Map.put(users, user_id, new_position)
        {:reply, {:ok, new_position}, %{board: board, users: users}}
      _ ->
        {:reply, {:error, user_position}, state}
    end
  end

end
