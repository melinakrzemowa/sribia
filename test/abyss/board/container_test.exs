defmodule Abyss.Board.ContainerTest do
  use ExUnit.Case
  alias Abyss.Board.Container

  setup do
    %{container: Container.new}
  end

  test "blocks?", %{container: container} do
    refute Container.blocks?(container, {1, 1})
    container = Container.put(container, {1, 1}, :user, 2, true)
    assert Container.blocks?(container, {1, 1})
  end

  test "doesn't block if fields not blocking", %{container: container} do
    container = Container.put(container, {1, 1}, :object, 2, false)
    container = Container.put(container, {1, 1}, :object, 3, false)
    refute Container.blocks?(container, {1, 1})
  end

  test "blocks if just one fields blocking", %{container: container} do
    container = Container.put(container, {1, 1}, :object, 2, false)
    container = Container.put(container, {1, 1}, :user, 2, true)
    container = Container.put(container, {1, 1}, :object, 3, false)
    assert Container.blocks?(container, {1, 1})
  end

  test "gets position", %{container: container} do
    assert nil == Container.get_position(container, :user, 2)
    container = Container.put(container, {1, 1}, :user, 2, true)
    assert {1, 1} == Container.get_position(container, :user, 2)
  end

  test "gets field", %{container: container} do
    assert [] == Container.get_field(container, {1, 1})
    container = Container.put(container, {1, 1}, :user, 2, true)
    assert [{:user, 2}] == Container.get_field(container, {1, 1})
  end

  test "gets field of type", %{container: container} do
    container = Container.put(container, {1, 1}, :user, 2, true)
    container = Container.put(container, {1, 1}, :user, 3, true)
    container = Container.put(container, {1, 1}, :monster, 2, true)
    container = Container.put(container, {1, 1}, :object, 2, true)
    assert [{:user, 3}, {:user, 2}] == Container.get_field(container, {1, 1}, :user)
    assert [{:monster, 2}] == Container.get_field(container, {1, 1}, :monster)
    assert [{:object, 2}] == Container.get_field(container, {1, 1}, :object)
  end

  test "puts into container", %{container: container} do
    container = Container.put(container, {1, 1}, :user, 2, true)
    assert container == %Container{
      details: %{{:user, 2} => {1, 1}},
      fields: %{{1, 1} => [{{:user, 2}, true}]}
    }
  end

  test "deletes from container", %{container: container} do
    container =
      container
      |> Container.put({1, 1}, :user, 2, true)
      |> Container.delete({1, 1}, :user, 2)

    assert container.details == %{}
    assert container.fields == %{}
  end

  test "moves in container", %{container: container} do
    container =
      container
      |> Container.put({1, 1}, :user, 2, true)
      |> Container.move({1, 2}, :user, 2)

    assert container.details == %{{:user, 2} => {1, 2}}
    assert container.fields == %{{1, 2} => [{{:user, 2}, true}]}
  end

end
