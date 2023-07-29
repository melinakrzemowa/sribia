import { field, scale, size } from "./globals"
import NameText from "./names"
import outfits from "./data/outfits.json" assert {type: 'json'}

export default class UsersContainer {

  constructor(state) {
    this.state = state;
    this.container = {}; // users contained by user_id
  }

  getSpriteIndex(group, w, h, l, x, y, z, f) {
    return ((((((f % group.frames) * group.patternZ + z) * group.patternY + y) * group.patternX + x) * group.layers + l) * group.height + h) * group.width + w;
  };

  createUserSprite(user) {

    user.outfit = 128
    let outfitData = outfits[user.outfit]
    let itemData = outfitData

    for (let w = 0; w < itemData.width; w++) {
      for (let h = 0; h < itemData.height; h++) {
        for (var l = 0; l < itemData.layers; l++) {
          let index = this.getSpriteIndex(itemData, w, h, l, 0, 0, 0, 0)
          let spriteId = itemData.sprites[index]
        
          if (spriteId > 0) {
            let sheetNumber = Math.ceil(spriteId / 1000)
            let sprite = this.state.add.sprite((user.x - w) * field, (user.y - h) * field, 'tibia' + sheetNumber, spriteId.toString())
            this.state.group.add(sprite)
            sprite.scale.setTo(scale, scale);
            sprite.anchor.setTo(0.75, 0.75)

            let directions = ['n', 'e', 's', 'w']

            directions.forEach((dir, i) => {
              let frames = [];

              for (let f = 1; f < itemData.frames; f++) {
                let index = this.getSpriteIndex(itemData, w, h, l, i, 0, 0, f)
                frames[f] = itemData.sprites[index].toString()
              }
  
              sprite.animations.add(dir + '_move', frames)

              let index = this.getSpriteIndex(itemData, w, h, l, i, 0, 0, 0)
              sprite.animations.add(dir + '_stand', [itemData.sprites[index].toString()])
            })

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
        x: user.x,
        y: user.y,
        name: user.name
      };

      userObj.nameText = new NameText(this.state.add, userObj);

      this.container[user.user_id] = userObj;
      this.state.map.putObject(user.x, user.y, userObj);
    }
  }

  get(user_id) {
    return this.container[user_id];
  }

  move(payload) {
    let x = payload.x;
    let y = payload.y;
    let self = this;

    let user = this.get(payload.user_id);

    // Check if sprite should be moved
    if (x != user.x || y != user.y) {

      // Check which animation to play
      let animation = "";
      if (y > user.y) animation += "s";
      if (y < user.y) animation += "n";
      if (x > user.x) animation += "e";
      if (x < user.x) animation += "w";

      // Save last move time
      user.moved = Date.now();

      // Move sprite with tween and play animation
      user.sprite.animations.play(animation + '_move', 8, true);
      var tween = this.state.add.tween(user.sprite).to( { x: x * field, y: y * field}, payload.move_time, null, true);
      tween.onComplete.add(function() {
        // Stop animation if user stopped moving
        if(Date.now() - self.container[payload.user_id].moved > 200) {
          user.sprite.animations.stop();
          user.sprite.animations.play(animation + '_stand', 0, true);
          user.nameText.update();
        }
      });
      tween.onUpdateCallback(() => {
        user.nameText.update();
      });
    } else {
      // If sprite shouldn't be moved then set its position to correct one
      user.sprite.x = payload.x * field;
      user.sprite.y = payload.y * field;
    }

    // Save user position
    this.state.map.deleteObject(user.x, user.y, user);
    this.state.map.putObject(x, y, user);

    user.x = x;
    user.y = y;
  }

}
