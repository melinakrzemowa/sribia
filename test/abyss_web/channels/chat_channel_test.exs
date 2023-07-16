defmodule AbyssWeb.ChatChannelTest do
  use AbyssWeb.ChannelCase

  alias Abyss.Accounts
  alias AbyssWeb.ChatChannel
  alias AbyssWeb.UserSocket

  setup do
    {:ok, user} = Accounts.create_user(%{name: "some name"})

    {:ok, _, socket} =
      UserSocket
      |> socket("user_id", %{user_id: user.id, user: user})
      |> subscribe_and_join(ChatChannel, "chat:lobby")

    {:ok, socket: socket}
  end

  test "ping replies with status ok", %{socket: socket} do
    ref = push(socket, "ping", %{"hello" => "there"})
    assert_reply ref, :ok, %{"hello" => "there"}
  end

  test "shout broadcasts to chat:lobby", %{socket: socket} do
    push(socket, "shout", %{"body" => "hello"})
    assert_broadcast "shout", %{body: "hello", user: "some name"}
  end

  test "broadcasts are pushed to the client", %{socket: socket} do
    broadcast_from!(socket, "broadcast", %{"some" => "data"})
    assert_push "broadcast", %{"some" => "data"}
  end
end
