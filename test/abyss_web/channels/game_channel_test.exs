defmodule AbyssWeb.GameChannelTest do
  use AbyssWeb.ChannelCase

  alias Abyss.Accounts
  alias AbyssWeb.GameChannel

  setup do
    {:ok, user} = Accounts.create_user(%{name: "some name", speed: 1000})
    user_id = user.id

    {:ok, _, socket} =
      socket("user_id", %{user_id: user.id})
      |> subscribe_and_join(GameChannel, "game:lobby")

    assert_broadcast "user_joined", %{user_id: ^user_id, x: 1, y: 1}

    {:ok, socket: socket, user: user}
  end

  test "moves on board", %{socket: socket, user: %{id: user_id}} do
    push socket, "move", %{"direction" => "s"}
    assert_broadcast "move", %{user_id: ^user_id, x: 1, y: 2}
  end
end
