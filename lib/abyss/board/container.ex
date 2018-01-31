defmodule Abyss.Board.Container do
  alias Abyss.Board.Container

  defstruct [fields: %{}, details: %{}]

  def new(), do: %Container{}

  def blocks?(%Container{fields: fields}, pos) do
    Map.get(fields, pos, [])
    |> List.keymember?(true, 1)
  end

  def get_position(%Container{details: details}, type, element) do
    Map.get(details, {type, element})
  end

  def get_field(%Container{fields: fields}, pos) do
    Map.get(fields, pos, [])
    |> Enum.map(fn {v, _b} -> v end)
  end

  def get_field(%Container{} = container, pos, type) do
    container
    |> get_field(pos)
    |> Enum.filter(fn {t, _e} -> t == type end)
  end

  def put(%Container{fields: fields, details: details} = container, pos, type, element, blocks) do
    list = Map.get(fields, pos, [])
    fields = Map.put(fields, pos, [{{type, element}, blocks} | list])
    details = Map.put(details, {type, element}, pos)
    %Container{container | fields: fields, details: details}
  end

  def move(%Container{fields: fields} = container, pos, type, element) do
    old_pos = get_position(container, type, element)
    {_, blocks} = Map.get(fields, old_pos, []) |> List.keyfind({type, element}, 0)
    container
    |> delete(old_pos, type, element)
    |> put(pos, type, element, blocks)
  end

  def delete(%Container{fields: fields, details: details} = container, pos, type, element) do
    list = Map.get(fields, pos, []) |> List.keydelete({type, element}, 0)
    fields = if list == [], do: Map.delete(fields, pos), else: Map.put(fields, pos, list)
    details = Map.delete(details, {type, element})
    %Container{container | fields: fields, details: details}
  end

end
