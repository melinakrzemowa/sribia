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

      # Skills as JSON map with level and ticks for each skill
      add :skills, :map, default: %{
        "melee_fighting" => %{"level" => 0, "ticks" => 0},
        "distance_fighting" => %{"level" => 0, "ticks" => 0},
        "shielding" => %{"level" => 0, "ticks" => 0},
        "magic_level" => %{"level" => 0, "ticks" => 0},
        "crafting" => %{"level" => 0, "ticks" => 0},
        "fishing" => %{"level" => 0, "ticks" => 0}
      }
    end
  end
end
