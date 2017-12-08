defmodule SribiaWeb.GameChannel do
  use SribiaWeb, :channel

  def join("game:lobby", _payload, socket) do
    if authorized?(socket) do
      {:ok, socket}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  # It is also common to receive messages from the client and
  # broadcast to everyone in the current topic (game:lobby).
  def handle_in("move", %{"x" => x, "y" => y}, socket) do
    broadcast socket, "move", %{x: x, y: y, user_id: socket.assigns[:user_id]}
    {:noreply, socket}
  end

  # Add authorization logic here as required.
  defp authorized?(socket) do
    !!socket.assigns[:user_id]
  end
end
