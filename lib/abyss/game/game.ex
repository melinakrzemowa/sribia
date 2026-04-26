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

  def spawn_item({x, y} = position, item_id, count \\ 1) do
    if can_place_on_tile?(position) do
      with {:ok, item} <- Board.spawn_item(position, item_id, count) do
        AbyssWeb.Endpoint.broadcast("game:lobby", "item_object", %{
          instance_id: item.id,
          item_id: item.item_id,
          count: item.count,
          x: x,
          y: y
        })

        {:ok, item}
      end
    else
      {:error, :tile_blocked}
    end
  end

  @doc """
  Returns true if a movable item can be dropped on the tile at `{x, y}` on
  the game level (z = 7). The tile is rejected when any of its env (ground
  or items) is an unpassable, unmoveable surface without `hasElevation`
  (water, trees, walls), OR when there's a live Board item at that tile
  that itself blocks (e.g. a moved statue still rejects placement at its
  current position).
  """
  def can_place_on_tile?({_x, _y} = pos) do
    Abyss.Items.env_allows_placement?(pos) and not live_blocks_placement?(pos)
  end

  defp live_blocks_placement?({x, y}) do
    Enum.any?(Board.get_items({x, y}), &Abyss.Items.blocks?(&1.item_id))
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
         # Same rule as TFS: LOS is checked from the PLAYER's tile to the
         # destination, not from the item's source. The moving instance is
         # excluded from the LOS check — otherwise pushing a statue past
         # itself would be self-blocked.
         true <- line_of_sight?({user.x, user.y}, new_pos, ignore_item: instance_id) || {:error, :no_los},
         true <- movable?(item) || {:error, :unmoveable},
         true <- can_place_on_tile?(new_pos) || {:error, :tile_blocked} do
      Board.move_item(instance_id, new_pos)
    else
      nil -> {:error, :not_found}
      {:error, _reason} = err -> err
      false -> {:error, :invalid}
    end
  end

  @doc """
  Place an item into one of the player's equipment slots. The item can be
  picked up either from a tile (in which case the player must be adjacent
  to that tile and the item must be the top of its stack) or from another
  one of the player's slots.

  Slot ↔ slot moves are only allowed when the destination slot is empty —
  swaps are not supported. If the source is a tile and the destination slot
  already holds something, the previously equipped item is dropped on the
  source tile (i.e. it takes the spot the new item came from).
  """
  def equip_item(user_id, instance_id, slot) do
    with true <- Abyss.Equipment.valid_slot?(slot) || {:error, :invalid_slot},
         %Abyss.Board.Item{} = item <- Board.get_item(instance_id),
         true <- Abyss.Equipment.slot_accepts?(slot, item.item_id) || {:error, :wrong_slot},
         user <- Accounts.get_user!(user_id) do
      case Board.get_position(:item, instance_id) do
        nil -> equip_from_slot(user_id, item, slot)
        source_pos -> equip_from_ground(user_id, user, item, source_pos, slot)
      end
    else
      nil -> {:error, :not_found}
      {:error, _reason} = err -> err
      false -> {:error, :invalid}
    end
  end

  defp equip_from_ground(user_id, user, item, source_pos, slot) do
    with true <- adjacent?({user.x, user.y}, source_pos) || {:error, :too_far_from_source},
         true <- top_of_stack?(item.id, source_pos) || {:error, :not_top_of_stack} do
      {:ok, ^source_pos} = Board.detach_item(item.id)
      previous = Abyss.UserSession.set_equipment_slot(user_id, slot, item)

      if previous do
        # Displaced item lands on the tile the newly equipped one came from
        # so the visible "swap" reads naturally for the player.
        :ok = Board.place_item(previous.id, source_pos)
      end

      {:ok,
       %{
         equipped: item,
         slot: slot,
         source_pos: source_pos,
         displaced: previous,
         from_slot: nil,
         user_pos: {user.x, user.y}
       }}
    end
  end

  defp equip_from_slot(user_id, item, slot) do
    equipment = Abyss.UserSession.get_equipment(user_id)

    case Enum.find(equipment, fn {_s, i} -> i.id == item.id end) do
      nil ->
        {:error, :not_found}

      {^slot, _} ->
        # No-op: already in the target slot.
        {:ok,
         %{equipped: item, slot: slot, source_pos: nil, displaced: nil,
           from_slot: slot, user_pos: nil}}

      {from_slot, _} ->
        if Map.has_key?(equipment, slot) do
          {:error, :slot_occupied}
        else
          Abyss.UserSession.set_equipment_slot(user_id, from_slot, nil)
          Abyss.UserSession.set_equipment_slot(user_id, slot, item)

          {:ok,
           %{equipped: item, slot: slot, source_pos: nil, displaced: nil,
             from_slot: from_slot, user_pos: nil}}
        end
    end
  end

  @doc """
  Unequip the item in `slot` and place it on `dest_pos`. Same LOS / placement
  rules as `move_item`.
  """
  def unequip_item(user_id, slot, {_x, _y} = dest_pos) do
    with true <- Abyss.Equipment.valid_slot?(slot) || {:error, :invalid_slot},
         %Abyss.Board.Item{} = item <- Abyss.UserSession.get_equipment_slot(user_id, slot),
         user <- Accounts.get_user!(user_id),
         true <- line_of_sight?({user.x, user.y}, dest_pos) || {:error, :no_los},
         true <- can_place_on_tile?(dest_pos) || {:error, :tile_blocked} do
      Abyss.UserSession.set_equipment_slot(user_id, slot, nil)
      :ok = Board.place_item(item.id, dest_pos)
      {:ok, %{item: item, slot: slot, dest_pos: dest_pos}}
    else
      nil -> {:error, :empty_slot}
      {:error, _reason} = err -> err
      false -> {:error, :invalid}
    end
  end

  defp top_of_stack?(instance_id, pos) do
    case Board.get_items(pos) do
      [%Abyss.Board.Item{id: ^instance_id} | _] -> true
      _ -> false
    end
  end

  defp adjacent?({ax, ay}, {bx, by}), do: abs(ax - bx) <= 1 and abs(ay - by) <= 1

  @doc """
  Line-of-sight check matching the TFS server algorithm. Auto-clear when the
  endpoints are within 1 tile of each other; otherwise walk a slope-based
  DDA along the longer axis (steep when |dy| > |dx|, slight otherwise) and
  reject the move if any intermediate tile blocks projectiles.

  Pass `ignore_item: instance_id` to exclude a single Board item from
  consideration — used when pushing a blocking item (e.g. a statue) so it
  doesn't self-block its own LOS line.
  """
  def line_of_sight?(from, to, opts \\ [])

  def line_of_sight?({x1, y1} = from, {x2, y2} = to, opts) do
    cond do
      from == to -> true
      abs(x1 - x2) < 2 and abs(y1 - y2) < 2 -> true
      true -> check_sight_line(x1, y1, x2, y2, opts[:ignore_item])
    end
  end

  defp check_sight_line(x0, y0, x1, y1, ignore) do
    if abs(y1 - y0) > abs(x1 - x0) do
      if y1 > y0 do
        check_steep_line(y0, x0, y1, x1, ignore)
      else
        check_steep_line(y1, x1, y0, x0, ignore)
      end
    else
      if x0 > x1 do
        check_slight_line(x1, y1, x0, y0, ignore)
      else
        check_slight_line(x0, y0, x1, y1, ignore)
      end
    end
  end

  # Slight: |dx| >= |dy|. Iterate x; the line's y at each x is interpolated.
  defp check_slight_line(x0, y0, x1, y1, ignore) do
    dx = x1 - x0
    slope = if dx == 0, do: 1.0, else: (y1 - y0) / dx
    walk_slight(x0 + 1, x1, y0 + slope, slope, ignore)
  end

  defp walk_slight(x, x1, _yi, _slope, _ignore) when x >= x1, do: true
  defp walk_slight(x, x1, yi, slope, ignore) do
    if blocks_los?({x, trunc(yi + 0.1)}, ignore) do
      false
    else
      walk_slight(x + 1, x1, yi + slope, slope, ignore)
    end
  end

  # Steep: |dy| > |dx|. Iterate y (passed as the first arg) and interpolate x.
  defp check_steep_line(y0, x0, y1, x1, ignore) do
    dy = y1 - y0
    slope = if dy == 0, do: 1.0, else: (x1 - x0) / dy
    walk_steep(y0 + 1, y1, x0 + slope, slope, ignore)
  end

  defp walk_steep(y, y1, _xi, _slope, _ignore) when y >= y1, do: true
  defp walk_steep(y, y1, xi, slope, ignore) do
    if blocks_los?({trunc(xi + 0.1), y}, ignore) do
      false
    else
      walk_steep(y + 1, y1, xi + slope, slope, ignore)
    end
  end

  defp blocks_los?({_x, _y} = pos, ignore) do
    Abyss.Items.env_blocks_movement?(pos) or
      Enum.any?(Board.get_items(pos), fn item ->
        item.id != ignore and Abyss.Items.blocks?(item.item_id)
      end)
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
        data
        |> strip_loose_items()
        |> Map.merge(%{x: i, y: j, z: z})
      else
        %{}
      end
    end
  end

  # Items that have been promoted to live Board items must not be rendered
  # again on the client as static env decoration — drop them from the
  # `items` array of the cached tile before the payload is shipped.
  defp strip_loose_items(%{items: items} = tile) when is_list(items) do
    %{tile | items: Enum.reject(items, &Abyss.Items.loose?/1)}
  end

  defp strip_loose_items(tile), do: tile

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
