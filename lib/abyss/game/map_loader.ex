defmodule Abyss.Game.MapLoader do
  require Logger

  if Mix.env() != :test do
    def load_cache() do
      spawn_link(fn ->
        {:ok, unzip} =
          "priv/map.json.zip"
          |> Unzip.LocalFile.open()
          |> Unzip.new()

        Unzip.file_stream!(unzip, "map.json")
        |> Stream.into(File.stream!("priv/map.json"))
        |> Stream.run()

        Logger.info("[MapLoader] Map file unzipped")

        map_file = File.read!("priv/map.json")
        Logger.info("[MapLoader] Loaded Map file")

        {:ok, otbm_map} = Jason.decode(map_file)
        Logger.info("[MapLoader] Decoded Map file")

        [map_node] = otbm_map["data"]["nodes"]

        Logger.info("[MapLoader] Total features: #{Enum.count(map_node["features"])}")

        Logger.info("[MapLoader] Loading objects...")

        items_file = File.read!("assets/js/data/items.json")
        Logger.info("[MapLoader] Loaded Items file")

        {:ok, items} = Jason.decode(items_file)
        Logger.info("[MapLoader] Decoded Items file")

        Enum.each(map_node["features"], fn feature ->
          if feature["type"] == 4 && feature["x"] >= 32000 && feature["y"] >= 32000 && feature["x"] <= 33000 && feature["y"] <= 33000 &&
               feature["z"] == 7 do
            Enum.each(feature["tiles"], fn tile ->
              Cachex.put!(:map, {feature["x"] + tile["x"], feature["y"] + tile["y"], feature["z"]}, %{
                id: tile["tileid"],
                items: tile["items"],
                details: Map.get(items, to_string(tile["tileid"]))
              })
            end)
          end
        end)

        Logger.info("[MapLoader] Finished loading Map")

        # TODO: put items on Board
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
