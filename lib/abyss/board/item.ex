defmodule Abyss.Board.Item do
  @moduledoc """
  A single item instance on the board.

  - `id`        : runtime-only instance id, unique across all items.
  - `item_id`   : item definition id (key in priv/items.json).
  - `count`     : stack size, only meaningful for items whose definition has
                  `stackable: true`. Defaults to 1.
  """
  defstruct [:id, :item_id, count: 1]
end
