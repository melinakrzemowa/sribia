defmodule AbyssWeb.Router do
  use AbyssWeb, :router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_flash
    plug :protect_from_forgery
    plug :put_secure_browser_headers
  end

  pipeline :auth do
    plug AbyssWeb.Plugs.Auth
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/", AbyssWeb do
    pipe_through [:browser, :auth]

    get "/", PageController, :index
  end

  scope "/auth", AbyssWeb do
    pipe_through :browser

    get "/", PageController, :auth
    post "/login", PageController, :login
  end

  scope "/admin", AbyssWeb do
    pipe_through [:browser, :auth]

    resources "/users", UserController
  end

  # Other scopes may use custom stacks.
  # scope "/api", AbyssWeb do
  #   pipe_through :api
  # end
end
