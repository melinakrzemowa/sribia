window.PIXI   = require('phaser-ce/build/custom/pixi');
window.p2     = require('phaser-ce/build/custom/p2');
window.Phaser = require('phaser-ce/build/custom/phaser-split');

// Import dependencies
//
// If you no longer want to use a dependency, remember
// to also remove its path from "config.paths.watched".
import "phoenix_html"

import {player} from "./player"
import {field} from "./globals"
import socket from "./socket"
import "./channels/chat_channel"
import {gameChannel} from "./channels/game_channel"

var game = new Phaser.Game(540, 540, Phaser.CANVAS, 'game', { preload: preload, create: create, update: update, render: render });
let users = {};

function preload() {
  game.load.image('ball', '/sprites/shinyball.png', field, field);
  game.load.image('background','/sprites/debug-grid-1920x1920.png');
  game.load.spritesheet('deathknight', '/sprites/deathknight.png', 72, 72, 76);
}

function create() {
  game.time.advancedTiming = true;

  let bg = game.add.tileSprite(0, 0, 1920, 1920, 'background')
  bg.scale.setTo(1.125, 1.125);
  bg.x = -18;
  bg.y = -18;
  game.world.setBounds(-18, -18, 2142, 2142);
  game.input.keyboard.addKeyCapture([Phaser.Keyboard.LEFT, Phaser.Keyboard.RIGHT, Phaser.Keyboard.UP, Phaser.Keyboard.DOWN]);

  gameChannel.on("joined", payload => {
    $("#stats").html(`Speed: ${payload.speed}`);
    player.speed = payload.speed;
    player.joined = true;
    player.movingPosition.x = player.position.x = payload.x;
    player.movingPosition.y = player.position.y = payload.y;

    player.sprite = createUserSprite(payload);
    game.camera.follow(player.sprite);
    player.sprite.anchor.setTo(0.5)
  });

  gameChannel.on("move", user => {
    if (user.user_id == player.id) return;

    if (!users[user.user_id]) {
      users[user.user_id] = {sprite: createUserSprite(user)};
    }
    move(user);
  });

  gameChannel.join();

}

function update() {

  let direction = {x: 0, y: 0};

  if (game.input.keyboard.isDown(Phaser.Keyboard.LEFT)) direction.x--;
  if (game.input.keyboard.isDown(Phaser.Keyboard.RIGHT)) direction.x++;
  if (game.input.keyboard.isDown(Phaser.Keyboard.UP)) direction.y--;
  if (game.input.keyboard.isDown(Phaser.Keyboard.DOWN)) direction.y++;

  player.update(direction, game.time.fps);
}

function render() {
  game.debug.cameraInfo(game.camera, 32, 32);
  if (player.joined) {
    game.debug.spriteInfo(player.sprite, 32, 180);
    game.debug.spriteCoords(player.sprite, 32, 460);
  }
  game.debug.text(game.time.fps || '--', 2, 14, "#00ff00");
}

function createUserSprite(user) {
  var sprite = game.add.sprite(user.x * field, user.y * field, 'deathknight', 4);
  sprite.scale.setTo(0.5, 0.5);
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

function move(user) {

  var x = user.x * field;
  var y = user.y * field;

  if (x != users[user.user_id].sprite.x || y != users[user.user_id].sprite.y) {

    let animation = "";
    if (y > users[user.user_id].sprite.y) animation += "s";
    if (y < users[user.user_id].sprite.y) animation += "n";
    if (x > users[user.user_id].sprite.x) animation += "e";
    if (x < users[user.user_id].sprite.x) animation += "w";

    users[user.user_id].sprite.animations.play(animation + '_move', 15, true);

    var tween = game.add.tween(users[user.user_id].sprite).to( { x: x, y: y }, user.move_time, null, true);
    tween.onComplete.add(function() {
      users[user.user_id].sprite.x = x;
      users[user.user_id].sprite.y = y;
      users[user.user_id].sprite.animations.stop();
    });
  } else {
    users[user.user_id].sprite.x = user.x * field;
    users[user.user_id].sprite.y = user.y * field;
  }
}
