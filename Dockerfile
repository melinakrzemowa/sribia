FROM hexpm/elixir:1.14.5-erlang-24.3.4.13-debian-bookworm-20230612-slim AS build

# install build dependencies
RUN apt-get update && \
  apt-get install -y locales && \
  echo "en_US.UTF-8 UTF-8" >> /etc/locale.gen && \
  locale-gen

ENV LC_ALL="en_US.UTF-8"

RUN apt-get install -y npm git python3

# prepare build dir
WORKDIR /app

# install hex + rebar
RUN mix local.hex --force && \
    mix local.rebar --force

# set build ENV
ENV MIX_ENV=prod

# install mix dependencies
COPY mix.exs mix.lock ./
COPY config config
RUN mix do deps.get, deps.compile

# build assets
COPY assets/package.json assets/package-lock.json ./assets/
RUN npm --prefix ./assets ci --progress=false --no-audit --loglevel=error

COPY priv priv
COPY assets assets
RUN mix esbuild default --minify
RUN mix phx.digest

# compile and build release
COPY lib lib
# uncomment COPY if rel/ exists
# COPY rel rel
RUN mix do compile, release

# prepare release image
FROM debian:bookworm-20230612-slim AS app

# install build dependencies
RUN apt-get update && \
  apt-get install -y locales && \
  echo "en_US.UTF-8 UTF-8" >> /etc/locale.gen && \
  locale-gen

ENV LC_ALL="en_US.UTF-8"

RUN apt-get install -y openssl

WORKDIR /app

COPY --from=build /app/_build/prod/rel/abyss ./

ENV HOME=/app

CMD ["bin/abyss", "start"]
