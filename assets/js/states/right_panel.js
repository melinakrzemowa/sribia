import { dpr, canvasWidth, canvasHeight, sidebarWidth } from "../globals";

// Sidebar layout styled after edubart/otclient game UI.
// All positions below are in CSS pixels; this.s() scales to physical.

const COLORS = {
  panelBg: 0x484848,      // Tibia-style stone-grey panel face
  panelBgDark: 0x2a2a2a,
  slotInterior: 0x303030, // dark grey, visible behind empty cells / Soul/Cap / status bar
  border: 0x1a1a1a,
  borderLight: 0x6a6a6a,
  buttonFace: 0x505050,
  buttonFacePressed: 0x383838,
  buttonLight: 0x6a6a6a,
  buttonShadow: 0x2a2a2a,
  hpFill: 0xc03030,
  hpEmpty: 0x330000,
  mpFill: 0x3045c4,
  mpEmpty: 0x000033,
  textLight: "#e0dcc5",
  textDim: "#a09c88",
  titleBg: 0x282828,
};

const BUTTON_H = 22;            // CSS px — height of a standard OTC button
const SLOT = 34;                // CSS px — edubart slot icon is 34×34 native
const GUTTER = 6;
const EDGE_PAD = 4;             // extra right-side margin so UI isn't flush with canvas edge

export default class RightPanelState {
  constructor(game, mainState) {
    this.game = game;
    this.mainState = mainState;
    this.panelX = canvasWidth - sidebarWidth;
    this.width = sidebarWidth;
    this.panelH = canvasHeight;

    // Player stats
    this.maxHealth = 100; this.currentHealth = 70;
    this.maxMana = 50;    this.currentMana = 30;
    this._lastHealth = -1; this._lastMana = -1;

    // Sprite/text pools (destroyed on rebuild)
    this.sprites = [];
    this.texts = [];
    this.interactives = [];

    // UI state
    this.selectedFightMode = "balanced";
    this.followOn = true;
    this.secureOn = false;
    // Open windows stack below the tabs. Ordered array; each entry has a
    // per-window height in CSS px that the user can resize via drag handle.
    this.openWindows = []; // { name, h }
    this.DEFAULT_WIN_H = 90;
    this.MIN_WIN_H = 40;

    // Active drag state (null when idle). Lives across redraws so handlers keep
    // running even after the handle sprite is destroyed and recreated.
    this._activeDrag = null;
  }

  s(v) { return Math.round(v * dpr); }

  // ── Sprite helpers ──────────────────────────────────────
  addImage(key, cssX, cssY, cssW, cssH, frame) {
    if (!this.game.cache.checkImageKey(key)) return null;
    const spr = this.game.add.sprite(0, 0, key, frame || 0);
    spr.fixedToCamera = true;
    spr.cameraOffset.setTo(this.panelX + this.s(cssX), this.s(cssY));
    spr.smoothed = false;
    if (cssW && cssH) {
      const natW = spr.texture.frame.width;
      const natH = spr.texture.frame.height;
      spr.scale.set(this.s(cssW) / natW, this.s(cssH) / natH);
    }
    this.sprites.push(spr);
    return spr;
  }

  addTileSprite(key, cssX, cssY, cssW, cssH) {
    if (!this.game.cache.checkImageKey(key)) return null;
    const spr = this.game.add.tileSprite(0, 0, this.s(cssW), this.s(cssH), key);
    spr.fixedToCamera = true;
    spr.cameraOffset.setTo(this.panelX + this.s(cssX), this.s(cssY));
    spr.smoothed = false;
    this.sprites.push(spr);
    return spr;
  }

  addText(cssX, cssY, label, cssFontSize, color, anchor, bold) {
    const style = {
      font: `${bold ? "bold " : ""}${this.s(cssFontSize)}px Verdana`,
      fill: color || COLORS.textLight,
    };
    const t = this.game.add.text(this.panelX + this.s(cssX), this.s(cssY), label, style);
    if (anchor) t.anchor.set(anchor[0], anchor[1]);
    t.fixedToCamera = true;
    this.texts.push(t);
    return t;
  }

  addClickArea(cssX, cssY, cssW, cssH, callback) {
    const w = this.s(cssW); const h = this.s(cssH);
    const bmd = this.game.add.bitmapData(w, h);
    bmd.fill(255, 255, 255, 255);
    const spr = this.game.add.sprite(0, 0, bmd);
    spr.alpha = 0.001;
    spr.fixedToCamera = true;
    spr.cameraOffset.setTo(this.panelX + this.s(cssX), this.s(cssY));
    spr.inputEnabled = true;
    spr.input.pixelPerfectClick = false;
    spr.input.useHandCursor = true;
    spr.events.onInputDown.add(callback, this);
    this.interactives.push(spr);
    return spr;
  }

