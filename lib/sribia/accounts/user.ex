defmodule Sribia.Accounts.User do
  use Ecto.Schema
  import Ecto.Changeset
  alias Sribia.Accounts.User


  schema "users" do
    field :name, :string
    field :x, :integer
    field :y, :integer
    field :speed, :integer, default: 1
    field :last_move, :naive_datetime

    timestamps()
  end

  @doc false
  def changeset(%User{} = user, attrs) do
    user
    |> cast(attrs, [:name, :x, :y, :speed, :last_move])
    |> validate_required([:name])
  end
end
