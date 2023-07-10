defmodule Abyss.Game do
  alias Abyss.{Accounts, Board}

  @starting_position {1, 1}

  def join(user_id) do
    user =
      user_id
      |> Accounts.get_user!()
      |> check_position

    {:ok, position} = Board.add_user({user.x, user.y}, user_id)
    update_user_position(user, position)
  end

  def get_fields({x, y}) do
    Board.get_fields({x, y}, 100)
    |> Enum.map(fn {position, field} -> {position, load_field(field)} end)
  end

  defp load_field(field) do
    field |> Enum.map(&load_object/1)
  end

  defp load_object({{:user, id}, _blocks}) do
    Accounts.get_user!(id)
  end

  defp load_object(object), do: object

  def move(user_id, direction) do
    user = Accounts.get_user!(user_id)
    move_time = round(100_000 / (2 * (user.speed - 1) + 120))
    diff = NaiveDateTime.diff(NaiveDateTime.utc_now(), user.last_move, :millisecond)
    # allow slightly faster movement for smooth movement on frontend
    if diff >= move_time * 0.85 do
      case Board.move(:user, user_id, direction) do
        {:ok, position} ->
          update_user_position(user, position)
          {:ok, position, move_time}

        {:error, position} ->
          {:error, position}
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
