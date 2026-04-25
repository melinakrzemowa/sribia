import {
  mapSize, field, size, scale, displayScale, dpr,
  canvasWidth, canvasHeight, sidebarWidth, chatHeight,
  recalcField,
} from "../globals";

import GameMap from "../game_map";
import GameChannel from "../channels/game_channel";
import Player from "../player";
import UsersContainer from "../users_container";
import MobileDetect from "mobile-detect";
import items from "../data/items.json" assert { type: "json" };
import RightPanelState from "./right_panel";
import ChatRenderer from "../chat_renderer";
import { findPath } from "../pathfinder";

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

    // edubart/otclient UI chrome (panels, buttons, progress bar, miniwindow)
    ["panel_side", "miniwindow", "panel_map", "progressbar", "separator_horizontal"].forEach((n) =>
      this.load.image(`otc_${n}`, `/images/ui/otc/ui/${n}.png`)
    );
    // Buttons are 3-state spritesheets (22x69 = 22x23 × 3)
    ["button", "button_rounded", "tabbutton_square"].forEach((n) => {
      const w = n === "tabbutton_square" ? 20 : 22;
      const h = n === "tabbutton_square" ? 21 : 23;
      this.load.spritesheet(`otc_${n}`, `/images/ui/otc/ui/${n}.png`, w, h);
    });

    // Equipment slot placeholders (34x34)
    ["head", "neck", "body", "back", "right-hand", "left-hand", "legs", "feet", "finger", "ammo"].forEach((n) =>
      this.load.image(`slot_${n.replace("-", "_")}`, `/images/ui/otc/slots/${n}.png`)
    );

    // Combat mode icons — 20x40 spritesheet (2 frames: off, on)
    ["fightoffensive", "fightbalanced", "fightdefensive", "chasemode", "safefight"].forEach((n) =>
      this.load.spritesheet(`combat_${n}`, `/images/ui/otc/combat/${n}.png`, 20, 20)
    );

    // Minimap controls
    ["zoom_in", "zoom_out", "cross"].forEach((n) =>
      this.load.image(`mm_${n}`, `/images/ui/otc/minimap/${n}.png`)
    );
    ["floor_up", "floor_down"].forEach((n) =>
      this.load.spritesheet(`mm_${n}`, `/images/ui/otc/minimap/${n}.png`, 16, 16)
    );

    // Top button icons (for Skills/Battle/VIP/Logout tab icons)
    ["skills", "battle", "viplist", "logout", "options"].forEach((n) =>
      this.load.image(`top_${n}`, `/images/ui/otc/topbuttons/${n}.png`)
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

    // Joystick scaled by dpr to maintain consistent CSS size (~100px diameter)
    this.stick = this.pad.addStick(0, 0, Math.round(100 * dpr), "generic");
    this.stick.alignBottomLeft(Math.round(20 * dpr));

    this.stick.baseSprite.scale.setTo(0.5 * dpr, 0.5 * dpr);
    this.stick.stickSprite.scale.setTo(0.5 * dpr, 0.5 * dpr);

    // SHOW_ALL scales the canvas to fill the parent while maintaining aspect ratio.
    // Since game dimensions = viewport * dpr, the scale factor is always 1/dpr,
    // keeping the sidebar at a fixed 200 CSS pixels. Input coordinates are handled
    // automatically by the ScaleManager.
    this.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;

    // Verify if on mobile
    var md = new MobileDetect(window.navigator.userAgent);
    this.isMobile = !!md.mobile();
    if (!this.isMobile) {
      this.stick.alpha = 0;
      this.stick.enabled = false;
    }

    this.world.setBounds(
      -field / 2,
      -field / 2,
      mapSize * field,
      mapSize * field
    );

    // Camera covers the tile play area (canvas minus sidebar and chat)
    this.updateCameraViewport(canvasWidth, canvasHeight);

    this.input.keyboard.addKeyCapture([
      Phaser.Keyboard.LEFT,
      Phaser.Keyboard.RIGHT,
      Phaser.Keyboard.UP,
      Phaser.Keyboard.DOWN,
    ]);

    // Click-to-move: queue of tile targets ({x, y}) for the player to walk through.
    this.clickPath = [];
    // Tracks a pointer press until release. We only commit to "this is an
    // item drag" once the cursor moves past DRAG_THRESHOLD pixels — a plain
    // click on an item tile still triggers click-to-move.
    this.pendingPress = null;
    this.itemDrag = null;
    this.DRAG_THRESHOLD = 6;
    this.input.onDown.add(this.onWorldDown, this);
    this.input.onUp.add(this.onWorldUp, this);
    this.input.addMoveCallback(this.onWorldMove, this);

    // Join channels to listen on events from backend
    this.channel.on("move", (user) => {
      if (user.user_id == this.player.id) return;
      this.users.move(user);
    });

    this.channel.on("user_object", (user) => {
      if (user.user_id == this.player.id) return;
      this.users.add(user);
    });

    this.channel.on("item_object", (item) => {
      this.map.addItem(item.x, item.y, item);
      this.refreshPlayerElevationIfOn(item.x, item.y);
    });

    this.channel.on("item_removed", (item) => {
      this.map.removeItem(item.x, item.y, item.instance_id);
      this.refreshPlayerElevationIfOn(item.x, item.y);
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

    // Fill gap between tile area and sidebar
    this.gapGfx = this.game.add.graphics(0, 0);
    this.gapGfx.fixedToCamera = true;
    this.drawBorders(canvasWidth, canvasHeight);

    // Chat renderer (Phaser-based scrollable chat) — after gap so it draws on top
    this.setupChat(canvasWidth, canvasHeight);

    // Initialize and create right panel (sidebar)
    this.rightPanel = new RightPanelState(this.game, this);
    this.rightPanel.create();

    // Handle window resize with debounce — if field changes, reload for clean state
    this._resizeTimer = null;
    window.addEventListener("resize", () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => this.handleResize(), 300);
    });
  }

  updateCameraViewport(cw, ch) {
    // Camera fills the full available width so grey margins render over edges.
    this.camera.width = cw - sidebarWidth;
    // Exactly 11 tiles tall so the player is centered in the tile area.
    // Fixed-to-camera elements (chat, sidebar) render beyond camera bounds.
    this.camera.height = field * 11;
  }

  handleResize() {
    const oldField = recalcField(window.innerWidth, window.innerHeight);

    if (oldField !== field) {
      // Field changed — tile sizes need updating. Reload for clean state.
      // This is more reliable than trying to reposition hundreds of sprites.
      window.location.reload();
      return;
    }

    // Field unchanged — just update canvas and UI positions
    const newW = canvasWidth;
    const newH = canvasHeight;
    this.game.scale.setGameSize(newW, newH);

    this.updateCameraViewport(newW, newH);
    this.drawBorders(newW, newH);
    if (this.chatRenderer) {
      const tileH = field * 11;
      this.chatRenderer.reposition(0, tileH, newW - sidebarWidth, newH - tileH);
    }
    if (this.chatHandleSprite) {
      const tileH = field * 11;
      const chatW = newW - sidebarWidth;
      this.drawChatHandle(0, tileH, chatW, this.s_dpr(4));
      this.chatHandleSprite.cameraOffset.setTo(0, tileH - this.s_dpr(2));
    }
    this.rightPanel.rebuild(newW, newH);
  }

  setupChat(cw, ch) {
    const tileH = field * 11;
    const chatX = 0;
    const chatY = tileH;
    const chatW = cw - sidebarWidth;
    const chatH = ch - tileH;

    this.chatRenderer = new ChatRenderer(this.game, chatX, chatY, chatW, chatH);
    window.chatRenderer = this.chatRenderer;

    // Draggable border between play area and chat
    this.setupChatResizeHandle(chatX, chatY, chatW);
  }

  setupChatResizeHandle(chatX, chatY, chatW) {
    const handleH = this.s_dpr(4);

    if (this.chatHandleGfx) this.chatHandleGfx.destroy();
    if (this.chatHandleSprite) this.chatHandleSprite.destroy();

    // Visual handle bar
    this.chatHandleGfx = this.game.add.graphics(0, 0);
    this.chatHandleGfx.fixedToCamera = true;
    this.drawChatHandle(chatX, chatY, chatW, handleH);

    // Draggable sprite
    const bmd = this.game.add.bitmapData(chatW, handleH);
    bmd.fill(255, 255, 255, 255);
    this.chatHandleSprite = this.game.add.sprite(0, 0, bmd);
    this.chatHandleSprite.alpha = 0.001;
    this.chatHandleSprite.fixedToCamera = true;
    this.chatHandleSprite.cameraOffset.setTo(chatX, chatY - Math.round(handleH / 2));
    this.chatHandleSprite.inputEnabled = true;
    this.chatHandleSprite.input.pixelPerfectClick = false;
    this.chatHandleSprite.input.useHandCursor = true;
    this.chatHandleSprite.input.enableDrag(false, false, false, 255);

    let dragStartY;
    this.chatHandleSprite.events.onDragStart.add(() => {
      dragStartY = this.chatHandleSprite.cameraOffset.y;
    });
    this.chatHandleSprite.events.onDragUpdate.add(() => {
      // Lock horizontal
      this.chatHandleSprite.cameraOffset.x = chatX;
    });
    this.chatHandleSprite.events.onDragStop.add(() => {
      const newChatY = this.chatHandleSprite.cameraOffset.y + Math.round(handleH / 2);
      const minTileH = this.s_dpr(200); // min play area height
      const minChatH = this.s_dpr(40);  // min chat height
      const maxChatY = canvasHeight - minChatH;
      const clampedY = Math.max(minTileH, Math.min(maxChatY, newChatY));

      // Recalculate with new chat height
      this.applyChatResize(clampedY);
    });
  }

  s_dpr(v) { return Math.round(v * dpr); }

  drawChatHandle(x, y, w, h) {
    const gfx = this.chatHandleGfx;
    gfx.clear();
    const halfH = Math.round(h / 2);
    gfx.beginFill(0x555555);
    gfx.drawRect(x, y - halfH, w, h);
    gfx.endFill();
    // Grip dots
    const cx = x + Math.round(w / 2);
    const bw = Math.max(1, this.s_dpr(1));
    gfx.beginFill(0x888888);
    gfx.drawRect(cx - this.s_dpr(10), y - bw, this.s_dpr(4), bw * 2);
    gfx.drawRect(cx - this.s_dpr(2), y - bw, this.s_dpr(4), bw * 2);
    gfx.drawRect(cx + this.s_dpr(6), y - bw, this.s_dpr(4), bw * 2);
    gfx.endFill();
  }

  applyChatResize(newTileH) {
    // Store the desired chat height as CSS pixels and reload.
    // globals.js reads this on load to compute the correct field.
    const chatCanvasPx = canvasHeight - newTileH;
    const chatCSS = Math.round(chatCanvasPx / dpr);
    localStorage.setItem("sribia_chatH", chatCSS.toString());
    window.location.reload();
  }

  drawBorders(cw, ch) {
    this.gapGfx.clear();
    const gfx = this.gapGfx;
    const grey = 0x484848;

    const availW = cw - sidebarWidth;
    const tileW = field * 15;
    const tileH = field * 11;

    // Center the tile area horizontally
    const hGap = availW - tileW;
    this.tileOffsetX = Math.max(0, Math.round(hGap / 2));

    // Left border (full height of tile area)
    if (this.tileOffsetX > 0) {
      gfx.beginFill(grey);
      gfx.drawRect(0, 0, this.tileOffsetX, tileH);
      gfx.endFill();
    }

    // Right border (full height of tile area)
    const rightX = this.tileOffsetX + tileW;
    if (rightX < availW) {
      gfx.beginFill(grey);
      gfx.drawRect(rightX, 0, availW - rightX, tileH);
      gfx.endFill();
    }

    // Top border — covers area above where tiles are loaded
    // (camera may show area above the visible 11-tile range)
    gfx.beginFill(grey);
    gfx.drawRect(0, 0, availW, 0); // no top gap normally since tiles start at y=0
    gfx.endFill();

    // Grey strip between tile area bottom and chat area top
    // (covers any black gap from unloaded tiles below the 11-row view)
    // The chat background handles the area below tileH, but the grey fills
    // the transition on left/right margins below the tile area
    gfx.beginFill(grey);
    gfx.drawRect(0, tileH, this.tileOffsetX, ch - tileH);
    gfx.endFill();
    if (rightX < availW) {
      gfx.beginFill(grey);
      gfx.drawRect(rightX, tileH, availW - rightX, ch - tileH);
      gfx.endFill();
    }
  }

  // Convert a screen-space pointer into the tile under it, accounting for
  // the camera scroll.
  pointerTile(pointer) {
    const worldX = pointer.x + this.camera.x;
    const worldY = pointer.y + this.camera.y;
    return { x: Math.round(worldX / field), y: Math.round(worldY / field) };
  }

  // Mouse down — remember the press; defer click-to-move and item-drag
  // decisions until the user either releases (click) or moves the pointer
  // (drag).
  onWorldDown(pointer) {
    if (!this.player || !this.player.joined) return;
    if (pointer.rightButton && pointer.rightButton.isDown) return;
    if (pointer.x >= this.camera.width) return;
    if (pointer.y >= this.camera.height) return;

    const tile = this.pointerTile(pointer);
    this.pendingPress = {
      screenX: pointer.x,
      screenY: pointer.y,
      tile,
    };
  }

  // Pointer move while a press is in progress — promote to an item-drag if
  // the cursor moves past DRAG_THRESHOLD AND the original tile has items.
  onWorldMove(pointer) {
    if (!this.pendingPress || this.itemDrag) return;
    if (!pointer.isDown) return;
    const dx = pointer.x - this.pendingPress.screenX;
    const dy = pointer.y - this.pendingPress.screenY;
    if (dx * dx + dy * dy < this.DRAG_THRESHOLD * this.DRAG_THRESHOLD) return;
    const { x: tx, y: ty } = this.pendingPress.tile;
    const tile = this.map.getTile(tx, ty);
    if (!tile || !tile.items || tile.items.length === 0) return;
    const top = tile.topItem();
    this.itemDrag = { instance_id: top.instance_id, source: { x: tx, y: ty } };
    this.game.canvas.style.cursor = "crosshair";
  }

  // Mouse up — either finalise an item drag, or treat the press as a plain
  // click (click-to-move).
  onWorldUp(pointer) {
    if (this.itemDrag) {
      const drag = this.itemDrag;
      this.itemDrag = null;
      this.pendingPress = null;
      this.game.canvas.style.cursor = "default";
      const { x: tx, y: ty } = this.pointerTile(pointer);
      if (tx === drag.source.x && ty === drag.source.y) return;
      if (!this.channel) return;
      this.channel.push("move_item", {
        instance_id: drag.instance_id,
        x: tx,
        y: ty,
      });
      return;
    }

    if (!this.pendingPress) return;
    const press = this.pendingPress;
    this.pendingPress = null;
    const { x: tx, y: ty } = this.pointerTile(pointer);
    // Treat as a click only if released on the same tile and the player
    // isn't already there.
    if (tx !== press.tile.x || ty !== press.tile.y) return;
    if (tx === this.player.position.x && ty === this.player.position.y) return;
    const path = findPath(
      this.player.position,
      { x: tx, y: ty },
      (x, y) => this.map.isBlocked(x, y)
    );
    if (path && path.length > 0) this.clickPath = path;
  }

  // Re-fix the player's sprite Y when an item arrives or leaves their tile,
  // so they snap up/down by elevation steps as boxes appear or disappear.
  refreshPlayerElevationIfOn(x, y) {
    if (
      this.player &&
      this.player.joined &&
      !this.player.moving &&
      this.player.position.x === x &&
      this.player.position.y === y
    ) {
      this.player.fixPosition();
    }
  }

  // If there's an active click path, derive the next-step direction toward its
  // current head. We consume tiles against `movingPosition` (the tile the
  // player is currently committed to) rather than `position` — otherwise the
  // player would chain an extra step on arrival before main.update got a
  // chance to shift the path. Keyboard / joystick input takes precedence and
  // cancels the path.
  pathDirection() {
    const mp = this.player.movingPosition;
    while (this.clickPath.length > 0) {
      const t = this.clickPath[0];
      if (t.x === mp.x && t.y === mp.y) {
        this.clickPath.shift();
        continue;
      }
      // If the upcoming tile became blocked (e.g. someone stepped in), abort.
      if (this.map.isBlocked(t.x, t.y)) {
        this.clickPath = [];
        return { x: 0, y: 0 };
      }
      return { x: Math.sign(t.x - mp.x), y: Math.sign(t.y - mp.y) };
    }
    return { x: 0, y: 0 };
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

    // Manual input overrides / cancels click-to-move.
    if (direction.x !== 0 || direction.y !== 0) {
      if (this.clickPath.length > 0) this.clickPath = [];
    } else if (this.clickPath.length > 0) {
      direction = this.pathDirection();
    }

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
          // isOnTop env layer (signs/letters) renders above the character
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

          // Otherwise the character renders above ground items on the same tile.
          if (aPosition.isCharacter && !bPosition.isCharacter) return 1;
          if (bPosition.isCharacter && !aPosition.isCharacter) return -1;

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
