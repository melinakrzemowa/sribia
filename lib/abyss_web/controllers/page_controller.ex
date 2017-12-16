defmodule AbyssWeb.PageController do
  use AbyssWeb, :controller

  def index(conn, _params) do
    render conn, "index.html"
  end

  def auth(conn, _params) do
    render conn, "login.html"
  end

  def login(conn, %{"name" => name}) do
    conn
    |> Abyss.Accounts.authorize(name)
    |> redirect(to: page_path(conn, :index))
  end

end
