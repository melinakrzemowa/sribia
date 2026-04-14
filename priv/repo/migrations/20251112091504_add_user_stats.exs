defmodule Abyss.Repo.Migrations.AddUserStats do
  use Ecto.Migration

  def change do
    alter table(:users) do
      # Health and Mana
      add :current_health, :integer, default: 100
      add :max_health, :integer, default: 100
      add :current_mana, :integer, default: 50
      add :max_mana, :integer, default: 50

      # Level and Experience
      add :level, :integer, default: 1
      add :experience, :integer, default: 0

      # Z Position (in addition to existing x, y)
      add :z, :integer, default: 0

      # Skills - individual fields for each skill
      add :melee_fighting_level, :integer, default: 0
      add :melee_fighting_ticks, :integer, default: 0
      add :distance_fighting_level, :integer, default: 0
      add :distance_fighting_ticks, :integer, default: 0
      add :shielding_level, :integer, default: 0
      add :shielding_ticks, :integer, default: 0
      add :magic_level_level, :integer, default: 0
      add :magic_level_ticks, :integer, default: 0
      add :crafting_level, :integer, default: 0
      add :crafting_ticks, :integer, default: 0
      add :fishing_level, :integer, default: 0
      add :fishing_ticks, :integer, default: 0
    end
  end
end
