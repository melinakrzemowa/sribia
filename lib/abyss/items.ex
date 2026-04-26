defmodule Abyss.Items do
  @moduledoc """
  In-memory registry of every item definition from `priv/items.json`.

  Backed by an ETS table so reads are concurrent and non-copying. The full
  raw definition is kept (including fields we don't currently use) so future
  rules / properties can be added without touching the loader.
  """
  use GenServer

  @table :abyss_items

  def start_link(_), do: GenServer.start_link(__MODULE__, nil, name: __MODULE__)

  @doc "Look up an item definition by integer or string id."
  def get(id) when is_integer(id), do: get(Integer.to_string(id))
  def get(id) when is_binary(id) do
    case :ets.lookup(@table, id) do
      [{_, props}] -> props
      [] -> nil
    end
  end

  @doc """
  Returns true if a movable item can be dropped on the given tile.

  Tiles with an environment item that is unmoveable + unpassable but not
  `hasElevation` (e.g. trees, walls) reject placement. Tables and similar
  surfaces have `hasElevation` set, so they accept placement.
  """
  def can_place_on?(env_items) when is_list(env_items) do
    Enum.all?(env_items, &allows_placement?/1)
  end

  @doc """
  Returns true when an item embedded in the static map JSON should be turned
  into a real Board item (movable, pickupable, draggable) rather than a baked-in
  decoration sprite.

  Rule: not flagged `isUnmoveable`, single-tile (we don't move multi-tile
  pieces), AND looks like a "thing" — pickupable (gold, food, weapons),
  hasElevation (boxes, barrels, dropped chests) or isUnpassable (single-tile
  statues, plant pots that can be pushed but not stuffed in a backpack).
  """
  def loose?(%{"id" => id}), do: loose?(id)

  def loose?(id) when is_integer(id) or is_binary(id) do
    case get(id) do
      nil -> false
      props -> loose_props?(props)
    end
  end

  def loose_props?(props) when is_map(props) do
    cond do
      props["isUnmoveable"] == true -> false
      not single_tile?(props) -> false
      props["pickupable"] == true -> true
      props["hasElevation"] == true -> true
      props["isUnpassable"] == true -> true
      true -> false
    end
  end

  def loose_props?(_), do: false

  @doc """
  An item that physically blocks movement / LOS at the tile it currently
  occupies. Items with `hasElevation` (boxes, tables) don't block — you can
  walk across them.
  """
  def blocks?(%{"id" => id}), do: blocks?(id)

  def blocks?(id) when is_integer(id) or is_binary(id) do
    case get(id) do
      nil -> false
      props -> blocks_props?(props)
    end
  end

  def blocks_props?(props) when is_map(props) do
    props["isUnpassable"] == true and props["hasElevation"] != true
  end

  def blocks_props?(_), do: false

  defp single_tile?(props) do
    case List.first(props["groups"] || []) do
      %{"width" => w, "height" => h} -> w == 1 and h == 1
      _ -> true
    end
  end

  defp allows_placement?(%{"id" => id}), do: allows_placement?(id)
  defp allows_placement?(id) when is_integer(id) or is_binary(id) do
    case get(id) do
      nil -> true
      props ->
        not (props["isUnpassable"] == true and
             props["isUnmoveable"] == true and
             props["hasElevation"] != true)
    end
  end

  @doc """
  Whether the static map at `pos` (z = 7) blocks movement / line of sight.
  Inspects both the ground tile id (water, walls baked into the tileset)
  and any env items on the tile. Loose items are skipped — those are
  authoritative from the Board, so callers handle them separately.
  """
  def env_blocks_movement?({x, y}) do
    case Cachex.get(:map, {x, y, 7}) do
      {:ok, %{id: ground_id, items: items}} ->
        blocks?(ground_id) or
          Enum.any?(items || [], fn item ->
            not loose?(item) and blocks?(item)
          end)

      _ ->
        false
    end
  end

  @doc """
  Whether the static map at `pos` accepts a movable item being dropped on
  it. Same combined ground + items inspection but using the stricter
  `allows_placement?` rule so the rule about movable blockers (statues)
  isn't double-applied — those are handled live via the Board.
  """
  def env_allows_placement?({x, y}) do
    case Cachex.get(:map, {x, y, 7}) do
      {:ok, %{id: ground_id, items: items}} ->
        allows_placement?(ground_id) and
          (items || []) |> Enum.reject(&loose?/1) |> can_place_on?()

      _ ->
        true
    end
  end

  @impl true
  def init(_) do
    :ets.new(@table, [:named_table, :public, read_concurrency: true])
    items_file = File.read!("#{:code.priv_dir(:abyss)}/items.json")
    {:ok, items} = Jason.decode(items_file)
    Enum.each(items, fn {id, props} -> :ets.insert(@table, {id, props}) end)
    {:ok, nil}
  end
end
