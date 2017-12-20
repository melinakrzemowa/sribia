defmodule Abyss.Game do
  alias Abyss.{Accounts, Board}

  @starting_position {5, 5}

  def join(user_id) do
    user =
      user_id
      |> Accounts.get_user!
      |> check_position

    {:ok, position} = Board.join(user_id, {user.x, user.y})
    update_user_position(user, position)
  end

  def move(user_id, direction) do
    user = Accounts.get_user!(user_id)
    move_time = round(100000 / (2 * (user.speed - 1) + 220))
    diff = NaiveDateTime.diff(NaiveDateTime.utc_now(), user.last_move, :millisecond)
    if diff >= move_time * 0.85 do # allow slightly faster movement for smooth movement on frontend
      case Board.move(user_id, direction) do
        {:ok, position} ->
          update_user_position(user, position)
          {:ok, position, move_time}
        {:error, position} -> {:error, position}
      end
    else
      {:error, {user.x, user.y}}
    end
  end

  defp check_position(%{x: nil} = user) do
    update_user_position(user, @starting_position)
  end
  defp check_position(%{y: nil} = user) do
    update_user_position(user, @starting_position)
  end
  defp check_position(user), do: user

  defp update_user_position(user, {x, y}) do
    {:ok, user} = Accounts.update_user(user, %{x: x, y: y, last_move: NaiveDateTime.utc_now()})
    user
  end

end
