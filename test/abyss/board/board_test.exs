defmodule Abyss.Board.BoardTest do
  use ExUnit.Case
  alias Abyss.{Board, Board.Container}

  setup do
    container =
      Container.new()
      |> Container.put({1, 1}, :user, 1, true)
      |> Container.put({1, 2}, :user, 2, true)
      |> Container.put({1, 3}, :user, 3, true)
      |> Container.put({2, 1}, :object, 1, false)
      |> Container.put({2, 2}, :object, 2, false)
      |> Container.put({2, 3}, :object, 3, false)
      |> Container.put({3, 1}, :monster, 1, true)
      |> Container.put({3, 2}, :monster, 2, true)
      |> Container.put({3, 3}, :monster, 3, true)

    %{state: container}
  end

  test "gets position", %{state: state} do
    assert {:reply, {1, 1}, state} == Board.handle_call({:get_position, :user, 1}, self(), state)
    assert {:reply, {2, 1}, state} == Board.handle_call({:get_position, :object, 1}, self(), state)
    assert {:reply, {3, 1}, state} == Board.handle_call({:get_position, :monster, 1}, self(), state)
    assert {:reply, nil, state} == Board.handle_call({:get_position, :test, 1}, self(), state)
  end

  test "adds user", %{state: state} do
    # empty spot
    {:reply, {:ok, {0, 0}}, _new_state} = Board.handle_call({:add_user, {0, 0}, 4}, self(), state)
    # spot taken
    {:reply, {:ok, {1, 0}}, _new_state} = Board.handle_call({:add_user, {1, 1}, 4}, self(), state)
  end

  test "adds something to board", %{state: state} do
    {:reply, {:ok, {1, 1}}, _new_state} = Board.handle_call({:add, {1, 1}, :object, 4, false}, self(), state)
  end

  test "deletes from board", %{state: state} do
    {:reply, :ok, new_state} = Board.handle_call({:delete, :object, 3}, self(), state)
    assert [] == Container.get_field(new_state, {2, 3})
  end

  test "moves user", %{state: state} do
    {:reply, {:ok, {2, 1}}, state} = Board.handle_call({:move, :user, 1, :e}, self(), state)
    {:reply, {:error, {2, 1}}, state} = Board.handle_call({:move, :user, 1, :e}, self(), state)
    {:reply, {:ok, {2, 2}}, state} = Board.handle_call({:move, :user, 1, :s}, self(), state)
    {:reply, {:ok, {2, 3}}, state} = Board.handle_call({:move, :user, 1, :s}, self(), state)
    {:reply, {:error, {2, 3}}, _state} = Board.handle_call({:move, :user, 1, :w}, self(), state)
  end

  test "gets fields", %{state: state} do
    {:reply, fields, _state} = Board.handle_call({:get_fields, {2, 2}, 1}, self(), state)

    assert %{
             {1, 1} => [{{:user, 1}, true}],
             {1, 2} => [{{:user, 2}, true}],
             {1, 3} => [{{:user, 3}, true}],
             {2, 1} => [{{:object, 1}, false}],
             {2, 2} => [{{:object, 2}, false}],
             {2, 3} => [{{:object, 3}, false}],
             {3, 1} => [{{:monster, 1}, true}],
             {3, 2} => [{{:monster, 2}, true}],
             {3, 3} => [{{:monster, 3}, true}]
           } == fields
  end
end
