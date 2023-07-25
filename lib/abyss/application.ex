defmodule Abyss.Application do
  use Application

  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  def start(_type, _args) do
    # Define workers and child supervisors to be supervised
    children = [
      {Cachex, name: :map},
      Abyss.Repo,
      {Phoenix.PubSub, name: Abyss.PubSub},
      AbyssWeb.Endpoint,
      Abyss.Board
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Abyss.Supervisor]
    supervisor = Supervisor.start_link(children, opts)

    Abyss.Game.MapLoader.load_cache()

    supervisor
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  def config_change(changed, _new, removed) do
    AbyssWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
