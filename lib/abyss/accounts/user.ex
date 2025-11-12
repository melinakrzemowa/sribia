defmodule Abyss.Accounts.User do
  use Ecto.Schema
  import Ecto.Changeset
  alias Abyss.Accounts.User

  schema "users" do
    field :name, :string
    field :x, :integer
    field :y, :integer
    field :z, :integer, default: 0
    field :speed, :integer, default: 1
    field :last_move, :naive_datetime

    # Health and Mana
    field :current_health, :integer, default: 100
    field :max_health, :integer, default: 100
    field :current_mana, :integer, default: 50
    field :max_mana, :integer, default: 50

    # Level and Experience
    field :level, :integer, default: 1
    field :experience, :integer, default: 0

    # Skills with level and ticks
    field :skills, :map, default: %{
      "melee_fighting" => %{"level" => 0, "ticks" => 0},
      "distance_fighting" => %{"level" => 0, "ticks" => 0},
      "shielding" => %{"level" => 0, "ticks" => 0},
      "magic_level" => %{"level" => 0, "ticks" => 0},
      "crafting" => %{"level" => 0, "ticks" => 0},
      "fishing" => %{"level" => 0, "ticks" => 0}
    }

    timestamps()
  end

  @doc false
  def changeset(%User{} = user, attrs) do
    user
    |> cast(attrs, [:name, :x, :y, :z, :speed, :last_move, :current_health, :max_health,
                    :current_mana, :max_mana, :level, :experience, :skills])
    |> validate_required([:name])
  end
end
