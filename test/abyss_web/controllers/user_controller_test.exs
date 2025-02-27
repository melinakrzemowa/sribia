defmodule AbyssWeb.UserControllerTest do
  use AbyssWeb.ConnCase

  alias Abyss.Accounts

  @create_attrs %{name: "some name"}
  @update_attrs %{name: "some updated name"}
  @invalid_attrs %{name: nil}

  def fixture(:user) do
    {:ok, user} = Accounts.create_user(@create_attrs)
    user
  end

  setup %{conn: conn} do
    user = fixture(:user)
    conn = put_session(conn, :user_id, user.id)

    %{conn: conn, user: user}
  end

  describe "index" do
    test "lists all users", %{conn: conn} do
      conn = get(conn, user_path(conn, :index))
      assert html_response(conn, 200) =~ "Listing Users"
    end
  end

  describe "new user" do
    test "renders form", %{conn: conn} do
      conn = get(conn, user_path(conn, :new))
      assert html_response(conn, 200) =~ "New User"
    end
  end

  describe "create user" do
    test "redirects to show when data is valid", %{conn: conn} do
      conn = post conn, user_path(conn, :create), user: @create_attrs

      assert %{id: id} = redirected_params(conn)
      assert redirected_to(conn) == user_path(conn, :show, id)

      conn = get(conn, user_path(conn, :show, id))
      assert html_response(conn, 200) =~ "Show User"
    end

    test "renders errors when data is invalid", %{conn: conn} do
      conn = post conn, user_path(conn, :create), user: @invalid_attrs
      assert html_response(conn, 200) =~ "New User"
    end
  end

  describe "edit user" do
    test "renders form for editing chosen user", %{conn: conn, user: user} do
      conn = get(conn, user_path(conn, :edit, user))
      assert html_response(conn, 200) =~ "Edit User"
    end
  end

  describe "update user" do
    test "redirects when data is valid", %{conn: conn, user: user} do
      conn2 = put conn, user_path(conn, :update, user), user: @update_attrs
      assert redirected_to(conn2) == user_path(conn2, :show, user)

      conn3 = get(conn, user_path(conn, :show, user))
      assert html_response(conn3, 200) =~ "some updated name"
    end

    test "renders errors when data is invalid", %{conn: conn, user: user} do
      conn = put conn, user_path(conn, :update, user), user: @invalid_attrs
      assert html_response(conn, 200) =~ "Edit User"
    end
  end

  describe "delete user" do
    test "deletes chosen user", %{conn: conn, user: user} do
      conn = delete(conn, user_path(conn, :delete, user))
      assert redirected_to(conn) == user_path(conn, :index)

      assert_error_sent 404, fn ->
        get(conn, user_path(conn, :show, user))
      end
    end
  end
end
