import { field, scale } from "./globals";
import NameText from "./names";

const MAX_ELEVATIONS_ON_HEAD = 3;
const ELEVATION_PIXELS = 8; // sprite-pixel offset per stacked elevated item

export default class Player {
  constructor(state) {
    this.state = state;
    this.id = window.user_id;
    this.type = "character";

    this.position = { x: 0, y: 0 };
    this.movingPosition = { x: 0, y: 0 };
    this.direction = { x: 0, y: 0 };

    this.speed = 1;
    this.joined = false;
    this.name = "";
    this.sprite = null;
    this.nameText = null;
    this.moving = false;
    this.fps = 60;
    this.health = 100;
    this.maxHealth = 100;

    // Logical sprite position used for all movement logic. The actual
    // `sprite.y` is rendered as `logicalY - elevationOffset` so visual
    // elevation never confuses inDestination() etc.
    this.logicalX = 0;
    this.logicalY = 0;

    this.state.channel.on("joined", (payload) => {
      // reset state on reconnect
      if (this.sprite) this.sprite.destroy();
      if (this.nameText) this.nameText.destroy();

      this.joined = true;
      this.speed = payload.speed;
      this.name = payload.name;
      if (typeof payload.max_health === "number") this.maxHealth = payload.max_health;
      if (typeof payload.health === "number") this.health = payload.health;

      this.movingPosition.x = this.position.x = payload.x;
      this.movingPosition.y = this.position.y = payload.y;
      this.logicalX = payload.x * field;
      this.logicalY = payload.y * field;

      this.sprite = this.state.users.createUserSprite(payload);
      this.sprite.gameObject = this;

      // Camera follows an invisible anchor pinned to the player's LOGICAL
      // tile position, not the (possibly elevated) sprite — otherwise the
      // viewport jumps every time we step onto / off a stacked box.
      if (!this.cameraAnchor) {
        const bmd = this.state.add.bitmapData(1, 1);
        this.cameraAnchor = this.state.add.sprite(0, 0, bmd);
        this.cameraAnchor.alpha = 0;
      }
      this.state.camera.follow(this.cameraAnchor);
      this.applyRenderPosition();

      this.nameText = new NameText(this.state.add, this);
    });

    this.state.channel.on("move", (payload) => {
      // Ignore other users
      if (payload.user_id != this.id) return;

      // If player move is blocked then stop movement
      if (
        this.movingPosition.x != payload.x ||
        this.movingPosition.y != payload.y
      ) {
        this.movingPosition = { x: payload.x, y: payload.y };
        this.position = { x: payload.x, y: payload.y };
        this.logicalX = payload.x * field;
        this.logicalY = payload.y * field;
        this.applyRenderPosition();
        this.nameText.update();
      }
    });
  }

  update(direction, fps) {
    this.fps = fps;

    if (!this.joined) return;

    let input = direction.x != 0 || direction.y != 0;

    // Start the movement after input
    if (!this.moving && input) {
      let movingPosition = {
        x: this.position.x + direction.x,
        y: this.position.y + direction.y,
      };
      let animation = this.updateDirection(direction);

      // Check colision
      if (this.state.map.isBlocked(movingPosition.x, movingPosition.y)) return;

      this.moving = true;
      this.movingPosition = movingPosition;
      this.state.channel.push("move", { direction: animation });
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
        if (
          this.state.map.isBlocked(
            this.movingPosition.x + direction.x,
            this.movingPosition.y + direction.y
          )
        ) {
          return;
        }

        this.movingPosition.x += direction.x;
        this.movingPosition.y += direction.y;

        this.state.channel.push("move", { direction: animation });
      }
      this.logicalX += this.movingDistance() * this.direction.x;
      this.logicalY += this.movingDistance() * this.direction.y;
      this.applyRenderPosition();
      this.nameText.update();
    } else {
      // Finish the movement
      this.position.x = this.movingPosition.x;
      this.position.y = this.movingPosition.y;

      this.moving = false;
      this.sprite.animations.stop();
      this.sprite.animations.play(this.getAnimation() + "_stand", 0, true);

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
    this.sprite.animations.play(this.getAnimation() + "_move", 8, true);
    return this.getDirection();
  }

  movingDistance() {
    const baseMoveTime = Math.round(100000 / (2 * (this.speed - 1) + 180));
    // Diagonal moves take twice as long per tile; halve the per-axis speed
    // so the character visibly walks diagonals at half cardinal speed.
    const isDiagonal = this.direction.x !== 0 && this.direction.y !== 0;
    const moveTime = isDiagonal ? baseMoveTime * 2 : baseMoveTime;
    let distance = (field / moveTime) * (1000 / this.fps);
    return distance > field ? field : distance;
  }

  inDestination() {
    let epsilon = this.movingDistance();
    return (
      Math.abs(this.movingPosition.y * field - this.logicalY) <= epsilon &&
      Math.abs(this.movingPosition.x * field - this.logicalX) <= epsilon
    );
  }

  fixPosition() {
    this.logicalX = this.position.x * field;
    this.logicalY = this.position.y * field;
    this.applyRenderPosition();
    if (this.nameText) this.nameText.update();
  }

  // Push logical → rendered: the sprite is shifted up + left to match the
  // visual top of any box stack the player is on (boxes themselves render
  // with -8sp × elevationIdx in BOTH axes). The camera anchor stays on the
  // logical position so elevation never moves the viewport.
  applyRenderPosition() {
    if (!this.sprite) return;
    const off = this.elevationOffset();
    this.sprite.x = this.logicalX - off;
    this.sprite.y = this.logicalY - off;
    if (this.cameraAnchor) {
      this.cameraAnchor.x = this.logicalX;
      this.cameraAnchor.y = this.logicalY;
    }
  }

  // How many sprite pixels the character should be shifted up + left when
  // standing on stacked hasElevation items (cap MAX_ELEVATIONS_ON_HEAD).
  // While moving we read the DESTINATION tile so the sprite lifts (or drops)
  // the instant the step begins, rather than at arrival.
  elevationOffset() {
    if (!this.state.map) return 0;
    const tx = this.moving ? this.movingPosition.x : this.position.x;
    const ty = this.moving ? this.movingPosition.y : this.position.y;
    const tile = this.state.map.getTile(tx, ty);
    if (!tile || typeof tile.elevationCount !== "function") return 0;
    return Math.min(MAX_ELEVATIONS_ON_HEAD, tile.elevationCount()) * ELEVATION_PIXELS * scale;
  }
}
