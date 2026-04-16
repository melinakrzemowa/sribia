import { dpr, canvasWidth, canvasHeight, sidebarWidth } from "../globals";

const C = {
  panelBg: 0x484848,
  sectionBg: 0x3c3c3c,
  slotBg: 0x2a2a2a,
  borderLight: 0x7a7a7a,
  borderDark: 0x1a1a1a,
  borderMid: 0x555555,
  minimapBg: 0x000000,
  healthBar: 0xcc0000,
  healthBarBg: 0x3c0000,
  manaBar: 0x3333cc,
  manaBarBg: 0x00003c,
  buttonBg: 0x555555,
  buttonPressed: 0x3a3a3a,
  windowBg: 0x3c3c3c,
  windowTitle: 0x555555,
  resizeHandle: 0x666666,
};

const MIN_WIN_HEIGHT_CSS = 40; // minimum window height in CSS pixels

export default class RightPanelState {
  constructor(game, mainState) {
    this.game = game;
    this.mainState = mainState;
    this.panelX = canvasWidth - sidebarWidth;
    this.width = sidebarWidth;
    this.panelH = canvasHeight;

    this.maxHealth = 100;
    this.currentHealth = 70;
    this.maxMana = 50;
    this.currentMana = 30;
    this._lastHealth = -1;
    this._lastMana = -1;

    this.texts = [];
    this.interactives = [];

    // Stacking window manager: ordered list of open windows
    // Each: { name: string, heightRatio: number }
    this.openWindows = [];
    this.windowElements = null; // Phaser group, destroyed/recreated on layout change
  }

  s(v) { return Math.round(v * dpr); }

  drawBevel(gfx, x, y, w, h, fill, inset) {
    const light = inset ? C.borderDark : C.borderLight;
    const dark = inset ? C.borderLight : C.borderDark;
    const bw = Math.max(1, this.s(1));
    gfx.beginFill(fill);
    gfx.drawRect(x, y, w, h);
    gfx.endFill();
    gfx.beginFill(light);
    gfx.drawRect(x, y, w, bw);
    gfx.endFill();
    gfx.beginFill(light);
    gfx.drawRect(x, y, bw, h);
    gfx.endFill();
    gfx.beginFill(dark);
    gfx.drawRect(x, y + h - bw, w, bw);
    gfx.endFill();
    gfx.beginFill(dark);
    gfx.drawRect(x + w - bw, y, bw, h);
    gfx.endFill();
  }

  addText(x, y, label, cssFontSize, color, anchor) {
    const text = this.game.add.text(x, y, label, {
      font: `${this.s(cssFontSize)}px Verdana`,
      fill: color || "#cccccc",
    });
    if (anchor) text.anchor.set(anchor[0], anchor[1]);
    text.fixedToCamera = true;
    this.texts.push(text);
    return text;
  }

  addCenteredText(x, y, w, h, label, cssFontSize, color) {
    return this.addText(
      x + Math.round(w / 2), y + Math.round(h / 2),
      label, cssFontSize, color, [0.5, 0.5]
    );
  }

  addClickArea(x, y, w, h, callback) {
    const bmd = this.game.add.bitmapData(w, h);
    bmd.fill(255, 255, 255, 255);
    const sprite = this.game.add.sprite(0, 0, bmd);
    sprite.alpha = 0.001;
    sprite.fixedToCamera = true;
    sprite.cameraOffset.setTo(x, y);
    sprite.inputEnabled = true;
    sprite.input.pixelPerfectClick = false;
    sprite.input.useHandCursor = true;
    sprite.events.onInputDown.add(callback, this);
    this.interactives.push(sprite);
    return sprite;
  }

  create() {
    this.staticGfx = this.game.add.graphics(0, 0);
    this.staticGfx.fixedToCamera = true;
    this.healthBarGfx = this.game.add.graphics(0, 0);
    this.healthBarGfx.fixedToCamera = true;
    this.manaBarGfx = this.game.add.graphics(0, 0);
    this.manaBarGfx.fixedToCamera = true;
    this.btnAnimGfx = this.game.add.graphics(0, 0);
    this.btnAnimGfx.fixedToCamera = true;

    this.drawAll();
    this.updateBars();
  }