  // Draw a beveled button rectangle onto bgGfx (no sprite stretching).
  drawButtonBg(cssX, cssY, cssW, cssH, pressed) {
    const gfx = this.bgGfx;
    const bw = Math.max(1, this.s(1));
    const x = this.panelX + this.s(cssX);
    const y = this.s(cssY);
    const w = this.s(cssW);
    const h = this.s(cssH);

    gfx.beginFill(pressed ? COLORS.buttonFacePressed : COLORS.buttonFace);
    gfx.drawRect(x, y, w, h);
    gfx.endFill();

    gfx.beginFill(pressed ? COLORS.buttonShadow : COLORS.buttonLight);
    gfx.drawRect(x, y, w, bw);        // top edge
    gfx.drawRect(x, y, bw, h);        // left edge
    gfx.endFill();
    gfx.beginFill(pressed ? COLORS.buttonLight : COLORS.buttonShadow);
    gfx.drawRect(x, y + h - bw, w, bw); // bottom edge
    gfx.drawRect(x + w - bw, y, bw, h); // right edge
    gfx.endFill();
  }

  addButton(cssX, cssY, cssW, cssH, label, pressed, onClick) {
    this.drawButtonBg(cssX, cssY, cssW, cssH, pressed);
    this.addText(cssX + cssW / 2, cssY + cssH / 2, label, 10, COLORS.textLight, [0.5, 0.5]);
    if (onClick) this.addClickArea(cssX, cssY, cssW, cssH, onClick);
  }

  // ── Lifecycle ──────────────────────────────────────────
  create() {
    this.drawAll();
    this.updateBars();
  }

  rebuild(newCanvasW, newCanvasH) {
    this.panelX = newCanvasW - sidebarWidth;
    this.panelH = newCanvasH;
    this.sprites.forEach((s) => s.destroy());       this.sprites = [];
    this.texts.forEach((t) => t.destroy());         this.texts = [];
    this.interactives.forEach((s) => s.destroy()); this.interactives = [];
    if (this.bgGfx) this.bgGfx.destroy();
    if (this.hpGfx) this.hpGfx.destroy();
    if (this.mpGfx) this.mpGfx.destroy();
    this.drawAll();
    this._lastHealth = -1; this._lastMana = -1;
    this.updateBars();
  }

  redraw() { this.rebuild(this.panelX + this.width, this.panelH); }

  drawAll() {
    const cssWFull = this.width / dpr;
    const cssW = cssWFull - EDGE_PAD;  // leave breathing room on the right edge
    const cssH = this.panelH / dpr;

    // 1. Solid panel background + bevel via graphics (bottom z layer)
    this.bgGfx = this.game.add.graphics(0, 0);
    this.bgGfx.fixedToCamera = true;
    const gfx = this.bgGfx;
    gfx.beginFill(COLORS.panelBg);
    gfx.drawRect(this.panelX, 0, this.s(cssWFull), this.s(cssH));
    gfx.endFill();

    // Dark border stripe on the left edge
    gfx.beginFill(COLORS.border);
    gfx.drawRect(this.panelX, 0, Math.max(1, this.s(1)), this.panelH);
    gfx.endFill();

    // Layout walk-down: tabs sit right below equipment; open windows stack below tabs.
    let y = GUTTER;
    y = this.drawMinimap(y, cssW);
    y = this.drawStatusBars(y, cssW);
    y = this.drawMainGrid(y, cssW);
    y = this.drawTabs(y, cssW);
    this.drawWindows(y, cssH, cssW);

    // HP/MP dynamic fill gfx must render ABOVE the static bar chrome
    this.hpGfx = this.game.add.graphics(0, 0); this.hpGfx.fixedToCamera = true;
    this.mpGfx = this.game.add.graphics(0, 0); this.mpGfx.fixedToCamera = true;
  }

