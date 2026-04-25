defmodule Abyss.Board.Container do
  alias Abyss.Board.{Container, Item}

  # `items` holds the live %Item{} struct for every item instance currently
  # tracked on the board (whether it sits on a tile or — later — in someone's
  # equipment). The fields/details indices keep the spatial mapping; `items`
  # keeps the data each instance carries.
  defstruct fields: %{}, details: %{}, items: %{}, next_item_id: 1

  def new(), do: %Container{}

  def get_item(%Container{items: items}, id), do: Map.get(items, id)

  def add_item(%Container{items: items, next_item_id: next} = container, item_id, count \\ 1) do
    item = %Item{id: next, item_id: item_id, count: count}
    container = %Container{container | items: Map.put(items, next, item), next_item_id: next + 1}
    {item, container}
  end

  def remove_item(%Container{items: items} = container, instance_id) do
    %Container{container | items: Map.delete(items, instance_id)}
  end

  def blocks?(%Container{fields: fields}, pos) do
    Map.get(fields, pos, [])
    |> List.keymember?(true, 1)
  end

  # Check if position is blocked, but ignore {type, object} in this check
  def blocks?(%Container{fields: fields}, pos, type, object) do
    Map.get(fields, pos, [])
    |> List.keydelete({type, object}, 0)
    |> List.keymember?(true, 1)
  end

  def get_position(%Container{details: details}, type, object) do
    Map.get(details, {type, object})
  end

  def get_field(%Container{fields: fields}, pos) do
    Map.get(fields, pos, [])
  end

  def get_field(%Container{} = container, pos, type) do
    container
    |> get_field(pos)
    |> Enum.filter(fn {{t, _e}, _b} -> t == type end)
  end

  def put(%Container{} = container, pos, type, object, blocks) do
    container = delete(container, type, object)
    list = Map.get(container.fields, pos, [])
    fields = Map.put(container.fields, pos, [{{type, object}, blocks} | list])
    details = Map.put(container.details, {type, object}, pos)
    %Container{container | fields: fields, details: details}
  end

  def move(%Container{fields: fields} = container, pos, type, object) do
    old_pos = get_position(container, type, object)
    {_, blocks} = Map.get(fields, old_pos, []) |> List.keyfind({type, object}, 0)

    container
    |> delete(type, object)
    |> put(pos, type, object, blocks)
  end

  def delete(%Container{fields: fields, details: details} = container, type, object) do
    pos = get_position(container, type, object)
    list = Map.get(fields, pos, []) |> List.keydelete({type, object}, 0)
    fields = if list == [], do: Map.delete(fields, pos), else: Map.put(fields, pos, list)
    details = Map.delete(details, {type, object})
    %Container{container | fields: fields, details: details}
  end

  def get_free_spot(container, {x, y}, type, object) do
    mods = [0, -1, 1]

    Enum.reduce_while(mods, nil, fn mod_x, _ ->
      Enum.reduce_while(mods, nil, fn mod_y, _ ->
        pos = {x + mod_x, y + mod_y}

        container
        |> blocks?(pos, type, object)
        |> continue?(pos)
      end)
      |> continue?()
    end)
  end

  defp continue?(blocks \\ nil, pos)
  defp continue?(nil, nil), do: {:cont, nil}
  defp continue?(nil, pos), do: {:halt, pos}
  defp continue?(false, pos), do: {:halt, pos}
  defp continue?(true, _pos), do: {:cont, nil}
end
