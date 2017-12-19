import {field} from "./globals"

export class Player {

  constructor() {
    this.id = window.user_id;

    this.position = {x: 0, y: 0};
    this.movingPosition = {x: 0, y: 0};

    this.joined = false;
    this.sprite = null;
    this.moving = false;
    this.movingTime = 0;
  }

  movingDistance() {
    return 2;
  }

  move(left) {
    if (left || this.movingPosition.x * field < this.sprite.x) {
      if (left && this.movingPosition.x * field == this.sprite.x) {
        this.position.x = this.movingPosition.x;
        this.movingPosition.x--;
        console.log("Position: ", this.position);
      }
      this.sprite.x -= this.movingDistance();
    } else {
      this.position.x = this.movingPosition.x;
      if (this.moving) {
        console.log("Position: ", this.position);
      }
      this.moving = false;
      this.sprite.animations.stop();
    }
  }

}
