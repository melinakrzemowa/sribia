defmodule AbyssWeb.UserSocketTest do
  use AbyssWeb.ChannelCase, async: false

  alias Abyss.Accounts
  alias AbyssWeb.UserSocket

  test "accepts a token signed for an existing user" do
    {:ok, user} = Accounts.create_user(%{name: "socket user", speed: 1000})
    token = Phoenix.Token.sign(@endpoint, "user token", user.id)

    assert {:ok, socket} = connect(UserSocket, %{"token" => token})
    assert socket.assigns.user_id == user.id
    assert socket.assigns.user.id == user.id
  end

  test "refuses an invalid token" do
    assert :error = connect(UserSocket, %{"token" => "garbage"})
  end

  test "refuses a connection without a token" do
    assert :error = connect(UserSocket, %{})
  end
end
