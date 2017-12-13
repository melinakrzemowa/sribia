// NOTE: The contents of this file will only be executed if
// you uncomment its entry in "assets/js/app.js".

// To use Phoenix channels, the first step is to import Socket
// and connect at the socket path in "lib/web/endpoint.ex":
import {Socket} from "phoenix"

window.PIXI   = require('phaser-ce/build/custom/pixi');
window.p2     = require('phaser-ce/build/custom/p2');
window.Phaser = require('phaser-ce/build/custom/phaser-split');

var game = new Phaser.Game(512, 512, Phaser.AUTO, 'phaser-example', { preload: preload, create: create, update: update, render: render });
let users = {};
var field = 32;
var user_id = window.user_id;
let speed = 1;
let socket;
let gameChannel;

function preload() {
  game.load.image('ball', '/sprites/shinyball.png', field, field);
}

function create() {
  game.stage.backgroundColor = '#ccff99';
  game.input.onTap.add(onTap, this);

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

  gameChannel.on("move", payload => {
    if (!users[payload.user_id]) {
      createUser(payload);
    }
    move(payload);
  });

  gameChannel.on("stats", payload => {
    $("#stats").html(`Speed: ${payload.speed}`);
    speed = payload.speed;
  });

  gameChannel.join()
    .receive("ok", resp => { console.log("Joined successfully", resp); })
    .receive("error", resp => { console.log("Unable to join", resp) })
}

function update() {

    if (game.input.keyboard.isDown(Phaser.Keyboard.LEFT))
    {
      gameChannel.push("move", {direction: "w"});
    }

    if (game.input.keyboard.isDown(Phaser.Keyboard.RIGHT))
    {
      gameChannel.push("move", {direction: "e"});
    }

    if (game.input.keyboard.isDown(Phaser.Keyboard.UP))
    {
      gameChannel.push("move", {direction: "n"});
    }

    if (game.input.keyboard.isDown(Phaser.Keyboard.DOWN))
    {
      gameChannel.push("move", {direction: "s"});
    }

}

function render() {
  if (users[user_id])
    game.debug.spriteInfo(users[user_id].sprite);
}

function onTap(pointer) {
  var x = pointer.x / field;
  var y = pointer.y / field;
}

function createUser(user) {
  var sprite = game.add.sprite(user.x * field, user.y * field, 'ball');
  game.physics.enable(sprite, Phaser.Physics.ARCADE);
  users[user.user_id] = {sprite: sprite}
}

function move(user) {
  var x = user.x * field;
  var y = user.y * field;

  if (x != users[user.user_id].sprite.x || y != users[user.user_id].sprite.y) {
    var tween = game.add.tween(users[user.user_id].sprite).to( { x: x, y: y }, user.move_time, null, true);
    tween.onComplete.add(function() {
      users[user.user_id].sprite.x = x;
      users[user.user_id].sprite.y = y;
    });
  } else {
    users[user.user_id].sprite.x = user.x * field;
    users[user.user_id].sprite.y = user.y * field;
  }
}

export default socket
