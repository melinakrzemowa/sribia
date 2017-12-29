import { field } from "./globals"
import NameText from "./names"

const mapSize = 10000;

export default class UsersContainer {

  constructor(state) {
    this.state = state;
    this.container = {}; // users contained by user_id
    this.map = new Map(); // users contained by point
  }

  createUserSprite(user) {
    var sprite = this.state.add.sprite(user.x * field, user.y * field, 'babe');
    sprite.scale.setTo(0.35, 0.35);
    sprite.anchor.setTo(0.5)

    sprite.animations.add('s_stand', [0]);
    sprite.animations.add('n_stand', [5]);
    sprite.animations.add('e_stand', [10]);
    sprite.animations.add('w_stand', [15]);
    sprite.animations.add('ne_stand', [20]);
    sprite.animations.add('se_stand', [25]);
    sprite.animations.add('sw_stand', [30]);
    sprite.animations.add('nw_stand', [35]);
    sprite.animations.add('s_move', [1, 2, 3, 4]);
    sprite.animations.add('n_move', [6, 7, 8, 9]);
    sprite.animations.add('e_move', [11, 12, 13, 14]);
    sprite.animations.add('w_move', [16, 17, 18, 19]);
    sprite.animations.add('ne_move', [21, 22, 23, 24]);
    sprite.animations.add('se_move', [26, 27, 28, 29]);
    sprite.animations.add('sw_move', [31, 32, 33, 34]);
    sprite.animations.add('nw_move', [36, 37, 38, 39]);

    return sprite;
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
      let key = user.x * mapSize + user.y;
      this.map.set(key, userObj);
      console.log(this.map);
    }
  }

  get(user_id) {
    return this.container[user_id];
  }

  getFrom(x, y) {
    return this.map.get(x * mapSize + y);
  }

  update(payload) {
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
    this.map.delete(user.x * mapSize + user.y);
    this.map.set(x * mapSize + y, user);

    user.x = x;
    user.y = y;
  }

}
