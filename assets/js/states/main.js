import { mapSize, field, size, scale, displayScale, panelWidth } from "../globals";

import GameMap from "../game_map";
import GameChannel from "../channels/game_channel";
import Player from "../player";
import UsersContainer from "../users_container";
import MobileDetect from "mobile-detect";
import items from "../data/items.json" assert { type: "json" };
import RightPanelState from "./right_panel";

export default class MainState extends Phaser.State {
  preload() {
    this.map = new GameMap(this);
    this.channel = new GameChannel();
    this.player = new Player(this);
    this.users = new UsersContainer(this);
    this.group = this.add.group();

    this.load.atlas(
      "generic",
      "/sprites/skins/generic-joystick.png",
      "/sprites/skins/generic-joystick.json"
    );

    this.load.atlasJSONHash(
      "tibia1",
      "/sprites/tibia1.png",
      "/sprites/tibia1.json"
    );
    this.load.atlasJSONHash(
      "tibia2",
      "/sprites/tibia2.png",
      "/sprites/tibia2.json"
    );
    this.load.atlasJSONHash(
      "tibia3",
      "/sprites/tibia3.png",
      "/sprites/tibia3.json"
    );
    this.load.atlasJSONHash(
      "tibia4",
      "/sprites/tibia4.png",
      "/sprites/tibia4.json"
    );
    this.load.atlasJSONHash(
      "tibia5",
      "/sprites/tibia5.png",
      "/sprites/tibia5.json"
    );
    this.load.atlasJSONHash(
      "tibia6",
      "/sprites/tibia6.png",
      "/sprites/tibia6.json"
    );
    this.load.atlasJSONHash(
      "tibia7",
      "/sprites/tibia7.png",
      "/sprites/tibia7.json"
    );
  }

  getSpriteIndex(group, w, h, l, x, y, z, f) {
    return (
      ((((((f % group.frames) * group.patternZ + z) * group.patternY + y) *
        group.patternX +
        x) *
        group.layers +
        l) *
        group.height +
        h) *
        group.width +
      w
    );
  }

  create() {
    // FPS
    this.time.advancedTiming = true;
    // Window active in background
    this.stage.disableVisibilityChange = true;

    // Enable pixel-perfect rendering for crisp sprites
    Phaser.Canvas.setImageRenderingCrisp(this.game.canvas);
    this.game.renderer.renderSession.roundPixels = true;

    // Performance tracking for sorting optimization
    this.performance = {
      lastGroupSize: 0,
    };

    // Set debug font to match display scale
    this.game.debug.font = `${Math.round(14 * displayScale)}px Courier`;
    this.game.debug.lineHeight = Math.round(16 * displayScale);

    // Add Joystick
    this.pad = this.game.plugins.add(Phaser.VirtualJoystick);

    this.stick = this.pad.addStick(0, 0, Math.round(100 * displayScale), "generic");
    this.stick.alignBottomLeft(0);

    // Scale the joystick relative to display
    this.stick.baseSprite.scale.setTo(0.5 * displayScale, 0.5 * displayScale);
    this.stick.stickSprite.scale.setTo(0.5 * displayScale, 0.5 * displayScale);

    // Enable responsive scaling for all devices
    this.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;

    // Verify if on mobile
    var md = new MobileDetect(window.navigator.userAgent);
    if (!md.mobile()) {
      this.stick.alpha = 0;
      this.stick.enabled = false;
    }

    this.world.setBounds(
      -field / 2,
      -field / 2,
      mapSize * field,
      mapSize * field
    );

    this.camera.width = field * 15;
    this.camera.height = field * 11;

    this.input.keyboard.addKeyCapture([
      Phaser.Keyboard.LEFT,
      Phaser.Keyboard.RIGHT,
      Phaser.Keyboard.UP,
      Phaser.Keyboard.DOWN,
    ]);

    // Join channels to listen on events from backend
    this.channel.on("move", (user) => {
      if (user.user_id == this.player.id) return;
      this.users.move(user);
    });

    this.channel.on("user_object", (user) => {
      if (user.user_id == this.player.id) return;
      this.users.add(user);
    });

    this.channel.on("user_left", (data) => {
      console.log("User left:", data);
      this.users.remove(data.user_id);
    });

    this.channel.on("map_data", (mapData) => {
      mapData.map.forEach((mapTile) => {
        this.map.loadTile(mapTile);
      });
    });

    this.channel.join();

    // Initialize and create right panel
    this.rightPanel = new RightPanelState(this.game, this);
    this.rightPanel.create();
  }

