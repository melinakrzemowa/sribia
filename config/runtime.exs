import Config

if config_env() == :prod do
  # OpenTelemetry — export traces to the local somsiad Alloy via OTLP/HTTP.
  config :opentelemetry,
    resource: %{service: %{name: "sribia", version: System.get_env("VERSION") || "dev"}}

  config :opentelemetry_exporter,
    otlp_protocol: :http_protobuf,
    otlp_endpoint: System.get_env("OTLP_ENDPOINT", "http://host.docker.internal:4318")

  database_url =
    System.get_env("DATABASE_URL") ||
      raise """
      environment variable DATABASE_URL is missing.
      For example: ecto://USER:PASS@HOST/DATABASE
      """

  config :abyss, Abyss.Repo,
    url: database_url,
    pool_size: String.to_integer(System.get_env("POOL_SIZE") || "10"),
    # Kernel-level keepalive helps the pool notice a half-open Postgres
    # socket (proxy hiccup, container network reset, etc.) rather than
    # discovering it on the next slow query.
    socket_options: [keepalive: true],
    connect_timeout: 15_000

  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise """
      environment variable SECRET_KEY_BASE is missing.
      You can generate one by calling: mix phx.gen.secret
      """

  host =
    System.get_env("HOST") ||
      raise """
      environment variable HOST is missing.
      Provide a domain which you use for the release.
      """

  port = String.to_integer(System.get_env("PORT") || "4000")

  config :abyss, AbyssWeb.Endpoint,
    server: true,
    url: [host: host],
    http: [
      :inet6,
      port: port,
      # Enable cowboy_telemetry_h so OpenTelemetry can hook HTTP request
      # spans (sribia uses controllers, not LiveView, so without this the
      # OTel exporter has nothing to send).
      protocol_options: [
        stream_handlers: [:cowboy_telemetry_h, :cowboy_stream_h]
      ]
    ],
    secret_key_base: secret_key_base
end
