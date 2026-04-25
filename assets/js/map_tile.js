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

    let elevationIdx = 0;
    visible.forEach((it, stackIdx) => {
      const def = items[String(it.item_id)];
      if (!def) return;

      // All stacked items get a small left shift per stack position so a pile
      // of identical items reads as a stack instead of one sprite.
      const xShift = -stackIdx * 8 * scale;
      let yShift = 0;
      if (def.hasElevation) {
        if (elevationIdx >= MAX_VISIBLE_ELEVATIONS) return; // hide overflow box-stack
        const stepNative = (def.elevation || 8); // sprite-pixel offset per elevation
        yShift = -elevationIdx * stepNative * scale;
        elevationIdx += 1;
      }

      const sprite = this._spawnItemSprite(def, xShift, yShift, it);
      if (sprite) this.itemSprites.push(sprite);
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
    this._enableItemDrag(sprite, instance);
    return sprite;
  }

  // Phaser drag — on release, ask the server to move the item to the tile
  // under the cursor. Snap-back happens automatically because we don't
  // mutate `this.items` here; the server's broadcast (item_removed +
  // item_object) drives the actual move.
  _enableItemDrag(sprite, instance) {
    sprite.inputEnabled = true;
    sprite.input.useHandCursor = true;
    sprite.input.enableDrag(false, false, false, 255);
    sprite.events.onDragStop.add(() => {
      const tx = Math.round(sprite.x / field);
      const ty = Math.round(sprite.y / field);
      const channel = this.map.state.channel;
      if (!channel) return;
      channel.push("move_item", {
        instance_id: instance.instance_id,
        x: tx,
        y: ty,
      });
      // Re-render now so the dragged sprite snaps back; if the server
      // accepts, the broadcasted item_removed + item_object will replace
      // it at the new tile a moment later.
      this._renderItems();
    });
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