  rebuild(newCanvasW, newCanvasH) {
    this.panelX = newCanvasW - sidebarWidth;
    this.panelH = newCanvasH;

    this.texts.forEach((t) => t.destroy());
    this.texts = [];
    this.interactives.forEach((s) => s.destroy());
    this.interactives = [];

    this.staticGfx.clear();
    this.healthBarGfx.clear();
    this.manaBarGfx.clear();
    this.btnAnimGfx.clear();

    this.destroyWindowElements();

    this.drawAll();
    this._lastHealth = -1;
    this._lastMana = -1;
    this.updateBars();
  }

  drawAll() {
    this.margin = this.s(3);
    let y;
    this.drawBackground();
    y = this.drawMinimap();
    y = this.drawStatusBars(y);
    y = this.drawEquipmentAndActions(y);
    y = this.drawBottomButtons(y);
    this.windowStartY = this.s(y);
    this.buildWindows();
  }

  drawBackground() {
    const gfx = this.staticGfx;
    const bw = Math.max(1, this.s(1));
    gfx.beginFill(C.panelBg);
    gfx.drawRect(this.panelX, 0, this.width, this.panelH);
    gfx.endFill();
    gfx.beginFill(C.borderDark);
    gfx.drawRect(this.panelX, 0, bw, this.panelH);
    gfx.endFill();
  }

  // ─── MINIMAP ──────────────────────────────────────────────
  drawMinimap() {
    const gfx = this.staticGfx;
    const px = this.panelX;
    const M = this.margin;
    const mapSize = this.s(125);
    const mapX = px + M;
    const mapY = M;

    this.drawBevel(gfx, mapX, mapY, mapSize, mapSize, C.minimapBg, true);
    const cx = mapX + Math.round(mapSize / 2);
    const cy = mapY + Math.round(mapSize / 2);
    const cr = this.s(3);
    const bw = Math.max(1, this.s(1));
    gfx.beginFill(0xffffff);
    gfx.drawRect(cx - cr, cy, cr * 2 + bw, bw);
    gfx.drawRect(cx, cy - cr, bw, cr * 2 + bw);
    gfx.endFill();

    const ctrlX = mapX + mapSize + this.s(3);
    const ctrlW = this.width - M * 2 - mapSize - this.s(3);
    let cy2 = mapY;
    const compassSize = ctrlW;
    const compassR = Math.round(compassSize / 2);
    const compassCX = ctrlX + compassR;
    const compassCY = cy2 + compassR;
    gfx.beginFill(C.sectionBg);
    gfx.drawCircle(compassCX, compassCY, compassSize);
    gfx.endFill();
    gfx.lineStyle(bw, 0x7a7a7a, 1);
    gfx.drawCircle(compassCX, compassCY, compassSize);
    gfx.lineStyle(0);
    this.addText(compassCX, compassCY - this.s(12), "\u25B2", 8, "#aaa", [0.5, 0.5]);
    this.addText(compassCX, compassCY + this.s(12), "\u25BC", 8, "#aaa", [0.5, 0.5]);
    this.addText(compassCX - this.s(12), compassCY, "\u25C4", 8, "#aaa", [0.5, 0.5]);
    this.addText(compassCX + this.s(12), compassCY, "\u25BA", 8, "#aaa", [0.5, 0.5]);
    cy2 += compassSize + this.s(3);
    const zBtnW = Math.floor((ctrlW - this.s(2)) / 2);
    const zBtnH = this.s(16);
    this.drawBevel(gfx, ctrlX, cy2, zBtnW, zBtnH, C.buttonBg, false);
    this.addCenteredText(ctrlX, cy2, zBtnW, zBtnH, "+", 8);
    this.drawBevel(gfx, ctrlX + zBtnW + this.s(2), cy2, zBtnW, zBtnH, C.buttonBg, false);
    this.addCenteredText(ctrlX + zBtnW + this.s(2), cy2, zBtnW, zBtnH, "-", 8);
    cy2 += zBtnH + this.s(2);
    this.drawBevel(gfx, ctrlX, cy2, ctrlW, zBtnH, C.buttonBg, false);
    this.addCenteredText(ctrlX, cy2, ctrlW, zBtnH, "Centre", 7);
    return Math.round((mapY + mapSize + M) / dpr);
  }