  // ── Minimap ─────────────────────────────────────────────
  drawMinimap(y, cssW) {
    const size = cssW - GUTTER * 2 - 26 - GUTTER;  // leave room for right control column
    const controlW = 26;
    const mapX = GUTTER;

    // Minimap black frame
    this.drawInsetFrame(mapX, y, size, size);
    const gfx = this.bgGfx;
    gfx.beginFill(0x000000);
    gfx.drawRect(
      this.panelX + this.s(mapX + 1), this.s(y + 1),
      this.s(size - 2), this.s(size - 2)
    );
    gfx.endFill();
    // Player "+"
    const cx = this.panelX + this.s(mapX + size / 2);
    const cy = this.s(y + size / 2);
    const cr = this.s(3);
    const bw = Math.max(1, this.s(1));
    gfx.beginFill(0xffffff);
    gfx.drawRect(cx - cr, cy, cr * 2 + bw, bw);
    gfx.drawRect(cx, cy - cr, bw, cr * 2 + bw);
    gfx.endFill();

    // Right column of minimap controls
    const cx0 = cssW - GUTTER - controlW;
    let cy0 = y;
    const btnSize = controlW;

    // zoom_in / zoom_out / floor_up / floor_down each on their own row
    const buttons = [
      { icon: "mm_zoom_in", action: "zoom_in" },
      { icon: "mm_zoom_out", action: "zoom_out" },
      { icon: "mm_floor_up", action: "floor_up" },
      { icon: "mm_floor_down", action: "floor_down" },
      { icon: "mm_cross", action: "centre" },
    ];
    // Keep buttons square so icons aren't vertically stretched.
    const rowH = btnSize;
    const gap = Math.max(1, Math.floor((size - rowH * buttons.length) / (buttons.length - 1)));
    buttons.forEach(({ icon, action }) => {
      this.drawButtonBg(cx0, cy0, btnSize, rowH, false);
      const pad = 3;
      const iconSize = btnSize - pad * 2;
      this.addImage(icon, cx0 + pad, cy0 + pad, iconSize, iconSize);
      this.addClickArea(cx0, cy0, btnSize, rowH, () => this.onMinimapAction(action));
      cy0 += rowH + gap;
    });

    return y + size + GUTTER;
  }

  // ── HP / MP bars ─────────────────────────────────────────
  drawStatusBars(y, cssW) {
    const barX = GUTTER;
    const barW = cssW - GUTTER * 2;
    const barH = 16;

    // HP bar (progressbar.png native is 80×16; stretched to fit)
    this.addImage("otc_progressbar", barX, y, barW, barH);
    this.hpBarGeom = { x: this.panelX + this.s(barX + 2), y: this.s(y + 2), w: this.s(barW - 4), h: this.s(barH - 4) };
    this.hpNumText = this.addText(cssW / 2, y + barH / 2, "", 9, "#ffffff", [0.5, 0.5], true);
    y += barH + 2;

    this.addImage("otc_progressbar", barX, y, barW, barH);
    this.mpBarGeom = { x: this.panelX + this.s(barX + 2), y: this.s(y + 2), w: this.s(barW - 4), h: this.s(barH - 4) };
    this.mpNumText = this.addText(cssW / 2, y + barH / 2, "", 9, "#ffffff", [0.5, 0.5], true);
    return y + barH + GUTTER;
  }

  // ── Main grid: equipment (left) + combat/actions (right) ──
  // Both columns are top-aligned; status bar appears below the equipment grid.
  drawMainGrid(y, cssW) {
    const avail = cssW - GUTTER * 3;
    const leftW = Math.floor(avail * 0.68);
    const rightW = avail - leftW;
    const leftX = GUTTER;
    const rightX = GUTTER + leftW + GUTTER;
    const statusH = 14;
    const gap = 2;

    // Left column: equipment grid (with Soul/Cap in row 4 corners) → status bar
    let ly = this.drawEquipment(y, leftX, leftW);
    ly = this.drawStatusBar(ly + gap, leftX, leftW, statusH);

    // Right column: combat icons → stacked action buttons (top-aligned with equipment)
    const ry = this.drawCombatAndActions(y, rightX, rightW);

    return Math.max(ly, ry) + GUTTER;
  }

  drawStatusBar(y, x, w, h) {
    this.drawSlotBg(x, y, w, h);
    return y + h;
  }

  // Recessed slot frame (inset bevel) — for equipment slots.
  // Interior fill uses slotInterior so cells without a slot image still look like tiles.
  drawSlotBg(cssX, cssY, cssW, cssH) {
    const gfx = this.bgGfx;
    const bw = Math.max(1, this.s(1));
    const x = this.panelX + this.s(cssX);
    const y = this.s(cssY);
    const w = this.s(cssW);
    const h = this.s(cssH);

    gfx.beginFill(COLORS.slotInterior);
    gfx.drawRect(x, y, w, h);
    gfx.endFill();

    gfx.beginFill(COLORS.buttonShadow);
    gfx.drawRect(x, y, w, bw);
    gfx.drawRect(x, y, bw, h);
    gfx.endFill();
    gfx.beginFill(COLORS.buttonLight);
    gfx.drawRect(x, y + h - bw, w, bw);
    gfx.drawRect(x + w - bw, y, bw, h);
    gfx.endFill();
  }

