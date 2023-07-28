import {field} from "./globals"
import NameText from "./names"

export default class Player {

  constructor(state) {
    this.state = state;
    this.id = window.user_id;

    this.position = {x: 0, y: 0};
    this.movingPosition = {x: 0, y: 0};
    this.direction = {x: 0, y: 0};

    this.speed = 1;
    this.joined = false;
    this.name = "";
    this.sprite = null;
    this.nameText = null;
    this.moving = false;
    this.fps = 60;

    this.state.channel.on("joined", payload => {
      // reset state on reconnect
      if (this.sprite) this.sprite.destroy();
      if (this.nameText) this.nameText.destroy();

      this.joined = true;
      this.speed = payload.speed;
      this.name = payload.name;

      this.movingPosition.x = this.position.x = payload.x;
      this.movingPosition.y = this.position.y = payload.y;

      this.sprite = this.state.users.createUserSprite(payload);
      this.state.camera.follow(this.sprite);

      this.nameText = new NameText(this.state.add, this);
    });

    this.state.channel.on("move", payload => {
      // Ignore other users
      if (payload.user_id != this.id) return;

      // If player move is blocked then stop movement
      if (this.movingPosition.x != payload.x || this.movingPosition.y != payload.y) {
        this.sprite.x = payload.x * field;
        this.sprite.y = payload.y * field;
        this.movingPosition = {x: payload.x, y: payload.y}
        this.position = {x: payload.x, y: payload.y}
        this.nameText.update();
      }
    });
  }

  update(direction, fps) {
    this.fps = fps;

    if (!this.joined) return;

    let input = (direction.x != 0 || direction.y != 0);

    // Start the movement after input
    if (!this.moving && input) {
      let movingPosition = {x: this.position.x + direction.x, y: this.position.y + direction.y};
      let animation = this.updateDirection(direction);

      // Check colision
      if (this.state.map.isBlocked(movingPosition.x, movingPosition.y)) return;

      this.moving = true;
      this.movingPosition = movingPosition;
      this.state.channel.push("move", {direction: animation});
    }

    if (input || !this.inDestination()) {
      // Continue the movement if clicked or the player not in destination yet
      if (input && this.inDestination()) {
        // Continue the movement if clicked and player reached destination
        this.position.x = this.movingPosition.x;
        this.position.y = this.movingPosition.y;
        this.fixPosition();

        let animation = this.updateDirection(direction);

        // Check colision
        if (this.state.map.isBlocked(this.movingPosition.x + direction.x, this.movingPosition.y + direction.y)) {
          return;
        }

        this.movingPosition.x += direction.x;
        this.movingPosition.y += direction.y;

        console.log("Position: ", this.position);
        this.state.channel.push("move", {direction: animation});
      }
      this.sprite.x += this.movingDistance() * this.direction.x;
      this.sprite.y += this.movingDistance() * this.direction.y;
      this.nameText.update();
    } else {
      // Finish the movement
      this.position.x = this.movingPosition.x;
      this.position.y = this.movingPosition.y;

      if (this.moving) {
        console.log("Position: ", this.position);
      }
      this.moving = false;
      this.sprite.animations.stop();
      this.sprite.animations.play(this.getAnimation() + '_stand', 0, true);

      this.fixPosition();
    }
  }

  getDirection() {
    let direction = "";
    if (this.direction.y > 0) direction += "s";
    if (this.direction.y < 0) direction += "n";
    if (this.direction.x > 0) direction += "e";
    if (this.direction.x < 0) direction += "w";
    return direction;
  }

  getAnimation() {
    if (this.direction.x > 0) return "e";
    if (this.direction.x < 0) return "w";
    if (this.direction.y > 0) return "s";
    if (this.direction.y < 0) return "n";
    
    return "";
  }

  updateDirection(direction) {
    this.direction = direction;
    this.sprite.animations.play(this.getAnimation() + '_move', 4, true);
    return this.getDirection();
  }

  movingDistance() {
    let distance = field / Math.round(100000 / (2 * (this.speed - 1) + 120)) * (1000 / this.fps);
    return distance > field ? field : distance;
  }

  inDestination() {
    let epsilon = this.movingDistance();

    return Math.abs(this.movingPosition.y * field - this.sprite.y) <= epsilon &&
           Math.abs(this.movingPosition.x * field - this.sprite.x) <= epsilon;
  }

  fixPosition() {
    this.sprite.x = this.position.x * field;
    this.sprite.y = this.position.y * field;
    this.nameText.update();
  }

}
