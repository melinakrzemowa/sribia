defmodule SribiaWeb.GameChannel do
  use SribiaWeb, :channel
  alias Sribia.Board

  def join("game:lobby", _payload, socket) do
    if authorized?(socket) do
      :ok = Board.join(socket.assigns[:user_id], {1, 1})
      Process.send_after(self(), {:joined, {1, 1}}, 0)
      {:ok, socket}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  def handle_info({:joined, {x, y}}, socket) do
    broadcast socket, "move", %{x: x, y: y, user_id: socket.assigns[:user_id]}
    {:noreply, socket}
  end

  # It is also common to receive messages from the client and
  # broadcast to everyone in the current topic (game:lobby).
  def handle_in("move", %{"direction" => direction}, socket) do
    direction = String.to_existing_atom(direction)
    case Board.move(socket.assigns[:user_id], direction) do
      {:ok, {x, y}} ->
        broadcast socket, "move", %{x: x, y: y, user_id: socket.assigns[:user_id]}
      {:error, {x, y}} ->
        broadcast socket, "move", %{x: x, y: y, user_id: socket.assigns[:user_id]}
    end
    {:noreply, socket}
  end

  # Add authorization logic here as required.
  defp authorized?(socket) do
    !!socket.assigns[:user_id]
  end
end
