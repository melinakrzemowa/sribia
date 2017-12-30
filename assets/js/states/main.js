import {field} from "../globals"

import ObjectMap from "../object_map"
import GameChannel from "../channels/game_channel"
import Player from "../player"
import UsersContainer from "../users_container"

export default class MainState extends Phaser.State {

  preload() {
    this.map = new ObjectMap(this);
    this.channel = new GameChannel();
    this.player = new Player(this);
    this.users = new UsersContainer(this);
    this.group = this.add.group();

    this.load.atlas('generic', '/sprites/skins/generic-joystick.png', '/sprites/skins/generic-joystick.json');
    this.load.image('ball', '/sprites/shinyball.png', field, field);
    this.load.image('background','/sprites/debug-grid-1920x1920.png');
    this.load.spritesheet('deathknight', '/sprites/deathknight.png', 72, 72, 76);
    this.load.spritesheet('babe', '/sprites/babe.png', 144, 144, 40);
  }

  create() {
    this.time.advancedTiming = true;
    this.stage.disableVisibilityChange = true;

    this.pad = this.game.plugins.add(Phaser.VirtualJoystick);

    this.stick = this.pad.addStick(0, 0, 200, 'generic');
    this.stick.alignBottomLeft(0);

    var md = new MobileDetect(window.navigator.userAgent);
    if (!md.mobile()) {
      this.stick.alpha = 0;
      this.stick.enabled = false;
    }

    let bg = this.add.tileSprite(0, 0, 1920, 1920, 'background')
    bg.scale.setTo(1, 1);
    bg.x = -36;
    bg.y = -36;
    this.world.sendToBack(bg);
    this.world.setBounds(-36, -36, 2142, 2142);
    this.input.keyboard.addKeyCapture([Phaser.Keyboard.LEFT, Phaser.Keyboard.RIGHT, Phaser.Keyboard.UP, Phaser.Keyboard.DOWN]);

    this.channel.on("move", user => {
      if (user.user_id == this.player.id) return;
      this.users.move(user);
    });

    this.channel.on("user_joined", user => {
      if (user.user_id == this.player.id) return;
      this.users.add(user);
    });

    this.channel.join();
  }

  update() {
    let direction = {x: 0, y: 0};

    if (this.stick.isDown) {
      direction = this.octantToDirection();
    }

    if (!this.stick.isDown && this.input.keyboard.isDown(Phaser.Keyboard.LEFT)) direction.x--;
    if (!this.stick.isDown && this.input.keyboard.isDown(Phaser.Keyboard.RIGHT)) direction.x++;
    if (!this.stick.isDown && this.input.keyboard.isDown(Phaser.Keyboard.UP)) direction.y--;
    if (!this.stick.isDown && this.input.keyboard.isDown(Phaser.Keyboard.DOWN)) direction.y++;

    this.player.update(direction, this.time.fps);

    this.group.sort('y', Phaser.Group.SORT_ASCENDING);
  }

  render() {
    // this.debug.cameraInfo(game.camera, 32, 32);
    this.game.debug.text(this.time.fps || '--', 2, 14, "#00ff00");
    this.game.debug.text(`x: ${this.player.position.x} y: ${this.player.position.y}`, 2, 32, "#00ff00");
    if (this.player.joined) {
      // this.debug.spriteInfo(player.sprite, 32, 180);
      this.game.debug.spriteCoords(this.player.sprite, 6, 500);
    }
  }

  octantToDirection() {
    switch(this.stick.octant) {
      case 0:   return {x: 1, y: 0};
      case 45:  return {x: 1, y: 1};
      case 90:  return {x: 0, y: 1};
      case 135: return {x: -1, y: 1};
      case 180: return {x: -1, y: 0};
      case 225: return {x: -1, y: -1};
      case 270: return {x: 0, y: -1};
      case 315: return {x: 1, y: -1};
      case 360: return {x: 1, y: 0};
    }
  }


}
