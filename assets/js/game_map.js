import MapTile from "./map_tile";
import items from "./data/items.json" assert { type: "json" };
import { mapSize, field, size, scale } from "./globals";

// Phaser's per-sprite animation clock starts when each sprite is created,
// so tiles loaded later (a leading column entering view as the player walks)
// drift out of phase with already-rendered tiles. We swap frames manually
// from a single global clock, sampled in tickAnimations() — every animated
// sprite shows the same frame at any wall-clock instant regardless of when
// it joined the map.
const TILE_ANIM_FPS = 2;
const TILE_ANIM_FRAME_MS = 1000 / TILE_ANIM_FPS;

export default class GameMap {
  constructor(state) {
    this.map = new Map();
    this.state = state;
    // Each entry: { sprite, frames, lastIdx }. tickAnimations() iterates the
    // list once per frame and updates frameName when the global frame index
    // changes (so most ticks are no-ops between frame boundaries).
    this.animatedTiles = [];
  }

  registerAnimatedTile(sprite, frames) {
    if (!frames || frames.length < 2) return;
    const idx = this._currentFrameIdx(frames.length);
    sprite.frameName = frames[idx];
    this.animatedTiles.push({ sprite, frames, lastIdx: idx });
  }

  _currentFrameIdx(len) {
    return Math.floor(Date.now() / TILE_ANIM_FRAME_MS) % len;
  }

  tickAnimations() {
    if (this.animatedTiles.length === 0) return;
    const now = Date.now();
    for (const a of this.animatedTiles) {
      const idx = Math.floor(now / TILE_ANIM_FRAME_MS) % a.frames.length;
      if (idx !== a.lastIdx) {
        a.sprite.frameName = a.frames[idx];
        a.lastIdx = idx;
      }
    }
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

  addItem(x, y, payload) {
    return this.getTile(x, y).addItem(payload);
  }

  removeItem(x, y, instanceId) {
    return this.getTile(x, y).removeItem(instanceId);
  }

  loadTile(mapTile) {
    let tile = this.getTile(mapTile.x, mapTile.y);

    if (!tile.loaded && mapTile.id) {
      // The ground tile itself can be a blocker (water, lava). Older code
      // only checked items on the tile, so water was silently walkable.
      const groundDef = items[mapTile.id];
      if (groundDef) {
        if (groundDef.isUnpassable) tile.staticBlocks = true;
        if (groundDef.blockPathfind) tile.pathfindBlocks = true;
      }
      let mapTileData = items[mapTile.id].groups[0];
      let pattern =
        (mapTile.x % mapTileData.patternX) +
        (mapTile.y % mapTileData.patternY) * mapTileData.patternX;

      // we need to start from the back so we keep the highest layers on top
      for (var layer = mapTileData.layers - 1; layer >= 0; layer--) {
        let spriteId =
          mapTileData.sprites[layer + pattern * mapTileData.layers];

        if (spriteId > 0) {
          let sheetNumber = Math.ceil(spriteId / 1000);
          let sprite = this.state.add.sprite(
            mapTile.x * field,
            mapTile.y * field,
            "tibia" + sheetNumber,
            spriteId.toString()
          );
          sprite.scale.setTo(scale, scale);
          sprite.anchor.setTo(0.5, 0.5);

          this.state.world.sendToBack(sprite);

          if (mapTileData.frames > 1) {
            let frames = [];

            for (let f = 0; f < mapTileData.frames; f++) {
              let index = this.state.getSpriteIndex(
                mapTileData,
                0,
                0,
                layer,
                mapTile.x % mapTileData.patternX,
                mapTile.y % mapTileData.patternY,
                0,
                f
              );
              frames[f] = mapTileData.sprites[index].toString();
            }

            this.registerAnimatedTile(sprite, frames);
          }
        }
      }
    }

    if (!tile.loaded && mapTile.items) {
      mapTile.items.forEach((item) => {
        let tile = this.getTile(mapTile.x, mapTile.y);

        tile.createEnv(items[item.id]);
        tile.staticBlocks = tile.staticBlocks || !!items[item.id].isUnpassable;
        tile.pathfindBlocks = tile.pathfindBlocks || !!items[item.id].blockPathfind;
        if (items[item.id].hasElevation) tile.staticElevation += 1;
      });
    }

    tile.loaded = true;
    tile.recomputeBlocks();
  }

  // Used by the click-to-move pathfinder. Combines hard blockers (used by
  // direct movement too) with `blockPathfind` tiles like water/lava that
  // shouldn't be auto-walked into but stay manually accessible.
  isPathfindBlocked(x, y) {
    const tile = this.getTile(x, y);
    return tile.blocks || tile.pathfindBlocks || tile.getObjects().length != 0;
  }

  getTile(x, y) {
    let tile = this.map.get(x * mapSize + y);
    if (!tile) tile = this.createTile(x, y);
    return tile;
  }

  createTile(x, y) {
    let tile = new MapTile(this, x, y);
    this.map.set(x * mapSize + y, tile);
    return tile;
  }
}
