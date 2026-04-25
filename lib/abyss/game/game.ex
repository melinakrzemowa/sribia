defmodule Abyss.Game do
  alias Abyss.{Accounts, Board}

  @starting_position {32097, 32219}
  @map_range_x 8
  @map_range_y 8

  def join(user_id) do
    user =
      user_id
      |> Accounts.get_user!()
      |> check_position

    {:ok, position} = Board.add_user({user.x, user.y}, user_id)
    update_user_position(user, position)
  end

  def leave(user_id) do
    Board.delete(:user, user_id)
  end

  def get_fields({x, y}) do
    Board.get_fields({x, y}, {8, 8})
    |> Enum.map(fn {position, field} -> {position, load_field(field)} end)
  end

  defp load_field(field) do
    field |> Enum.map(&load_object/1)
  end

  defp load_object({{:user, id}, _blocks}) do
    Accounts.get_user!(id)
  end

  defp load_object({{:item, id}, _blocks}) do
    Board.get_item(id)
  end

  defp load_object(object), do: object

  def spawn_item({_x, _y} = position, item_id, count \\ 1) do
    if can_place_on_tile?(position) do
      Board.spawn_item(position, item_id, count)
    else
      {:error, :tile_blocked}
    end
  end

  @doc """
  Returns true if a movable item can be dropped on the tile at `{x, y}` on
  the game level (z = 7). The tile is rejected when any of its env items is
  an unpassable, unmoveable surface without `hasElevation` (trees, walls).
  """
  def can_place_on_tile?({x, y}) do
    case Cachex.get(:map, {x, y, 7}) do
      {:ok, %{items: items}} when is_list(items) -> Abyss.Items.can_place_on?(items)
      _ -> true
    end
  end

  @doc """
  Move the top item at the source tile (where the item lives) to `new_pos`.

  Validates:
    - the item exists
    - the user is within one tile of both source and destination
    - the item's definition is not `isUnmoveable`
    - the destination tile accepts placement (no tree/wall env items)
    - the item is the top of its source stack (Board does this last check)
  """
  def move_item(user_id, instance_id, {_x, _y} = new_pos) do
    with %Abyss.Board.Item{} = item <- Board.get_item(instance_id),
         old_pos when not is_nil(old_pos) <- Board.get_position(:item, instance_id),
         user <- Accounts.get_user!(user_id),
         true <- adjacent?({user.x, user.y}, old_pos) || {:error, :too_far_from_source},
         true <- line_of_sight?(old_pos, new_pos) || {:error, :no_los},
         true <- movable?(item) || {:error, :unmoveable},
         true <- can_place_on_tile?(new_pos) || {:error, :tile_blocked} do
      Board.move_item(instance_id, new_pos)
    else
      nil -> {:error, :not_found}
      {:error, _reason} = err -> err
      false -> {:error, :invalid}
    end
  end

  defp adjacent?({ax, ay}, {bx, by}), do: abs(ax - bx) <= 1 and abs(ay - by) <= 1

  @doc """
  Bresenham line-of-sight from `from` to `to`. A tile that lies *on* the
  line counts as opaque if its env items include an unpassable item without
  `hasElevation`. We do not apply the corner-cut rule — a diagonal between
  two trees that is otherwise clear is allowed.
  """
  def line_of_sight?(from, to) do
    line_clear?(from, to)
  end

  defp line_clear?({x1, y1}, {x2, y2}) when {x1, y1} == {x2, y2}, do: true
  defp line_clear?({x1, y1}, {x2, y2}) do
    dx = abs(x2 - x1)
    sx = if x1 < x2, do: 1, else: -1
    dy = -abs(y2 - y1)
    sy = if y1 < y2, do: 1, else: -1
    err = dx + dy
    walk_los(x1, y1, x2, y2, sx, sy, dx, dy, err)
  end

  defp walk_los(x, y, x, y, _sx, _sy, _dx, _dy, _err), do: true
  defp walk_los(x0, y0, x1, y1, sx, sy, dx, dy, err) do
    e2 = 2 * err
    step_x? = e2 >= dy
    step_y? = e2 <= dx
    {nx, ny, new_err} =
      cond do
        step_x? and step_y? -> {x0 + sx, y0 + sy, err + dy + dx}
        step_x? -> {x0 + sx, y0, err + dy}
        step_y? -> {x0, y0 + sy, err + dx}
        true -> {x0, y0, err}
      end

    cond do
      {nx, ny} == {x1, y1} -> true
      blocks_los?({nx, ny}) -> false
      true -> walk_los(nx, ny, x1, y1, sx, sy, dx, dy, new_err)
    end
  end

  defp blocks_los?({x, y}) do
    case Cachex.get(:map, {x, y, 7}) do
      {:ok, %{items: items}} when is_list(items) ->
        Enum.any?(items, fn %{"id" => id} ->
          case Abyss.Items.get(id) do
            %{"isUnpassable" => true} = props -> props["hasElevation"] != true
            _ -> false
          end
        end)
      _ ->
        false
    end
  end

  defp movable?(%Abyss.Board.Item{item_id: item_id}) do
    case Abyss.Items.get(item_id) do
      nil -> true
      props -> props["isUnmoveable"] != true
    end
  end

  def move(user_id, direction) do
    user = Accounts.get_user!(user_id)
    base_move_time = round(100_000 / (2 * (user.speed - 1) + 180))
    # Diagonal steps cover sqrt(2) × the distance of a cardinal step, so they
    # cost twice the cooldown.
    move_time =
      if direction in [:nw, :ne, :sw, :se], do: base_move_time * 2, else: base_move_time

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

  def get_map_data(x, y, z) do
    for i <- (x - @map_range_x)..(x + @map_range_x), j <- (y - @map_range_y)..(y + @map_range_y) do
      {:ok, data} = Cachex.get(:map, {i, j, z})

      if data do
        Map.merge(data, %{x: i, y: j, z: z})
      else
        %{}
      end
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
