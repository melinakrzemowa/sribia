defmodule AbyssWeb.ChatChannel do
  use AbyssWeb, :channel

  def join("chat:lobby", _payload, socket) do
    if authorized?(socket) do
      {:ok, socket}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  # Channels can be used in a request/response fashion
  # by sending replies to requests from the client
  def handle_in("ping", payload, socket) do
    {:reply, {:ok, payload}, socket}
  end

  # It is also common to receive messages from the client and
  # broadcast to everyone in the current topic (chat:lobby).
  def handle_in("shout", %{"body" => body}, socket) do
    broadcast socket, "shout", %{body: body, user: socket.assigns[:user].name}
    {:noreply, socket}
  end

  # Add authorization logic here as required.
  defp authorized?(socket) do
    !!socket.assigns[:user_id]
  end
end
