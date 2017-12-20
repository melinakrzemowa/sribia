import {field} from "./globals"

export class Player {

  constructor() {
    this.id = window.user_id;

    this.position = {x: 0, y: 0};
    this.movingPosition = {x: 0, y: 0};
    this.direction = {x: 0, y: 0};

    this.speed = 0;
    this.joined = false;
    this.sprite = null;
    this.moving = false;
    this.movingTime = 0;
  }

  update(direction) {
    if (!this.joined) return;

    let input = (direction.x != 0 || direction.y != 0)

    if (!this.moving && input) {
      this.moving = true;
      this.movingTime = Date.now();

      this.movingPosition = {x: this.position.x + direction.x, y: this.position.y + direction.y};
      this.updateDirection(direction);
    }

    if (input || this.movingPosition.x * field != this.sprite.x || this.movingPosition.y * field != this.sprite.y) {
      if (input && this.movingPosition.x * field == this.sprite.x && this.movingPosition.y * field == this.sprite.y) {
        this.position.x = this.movingPosition.x;
        this.position.y = this.movingPosition.y;
        this.movingPosition.x += direction.x;
        this.movingPosition.y += direction.y;
        this.updateDirection(direction);

        console.log("Position: ", this.position);
        // gameChannel.push("move", {direction: "w"});
      }
      this.sprite.x += this.movingDistance() * this.direction.x;
      this.sprite.y += this.movingDistance() * this.direction.y;
    } else {
      this.position.x = this.movingPosition.x;
      this.position.y = this.movingPosition.y;

      if (this.moving) {
        console.log("Position: ", this.position);
        // gameChannel.push("move", {direction: "w"});
      }
      this.moving = false;
      this.sprite.animations.stop();
    }
  }

  updateDirection(direction) {
    this.direction = direction;
    let animation = "";
    if (direction.y > 0) animation += "s";
    if (direction.y < 0) animation += "n";
    if (direction.x > 0) animation += "e";
    if (direction.x < 0) animation += "w";

    this.sprite.animations.play(animation + '_move', 30, true);
  }

  movingDistance() {
    return 2;
  }

}
