defmodule AbyssWeb.GameChannel do
  use AbyssWeb, :channel
  alias Abyss.Game

  def join("game:lobby", _payload, socket) do
    if authorized?(socket) do
      user = Game.join(socket.assigns[:user_id])
      Process.send_after(self(), {:joined, user}, 0)
      {:ok, socket}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  def handle_info({:joined, user}, socket) do
    push socket, "joined", %{user_id: user.id, name: user.name, speed: user.speed, x: user.x, y: user.y}
    broadcast socket, "move", %{x: user.x, y: user.y, user_id: socket.assigns[:user_id]}
    {:noreply, socket}
  end

  # It is also common to receive messages from the client and
  # broadcast to everyone in the current topic (game:lobby).
  def handle_in("move", %{"direction" => direction}, socket) do
    direction = String.to_existing_atom(direction)
    case Game.move(socket.assigns[:user_id], direction) do
      {:ok, {x, y}, move_time} ->
        broadcast socket, "move", %{x: x, y: y, user_id: socket.assigns[:user_id], move_time: move_time}
        {:noreply, socket}
      {:error, {x, y}} ->
        broadcast socket, "move", %{x: x, y: y, user_id: socket.assigns[:user_id]}
        push socket, "blocked", %{x: x, y: y}
        {:noreply, socket}
    end
  end

  # Add authorization logic here as required.
  defp authorized?(socket) do
    !!socket.assigns[:user_id]
  end
end
