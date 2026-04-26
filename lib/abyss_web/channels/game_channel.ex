defmodule AbyssWeb.GameChannel do
  use AbyssWeb, :channel
  require Logger
  alias Abyss.Game
  alias Abyss.UserSession
  alias Abyss.Accounts.User
  alias Abyss.Board.Item

  def join("game:lobby", _payload, socket) do
    if authorized?(socket) do
      case UserSession.register_connection(socket.assigns[:user_id], self()) do
        {:ok, :replaced_session} ->
          Logger.info("User #{socket.assigns[:user_id]} connected from new client, disconnecting old client")

        {:ok, _} ->
          :ok

        error ->
          Logger.error("Failed to register user session: #{inspect(error)}")
      end

      user = Game.join(socket.assigns[:user_id])
      Process.send_after(self(), {:joined, user}, 0)
      {:ok, socket}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  def handle_info({:joined, user}, socket) do
    push(socket, "joined", user_payload(user))
    broadcast(socket, "user_object", user_payload(user))

    map_data = Game.get_map_data(user.x, user.y, 7)
    push(socket, "map_data", %{map: map_data})

    # Server stores items with the newest at the HEAD of each field list
    # (Container.put prepends). Reverse so the client receives oldest first
    # and ends up with the newest as the LAST element of `tile.items`,
    # matching the frontend convention that `items[length-1]` is the top
    # of the stack.
    Enum.each(Game.get_fields({user.x, user.y}), fn {position, list} ->
      Enum.each(Enum.reverse(list), fn object ->
        push_object(socket, position, object)
      end)
    end)

    push(socket, "equipment", equipment_payload(user.id))

    {:noreply, socket}
  end

  def handle_info(:force_disconnect, socket) do
    push(socket, "force_disconnect", %{
      reason: "You have been disconnected because you connected from another client"
    })

    # Mark this socket as force disconnected so terminate knows not to remove from board
    socket = assign(socket, :force_disconnected, true)

    # Close the socket connection
    {:stop, :normal, socket}
  end

  defp push_object(socket, _position, %User{} = user) do
    if socket.assigns[:user_id] != user.id do
      push(socket, "user_object", user_payload(user))
    end
  end

  defp push_object(socket, position, %Item{} = item) do
    push(socket, "item_object", item_payload(item, position))
  end

  defp push_object(_socket, _pos, _object), do: :ok

  defp user_payload(%User{} = user) do
    %{
      user_id: user.id,
      name: user.name,
      speed: user.speed,
      x: user.x,
      y: user.y,
      health: user.health,
      max_health: user.max_health
    }
  end

  defp item_payload(%Item{} = item, {x, y}) do
    %{instance_id: item.id, item_id: item.item_id, count: item.count, x: x, y: y}
  end

  def handle_in("move_item", %{"instance_id" => id, "x" => x, "y" => y}, socket) do
    user_id = socket.assigns[:user_id]

    case Game.move_item(user_id, id, {x, y}) do
      {:ok, item, {old_x, old_y}, {new_x, new_y}} ->
        broadcast(socket, "item_removed", %{instance_id: item.id, x: old_x, y: old_y})
        broadcast(socket, "item_object", item_payload(item, {new_x, new_y}))
        {:reply, :ok, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: to_string(reason)}}, socket}
    end
  end

  def handle_in("equip_item", %{"instance_id" => id, "slot" => slot_str}, socket) do
    user_id = socket.assigns[:user_id]

    with slot when is_atom(slot) <- safe_slot(slot_str),
         {:ok, result} <- Game.equip_item(user_id, id, slot) do
      case result do
        %{from_slot: from_slot} when not is_nil(from_slot) ->
          # Slot → slot move: nothing on the world changed, just push the
          # updated equipment map back to the player.
          push(socket, "equipment", equipment_payload(user_id))
          {:reply, :ok, socket}

        %{equipped: item, source_pos: {sx, sy}, displaced: displaced} ->
          broadcast(socket, "item_removed", %{instance_id: item.id, x: sx, y: sy})

          if displaced do
            # Displaced item drops on the tile the new one came from.
            broadcast(socket, "item_object", item_payload(displaced, {sx, sy}))
          end

          push(socket, "equipment", equipment_payload(user_id))
          {:reply, :ok, socket}
      end
    else
      nil -> {:reply, {:error, %{reason: "invalid_slot"}}, socket}
      {:error, reason} -> {:reply, {:error, %{reason: to_string(reason)}}, socket}
    end
  end

  def handle_in("unequip_item", %{"slot" => slot_str, "x" => x, "y" => y}, socket) do
    user_id = socket.assigns[:user_id]

    with slot when is_atom(slot) <- safe_slot(slot_str),
         {:ok, %{item: item, dest_pos: {dx, dy}}} <- Game.unequip_item(user_id, slot, {x, y}) do
      broadcast(socket, "item_object", item_payload(item, {dx, dy}))
      push(socket, "equipment", equipment_payload(user_id))
      {:reply, :ok, socket}
    else
      nil -> {:reply, {:error, %{reason: "invalid_slot"}}, socket}
      {:error, reason} -> {:reply, {:error, %{reason: to_string(reason)}}, socket}
    end
  end

  # It is also common to receive messages from the client and
  # broadcast to everyone in the current topic (game:lobby).
  def handle_in("move", %{"direction" => direction}, socket) do
    direction = String.to_existing_atom(direction)

    case Game.move(socket.assigns[:user_id], direction) do
      {:ok, {x, y}, move_time} ->
        # Only ship the leading-edge tiles that just entered view, instead
        # of re-pushing the full 17×17 visible window every step.
        {dx, dy} = Abyss.Board.Directions.calc(direction)
        positions = Game.newly_visible_tiles({x - dx, y - dy}, {x, y})
        push_visible_diff(socket, positions, {x, y})

        broadcast(socket, "move", %{x: x, y: y, user_id: socket.assigns[:user_id], move_time: move_time})
        {:noreply, socket}

      {:error, {x, y}} ->
        broadcast(socket, "move", %{x: x, y: y, user_id: socket.assigns[:user_id]})
        push(socket, "blocked", %{x: x, y: y})
        {:noreply, socket}
    end
  end

  defp push_visible_diff(_socket, [], _around), do: :ok

  defp push_visible_diff(socket, positions, around) do
    map_data = Game.get_map_data_for(positions, 7)
    if map_data != [], do: push(socket, "map_data", %{map: map_data})

    Enum.each(Game.get_fields_for(positions, around), fn {position, list} ->
      # Same convention as the initial join: server stores newest at the
      # head of the field list (Container.put prepends), but the client
      # treats `items[length-1]` as the top of the stack — reverse so the
      # last push lands as the topmost item.
      Enum.each(Enum.reverse(list), fn object ->
        push_object(socket, position, object)
      end)
    end)
  end

  defp safe_slot(slot_str) when is_binary(slot_str) do
    try do
      atom = String.to_existing_atom(slot_str)
      if Abyss.Equipment.valid_slot?(atom), do: atom, else: nil
    rescue
      ArgumentError -> nil
    end
  end

  defp safe_slot(_), do: nil

  defp equipment_payload(user_id) do
    equipment = Abyss.UserSession.get_equipment(user_id)

    slots =
      Map.new(equipment, fn {slot, %Item{id: id, item_id: item_id, count: count}} ->
        {slot, %{instance_id: id, item_id: item_id, count: count}}
      end)

    %{slots: slots}
  end

  intercept ["user_object"]

  def handle_out("user_object", msg, socket) do
    if socket.assigns[:user_id] == msg.user_id do
      {:noreply, socket}
    else
      push(socket, "user_object", msg)
      {:noreply, socket}
    end
  end

  # Handle channel termination (disconnect)
  def terminate(_reason, socket) do
    if socket.assigns[:user_id] do
      # Only remove user from board and broadcast if this is a regular disconnect
      unless socket.assigns[:force_disconnected] do
        Game.leave(socket.assigns[:user_id])
        UserSession.unregister_connection(socket.assigns[:user_id], self())
        broadcast(socket, "user_left", %{user_id: socket.assigns[:user_id]})
      end
    end

    :ok
  end

  # Add authorization logic here as required.
  defp authorized?(socket) do
    !!socket.assigns[:user_id]
  end
end
