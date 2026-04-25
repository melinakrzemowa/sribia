defmodule Abyss.Equipment do
  @moduledoc """
  Slot definitions and per-slot acceptance rules for player equipment.

  Equipment is held in-memory in `Abyss.UserSession`. The persisted form is a
  JSON map under `users.equipment` that survives restart with shape

      %{"slot_name" => %{"item_id" => 1614, "count" => 1}}

  In-memory we use atom slot keys and full `%Abyss.Board.Item{}` structs (the
  `id` is a fresh runtime instance id from the Board).
  """

  alias Abyss.Board.Item

  @slots [:head, :neck, :back, :body, :left_hand, :right_hand, :legs, :feet, :ring, :ammo]

  def slots, do: @slots

  def valid_slot?(slot) when slot in @slots, do: true
  def valid_slot?(_), do: false

  @doc """
  Returns true when an item with the given `item_id` may be placed in `slot`.
  Currently any pickupable, movable item fits any slot, except `back` which
  only accepts containers (so the backpack slot can't be filled with a sword).
  """
  def slot_accepts?(slot, item_id) do
    case Abyss.Items.get(item_id) do
      nil ->
        false

      props ->
        cond do
          props["pickupable"] != true -> false
          props["isUnmoveable"] == true -> false
          slot == :back and props["isContainer"] != true -> false
          true -> true
        end
    end
  end

  @doc """
  Persistence form: atom slot keys → `%Item{}` becomes string slot keys → maps.
  """
  def to_persisted(equipment) when is_map(equipment) do
    Map.new(equipment, fn {slot, %Item{item_id: item_id, count: count}} ->
      {Atom.to_string(slot), %{"item_id" => item_id, "count" => count}}
    end)
  end

  @doc """
  Restore an equipment map loaded from `users.equipment`. Each slot's
  persisted entry is turned into a fresh `%Item{}` in the Board (so it gets a
  new instance id) and the slot map is returned with atom keys.
  """
  def from_persisted(persisted) when is_map(persisted) do
    persisted
    |> Enum.flat_map(fn {slot_str, %{"item_id" => item_id} = entry} ->
      with slot when is_atom(slot) <- string_to_slot(slot_str),
           true <- valid_slot?(slot) do
        count = Map.get(entry, "count", 1)
        {:ok, item} = Abyss.Board.register_item(item_id, count)
        [{slot, item}]
      else
        _ -> []
      end
    end)
    |> Map.new()
  end

  def from_persisted(_), do: %{}

  defp string_to_slot(str) do
    try do
      String.to_existing_atom(str)
    rescue
      ArgumentError -> nil
    end
  end
end
