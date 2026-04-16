# Sribia (Abyss)

Real-time multiplayer tile-based game built with Elixir/Phoenix and Phaser.js frontend.

## Tech Stack

- **Language**: Elixir 1.19 / OTP 28
- **Framework**: Phoenix 1.8 with WebSocket channels
- **Database**: PostgreSQL via Ecto
- **Frontend**: Phaser 2.x (legacy), vanilla JS, Phoenix channels
- **Caching**: Cachex (in-memory map tile storage)
- **Assets**: esbuild
- **HTTP Server**: Cowboy

## Project Structure

- `lib/abyss/` - Core game logic
  - `accounts/` - User schema and CRUD (name, x, y, speed, last_move)
  - `board/` - Spatial system GenServer: Container (fields + details maps), collision detection, 8-directional movement
  - `game/` - Game API orchestration (join, leave, move, get_map_data), MapLoader loads `priv/map.rook.thin.json` into Cachex
  - `user_session.ex` - Per-user GenServer via Registry, tracks channel_pid, handles multi-device force-disconnect
  - `user_session_supervisor.ex` - DynamicSupervisor for user sessions
- `lib/abyss_web/` - Web layer
  - `channels/` - GameChannel (join/move/map_data), ChatChannel (shout)
  - `controllers/` - PageController (game + auth), UserController (admin CRUD)
  - `plugs/auth.ex` - Session-based auth, Phoenix.Token for WebSocket
  - `templates/` - EEx templates, game.html.eex (fullscreen mobile-optimized)
- `assets/js/` - Phaser game client
  - `socket.js` / `channels/` - Phoenix channel wrappers
  - `states/main.js` - Main game state
  - `game_map.js`, `player.js`, `users_container.js` - Rendering
- `priv/` - Map data (map.rook.thin.json), items.json, static assets

## Architecture

**OTP Supervision Tree**: Application -> {Board GenServer, MapLoader, UserSessionSupervisor, PubSub, Repo, Endpoint}

**Game Flow**: User authenticates -> WebSocket connects with signed token -> Joins "game:lobby" channel -> UserSession GenServer created -> Board.add_user -> Map data sent (8x8 tile radius) -> Real-time movement via channel broadcasts

**Board/Spatial System**: Container holds `fields` (position -> objects list) and `details` (object -> position). Objects can block movement. Users and monsters block, items don't.

**Movement Rate Limiting**: `move_time = round(100_000 / (2 * (speed - 1) + 180))`. Default speed 1 = ~500ms cooldown. Frontend allows 85% of move_time for smooth interpolation.

**Map**: 3D tile coordinates `{x, y, z}` stored in Cachex. Game level is z=7. MapLoader parses JSON at startup.

## Common Commands

```bash
mix setup              # Install deps, create DB, run migrations
mix test               # Run tests (64 tests, creates sandbox DB)
mix phx.server         # Start dev server at localhost:4040
iex -S mix phx.server  # Start with interactive shell
mix ecto.reset         # Drop, create, migrate DB
mix deps.get           # Fetch dependencies
mix esbuild default    # Build JS assets
```

## Development

- PostgreSQL must be running (user: postgres, password: postgres, db: abyss_dev)
- Dev server runs on port 4040
- esbuild watches assets in dev mode
- Tidewave available for AI-assisted development (dev only)
- Tests use Ecto sandbox + mock 256x256 map (no JSON file needed)
- UserSession cleanup time is 1s in test (vs production default)

## Key Patterns

- **Token auth for WebSockets**: Phoenix.Token signed in controller, verified in UserSocket.connect
- **Force disconnect**: New client connection pushes `:force_disconnect` to old channel, takes over session
- **Direction system**: 8 directions as atoms (`:n`, `:s`, `:e`, `:w`, `:ne`, `:nw`, `:se`, `:sw`) mapped to `{dx, dy}` deltas
- **Get-or-create users**: Login creates user if name doesn't exist

## Deployment

- Docker multi-stage build (hexpm/elixir:1.19.5-erlang-28.4.2)
- GitHub Actions: CI runs tests, Deploy builds arm64 image -> GHCR -> SSH via Cloudflare Tunnel -> docker compose up
- Production env vars: `DATABASE_URL`, `SECRET_KEY_BASE`, `HOST`, `VERSION`
- Hosted on Raspberry Pi at sribia.melinakrzemowa.pl
