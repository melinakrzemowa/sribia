defmodule SribiaWeb.GameChannel do
  use SribiaWeb, :channel
  alias Sribia.Game

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
    push socket, "stats", %{name: user.name, speed: user.speed}
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
        {:reply, {:ok, %{result: :moved}}, socket}
      {:error, {x, y}} ->
        broadcast socket, "move", %{x: x, y: y, user_id: socket.assigns[:user_id]}
        {:reply, {:ok, %{result: :blocked}}, socket}
      {:error, :too_early} ->
        {:reply, {:ok, %{result: :too_early}}, socket}
    end
  end

  # Add authorization logic here as required.
  defp authorized?(socket) do
    !!socket.assigns[:user_id]
  end
end
