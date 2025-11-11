defmodule AbyssWeb.GameChannel do
  use AbyssWeb, :channel
  require Logger
  alias Abyss.Game
  alias Abyss.UserSession
  alias Abyss.Accounts.User

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
    push(socket, "joined", %{user_id: user.id, name: user.name, speed: user.speed, x: user.x, y: user.y})
    broadcast(socket, "user_object", %{user_id: user.id, name: user.name, speed: user.speed, x: user.x, y: user.y})

    map_data = Game.get_map_data(user.x, user.y, 7)
    push(socket, "map_data", %{map: map_data})

    Enum.each(Game.get_fields({user.x, user.y}), fn {position, list} ->
      Enum.each(list, fn object ->
        push_object(socket, position, object)
      end)
    end)

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
      push(socket, "user_object", %{user_id: user.id, name: user.name, speed: user.speed, x: user.x, y: user.y})
    end
  end

  defp push_object(_socket, _pos, _object), do: :ok

  # It is also common to receive messages from the client and
  # broadcast to everyone in the current topic (game:lobby).
  def handle_in("move", %{"direction" => direction}, socket) do
    direction = String.to_existing_atom(direction)

    case Game.move(socket.assigns[:user_id], direction) do
      {:ok, {x, y}, move_time} ->
        map_data = Game.get_map_data(x, y, 7)
        push(socket, "map_data", %{map: map_data})

        Enum.each(Game.get_fields({x, y}), fn {position, list} ->
          Enum.each(list, fn object ->
            push_object(socket, position, object)
          end)
        end)

        broadcast(socket, "move", %{x: x, y: y, user_id: socket.assigns[:user_id], move_time: move_time})
        {:noreply, socket}

      {:error, {x, y}} ->
        broadcast(socket, "move", %{x: x, y: y, user_id: socket.assigns[:user_id]})
        push(socket, "blocked", %{x: x, y: y})
        {:noreply, socket}
    end
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
