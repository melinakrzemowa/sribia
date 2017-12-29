import {field} from "./globals"

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
      this.joined = true;
      this.speed = payload.speed;
      this.name = payload.name;

      this.movingPosition.x = this.position.x = payload.x;
      this.movingPosition.y = this.position.y = payload.y;

      this.sprite = this.state.users.createUserSprite(payload);
      this.state.camera.follow(this.sprite);

      let style = { font: "bold 12px Tahoma", fill: "#43d637", align: "center", stroke: '#000000', strokeThickness: 2};

      this.nameText = this.state.add.text(this.sprite.x, this.sprite.y - 24, this.name, style);
      this.nameText.anchor.set(0.5);
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
        this.setTextPosition();
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
      if (this.state.users.getFrom(movingPosition.x, movingPosition.y)) return;

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
        if (this.state.users.getFrom(this.movingPosition.x + direction.x, this.movingPosition.y + direction.y)) {
          return;
        }

        this.movingPosition.x += direction.x;
        this.movingPosition.y += direction.y;

        console.log("Position: ", this.position);
        this.state.channel.push("move", {direction: animation});
      }
      this.sprite.x += this.movingDistance() * this.direction.x;
      this.sprite.y += this.movingDistance() * this.direction.y;
      this.setTextPosition();
    } else {
      // Finish the movement
      this.position.x = this.movingPosition.x;
      this.position.y = this.movingPosition.y;

      if (this.moving) {
        console.log("Position: ", this.position);
      }
      this.moving = false;
      this.sprite.animations.stop();

      this.fixPosition();
    }
  }

  updateDirection(direction) {
    this.direction = direction;
    let animation = "";
    if (direction.y > 0) animation += "s";
    if (direction.y < 0) animation += "n";
    if (direction.x > 0) animation += "e";
    if (direction.x < 0) animation += "w";

    this.sprite.animations.play(animation + '_move', 8, true);

    return animation;
  }

  movingDistance() {
    // let now = Date.now();
    // let time = this.movingTime - now;

    // let fullDistance = Math.sqrt(Math.pow(this.position.x * field - this.movingPosition.x * field, 2) + Math.pow(this.position.y * field - this.movingPosition.y * field, 2))
    // let distance = Math.sqrt(Math.pow(this.movingPosition.y * field - this.sprite.y, 2) + Math.pow(this.movingPosition.x * field - this.sprite.x, 2));
    // console.log(fullDistance);
    // console.log(distance);


    return field / Math.round(100000 / (2 * (this.speed - 1) + 120)) * (1000 / this.fps);

    // s = v * t
    // t = 1000 / fps
    // v = distance / time

    // return 1.45635673567;
  }

  inDestination() {
    let epsilon = this.movingDistance();

    return Math.abs(this.movingPosition.y * field - this.sprite.y) <= epsilon &&
           Math.abs(this.movingPosition.x * field - this.sprite.x) <= epsilon;
  }

  fixPosition() {
    this.sprite.x = this.position.x * field;
    this.sprite.y = this.position.y * field;
    this.setTextPosition();
  }

  setTextPosition() {
    this.nameText.x = this.sprite.x;
    this.nameText.y = this.sprite.y - 24;
  }

}
