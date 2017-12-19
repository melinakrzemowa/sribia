// NOTE: The contents of this file will only be executed if
// you uncomment its entry in "assets/js/app.js".

// To use Phoenix channels, the first step is to import Socket
// and connect at the socket path in "lib/web/endpoint.ex":
import {Socket} from "phoenix"

window.PIXI   = require('phaser-ce/build/custom/pixi');
window.p2     = require('phaser-ce/build/custom/p2');
window.Phaser = require('phaser-ce/build/custom/phaser-split');

var game = new Phaser.Game(540, 540, Phaser.CANVAS, 'game', { preload: preload, create: create, update: update, render: render });
let users = {};
var field = 36;
let player = {
  id: window.user_id,
  joined: false,
  sprite: null
};
let socket;
let gameChannel;

function preload() {
  game.load.image('ball', '/sprites/shinyball.png', field, field);
  game.load.image('background','/sprites/debug-grid-1920x1920.png');
  game.load.spritesheet('deathknight', '/sprites/deathknight.png', 72, 72, 76);
}

function create() {
  let bg = game.add.tileSprite(0, 0, 1920, 1920, 'background')
  bg.scale.setTo(1.125, 1.125);
  bg.x = -18;
  bg.y = -18;
  game.world.setBounds(-18, -18, 2142, 2142);

  socket = new Socket("/socket", {params: {token: window.token}});

  socket.connect()

  // Now that you are connected, you can join channels with a topic:
  let channel = socket.channel("chat:lobby", {});

  let chatInput         = document.querySelector("#chat-input")
  let messagesContainer = document.querySelector("#messages")

  chatInput.addEventListener("keypress", event => {
    if(event.keyCode === 13){
      channel.push("shout", {body: chatInput.value})
      chatInput.value = ""
    }
  })

  channel.on("shout", payload => {
    let messageItem = document.createElement("li");
    messageItem.innerText = `[${new Date().toLocaleString()}] ${payload.user}: ${payload.body}`
    messagesContainer.appendChild(messageItem)
  })

  channel.join()
    .receive("ok", resp => { console.log("Joined successfully", resp) })
    .receive("error", resp => { console.log("Unable to join", resp) })

  gameChannel = socket.channel("game:lobby", {});

  gameChannel.on("joined", payload => {
    $("#stats").html(`Speed: ${payload.speed}`);
    player.speed = payload.speed;
    player.sprite = createUserSprite(payload)
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

  gameChannel.join()
    .receive("ok", resp => { console.log("Joined successfully", resp); })
    .receive("error", resp => { console.log("Unable to join", resp) })
}

function update() {






    // if (game.input.keyboard.isDown(Phaser.Keyboard.LEFT))
    // {
    //   gameChannel.push("move", {direction: "w"});
    // }
    //
    // if (game.input.keyboard.isDown(Phaser.Keyboard.RIGHT))
    // {
    //   gameChannel.push("move", {direction: "e"});
    // }
    //
    // if (game.input.keyboard.isDown(Phaser.Keyboard.UP))
    // {
    //   gameChannel.push("move", {direction: "n"});
    // }
    //
    // if (game.input.keyboard.isDown(Phaser.Keyboard.DOWN))
    // {
    //   gameChannel.push("move", {direction: "s"});
    // }

}

function render() {
  game.debug.cameraInfo(game.camera, 32, 32);
  if (player.joined) {
    game.debug.spriteInfo(player.sprite, 32, 200);
    game.debug.spriteCoords(player.sprite, 32, 460);
  }
}

function createUserSprite(user) {
  var sprite = game.add.sprite(user.x * field, user.y * field, 'deathknight', 4);
  sprite.scale.setTo(0.5, 0.5);
  sprite.animations.add('n_move', [0, 8, 16, 24, 32]);
  sprite.animations.add('e_move', [2, 10, 18, 26, 34]);
  sprite.animations.add('s_move', [4, 12, 20, 28, 36]);
  sprite.animations.add('w_move', [6, 14, 22, 30, 38]);

  return sprite;
}

function move(user) {

  var x = user.x * field;
  var y = user.y * field;

  if (x != users[user.user_id].sprite.x || y != users[user.user_id].sprite.y) {

    if (x > users[user.user_id].sprite.x) {
      users[user.user_id].sprite.animations.play('e_move', 30, true);
    }
    if (x < users[user.user_id].sprite.x) {
      users[user.user_id].sprite.animations.play('w_move', 30, true);
    }
    if (y > users[user.user_id].sprite.y) {
      users[user.user_id].sprite.animations.play('s_move', 30, true);
    }
    if (y < users[user.user_id].sprite.y) {
      users[user.user_id].sprite.animations.play('n_move', 30, true);
    }

    var tween = game.add.tween(users[user.user_id].sprite).to( { x: x, y: y }, user.move_time, null, true);
    tween.onComplete.add(function() {
      users[user.user_id].sprite.x = x;
      users[user.user_id].sprite.y = y;
      // users[user.user_id].sprite.animations.stop();
    });
  } else {
    users[user.user_id].sprite.x = user.x * field;
    users[user.user_id].sprite.y = user.y * field;
  }
}

export default socket
