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

    assert_broadcast "user_object", %{user_id: ^user_id, x: 32097, y: 32219}

    on_exit(fn ->
      Game.leave(user_id)
      UserSessionSupervisor.stop_session(user_id)
    end)

    {:ok, socket: socket, user: user}
  end

  test "moves on board", %{socket: socket, user: %{id: user_id}} do
    # Wait for move cooldown to expire after join (join sets last_move)
    Process.sleep(50)
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

  test "receives nearby players when moving into their range", %{socket: socket1} do
    # Create a second user positioned far away (outside the 8x8 field range)
    {:ok, user2} = Accounts.create_user(%{name: "player two", speed: 1000})
    # Position user2 at (32097, 32200) - 19 tiles away from user1's starting position (32097, 32219)
    {:ok, user2} = Accounts.update_user(user2, %{x: 32097, y: 32200})
    user2_id = user2.id

    # Join user2 to the channel
    {:ok, _, socket2} =
      UserSocket
      |> socket("user_id", %{user_id: user2.id})
      |> subscribe_and_join(GameChannel, "game:lobby")

    assert_broadcast "user_object", %{user_id: ^user2_id, x: 32097, y: 32200}

    # Move user1 north multiple times to get within visible range of user2
    # user1 starts at (32097, 32219), needs to move north to reach user2 at (32097, 32200)
    # Each move should decrease y by 1
    Enum.each(1..10, fn _ ->
      push(socket1, "move", %{"direction" => "n"})
      # Wait a bit for the move to process
      Process.sleep(10)
    end)

    # After moving 10 tiles north, user1 should be at (32097, 32209)
    # This is 9 tiles away from user2, which is within the 8x8 field range (16 tiles)
    # user1 should receive a user_object message about user2
    assert_push "user_object", %{user_id: ^user2_id, name: "player two", x: 32097, y: 32200}

    # Clean up
    Game.leave(user2.id)
    UserSessionSupervisor.stop_session(user2.id)
    leave(socket2)
  end
end