  update() {
    let direction = { x: 0, y: 0 };

    if (this.stick.isDown) {
      direction = this.octantToDirection();
    }

    if (!this.stick.isDown && this.input.keyboard.isDown(Phaser.Keyboard.LEFT))
      direction.x--;
    if (!this.stick.isDown && this.input.keyboard.isDown(Phaser.Keyboard.RIGHT))
      direction.x++;
    if (!this.stick.isDown && this.input.keyboard.isDown(Phaser.Keyboard.UP))
      direction.y--;
    if (!this.stick.isDown && this.input.keyboard.isDown(Phaser.Keyboard.DOWN))
      direction.y++;

    this.player.update(direction, this.time.fps);

    // Optimize sorting - only sort when needed
    const currentGroupSize = this.group.children.length;
    const groupSizeChanged =
      Math.abs(currentGroupSize - this.performance.lastGroupSize) > 0;

    // Only sort if:
    // 1. Group size changed (sprite added/removed)
    // 2. Player is moving (sprites changing positions)
    const shouldSort =
      groupSizeChanged || direction.x !== 0 || direction.y !== 0;

    if (shouldSort && currentGroupSize > 0) {
      this.group.customSort((a, b) => {
        let aPosition = a.gameObject.position;
        let bPosition = b.gameObject.position;

        if (a.gameObject.type == "character") {
          aPosition = { y: a.y / field, x: a.x / field, isCharacter: true };
        }

        if (b.gameObject.type == "character") {
          bPosition = { y: b.y / field, x: b.x / field, isCharacter: true };
        }

        if (aPosition.x > bPosition.x) return 1;
        if (aPosition.x < bPosition.x) return -1;

        if (aPosition.y > bPosition.y) {
          return 1;
        }

        if (aPosition.y == bPosition.y) {
          if (
            aPosition.isCharacter &&
            !bPosition.isCharacter &&
            b.gameObject.isOnTop
          )
            return -1;
          if (
            bPosition.isCharacter &&
            !aPosition.isCharacter &&
            a.gameObject.isOnTop
          )
            return 1;

          return 0;
        }

        return -1;
      });
      this.performance.lastGroupSize = currentGroupSize;
    }

    // Update right panel
    if (this.rightPanel) {
      this.rightPanel.update();
    }
  }

  render() {
    const ds = displayScale;
    this.game.debug.text(this.time.fps || "--", 2, Math.round(14 * ds), "#00ff00");
    this.game.debug.text(
      `x: ${this.player.position.x} y: ${this.player.position.y}`,
      2,
      Math.round(32 * ds),
      "#00ff00"
    );

    // Sprite count debugging
    const worldSpriteCount = this.world.children.length;
    const groupSpriteCount = this.group.children.length;
    this.game.debug.text(
      `Sprites - World: ${worldSpriteCount} | Group: ${groupSpriteCount}`,
      2,
      Math.round(50 * ds),
      "#00ff00"
    );

    // Render right panel
    if (this.rightPanel) {
      this.rightPanel.render();
    }
  }

  octantToDirection() {
    switch (this.stick.octant) {
      case 0:
        return { x: 1, y: 0 };
      case 45:
        return { x: 1, y: 1 };
      case 90:
        return { x: 0, y: 1 };
      case 135:
        return { x: -1, y: 1 };
      case 180:
        return { x: -1, y: 0 };
      case 225:
        return { x: -1, y: -1 };
      case 270:
        return { x: 0, y: -1 };
      case 315:
        return { x: 1, y: -1 };
      case 360:
        return { x: 1, y: 0 };
    }
  }
}
