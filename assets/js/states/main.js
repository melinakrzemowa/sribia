window.PIXI   = require('phaser-ce/build/custom/pixi');
window.p2     = require('phaser-ce/build/custom/p2');
window.Phaser = require('phaser-ce/build/custom/phaser-split');

import {field} from "../globals"

import GameChannel from "../channels/game_channel"
import Player from "../player"
import UsersContainer from "../users_container"

export default class MainState extends Phaser.State {

  preload() {
    this.channel = new GameChannel();
    this.player = new Player(this);
    this.users = new UsersContainer(this);

    this.load.image('ball', '/sprites/shinyball.png', field, field);
    this.load.image('background','/sprites/debug-grid-1920x1920.png');
    this.load.spritesheet('deathknight', '/sprites/deathknight.png', 72, 72, 76);
  }

  create() {
    this.time.advancedTiming = true;

    let bg = this.add.tileSprite(0, 0, 1920, 1920, 'background')
    bg.scale.setTo(1.125, 1.125);
    bg.x = -18;
    bg.y = -18;
    this.world.setBounds(-18, -18, 2142, 2142);
    this.input.keyboard.addKeyCapture([Phaser.Keyboard.LEFT, Phaser.Keyboard.RIGHT, Phaser.Keyboard.UP, Phaser.Keyboard.DOWN]);

    this.channel.on("move", user => {
      if (user.user_id == this.player.id) return;

      this.users.add(user);
      this.users.move(user);
    });

    this.channel.join();
  }

  update() {
    let direction = {x: 0, y: 0};

    if (this.input.keyboard.isDown(Phaser.Keyboard.LEFT)) direction.x--;
    if (this.input.keyboard.isDown(Phaser.Keyboard.RIGHT)) direction.x++;
    if (this.input.keyboard.isDown(Phaser.Keyboard.UP)) direction.y--;
    if (this.input.keyboard.isDown(Phaser.Keyboard.DOWN)) direction.y++;

    this.player.update(direction, this.time.fps);
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


}
