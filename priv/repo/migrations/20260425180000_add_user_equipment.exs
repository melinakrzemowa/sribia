defmodule Abyss.Repo.Migrations.AddUserEquipment do
  use Ecto.Migration

  def change do
    alter table(:users) do
      add :equipment, :map, default: %{}, null: false
    end
  end
end
