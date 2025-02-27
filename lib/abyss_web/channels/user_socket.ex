defmodule AbyssWeb.UserSocket do
  use Phoenix.Socket

  ## Channels
  channel "chat:*", AbyssWeb.ChatChannel
  channel "game:lobby", AbyssWeb.GameChannel

  # Socket params are passed from the client and can
  # be used to verify and authenticate a user. After
  # verification, you can put default assigns into
  # the socket that will be set for all channels, ie
  #
  #     {:ok, assign(socket, :user_id, verified_user_id)}
  #
  # To deny connection, return `:error`.
  #
  # See `Phoenix.Token` documentation for examples in
  # performing token verification on connect.
  def connect(%{"token" => token}, socket) do
    # max_age: 1209600 is equivalent to two weeks in seconds
    case Phoenix.Token.verify(socket, "user token", token, max_age: 1_209_600) do
      {:ok, user_id} ->
        socket =
          socket
          |> assign(:user_id, user_id)
          |> assign(:user, Abyss.Accounts.get_user!(user_id))

        {:ok, socket}

      {:error, _reason} ->
        :error
    end
  end

  # Socket id's are topics that allow you to identify all sockets for a given user:
  #
  #     def id(socket), do: "user_socket:#{socket.assigns.user_id}"
  #
  # Would allow you to broadcast a "disconnect" event and terminate
  # all active sockets and channels for a given user:
  #
  #     AbyssWeb.Endpoint.broadcast("user_socket:#{user.id}", "disconnect", %{})
  #
  # Returning `nil` makes this socket anonymous.
  def id(socket), do: "user_socket:#{socket.assigns[:user_id]}"
end
