defmodule Abyss.Board do
  use GenServer
  alias Abyss.Board.{Directions, Moves}

  # CLIENT

  def start_link() do
    GenServer.start_link(__MODULE__, %{board: %{}, users: %{}}, name: __MODULE__)
  end

  def init(state) do
    {:ok, state}
  end

  def get_position(user_id) do
    GenServer.call(__MODULE__, {:get_position, user_id})
  end

  def join(user_id, position) do
    GenServer.call(__MODULE__, {:add_user, user_id, position})
  end

  def move(user_id, direction) do
    GenServer.call(__MODULE__, {:move, user_id, direction})
  end

  def get_users do
    GenServer.call(__MODULE__, {:get_users})
  end

  # SERVER

  def handle_call({:get_position, user_id}, _from, %{board: _board, users: users} = state) do
    {:reply, Map.get(users, user_id), state}
  end

  def handle_call({:add_user, user_id, position}, _from, %{board: board, users: users}) do
    position =
      case get_free_spot(board, position, user_id) do
        nil -> {1, 1}
        position -> position
      end
    board = Map.put(board, position, {:user, user_id})
    users = Map.put(users, user_id, position)
    {:reply, {:ok, position}, %{board: board, users: users}}
  end

  def handle_call({:move, user_id, direction}, _from, %{board: board, users: users} = state) do
    user_position = Map.get(users, user_id)
    new_position = Moves.add(user_position, Directions.calc(direction))

    case Map.get(board, new_position) do
      nil ->
        board =
          board
          |> Map.delete(user_position)
          |> Map.put(new_position, {:user, user_id})
        users = Map.put(users, user_id, new_position)
        {:reply, {:ok, new_position}, %{board: board, users: users}}
      _ ->
        {:reply, {:error, user_position}, state}
    end
  end

  def handle_call({:get_users}, _from, %{users: users} = state) do
    {:reply, Enum.map(users, fn {id, _v} -> id end), state}
  end

  defp get_free_spot(board, {x, y}, user_id) do
    mods = [0, -1, 1]
    Enum.reduce_while(mods, nil, fn mod_x, _ ->
      Enum.reduce_while(mods, nil, fn mod_y, _ ->
        pos = {x + mod_x, y + mod_y}
        board |> Map.get(pos) |> continue_in?(pos, user_id)
      end) |> continue_out?()
    end)
  end

  defp continue_in?(nil, pos, _user_id), do: {:halt, pos}
  defp continue_in?({:user, user_id}, pos, user_id), do: {:halt, pos}
  defp continue_in?(_spot, _pos, _user_id), do: {:cont, nil}

  defp continue_out?(nil), do: {:cont, nil}
  defp continue_out?(pos), do: {:halt, pos}

end