  // ─── STATUS BARS ──────────────────────────────────────────
  drawStatusBars(cssY) {
    const gfx = this.staticGfx;
    const px = this.panelX;
    const M = this.margin;
    const y0 = this.s(cssY);
    const iconW = this.s(10);
    const numW = this.s(36);
    const gap = this.s(3);
    const barH = this.s(8);
    const barX = px + M + iconW + gap;
    const barW = this.width - M * 2 - iconW - gap - numW - gap;

    this.addText(px + M + Math.round(iconW / 2), y0 + Math.round(barH / 2), "\u2665", 8, "#ff4444", [0.5, 0.5]);
    this.drawBevel(gfx, barX, y0, barW, barH, C.healthBarBg, true);
    this.hpBarX = barX; this.hpBarY = y0; this.hpBarW = barW; this.hpBarH = barH;
    this.hpNumText = this.addText(barX + barW + gap, y0 + Math.round(barH / 2), "", 7, "#fff", [0, 0.5]);

    const y1 = y0 + barH + this.s(2);
    this.addText(px + M + Math.round(iconW / 2), y1 + Math.round(barH / 2), "\u2726", 8, "#6666ff", [0.5, 0.5]);
    this.drawBevel(gfx, barX, y1, barW, barH, C.manaBarBg, true);
    this.mpBarX = barX; this.mpBarY = y1; this.mpBarW = barW; this.mpBarH = barH;
    this.mpNumText = this.addText(barX + barW + gap, y1 + Math.round(barH / 2), "", 7, "#fff", [0, 0.5]);

    return cssY + Math.round((barH * 2 + this.s(2) + this.s(4)) / dpr);
  }

