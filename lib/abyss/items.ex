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

  @impl true
  def init(_) do
    :ets.new(@table, [:named_table, :public, read_concurrency: true])
    items_file = File.read!("#{:code.priv_dir(:abyss)}/items.json")
    {:ok, items} = Jason.decode(items_file)
    Enum.each(items, fn {id, props} -> :ets.insert(@table, {id, props}) end)
    {:ok, nil}
  end
end
