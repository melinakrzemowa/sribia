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

    # Skills - individual fields for each skill
    field :melee_fighting_level, :integer, default: 0
    field :melee_fighting_ticks, :integer, default: 0
    field :distance_fighting_level, :integer, default: 0
    field :distance_fighting_ticks, :integer, default: 0
    field :shielding_level, :integer, default: 0
    field :shielding_ticks, :integer, default: 0
    field :magic_level_level, :integer, default: 0
    field :magic_level_ticks, :integer, default: 0
    field :crafting_level, :integer, default: 0
    field :crafting_ticks, :integer, default: 0
    field :fishing_level, :integer, default: 0
    field :fishing_ticks, :integer, default: 0

    timestamps()
  end

  @doc false
  def changeset(%User{} = user, attrs) do
    user
    |> cast(attrs, [:name, :x, :y, :z, :speed, :last_move, :current_health, :max_health,
                    :current_mana, :max_mana, :level, :experience,
                    :melee_fighting_level, :melee_fighting_ticks,
                    :distance_fighting_level, :distance_fighting_ticks,
                    :shielding_level, :shielding_ticks,
                    :magic_level_level, :magic_level_ticks,
                    :crafting_level, :crafting_ticks,
                    :fishing_level, :fishing_ticks])
    |> validate_required([:name])
  end
end