  // ─── EQUIPMENT + ACTION BUTTONS ───────────────────────────
  drawEquipmentAndActions(cssY) {
    const gfx = this.staticGfx;
    const px = this.panelX;
    const M = this.margin;
    const y0 = this.s(cssY);
    const slotS = this.s(28);
    const slotGap = this.s(2);
    const actionBtnS = this.s(26);
    const eqW = slotS * 3 + slotGap * 2;
    const eqStartX = px + M;

    const slots = [
      [0, 0, "Amul"], [1, 0, "Helm"], [2, 0, "Back"],
      [0, 1, "Shld"], [1, 1, "Armor"], [2, 1, "Wpn"],
      [0, 2, "Ring"], [1, 2, "Legs"], [2, 2, "Ammo"],
      [1, 3, "Boots"],
    ];
    slots.forEach(([col, row, label]) => {
      const sx = eqStartX + col * (slotS + slotGap);
      const sy = y0 + row * (slotS + slotGap);
      this.drawBevel(gfx, sx, sy, slotS, slotS, C.slotBg, true);
      this.addCenteredText(sx, sy, slotS, slotS, label, 5, "#444");
    });

    const actX = eqStartX + eqW + this.s(4);
    const actBtnW = Math.floor((this.width - M - this.s(4) - eqW - M) / 2);
    const actBtnH = actionBtnS;
    const actGap = slotGap;
    const iconLabels = ["\u2694", "\u263A", "\u26A1", "\u26E8"];
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        const bx = actX + c * (actBtnW + actGap);
        const by = y0 + r * (actBtnH + actGap);
        this.drawBevel(gfx, bx, by, actBtnW, actBtnH, C.buttonBg, false);
        this.addCenteredText(bx, by, actBtnW, actBtnH, iconLabels[r * 2 + c], 9);
      }
    }
    const textBtnW = actBtnW * 2 + actGap;
    const textBtnH = this.s(14);
    let by = y0 + 2 * (actBtnH + actGap);
    ["Stop", "Options", "Help"].forEach((label) => {
      this.drawBevel(gfx, actX, by, textBtnW, textBtnH, C.buttonBg, false);
      this.addCenteredText(actX, by, textBtnW, textBtnH, label, 6);
      by += textBtnH + actGap;
    });
    const eqH = slotS * 4 + slotGap * 3;
    return cssY + Math.round((eqH + this.s(4)) / dpr);
  }

  // ─── BOTTOM BUTTONS ───────────────────────────────────────
  drawBottomButtons(cssY) {
    const gfx = this.staticGfx;
    const px = this.panelX;
    const M = this.margin;
    const btnH = this.s(18);
    const gap = this.s(2);
    const areaW = this.width - M * 2;
    const btnY = this.s(cssY);

    const buttons = [
      { label: "Skills", action: "Skills" },
      { label: "Battle", action: "Battle" },
      { label: "VIP", action: "VIP" },
      { label: "Logout", action: null },
    ];
    const btnW = Math.floor((areaW - gap * (buttons.length - 1)) / buttons.length);
    this.bottomBtns = [];

    buttons.forEach((btn, i) => {
      const bx = px + M + i * (btnW + gap);
      this.drawBevel(gfx, bx, btnY, btnW, btnH, C.buttonBg, false);
      this.addCenteredText(bx, btnY, btnW, btnH, btn.label, 7);
      this.bottomBtns.push({ x: bx, y: btnY, w: btnW, h: btnH, action: btn.action });
      this.addClickArea(bx, btnY, btnW, btnH, () => {
        this.animateButtonPress(bx, btnY, btnW, btnH);
        if (btn.action) {
          this.game.time.events.add(100, () => this.toggleWindow(btn.action), this);
        }
      });
    });
    return cssY + Math.round((btnH + this.s(3)) / dpr);
  }

  animateButtonPress(x, y, w, h) {
    const gfx = this.btnAnimGfx;
    this.drawBevel(gfx, x, y, w, h, C.buttonPressed, true);
    this.game.time.events.add(150, () => gfx.clear(), this);
  }

  // ─── STACKING WINDOW MANAGER ──────────────────────────────

  toggleWindow(name) {
    const idx = this.openWindows.findIndex((w) => w.name === name);
    if (idx >= 0) {
      this.closeWindow(name);
    } else {
      this.openWindow(name);
    }
  }

  openWindow(name) {
    // Don't open duplicates
    if (this.openWindows.find((w) => w.name === name)) return;

    // Add with equal ratio; redistribute all ratios equally
    this.openWindows.push({ name, heightRatio: 1 });
    this.equalizeRatios();
    this.buildWindows();
  }

  closeWindow(name) {
    this.openWindows = this.openWindows.filter((w) => w.name !== name);
    this.equalizeRatios();
    this.buildWindows();
  }

  equalizeRatios() {
    const n = this.openWindows.length;
    if (n === 0) return;
    this.openWindows.forEach((w) => (w.heightRatio = 1 / n));
  }

  destroyWindowElements() {
    if (this.windowElements) {
      this.windowElements.destroy(true);
      this.windowElements = null;
    }
    // Also destroy any resize handle interactives
    if (this.resizeHandles) {
      this.resizeHandles.forEach((h) => h.destroy());
      this.resizeHandles = [];
    }
  }

  buildWindows() {
    this.destroyWindowElements();

    const n = this.openWindows.length;
    if (n === 0) return;

    const px = this.panelX;
    const M = this.margin;
    const winX = px + M;
    const winW = this.width - M * 2;
    const availH = this.panelH - this.windowStartY - M;
    const titleH = this.s(18);
    const handleH = this.s(3); // resize handle between windows
    const bw = Math.max(1, this.s(1));
    const minH = this.s(MIN_WIN_HEIGHT_CSS);

    // Total space used by handles between windows
    const totalHandleH = Math.max(0, (n - 1) * handleH);
    const usableH = availH - totalHandleH;

    const group = this.game.add.group();
    this.resizeHandles = [];

    let curY = this.windowStartY;

    this.openWindows.forEach((win, i) => {
      const winH = Math.max(minH, Math.round(usableH * win.heightRatio));

      // Window background
      const bg = this.game.add.graphics(0, 0);
      bg.fixedToCamera = true;
      this.drawBevel(bg, winX, curY, winW, winH, C.windowBg, false);
      group.add(bg);

      // Title bar
      const titleGfx = this.game.add.graphics(0, 0);
      titleGfx.fixedToCamera = true;
      this.drawBevel(titleGfx, winX, curY, winW, titleH, C.windowTitle, false);
      group.add(titleGfx);

      // Title text
      const titleText = this.game.add.text(
        winX + this.s(6), curY + Math.round(titleH / 2),
        win.name, { font: `bold ${this.s(8)}px Verdana`, fill: "#cccccc" }
      );
      titleText.anchor.set(0, 0.5);
      titleText.fixedToCamera = true;
      group.add(titleText);

      // Close [x] button
      const closeSize = this.s(14);
      const closeX = winX + winW - closeSize - this.s(2);
      const closeY = curY + Math.round((titleH - closeSize) / 2);

      const closeGfx = this.game.add.graphics(0, 0);
      closeGfx.fixedToCamera = true;
      this.drawBevel(closeGfx, closeX, closeY, closeSize, closeSize, C.buttonBg, false);
      group.add(closeGfx);

      const closeText = this.game.add.text(
        closeX + Math.round(closeSize / 2), closeY + Math.round(closeSize / 2),
        "x", { font: `bold ${this.s(8)}px Verdana`, fill: "#cccccc" }
      );
      closeText.anchor.set(0.5);
      closeText.fixedToCamera = true;
      group.add(closeText);

      // Close click area
      const closeBmd = this.game.add.bitmapData(closeSize, closeSize);
      closeBmd.fill(255, 255, 255, 255);
      const closeBtn = this.game.add.sprite(0, 0, closeBmd);
      closeBtn.alpha = 0.001;
      closeBtn.fixedToCamera = true;
      closeBtn.cameraOffset.setTo(closeX, closeY);
      closeBtn.inputEnabled = true;
      closeBtn.input.pixelPerfectClick = false;
      closeBtn.input.useHandCursor = true;
      const windowName = win.name;
      closeBtn.events.onInputDown.add(() => this.closeWindow(windowName));
      group.add(closeBtn);

      // Separator below title
      const sepGfx = this.game.add.graphics(0, 0);
      sepGfx.fixedToCamera = true;
      sepGfx.beginFill(C.borderDark);
      sepGfx.drawRect(winX + this.s(2), curY + titleH, winW - this.s(4), bw);
      sepGfx.endFill();
      group.add(sepGfx);

      // Content placeholder
      const contentY = curY + titleH + this.s(4);
      const contentH = winH - titleH - this.s(4);
      if (contentH > this.s(12)) {
        const ph = this.game.add.text(
          winX + Math.round(winW / 2),
          contentY + Math.round(contentH / 2),
          `${win.name}`,
          { font: `${this.s(7)}px Verdana`, fill: "#555", align: "center" }
        );
        ph.anchor.set(0.5);
        ph.fixedToCamera = true;
        group.add(ph);
      }

      curY += winH;

      // Resize handle between windows (not after the last one)
      if (i < n - 1) {
        const handleGfx = this.game.add.graphics(0, 0);
        handleGfx.fixedToCamera = true;
        handleGfx.beginFill(C.resizeHandle);
        handleGfx.drawRect(winX, curY, winW, handleH);
        handleGfx.endFill();
        // Draw grip dots in the center
        const gripX = winX + Math.round(winW / 2);
        const gripY = curY + Math.round(handleH / 2);
        handleGfx.beginFill(0x888888);
        handleGfx.drawRect(gripX - this.s(6), gripY, this.s(2), bw);
        handleGfx.drawRect(gripX, gripY, this.s(2), bw);
        handleGfx.drawRect(gripX + this.s(6), gripY, this.s(2), bw);
        handleGfx.endFill();
        group.add(handleGfx);

        // Draggable resize handle
        const resizeBmd = this.game.add.bitmapData(winW, handleH);
        resizeBmd.fill(255, 255, 255, 255);
        const resizeSprite = this.game.add.sprite(0, 0, resizeBmd);
        resizeSprite.alpha = 0.001;
        resizeSprite.fixedToCamera = true;
        resizeSprite.cameraOffset.setTo(winX, curY);
        resizeSprite.inputEnabled = true;
        resizeSprite.input.pixelPerfectClick = false;
        resizeSprite.input.useHandCursor = true;
        resizeSprite.input.enableDrag(false, false, false, 255);

        const handleIndex = i;
        let dragStartY;
        resizeSprite.events.onDragStart.add(() => {
          dragStartY = resizeSprite.cameraOffset.y;
        });
        resizeSprite.events.onDragUpdate.add(() => {
          const delta = resizeSprite.cameraOffset.y - dragStartY;
          // Lock horizontal movement
          resizeSprite.cameraOffset.x = winX;
          this.resizeWindowAt(handleIndex, delta);
          dragStartY = resizeSprite.cameraOffset.y;
        });
        resizeSprite.events.onDragStop.add(() => {
          // Rebuild to clean up positions
          this.buildWindows();
        });

        group.add(resizeSprite);
        this.resizeHandles.push(resizeSprite);

        curY += handleH;
      }
    });

    this.windowElements = group;
  }

  resizeWindowAt(handleIndex, deltaPixels) {
    const above = this.openWindows[handleIndex];
    const below = this.openWindows[handleIndex + 1];
    if (!above || !below) return;

    const totalHandleH = Math.max(0, (this.openWindows.length - 1) * this.s(3));
    const availH = this.panelH - this.windowStartY - this.margin;
    const usableH = availH - totalHandleH;
    const minRatio = this.s(MIN_WIN_HEIGHT_CSS) / usableH;

    const deltaRatio = deltaPixels / usableH;
    const newAbove = above.heightRatio + deltaRatio;
    const newBelow = below.heightRatio - deltaRatio;

    if (newAbove >= minRatio && newBelow >= minRatio) {
      above.heightRatio = newAbove;
      below.heightRatio = newBelow;
    }
  }

  // ─── BARS UPDATE ──────────────────────────────────────────
  updateBars() {
    if (this.currentHealth === this._lastHealth && this.currentMana === this._lastMana) return;
    this._lastHealth = this.currentHealth;
    this._lastMana = this.currentMana;
    const bw = Math.max(1, this.s(1));

    this.healthBarGfx.clear();
    const hpW = Math.round(((this.hpBarW - bw * 2) * this.currentHealth) / this.maxHealth);
    if (hpW > 0) {
      this.healthBarGfx.beginFill(C.healthBar);
      this.healthBarGfx.drawRect(this.hpBarX + bw, this.hpBarY + bw, hpW, this.hpBarH - bw * 2);
      this.healthBarGfx.endFill();
    }
    if (this.hpNumText) this.hpNumText.text = `${this.currentHealth}`;

    this.manaBarGfx.clear();
    const mpW = Math.round(((this.mpBarW - bw * 2) * this.currentMana) / this.maxMana);
    if (mpW > 0) {
      this.manaBarGfx.beginFill(C.manaBar);
      this.manaBarGfx.drawRect(this.mpBarX + bw, this.mpBarY + bw, mpW, this.mpBarH - bw * 2);
      this.manaBarGfx.endFill();
    }
    if (this.mpNumText) this.mpNumText.text = `${this.currentMana}`;
  }

  update() { this.updateBars(); }
  render() {}
}
