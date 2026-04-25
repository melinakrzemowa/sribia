import { field, scale, size } from "./globals";
import items from "./data/items.json" assert { type: "json" };

const MAX_VISIBLE_ITEMS = 8;
const MAX_VISIBLE_ELEVATIONS = 3;

export default class MapTile {
  constructor(map, x, y) {
    this.map = map;

    this.x = x;
    this.y = y;
    this.blocks = false;
    this.envSprites = [];
    this.objects = [];
    // Movable items currently on this tile, oldest at index 0, newest on top.
    this.items = [];          // raw payloads {instance_id, item_id, count}
    this.itemSprites = [];    // Phaser sprites currently rendering `this.items`
    this.loaded = false;
  }

  getSpriteIndex(group, w, h, l, x, y, z, f) {
    return (
      ((((((f % group.frames) * group.patternZ + z) * group.patternY + y) *
        group.patternX +
        x) *
        group.layers +
        l) *
        group.height +
        h) *
        group.width +
      w
    );
  }

  createEnv(item) {
    let itemData = item.groups[0];

    for (let w = 0; w < itemData.width; w++) {
      for (let h = 0; h < itemData.height; h++) {
        // we need to start from the back so we keep the highest layers on top
        for (var l = itemData.layers - 1; l >= 0; l--) {
          let index = this.getSpriteIndex(
            itemData,
            w,
            h,
            l,
            this.x % itemData.patternX,
            this.y % itemData.patternY,
            0,
            0
          );
          let spriteId = itemData.sprites[index];

          if (spriteId > 0) {
            let sheetNumber = Math.ceil(spriteId / 1000);

            let x = (this.x - w) * field - (item.hasOffset ? item.offsetX * scale : 0);
            let y = (this.y - h) * field - (item.hasOffset ? item.offsetY * scale : 0);

            let sprite = this.map.state.add.sprite(
              x,
              y,
              "tibia" + sheetNumber,
              spriteId.toString()
            );
            this.map.state.group.add(sprite);
            sprite.scale.setTo(scale, scale);
            sprite.anchor.setTo(0.5, 0.5);
            sprite.gameObject = { ...item, position: { x: this.x, y: this.y } };

            if (itemData.frames > 1) {
              let frames = [];

              for (let f = 0; f < itemData.frames; f++) {
                let index = this.getSpriteIndex(
                  itemData,
                  w,
                  h,
                  l,
                  this.x % itemData.patternX,
                  this.y % itemData.patternY,
                  0,
                  f
                );
                frames[f] = itemData.sprites[index].toString();
              }

              sprite.animations.add("idle", frames);
              sprite.animations.play("idle", 2, true);
            }
          }
        }
      }
    }
  }

  addItem(payload) {
    if (this.items.find((it) => it.instance_id === payload.instance_id)) return;
    this.items.push(payload);
    this._renderItems();
  }

  removeItem(instanceId) {
    const before = this.items.length;
    this.items = this.items.filter((it) => it.instance_id !== instanceId);
    if (this.items.length !== before) this._renderItems();
  }

  _renderItems() {
    this.itemSprites.forEach((spr) => spr.destroy());
    this.itemSprites = [];

    // Show only the newest MAX_VISIBLE_ITEMS, oldest first so newer ones render on top.
    const start = Math.max(0, this.items.length - MAX_VISIBLE_ITEMS);
    const visible = this.items.slice(start);

    // `elevationCount` increments only for hasElevation items, so a non-
    // elevated item on top of two boxes is still lifted by 2 steps.
    let elevationCount = 0;
    visible.forEach((it, stackIdx) => {
      const def = items[String(it.item_id)];
      if (!def) return;

      // hasElevation items past the cap are hidden entirely.
      if (def.hasElevation && elevationCount >= MAX_VISIBLE_ELEVATIONS) return;

      // All stacked items get a small left shift per stack position so a pile
      // of identical items reads as a stack instead of one sprite.
      const xShift = -stackIdx * 8 * scale;
      const yShift = -Math.min(MAX_VISIBLE_ELEVATIONS, elevationCount) * 8 * scale;

      const sprite = this._spawnItemSprite(def, xShift, yShift, it);
      if (sprite) this.itemSprites.push(sprite);
      if (def.hasElevation) elevationCount += 1;
    });
  }

  _spawnItemSprite(def, xShift, yShift, instance) {
    const itemData = def.groups[0];
    if (!itemData || !itemData.sprites) return null;
    // Use the same sprite-index math as createEnv but for layer 0 only — items
    // are 1×1 single-layer assets in items.json.
    const index = this.getSpriteIndex(
      itemData,
      0, 0, 0,
      this.x % itemData.patternX,
      this.y % itemData.patternY,
      0, 0
    );
    const spriteId = itemData.sprites[index];
    if (!spriteId || spriteId <= 0) return null;
    const sheet = Math.ceil(spriteId / 1000);
    const offX = def.hasOffset ? def.offsetX * scale : 0;
    const offY = def.hasOffset ? def.offsetY * scale : 0;
    const sprite = this.map.state.add.sprite(
      this.x * field - offX + xShift,
      this.y * field - offY + yShift,
      "tibia" + sheet,
      spriteId.toString()
    );
    this.map.state.group.add(sprite);
    sprite.scale.setTo(scale, scale);
    sprite.anchor.setTo(0.5, 0.5);
    sprite.gameObject = {
      type: "item",
      position: { x: this.x, y: this.y },
      instance_id: instance.instance_id,
      item_id: instance.item_id,
    };
    return sprite;
  }

  // Tile-level helpers used by the input layer to start a drag and to
  // count elevated items underneath the player.
  topItem() {
    return this.items[this.items.length - 1];
  }

  elevationCount() {
    let count = 0;
    for (const it of this.items) {
      const def = items[String(it.item_id)];
      if (def && def.hasElevation) count++;
    }
    return count;
  }

  putObject(object) {
    return this.objects.push(object);
  }

  getObjects() {
    return this.objects;
  }

  deleteObject(object) {
    var index = this.objects.indexOf(object);
    if (index > -1) {
      this.objects.splice(index, 1);
    }
  }
}
