defmodule Abyss.Repo.Migrations.AddUserHealth do
  use Ecto.Migration

  def change do
    alter table(:users) do
      add :health, :integer, default: 100, null: false
      add :max_health, :integer, default: 100, null: false
    end
  end
end
