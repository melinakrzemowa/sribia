defmodule Abyss.Repo.Migrations.AddUserFields do
  use Ecto.Migration

  def change do
    alter table(:users) do
      add :x, :integer
      add :y, :integer
      add :speed, :integer, default: 1
      add :last_move, :naive_datetime
    end
  end
end
