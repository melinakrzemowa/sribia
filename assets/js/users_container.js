import { field } from "./globals"

const mapSize = 10000;

export default class UsersContainer {

  constructor(state) {
    this.state = state;
    this.container = {}; // users contained by user_id
    this.map = new Map(); // users contained by point
  }

  createUserSprite(user) {
    var sprite = this.state.add.sprite(user.x * field, user.y * field, 'deathknight', 4);
    sprite.scale.setTo(0.5, 0.5);
    sprite.anchor.setTo(0.5)
    sprite.animations.add('n_move', [0, 8, 16, 24, 32]);
    sprite.animations.add('e_move', [2, 10, 18, 26, 34]);
    sprite.animations.add('s_move', [4, 12, 20, 28, 36]);
    sprite.animations.add('w_move', [6, 14, 22, 30, 38]);
    sprite.animations.add('ne_move', [1, 9, 17, 25, 33]);
    sprite.animations.add('nw_move', [7, 15, 23, 31, 39]);
    sprite.animations.add('se_move', [3, 11, 19, 27, 35]);
    sprite.animations.add('sw_move', [5, 13, 21, 29, 37]);

    return sprite;
  }

  add(user) {
    if (!this.container[user.user_id]) {
      let userObj = {
        sprite: this.createUserSprite(user),
        x: user.x,
        y: user.y
      };

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
      user.sprite.animations.play(animation + '_move', 30, true);
      var tween = this.state.add.tween(user.sprite).to( { x: x * field, y: y * field}, payload.move_time, null, true);
      tween.onComplete.add(function() {
        // Stop animation if user stopped moving
        if(Date.now() - self.container[payload.user_id].moved > 200) {
          self.container[payload.user_id].sprite.animations.stop();
        }
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
