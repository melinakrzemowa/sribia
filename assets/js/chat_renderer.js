import { dpr } from "./globals";

const FONT_SIZE_CSS = 9;
const LINE_PADDING_CSS = 2;
const MARGIN_CSS = 4;
const MAX_MESSAGES = 100;
const INPUT_HEIGHT_CSS = 20;

export default class ChatRenderer {
  constructor(game, x, y, w, h) {
    this.game = game;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.dpr = dpr;

    this.fontSize = Math.round(FONT_SIZE_CSS * dpr);
    this.lineHeight = Math.round((FONT_SIZE_CSS + LINE_PADDING_CSS) * dpr);
    this.margin = Math.round(MARGIN_CSS * dpr);
    this.inputH = Math.round(INPUT_HEIGHT_CSS * dpr);
    this.textAreaH = this.h - this.inputH;

    this.messages = []; // { lines: string[], color: string }
    this.totalLines = 0;
    this.scrollOffset = 0; // in pixels from bottom

    // Draw background FIRST so messages render on top
    this.bgGfx = game.add.graphics(0, 0);
    this.bgGfx.fixedToCamera = true;
    this.drawBackground();

    // BitmapData for the message area (excludes input area)
    this.bmd = game.add.bitmapData(this.w, this.textAreaH);
    this.sprite = game.add.sprite(0, 0, this.bmd);
    this.sprite.fixedToCamera = true;
    this.sprite.cameraOffset.setTo(this.x, this.y);

    // Mousewheel scrolling
    this.game.input.mouse.mouseWheelCallback = (event) => {
      this.onWheel(event);
    };

    // Position HTML chat input into the chat area
    this.positionInput();

    // Initial render
    this.redraw();
  }

  drawBackground() {
    const gfx = this.bgGfx;
    const bw = Math.max(1, Math.round(this.dpr));
    // Dark chat background
    gfx.beginFill(0x1e1e1e);
    gfx.drawRect(this.x, this.y, this.w, this.h);
    gfx.endFill();
    // Top border
    gfx.beginFill(0x0a0a0a);
    gfx.drawRect(this.x, this.y, this.w, bw);
    gfx.endFill();
    // Separator above input
    gfx.beginFill(0x333333);
    gfx.drawRect(this.x, this.y + this.textAreaH, this.w, bw);
    gfx.endFill();
  }

  positionInput() {
    const input = document.querySelector("#chat-input");
    if (!input) return;

    // Position the HTML input over the chat input area
    const canvas = this.game.canvas;
    const cssX = this.x / this.dpr;
    const cssY = (this.y + this.textAreaH + 2) / this.dpr;
    const cssW = this.w / this.dpr;
    const cssH = (this.inputH - 4) / this.dpr;

    input.style.position = "absolute";
    input.style.left = cssX + "px";
    input.style.top = cssY + "px";
    input.style.width = cssW + "px";
    input.style.height = cssH + "px";
    input.style.border = "1px solid #444";
    input.style.background = "#1a1a1a";
    input.style.color = "#ffffff";
    input.style.fontFamily = "Verdana, sans-serif";
    input.style.fontWeight = "bold";
    input.style.fontSize = FONT_SIZE_CSS + "px";
    input.style.padding = "0 4px";
    input.style.outline = "none";
    input.style.boxSizing = "border-box";
    input.style.zIndex = "10";

    // Hide the old HTML messages container
    const messages = document.querySelector("#messages");
    if (messages) messages.style.display = "none";
  }

  addMessage(text, color) {
    // Word-wrap the message into lines
    const ctx = this.bmd.ctx;
    ctx.font = `bold ${this.fontSize}px Verdana`;
    const maxWidth = this.w - this.margin * 2;
    const lines = this.wrapText(ctx, text, maxWidth);

    this.messages.push({ lines, color: color || "#ffff00" });
    this.totalLines += lines.length;

    // Cap messages
    while (this.messages.length > MAX_MESSAGES) {
      const removed = this.messages.shift();
      this.totalLines -= removed.lines.length;
    }

    // Auto-scroll to bottom
    this.scrollOffset = 0;
    this.redraw();
  }

  wrapText(ctx, text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let currentLine = "";

    words.forEach((word) => {
      const test = currentLine ? currentLine + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = test;
      }
    });
    if (currentLine) lines.push(currentLine);
    return lines.length ? lines : [""];
  }

  onWheel(event) {
    // Check if mouse is over the chat area
    const mx = this.game.input.x;
    const my = this.game.input.y;
    if (mx >= this.x && mx <= this.x + this.w &&
        my >= this.y && my <= this.y + this.textAreaH) {
      const delta = event.wheelDelta ? -event.wheelDelta : event.deltaY;
      const scrollAmount = this.lineHeight * 3;
      if (delta > 0) {
        // Scroll up (show older messages)
        this.scrollOffset = Math.min(
          this.scrollOffset + scrollAmount,
          Math.max(0, this.totalLines * this.lineHeight - this.textAreaH)
        );
      } else {
        // Scroll down (show newer messages)
        this.scrollOffset = Math.max(0, this.scrollOffset - scrollAmount);
      }
      this.redraw();
    }
  }

  redraw() {
    const ctx = this.bmd.ctx;
    const w = this.w;
    const h = this.textAreaH;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Draw messages from bottom up
    ctx.font = `bold ${this.fontSize}px Verdana`;
    ctx.textBaseline = "top";

    // Flatten all lines with colors
    const allLines = [];
    this.messages.forEach((msg) => {
      msg.lines.forEach((line) => {
        allLines.push({ text: line, color: msg.color });
      });
    });

    // Start from the bottom of the text area, accounting for scroll
    const visibleBottom = h + this.scrollOffset;
    const startLine = allLines.length - 1;

    for (let i = startLine; i >= 0; i--) {
      const lineY = visibleBottom - (allLines.length - i) * this.lineHeight;
      if (lineY + this.lineHeight < 0) break; // above visible area
      if (lineY >= h) continue; // below visible area

      ctx.fillStyle = allLines[i].color;
      ctx.fillText(allLines[i].text, this.margin, lineY);
    }

    this.bmd.dirty = true;
  }

  // Called on window resize
  reposition(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.textAreaH = h - this.inputH;

    // Resize BitmapData
    this.bmd.resize(w, this.textAreaH);
    this.sprite.cameraOffset.setTo(x, y);

    // Redraw background
    this.bgGfx.clear();
    this.drawBackground();

    // Reposition input
    this.positionInput();

    this.redraw();
  }
}
