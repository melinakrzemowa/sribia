defmodule Abyss.Game.MapLoader do
  require Logger

  if Mix.env() != :test do
    def load_cache() do
      spawn_link(fn ->
        map_file = File.read!("#{:code.priv_dir(:abyss)}/map.rook.thin.json")
        Logger.info("[MapLoader] Loaded Map file")

        {:ok, otbm_map} = Jason.decode(map_file)

        [map_node] = otbm_map["data"]["nodes"]

        Logger.info("[MapLoader] Total features: #{Enum.count(map_node["features"])}")

        Logger.info("[MapLoader] Loading objects...")

        items_file = File.read!("#{:code.priv_dir(:abyss)}/items.json")
        Logger.info("[MapLoader] Loaded Items file")

        {:ok, items} = Jason.decode(items_file)
        Logger.info("[MapLoader] Decoded Items file")

        Enum.each(map_node["features"], fn feature ->
          Enum.each(feature["tiles"], fn tile ->
            Cachex.put!(:map, {feature["x"] + tile["x"], feature["y"] + tile["y"], feature["z"]}, %{
              id: tile["tileid"],
              items: tile["items"],
              details: Map.get(items, to_string(tile["tileid"]))
            })
          end)
        end)

        Logger.info("[MapLoader] Finished loading Map")

        # Cachex is now fully populated — kick the Board so it spawns every
        # loose item embedded in the map as a real Board instance. Doing it
        # here (instead of from Application.start) avoids the race where the
        # async load_cache hasn't filled Cachex yet by the time the boot
        # script tries to seed.
        Abyss.Board.reseed_from_cache()
      end)
    end
  else
    def load_cache() do
      for x <- 32000..32256, 32, y <- 32000..32256 do
        Cachex.put!(:map, {x, y, 7}, %{
          id: 102,
          items: [],
          details: %{}
        })
      end
    end
  end
end
