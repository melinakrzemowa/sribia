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
  require Logger
  alias Abyss.Board.{Container, Directions, Moves}

  @starting_position {32097, 32219}
  # Game level on which loose items live in the static map.
  @map_z 7

  # CLIENT

  def start_link(_args \\ []) do
    GenServer.start_link(__MODULE__, Container.new(), name: __MODULE__)
  end

  def init(state) do
    # Re-seed loose items from the Cachex map on every (re)start. On the very
    # first boot Cachex is still empty when Board.init runs, so this is a
    # no-op then; Application.start triggers a reseed once MapLoader is done.
    {:ok, state, {:continue, :seed_map_items}}
  end

  @doc """
  Walk the Cachex map and (re-)spawn every loose item embedded in it as a
  real Board item. Skips items that are already represented as Board items
  on the same tile (so calling this multiple times is idempotent).
  """
  def reseed_from_cache do
    GenServer.cast(__MODULE__, :seed_map_items)
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

  def register_item(item_id, count \\ 1) do
    GenServer.call(__MODULE__, {:register_item, item_id, count})
  end

  def remove_item(id) do
    GenServer.call(__MODULE__, {:remove_item, id})
  end

  def place_item(id, position) do
    GenServer.call(__MODULE__, {:place_item, id, position})
  end

  def detach_item(id) do
    GenServer.call(__MODULE__, {:detach_item, id})
  end

  def get_items(position) do
    GenServer.call(__MODULE__, {:get_items, position})
  end

  def get_item(id) do
    GenServer.call(__MODULE__, {:get_item, id})
  end

  def move_item(id, new_pos) do
    GenServer.call(__MODULE__, {:move_item, id, new_pos})
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
    case Container.get_position(container, type, object) do
      nil ->
        # Object isn't tracked here. Probably the Board crashed and the
        # caller didn't re-register before issuing a move. Bail out instead
        # of crashing the GenServer (which would wipe everyone else's
        # state too).
        {:reply, {:error, :not_on_board}, container}

      position ->
        new_position = Moves.add(position, Directions.calc(direction))

        cond do
          # Static map blockers (water, trees, walls baked into the tileset)
          # — Container only knows live placements, so without this the server
          # silently accepts walks onto water.
          Abyss.Items.env_blocks_movement?(new_position) ->
            {:reply, {:error, position}, container}

          Container.blocks?(container, new_position) ->
            {:reply, {:error, position}, container}

          true ->
            container = Container.move(container, new_position, type, object)
            {:reply, {:ok, new_position}, container}
        end
    end
  end

  def handle_call({:get_fields, {x, y}, {range_x, range_y}}, _from, %Container{} = container) do
    fields =
      Enum.reduce(-range_x..range_x, %{}, fn i, a ->
        Enum.reduce(-range_y..range_y, a, fn j, acc ->
          field =
            container
            |> Container.get_field({x + i, y + j})
            |> resolve_items(container)

          Map.put(acc, {x + i, y + j}, field)
        end)
      end)

    {:reply, fields, container}
  end

  def handle_call({:spawn_item, position, item_id, count}, _from, %Container{} = container) do
    {item, container} = Container.add_item(container, item_id, count)
    container = Container.put(container, position, :item, item.id, Abyss.Items.blocks?(item_id))
    {:reply, {:ok, item}, container}
  end

  def handle_call({:register_item, item_id, count}, _from, %Container{} = container) do
    {item, container} = Container.add_item(container, item_id, count)
    {:reply, {:ok, item}, container}
  end

  def handle_call({:remove_item, id}, _from, %Container{} = container) do
    container =
      container
      |> Container.delete(:item, id)
      |> Container.remove_item(id)

    {:reply, :ok, container}
  end

  def handle_call({:place_item, id, position}, _from, %Container{} = container) do
    case Container.get_item(container, id) do
      nil ->
        {:reply, {:error, :not_found}, container}

      %{item_id: item_id} ->
        blocks = Abyss.Items.blocks?(item_id)
        container = Container.put(container, position, :item, id, blocks)
        {:reply, :ok, container}
    end
  end

  def handle_call({:detach_item, id}, _from, %Container{} = container) do
    case Container.get_item(container, id) do
      nil ->
        {:reply, {:error, :not_found}, container}

      _ ->
        old_pos = Container.get_position(container, :item, id)
        container = Container.delete(container, :item, id)
        {:reply, {:ok, old_pos}, container}
    end
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

  @doc """
  Move an item instance from its current tile to `new_pos`. Returns
  `{:ok, item, old_pos, new_pos}` on success or `{:error, reason}`.

  This call expects the caller to have validated:
    - the item exists on the board
    - it is the top of its source stack
    - the destination tile accepts placement
    - the user requesting the move can reach both tiles
  """
  def handle_call({:move_item, id, new_pos}, _from, %Container{} = container) do
    case Container.get_position(container, :item, id) do
      nil ->
        {:reply, {:error, :not_found}, container}

      old_pos ->
        # Top of stack = head of the field list since Container.put prepends.
        case Container.get_field(container, old_pos, :item) do
          [{{:item, ^id}, _blocks} | _] ->
            container = Container.move(container, new_pos, :item, id)
            item = Container.get_item(container, id)
            {:reply, {:ok, item, old_pos, new_pos}, container}

          _ ->
            {:reply, {:error, :not_top_of_stack}, container}
        end
    end
  end

  def handle_continue(:seed_map_items, %Container{} = container) do
    {:noreply, do_seed_map_items(container)}
  end

  def handle_cast(:seed_map_items, %Container{} = container) do
    {:noreply, do_seed_map_items(container)}
  end

  # Walk the Cachex map and spawn a fresh Item for every loose entry on each
  # tile that doesn't already have a Board item there. Pure container work
  # so we don't recurse through GenServer.call from inside our own process.
  defp do_seed_map_items(%Container{} = container) do
    initial_count = map_size(container.items)
    # Default Cachex.stream! returns entries with nil values; ask for {key, value}.
    query = Cachex.Query.build(output: {:key, :value})

    new_container =
      :map
      |> Cachex.stream!(query)
      |> Enum.reduce(container, fn
        {{x, y, @map_z}, value}, acc -> seed_tile(acc, {x, y}, value)
        _, acc -> acc
      end)

    spawned = map_size(new_container.items) - initial_count

    if spawned > 0 do
      Logger.info("Board: seeded #{spawned} loose map items")
    end

    new_container
  end

  defp seed_tile(container, pos, %{items: items}) when is_list(items) do
    # Only seed if the tile has no Board items yet — keeps the operation
    # idempotent so a manual reseed during dev / a Board crash recovery
    # don't double-spawn.
    case Container.get_field(container, pos, :item) do
      [] ->
        Enum.reduce(items, container, fn item_def, acc ->
          if Abyss.Items.loose?(item_def) do
            {item, acc} = Container.add_item(acc, item_def["id"], 1)
            Container.put(acc, pos, :item, item.id, Abyss.Items.blocks?(item_def))
          else
            acc
          end
        end)

      _ ->
        container
    end
  end

  defp seed_tile(container, _pos, _value), do: container

  # Replace `{{:item, id}, _blocks}` entries in a field list with the live
  # `%Item{}` so the caller doesn't have to follow up with N additional
  # `Board.get_item/1` GenServer calls (one per item in the field). The
  # container is local state here so the lookup is just a Map fetch.
  defp resolve_items(field, container) do
    Enum.flat_map(field, fn
      {{:item, id}, _blocks} ->
        case Container.get_item(container, id) do
          nil -> []
          item -> [item]
        end

      other ->
        [other]
    end)
  end
end
