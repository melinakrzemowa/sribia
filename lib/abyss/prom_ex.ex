defmodule Abyss.PromEx do
  @moduledoc """
  Prometheus metrics for Sribia/Abyss. Mounted at `/metrics` (see router).
  Scraped by the somsiad stack on the Air via host.docker.internal:6900.
  """
  use PromEx, otp_app: :abyss

  alias PromEx.Plugins

  @impl true
  def plugins do
    [
      Plugins.Application,
      Plugins.Beam,
      {Plugins.Phoenix, router: AbyssWeb.Router, endpoint: AbyssWeb.Endpoint},
      Plugins.Ecto,
      Plugins.PhoenixLiveView
    ]
  end

  @impl true
  def dashboard_assigns do
    [
      datasource_id: "prometheus",
      default_selected_interval: "30s"
    ]
  end

  @impl true
  def dashboards, do: []
end
