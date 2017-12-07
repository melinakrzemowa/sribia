defmodule SribiaWeb.Plugs.Auth do
  # import Plug.Conn
  import Phoenix.Controller, only: [redirect: 2]
  import Plug.Conn, only: [get_session: 2, assign: 3]
  alias SribiaWeb.Router.Helpers, as: Routes


  def init(_), do: []

  def call(conn, _) do
    if user_id = get_session(conn, :user_id) do
      token = Phoenix.Token.sign(conn, "user token", user_id)

      conn
      |> assign(:token, token)
      |> assign(:user_id, user_id)
      |> assign(:user, Sribia.Accounts.get_user!(user_id))
    else
      redirect(conn, to: Routes.page_path(conn, :auth))
    end
  end

end
