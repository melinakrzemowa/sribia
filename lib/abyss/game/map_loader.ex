defmodule Abyss.Game.MapLoader do
  require Logger

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

      Enum.each(map_node["features"], fn feature ->
        if feature["type"] == 4 && feature["x"] >= 32000 && feature["y"] >= 32000 && feature["x"] <= 33000 && feature["y"] <= 33000 && feature["z"] == 7 do
          Enum.each(feature["tiles"], fn tile ->
            Cachex.put!(:map, {feature["x"] + tile["x"], feature["y"] + tile["y"], feature["z"]}, %{
              id: tile["tileid"],
              items: tile["items"]
            })
          end)
        end
      end)

      Logger.info("[MapLoader] Finished loading Map")
    end)
  end
end
