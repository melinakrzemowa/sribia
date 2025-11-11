defmodule Abyss.UserSessionTest do
  use ExUnit.Case, async: false

  alias Abyss.UserSession

  setup do
    # Generate unique user_id for each test to avoid conflicts
    user_id = System.unique_integer([:positive])
    {:ok, pid} = UserSession.start_link(user_id)

    on_exit(fn ->
      if Process.alive?(pid) do
        GenServer.stop(pid, :shutdown)
      end
    end)

    {:ok, user_id: user_id, pid: pid}
  end

  describe "session lifecycle" do
    test "stops cleanly with shutdown reason", %{pid: pid} do
      # Trap exits to handle shutdown gracefully
      Process.flag(:trap_exit, true)

      ref = Process.monitor(pid)
      GenServer.stop(pid, :shutdown)

      assert_receive {:DOWN, ^ref, :process, ^pid, :shutdown}, 1000
    end
  end

  describe "connection management" do
    test "registers a new channel connection", %{user_id: user_id} do
      channel_pid = spawn(fn -> :timer.sleep(5000) end)

      assert {:ok, :new_session} = UserSession.register_connection(user_id, channel_pid)
    end

    test "returns already_registered for same PID", %{user_id: user_id} do
      channel_pid = spawn(fn -> :timer.sleep(5000) end)

      {:ok, :new_session} = UserSession.register_connection(user_id, channel_pid)
      {:ok, :already_registered} = UserSession.register_connection(user_id, channel_pid)
    end

    test "replaces old connection with new one", %{user_id: user_id} do
      old_channel_pid =
        spawn(fn ->
          receive do
            :force_disconnect -> :ok
          after
            5000 -> :ok
          end
        end)

      new_channel_pid = spawn(fn -> :timer.sleep(5000) end)

      {:ok, :new_session} = UserSession.register_connection(user_id, old_channel_pid)
      {:ok, :replaced_session} = UserSession.register_connection(user_id, new_channel_pid)

      # Old channel should receive force_disconnect
      :timer.sleep(10)
      refute Process.alive?(old_channel_pid)
    end

    test "doesn't crash if old PID is already dead", %{user_id: user_id} do
      old_channel_pid = spawn(fn -> :ok end)

      :timer.sleep(10)
      refute Process.alive?(old_channel_pid)

      new_channel_pid = spawn(fn -> :timer.sleep(5000) end)

      # Should handle dead PID gracefully - registers as new since old PID is gone
      {:ok, :new_session} = UserSession.register_connection(user_id, new_channel_pid)
    end
  end

  describe "disconnection handling" do
    test "unregisters connection", %{user_id: user_id} do
      channel_pid = spawn(fn -> :timer.sleep(5000) end)

      {:ok, :new_session} = UserSession.register_connection(user_id, channel_pid)
      :ok = UserSession.unregister_connection(user_id, channel_pid)
    end

    test "schedules cleanup after disconnection", %{user_id: user_id, pid: pid} do
      # Trap exits to handle shutdown gracefully
      Process.flag(:trap_exit, true)

      channel_pid = spawn(fn -> :timer.sleep(5000) end)

      {:ok, :new_session} = UserSession.register_connection(user_id, channel_pid)
      :ok = UserSession.unregister_connection(user_id, channel_pid)

      # Session should still be alive
      assert Process.alive?(pid)

      ref = Process.monitor(pid)
      assert_receive {:DOWN, ^ref, :process, ^pid, :shutdown}, 1500
    end

    test "cancels cleanup if reconnected", %{user_id: user_id, pid: pid} do
      channel_pid = spawn(fn -> :timer.sleep(5000) end)

      {:ok, :new_session} = UserSession.register_connection(user_id, channel_pid)
      :ok = UserSession.unregister_connection(user_id, channel_pid)

      new_channel_pid = spawn(fn -> :timer.sleep(5000) end)
      {:ok, :new_session} = UserSession.register_connection(user_id, new_channel_pid)

      :timer.sleep(1500)

      assert Process.alive?(pid)
    end

    test "ignores unregister from wrong PID", %{user_id: user_id, pid: pid} do
      real_channel_pid = spawn(fn -> :timer.sleep(5000) end)
      wrong_channel_pid = spawn(fn -> :timer.sleep(5000) end)

      {:ok, :new_session} = UserSession.register_connection(user_id, real_channel_pid)

      :ok = UserSession.unregister_connection(user_id, wrong_channel_pid)

      Process.sleep(1500)

      assert Process.alive?(pid)
    end

    test "detects and clears dead channel PID", %{user_id: user_id, pid: pid} do
      # Trap exits to handle shutdown gracefully
      Process.flag(:trap_exit, true)

      channel_pid = spawn(fn -> :ok end)
      {:ok, :new_session} = UserSession.register_connection(user_id, channel_pid)

      :timer.sleep(10)
      refute Process.alive?(channel_pid)

      :ok = UserSession.unregister_connection(user_id, channel_pid)

      Process.sleep(1500)

      refute Process.alive?(pid)
    end
  end
end
