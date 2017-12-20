import { field } from "./globals"

export default class UsersContainer {

  constructor(state) {
    this.state = state;
    this.container = {};

  }

  createUserSprite(user) {
    console.log(field);
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
      this.container[user.user_id] = {
        sprite: this.createUserSprite(user),
        x: user.x,
        y: user.y
      };
    }
  }

  get(user_id) {
    return this.container[user_id];
  }

  move(payload) {
    let x = payload.x;
    let y = payload.y;
    let self = this;

    // let user = this.get(payload.user_id);

    // Check if sprite should be moved
    if (x != this.container[payload.user_id].x || y != this.container[payload.user_id].y) {

      // Check which animation to play
      let animation = "";
      if (y > this.container[payload.user_id].y) animation += "s";
      if (y < this.container[payload.user_id].y) animation += "n";
      if (x > this.container[payload.user_id].x) animation += "e";
      if (x < this.container[payload.user_id].x) animation += "w";

      // Save last move time
      this.container[payload.user_id].moved = Date.now();

      // Move sprite with tween and play animation
      this.container[payload.user_id].sprite.animations.play(animation + '_move', 30, true);
      var tween = this.state.add.tween(this.container[payload.user_id].sprite).to( { x: x * field, y: y * field}, payload.move_time, null, true);
      tween.onComplete.add(function() {
        // Stop animation if user stopped moving
        if(Date.now() - self.container[payload.user_id].moved > 200) {
          self.container[payload.user_id].sprite.animations.stop();
        }
      });
    } else {
      // If sprite shouldn't be moved then set its position to correct one
      this.container[payload.user_id].sprite.x = payload.x * field;
      this.container[payload.user_id].sprite.y = payload.y * field;
    }

    // Save user position
    this.container[payload.user_id].x = x;
    this.container[payload.user_id].y = y;
  }

}
