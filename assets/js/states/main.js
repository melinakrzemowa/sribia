import {mapSize, field, size, scale} from "../globals"

import GameMap from "../game_map"
import GameChannel from "../channels/game_channel"
import Player from "../player"
import UsersContainer from "../users_container"
import MobileDetect from "mobile-detect"

export default class MainState extends Phaser.State {

  preload() {
    this.map = new GameMap(this);
    this.channel = new GameChannel();
    this.player = new Player(this);
    this.users = new UsersContainer(this);
    this.group = this.add.group();

    this.load.atlas('generic', '/sprites/skins/generic-joystick.png', '/sprites/skins/generic-joystick.json');
    this.load.image('background','/sprites/earth_grid.png');
    this.load.spritesheet('babe', '/sprites/babe.png', size, size, 40);
    this.load.spritesheet('tree', '/sprites/trees.png', size * 3, size * 4, 1);
    this.load.spritesheet('tree2', '/sprites/trees.png', size * 2, size * 4, 6);
  }

  create() {
    // FPS
    this.time.advancedTiming = true;
    // Window active in background
    this.stage.disableVisibilityChange = true;

    // Add Joystick
    this.pad = this.game.plugins.add(Phaser.VirtualJoystick);

    this.stick = this.pad.addStick(0, 0, 200, 'generic');
    this.stick.alignBottomLeft(0);

    // Verify if on mobile
    var md = new MobileDetect(window.navigator.userAgent);
    if (!md.mobile()) {
      this.stick.alpha = 0;
      this.stick.enabled = false;
    } else {
      this.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
    }

    // Create background
    let bg = this.add.tileSprite(0, 0, mapSize * 100, mapSize * 100, 'background')
    bg.scale.setTo(scale, scale);
    bg.x -= field / 2;
    bg.y -= field / 2;
    this.world.sendToBack(bg);
    this.world.setBounds(-field / 2, -field / 2, mapSize * 100, mapSize * 100);
    this.input.keyboard.addKeyCapture([Phaser.Keyboard.LEFT, Phaser.Keyboard.RIGHT, Phaser.Keyboard.UP, Phaser.Keyboard.DOWN]);

    // Create test environement
    let tile = this.map.getTile(32091, 32200);
    tile.createEnv('tree', 0, 0.5, 0.875);
    tile.blocks = true;

    tile = this.map.getTile(32086,32205);
    tile.createEnv('tree2', 2, 0.25, 0.875);
    tile.blocks = true;


    // Join channels to listen on events from backend
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

    // this.group.sort('y', Phaser.Group.SORT_ASCENDING);
    this.group.customSort((a, b) => {
      if (a.y == b.y) {
        if (a.env) return 1;
        if (b.env) return -1;
        return 0;
      } else {
        return a.y > b.y ? 1 : -1;
      }
    });
  }

  render() {
    // this.debug.cameraInfo(game.camera, 32, 32);
    this.game.debug.text(this.time.fps || '--', 2, 14, "#00ff00");
    this.game.debug.text(`x: ${this.player.position.x} y: ${this.player.position.y}`, 2, 32, "#00ff00");
    if (this.player.joined) {
      // this.debug.spriteInfo(player.sprite, 32, 180);
      // this.game.debug.spriteCoords(this.player.sprite, 6, 500);
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
