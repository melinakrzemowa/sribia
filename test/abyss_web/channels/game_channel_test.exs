defmodule AbyssWeb.GameChannelTest do
  use AbyssWeb.ChannelCase, async: false

  alias Abyss.Accounts
  alias Abyss.Game
  alias Abyss.UserSession
  alias Abyss.UserSessionSupervisor
  alias AbyssWeb.GameChannel
  alias AbyssWeb.UserSocket

  setup do
    {:ok, user} = Accounts.create_user(%{name: "some name", speed: 1000})
    user_id = user.id

    {:ok, _, socket} =
      UserSocket
      |> socket("user_id", %{user_id: user.id})
      |> subscribe_and_join(GameChannel, "game:lobby")

    assert_broadcast "user_joined", %{user_id: ^user_id, x: 32097, y: 32219}

    on_exit(fn ->
      Game.leave(user_id)
      UserSessionSupervisor.stop_session(user_id)
    end)

    {:ok, socket: socket, user: user}
  end

  test "moves on board", %{socket: socket, user: %{id: user_id}} do
    push(socket, "move", %{"direction" => "s"})
    assert_broadcast "move", %{user_id: ^user_id, x: 32097, y: 32220}
  end

  test "registers connection in UserSession on join", %{user: user} do
    session_pid = UserSession.get_session(user.id)
    assert session_pid != nil
    assert Process.alive?(session_pid)
  end

  test "unregisters connection on leave", %{socket: socket, user: user} do
    session_pid = UserSession.get_session(user.id)
    assert Process.alive?(session_pid)

    leave(socket)

    # Session should still exist but with no connection
    assert Process.alive?(session_pid)
  end
end
