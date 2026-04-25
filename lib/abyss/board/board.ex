defmodule Abyss.Board do
  @moduledoc """
  In state - board holds info about objects on board
  [
    {:user, user_id},
    {:monster, pid},
    {:object, object_id}
  ]
  """
  use GenServer
  alias Abyss.Board.{Container, Directions, Moves}

  @starting_position {32097, 32219}

  # CLIENT

  def start_link(_args \\ []) do
    GenServer.start_link(__MODULE__, Container.new(), name: __MODULE__)
  end

  def init(state) do
    {:ok, state}
  end

  def get_position(type, object) do
    GenServer.call(__MODULE__, {:get_position, type, object})
  end

  def add(position, type, object, blocks) do
    GenServer.call(__MODULE__, {:add, position, type, object, blocks})
  end

  def add_user(position, user_id) do
    GenServer.call(__MODULE__, {:add_user, position, user_id})
  end

  def delete(type, object) do
    GenServer.call(__MODULE__, {:delete, type, object})
  end

  def move(type, object, direction) do
    GenServer.call(__MODULE__, {:move, type, object, direction})
  end

  def get_fields(position, range) do
    GenServer.call(__MODULE__, {:get_fields, position, range})
  end

  def spawn_item(position, item_id, count \\ 1) do
    GenServer.call(__MODULE__, {:spawn_item, position, item_id, count})
  end

  def get_items(position) do
    GenServer.call(__MODULE__, {:get_items, position})
  end

  def get_item(id) do
    GenServer.call(__MODULE__, {:get_item, id})
  end

  # SERVER

  def handle_call({:get_position, type, object}, _from, %Container{} = container) do
    {:reply, Container.get_position(container, type, object), container}
  end

  def handle_call({:add_user, position, user_id}, _from, %Container{} = container) do
    position =
      case Container.get_free_spot(container, position, :user, user_id) do
        nil -> @starting_position
        position -> position
      end

    container = Container.put(container, position, :user, user_id, true)
    {:reply, {:ok, position}, container}
  end

  def handle_call({:add, position, type, object, blocks}, _from, %Container{} = container) do
    container = Container.put(container, position, type, object, blocks)
    {:reply, {:ok, position}, container}
  end

  def handle_call({:delete, type, object}, _from, %Container{} = container) do
    container = Container.delete(container, type, object)
    {:reply, :ok, container}
  end

  def handle_call({:move, type, object, direction}, _from, %Container{} = container) do
    position = Container.get_position(container, type, object)
    new_position = Moves.add(position, Directions.calc(direction))

    if Container.blocks?(container, new_position) do
      {:reply, {:error, position}, container}
    else
      container = Container.move(container, new_position, type, object)
      {:reply, {:ok, new_position}, container}
    end
  end

  def handle_call({:get_fields, {x, y}, {range_x, range_y}}, _from, %Container{} = container) do
    fields =
      Enum.reduce(-range_x..range_x, %{}, fn i, a ->
        Enum.reduce(-range_y..range_y, a, fn j, acc ->
          field = Container.get_field(container, {x + i, y + j})
          Map.put(acc, {x + i, y + j}, field)
        end)
      end)

    {:reply, fields, container}
  end

  def handle_call({:spawn_item, position, item_id, count}, _from, %Container{} = container) do
    {item, container} = Container.add_item(container, item_id, count)
    container = Container.put(container, position, :item, item.id, false)
    {:reply, {:ok, item}, container}
  end

  def handle_call({:get_items, pos}, _from, %Container{} = container) do
    instances =
      Container.get_field(container, pos, :item)
      |> Enum.map(fn {{:item, id}, _blocks} -> Container.get_item(container, id) end)

    {:reply, instances, container}
  end

  def handle_call({:get_item, id}, _from, %Container{} = container) do
    {:reply, Container.get_item(container, id), container}
  end
end