  // ── Equipment 3×4 grid ────────────────────────────────
  // Row 4 col 0/2 carry Soul / Cap counters, col 1 is the feet slot.
  drawEquipment(y, x, w) {
    const slotSize = Math.floor(w / 3);
    const slotByPos = {
      "0,0": "slot_neck",      "1,0": "slot_head",       "2,0": "slot_back",
      "0,1": "slot_left_hand", "1,1": "slot_body",       "2,1": "slot_right_hand",
      "0,2": "slot_finger",    "1,2": "slot_legs",       "2,2": "slot_ammo",
                               "1,3": "slot_feet",
    };
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        const sx = x + col * slotSize;
        const sy = y + row * slotSize;
        this.drawSlotBg(sx, sy, slotSize, slotSize);
        const key = slotByPos[`${col},${row}`];
        if (key) this.addImage(key, sx, sy, slotSize, slotSize);
      }
    }

    // Soul / Cap counters in the bottom-row corner cells
    const bottomY = y + 3 * slotSize;
    const midY = bottomY + slotSize / 2;
    this.addText(x + slotSize / 2, midY - 6, "Soul:", 8, COLORS.textDim, [0.5, 1]);
    this.addText(x + slotSize / 2, midY + 1, "200",  10, COLORS.textLight, [0.5, 0], true);
    this.addText(x + slotSize * 2 + slotSize / 2, midY - 6, "Cap:", 8, COLORS.textDim, [0.5, 1]);
    this.addText(x + slotSize * 2 + slotSize / 2, midY + 1, "1113", 10, COLORS.textLight, [0.5, 0], true);

    return y + 4 * slotSize;
  }

  // ── Combat grid (2×3) + stacked action buttons ────────
  drawCombatAndActions(y, x, w) {
    const colW = Math.floor((w - 2) / 2);
    const rowH = colW; // square cells so icons have equal borders on all sides

    const modes = [
      { col: 0, row: 0, key: "combat_fightoffensive", mode: "offensive" },
      { col: 1, row: 0, key: "combat_chasemode",      mode: "follow" },
      { col: 0, row: 1, key: "combat_fightbalanced",  mode: "balanced" },
      { col: 1, row: 1, key: "combat_safefight",      mode: "secure" },
      { col: 0, row: 2, key: "combat_fightdefensive", mode: "defensive" },
    ];
    modes.forEach(({ col, row, key, mode }) => {
      let active;
      if (mode === "follow") active = this.followOn;
      else if (mode === "secure") active = this.secureOn;
      else active = this.selectedFightMode === mode;

      const bx = x + col * (colW + 2);
      const by = y + row * (rowH + 2);
      // Combat icons already include the button frame, so draw at full cell size.
      this.addImage(key, bx, by, colW, rowH, active ? 1 : 0);

      this.addClickArea(bx, by, colW, rowH, () => {
        if (mode === "follow") this.followOn = !this.followOn;
        else if (mode === "secure") this.secureOn = !this.secureOn;
        else this.selectedFightMode = mode;
        this.redraw();
      });
    });

    let ay = y + 3 * (rowH + 2);
    ["Stop", "Quests", "Options", "Help"].forEach((label) => {
      this.addButton(x, ay, w, BUTTON_H, label, false, () => this.onAction(label.toLowerCase()));
      ay += BUTTON_H + 2;
    });
    return ay;
  }

  // Invisible sprite that starts a live drag on mousedown. Drag state lives on
  // this._activeDrag so updateDrag() keeps firing across redraws.
  addDragHandle(cssX, cssY, cssW, cssH, onLive) {
    const w = this.s(cssW);
    const h = this.s(cssH);
    const bmd = this.game.add.bitmapData(w, h);
    bmd.fill(255, 255, 255, 255);
    const spr = this.game.add.sprite(0, 0, bmd);
    spr.alpha = 0.001;
    spr.fixedToCamera = true;
    spr.cameraOffset.setTo(this.panelX + this.s(cssX), this.s(cssY));
    spr.inputEnabled = true;
    spr.input.pixelPerfectClick = false;
    spr.input.useHandCursor = true;

    spr.events.onInputDown.add(() => {
      if (this._activeDrag) return; // already dragging
      this._activeDrag = {
        onLive,
        lastY: this.game.input.activePointer.y,
        state: {},
      };
    });

    this.interactives.push(spr);
    return spr;
  }

  // Called every frame from update(). Polls the pointer and forwards a live
  // CSS-pixel delta to the active handler. Stops on mouse up.
  updateDrag() {
    const d = this._activeDrag;
    if (!d) return;
    const pointer = this.game.input.activePointer;
    if (!pointer.isDown) {
      const wasReorder = !!d.draggingName;
      this._activeDrag = null;
      if (wasReorder) this.redraw(); // snap dragged window back to its slot
      return;
    }
    if (pointer.y === d.lastY) return;
    const stepCss = (pointer.y - d.lastY) / dpr;
    d.lastY = pointer.y;
    d.onLive(stepCss, d.state);
  }

  // ── Open windows stack below the tabs ──
  //   • Title bar drag → live reorder (dragged window follows cursor; neighbours jump when threshold crossed)
  //   • Bottom edge drag → live resize
  //   • [x] button → close
  drawWindows(topY, bottomY, cssW) {
    if (this.openWindows.length === 0) return;
    const x = GUTTER;
    const w = cssW - GUTTER * 2;
    const titleH = 16;
    const resizeH = 4;

    // Draw stationary windows first, then the dragged one on top with its
    // cursor-tracking offset applied.
    const draggingName = this._activeDrag && this._activeDrag.draggingName;
    const dragOffset = draggingName ? (this._activeDrag.state.acc || 0) : 0;

    let cy = topY;
    const rowTops = [];
    this.openWindows.forEach((win) => {
      rowTops.push(cy);
      cy += Math.max(this.MIN_WIN_H, win.h) + resizeH + 1;
    });

    // Non-dragged windows at their array-slot positions
    this.openWindows.forEach((win, i) => {
      if (win.name === draggingName) return;
      this.drawSingleWindow(win, i, x, w, rowTops[i], titleH, resizeH);
    });

    // Dragged window last (on top), offset by accumulated drag
    if (draggingName) {
      const i = this.openWindows.findIndex((w) => w.name === draggingName);
      if (i >= 0) {
        this.drawSingleWindow(
          this.openWindows[i], i, x, w, rowTops[i] + dragOffset, titleH, resizeH
        );
      }
    }
  }

  drawSingleWindow(win, i, x, w, cy, titleH, resizeH) {
    const wh = Math.max(this.MIN_WIN_H, win.h);
    const pressed = this._activeDrag && this._activeDrag.draggingName === win.name;

    // Body frame + title bar
    this.drawSlotBg(x, cy, w, wh);
    this.drawButtonBg(x, cy, w, titleH, pressed);
    this.addText(x + 6, cy + titleH / 2, win.name, 9, COLORS.textLight, [0, 0.5], true);

    // Close [x]
    const closeSize = titleH - 4;
    const cxPos = x + w - closeSize - 2;
    const ccy = cy + 2;
    this.drawButtonBg(cxPos, ccy, closeSize, closeSize, false);
    this.addText(cxPos + closeSize / 2, ccy + closeSize / 2, "x", 9, COLORS.textLight, [0.5, 0.5], true);
    this.addClickArea(cxPos, ccy, closeSize, closeSize, () => {
      this.openWindows.splice(i, 1);
      this.redraw();
    });

    // Title bar drag → live reorder
    const dragBarW = w - closeSize - 6;
    const name = win.name;
    this.addDragHandle(x, cy, dragBarW, titleH, (step, state) => {
      if (!state.init) {
        state.acc = 0;
        state.init = true;
        this._activeDrag.draggingName = name;
      }
      state.acc += step;
      const arr = this.openWindows;
      const idx = arr.findIndex((o) => o.name === name);
      if (idx < 0) return;
      const slotStep = resizeH + 1; // gap between windows in the row stack
      if (state.acc < 0 && idx > 0) {
        const prev = arr[idx - 1];
        if (state.acc <= -(prev.h / 2)) {
          [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
          state.acc += prev.h + slotStep;
        }
      } else if (state.acc > 0 && idx < arr.length - 1) {
        const next = arr[idx + 1];
        if (state.acc >= next.h / 2) {
          [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
          state.acc -= next.h + slotStep;
        }
      }
      this.redraw();
    });

    // Bottom resize handle → live resize
    const resizeY = cy + wh;
    this.drawButtonBg(x, resizeY, w, resizeH, false);
    this.addDragHandle(x, resizeY, w, resizeH, (step) => {
      win.h = Math.max(this.MIN_WIN_H, win.h + step);
      this.redraw();
    });
  }

  // ── Tabs (Skills / Battle / VIP / Logout) ─────────────
  drawTabs(y, cssW) {
    const w = cssW - GUTTER * 2;
    const tabs = [
      { label: "Skills", window: "Skills" },
      { label: "Battle", window: "Battle" },
      { label: "VIP",    window: "VIP" },
      { label: "Logout", window: null },
    ];
    const btnW = Math.floor((w - 2 * (tabs.length - 1)) / tabs.length);
    const btnH = BUTTON_H;
    tabs.forEach((t, i) => {
      const bx = GUTTER + i * (btnW + 2);
      const pressed = t.window && this.openWindows.some((w) => w.name === t.window);
      this.drawButtonBg(bx, y, btnW, btnH, pressed);
      this.addText(bx + btnW / 2, y + btnH / 2, t.label, 10, COLORS.textLight, [0.5, 0.5]);
      this.addClickArea(bx, y, btnW, btnH, () => {
        if (t.window) this.toggleWindow(t.window);
        else this.onAction("logout");
      });
    });
    return y + btnH + GUTTER;
  }

  // ── Frame utility ──────────────────────────────────────
  drawInsetFrame(cssX, cssY, cssW, cssH) {
    const gfx = this.bgGfx;
    const bw = Math.max(1, this.s(1));
    const x = this.panelX + this.s(cssX);
    const y = this.s(cssY);
    const w = this.s(cssW);
    const h = this.s(cssH);
    gfx.beginFill(COLORS.border);
    gfx.drawRect(x, y, w, bw); gfx.drawRect(x, y, bw, h);
    gfx.endFill();
    gfx.beginFill(COLORS.borderLight);
    gfx.drawRect(x, y + h - bw, w, bw); gfx.drawRect(x + w - bw, y, bw, h);
    gfx.endFill();
  }

  // ── Event hooks ────────────────────────────────────────
  onMinimapAction(name) {
    if (this.mainState && typeof this.mainState.onMinimapAction === "function") {
      this.mainState.onMinimapAction(name);
    }
  }

  onAction(name) {
    if (this.mainState && typeof this.mainState.onPanelAction === "function") {
      this.mainState.onPanelAction(name);
    }
  }

  toggleWindow(name) {
    const idx = this.openWindows.findIndex((w) => w.name === name);
    if (idx >= 0) this.openWindows.splice(idx, 1);
    else this.openWindows.push({ name, h: this.DEFAULT_WIN_H });
    this.redraw();
  }

  // ── HP/MP dynamic fill ─────────────────────────────────
  updateBars() {
    if (this.currentHealth === this._lastHealth && this.currentMana === this._lastMana) return;
    this._lastHealth = this.currentHealth;
    this._lastMana = this.currentMana;

    if (this.hpBarGeom) {
      this.hpGfx.clear();
      const { x, y, w, h } = this.hpBarGeom;
      this.hpGfx.beginFill(COLORS.hpEmpty);
      this.hpGfx.drawRect(x, y, w, h);
      this.hpGfx.endFill();
      const fw = Math.round((w * this.currentHealth) / this.maxHealth);
      if (fw > 0) {
        this.hpGfx.beginFill(COLORS.hpFill);
        this.hpGfx.drawRect(x, y, fw, h);
        this.hpGfx.endFill();
      }
      if (this.hpNumText) this.hpNumText.text = `${this.currentHealth} / ${this.maxHealth}`;
    }

    if (this.mpBarGeom) {
      this.mpGfx.clear();
      const { x, y, w, h } = this.mpBarGeom;
      this.mpGfx.beginFill(COLORS.mpEmpty);
      this.mpGfx.drawRect(x, y, w, h);
      this.mpGfx.endFill();
      const fw = Math.round((w * this.currentMana) / this.maxMana);
      if (fw > 0) {
        this.mpGfx.beginFill(COLORS.mpFill);
        this.mpGfx.drawRect(x, y, fw, h);
        this.mpGfx.endFill();
      }
      if (this.mpNumText) this.mpNumText.text = `${this.currentMana} / ${this.maxMana}`;
    }
  }

  update() { this.updateBars(); this.updateDrag(); }
  render() {}
}
