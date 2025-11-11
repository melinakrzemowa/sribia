defmodule Abyss.UserSessionSupervisorTest do
  use ExUnit.Case, async: false

  alias Abyss.{UserSession, UserSessionSupervisor}

  setup do
    IO.inspect(UserSessionSupervisor.list_sessions())

    # Generate unique user_id for each test
    user_id = System.unique_integer([:positive])
    {:ok, pid} = UserSessionSupervisor.start_session(user_id)

    on_exit(fn ->
      UserSessionSupervisor.stop_session(user_id)
    end)

    {:ok, user_id: user_id, pid: pid}
  end

  describe "start_session/1" do
    test "returns error if session already exists", %{user_id: user_id, pid: pid} do
      assert {:error, {:already_started, ^pid}} = UserSessionSupervisor.start_session(user_id)
    end

    test "can start multiple sessions for different users" do
      user_id1 = System.unique_integer([:positive])
      user_id2 = System.unique_integer([:positive])

      {:ok, pid1} = UserSessionSupervisor.start_session(user_id1)
      {:ok, pid2} = UserSessionSupervisor.start_session(user_id2)

      assert pid1 != pid2
      assert Process.alive?(pid1)
      assert Process.alive?(pid2)

      on_exit(fn ->
        UserSessionSupervisor.stop_session(user_id1)
        UserSessionSupervisor.stop_session(user_id2)
      end)
    end
  end

  describe "stop_session/1" do
    test "stops an existing session", %{user_id: user_id, pid: pid} do
      :ok = UserSessionSupervisor.stop_session(user_id)

      :timer.sleep(10)
      refute Process.alive?(pid)
    end

    test "handles stopping non-existent session gracefully" do
      assert :ok = UserSessionSupervisor.stop_session(System.unique_integer([:positive]))
    end
  end

  describe "list_sessions/0" do
    test "lists active sessions" do
      user_id1 = System.unique_integer([:positive])
      user_id2 = System.unique_integer([:positive])

      {:ok, _pid1} = UserSessionSupervisor.start_session(user_id1)
      {:ok, _pid2} = UserSessionSupervisor.start_session(user_id2)

      sessions = UserSessionSupervisor.list_sessions()
      assert length(sessions) == 3

      on_exit(fn ->
        UserSessionSupervisor.stop_session(user_id1)
        UserSessionSupervisor.stop_session(user_id2)
      end)
    end
  end

  describe "transient restart policy" do
    test "does not restart session after shutdown", %{user_id: user_id, pid: pid} do
      ref = Process.monitor(pid)
      GenServer.stop(pid, :shutdown)
      assert_receive {:DOWN, ^ref, :process, ^pid, :shutdown}, 1000

      :timer.sleep(100)

      assert UserSession.get_session(user_id) == nil
    end

    test "restarts session after abnormal exit", %{user_id: user_id, pid: pid} do
      ref = Process.monitor(pid)
      Process.exit(pid, :kill)
      assert_receive {:DOWN, ^ref, :process, ^pid, :killed}, 1000

      :timer.sleep(100)

      # Session should be restarted with new PID
      [{_, new_pid, _, _}] = UserSessionSupervisor.list_sessions()
      assert new_pid != nil
      assert new_pid != pid
      assert Process.alive?(new_pid)

      UserSessionSupervisor.stop_session(user_id)
    end
  end
end
