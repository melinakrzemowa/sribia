import { mapSize } from "./globals"
import MapTile from "./map_tile"

export default class GameMap {

  constructor(state) {
    this.map = new Map();
    this.state = state;
  }

  isBlocked(x, y) {
    let tile = this.getTile(x, y);
    return tile.blocks || tile.getObjects().length != 0;
  }

  getObjects(x, y) {
    let tile = this.getTile(x, y);
    return tile.getObjects();
  }

  putObject(x, y, object) {
    let tile = this.getTile(x, y);
    return tile.putObject(object);
  }

  deleteObject(x, y, object) {
    let tile = this.getTile(x, y);
    return tile.deleteObject(object);
  }

  getTile(x, y) {
    let tile = this.map.get(x * mapSize + y);
    if (!tile) tile = this.setTile(x, y);
    return tile
  }

  setTile(x, y) {
    let tile = new MapTile(this, x, y);
    this.map.set(x * mapSize + y, tile);
    return tile;
  }

}
