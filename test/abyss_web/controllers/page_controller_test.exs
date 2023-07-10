defmodule AbyssWeb.PageControllerTest do
  use AbyssWeb.ConnCase
  alias Abyss.Accounts

  def fixture(:user) do
    {:ok, user} = Accounts.create_user(%{name: "some name"})
    user
  end

  test "GET / renders game div", %{conn: conn} do
    user = fixture(:user)
    conn = put_session(conn, :user_id, user.id)
    conn = get(conn, "/")
    assert html_response(conn, 200) =~ "<div id=\"game\"></div>"
  end
end
