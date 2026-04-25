import { field, scale, size } from "./globals";
import NameText from "./names";
import outfits from "./data/outfits.json" assert { type: "json" };

const MAX_ELEVATIONS_ON_HEAD = 3;
const ELEVATION_PIXELS = 8;

export default class UsersContainer {
  constructor(state) {
    this.state = state;
    this.container = {}; // users contained by user_id
  }

  // Returns the px offset to apply on both axes when a user stands on
  // stacked hasElevation items.
  elevationOffset(x, y) {
    const tile = this.state.map && this.state.map.getTile(x, y);
    if (!tile || typeof tile.elevationCount !== "function") return 0;
    return Math.min(MAX_ELEVATIONS_ON_HEAD, tile.elevationCount()) * ELEVATION_PIXELS * scale;
  }

  applyElevation(user) {
    if (!user || !user.sprite || user.moving) return;
    const off = this.elevationOffset(user.position.x, user.position.y);
    user.sprite.x = user.position.x * field - off;
    user.sprite.y = user.position.y * field - off;
    if (user.nameText) user.nameText.update();
  }

  // Called when an item appears/disappears on a tile — refresh any user
  // currently standing there so they snap up/down by an elevation step.
  refreshElevationAt(x, y) {
    for (const id in this.container) {
      const u = this.container[id];
      if (!u.moving && u.position.x === x && u.position.y === y) this.applyElevation(u);
    }
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

  createUserSprite(user) {
    user.outfit = 128;
    let outfitData = outfits[user.outfit];
    let itemData = outfitData.groups[0];

    for (let w = 0; w < itemData.width; w++) {
      for (let h = 0; h < itemData.height; h++) {
        for (var l = 0; l < itemData.layers; l++) {
          let index = this.getSpriteIndex(itemData, w, h, l, 0, 0, 0, 0);
          let spriteId = itemData.sprites[index];

          if (spriteId > 0) {
            let sheetNumber = Math.ceil(spriteId / 1000);
            let sprite = this.state.add.sprite(
              (user.x - w) * field,
              (user.y - h) * field,
              "tibia" + sheetNumber,
              spriteId.toString()
            );
            this.state.group.add(sprite);
            sprite.scale.setTo(scale, scale);
            sprite.anchor.setTo(0.75, 0.75);

            let directions = ["n", "e", "s", "w"];

            directions.forEach((dir, i) => {
              let frames = [];

              for (let f = 1; f < itemData.frames; f++) {
                let index = this.getSpriteIndex(itemData, w, h, l, i, 0, 0, f);
                frames[f] = itemData.sprites[index].toString();
              }

              sprite.animations.add(dir + "_move", frames);

              let index = this.getSpriteIndex(itemData, w, h, l, i, 0, 0, 0);
              sprite.animations.add(dir + "_stand", [
                itemData.sprites[index].toString(),
              ]);
            });

            return sprite;
          }
        }
      }
    }
  }

  add(user) {
    if (!this.container[user.user_id]) {
      let userObj = {
        sprite: this.createUserSprite(user),
        position: { x: user.x, y: user.y },
        movingPosition: { x: user.x, y: user.y },
        moving: false,
        type: "character",
        name: user.name,
        health: typeof user.health === "number" ? user.health : 100,
        maxHealth: typeof user.max_health === "number" ? user.max_health : 100,
      };

      userObj.nameText = new NameText(this.state.add, userObj);

      userObj.sprite.gameObject = userObj;
      this.container[user.user_id] = userObj;
      this.state.map.putObject(user.x, user.y, userObj);
      this.applyElevation(userObj);
    }
  }

  get(user_id) {
    return this.container[user_id];
  }

  remove(user_id) {
    const user = this.container[user_id];
    if (user) {
      // Remove from map
      this.state.map.deleteObject(user.position.x, user.position.y, user);

      // Destroy sprite and nameText
      if (user.sprite) {
        user.sprite.destroy();
      }
      if (user.nameText) {
        user.nameText.destroy();
      }

      // Remove from container
      delete this.container[user_id];

      console.log(`Removed user ${user_id} from the board`);
    }
  }

  move(payload) {
    let x = payload.x;
    let y = payload.y;
    let self = this;

    let user = this.get(payload.user_id);

    // Check if sprite should be moved
    if (x != user.position.x || y != user.position.y) {
      // Check which animation to play
      let animation = "";
      if (y > user.position.y) animation = "s";
      if (y < user.position.y) animation = "n";
      if (x > user.position.x) animation = "e";
      if (x < user.position.x) animation = "w";

      // Save last move time
      user.moved = Date.now();
      user.moving = true;
      user.movingPosition = { x, y };

      // Move sprite with tween and play animation
      user.sprite.animations.play(animation + "_move", 8, true);
      var tween = this.state.add
        .tween(user.sprite)
        .to({ x: x * field, y: y * field }, payload.move_time, null, true);
      const usersContainer = this;
      tween.onComplete.add(function () {
        // Stop animation if user stopped moving
        const u = self.container[payload.user_id];
        if (!u) return;
        if (Date.now() - u.moved > 200) {
          u.sprite.animations.stop();
          u.sprite.animations.play(animation + "_stand", 0, true);
          u.nameText.update();
        }
        u.moving = false;
        usersContainer.applyElevation(u);
      });
      tween.onUpdateCallback(() => {
        user.nameText.update();
      });
    } else {
      // If sprite shouldn't be moved then set its position to correct one
      user.sprite.x = payload.x * field;
      user.sprite.y = payload.y * field;
      user.moving = false;
      this.applyElevation(user);
    }

    // Save user position
    this.state.map.deleteObject(user.position.x, user.position.y, user);
    this.state.map.putObject(x, y, user);

    user.position.x = x;
    user.position.y = y;
  }
}
