import { dpr, field } from "./globals";

function titleCase(s) {
  return (s || "").replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// Name label + small health bar above an entity. `object` needs `sprite` and
// `name`; an optional `object.hp` (0..1 ratio) drives the bar fill, defaulting
// to full while the backend doesn't expose per-entity health.
// `object.type === "monster"` switches the name colour to red.
export default class NameText {
  constructor(objectFactory, object) {
    this.objectFactory = objectFactory;
    this.object = object;
    // Fixed-pixel sizing (× dpr) for the bar and gaps so the readout stays the
    // same on any zoom level. The vertical anchor (head top) still tracks the
    // tile field size since that changes with the play area.
    this.xOffset = -Math.round(field * 0.25); // sprite is anchored at 0.75 — pull back to centre over the head
    this.barW = Math.round(28 * dpr);
    this.barH = Math.max(2, Math.round(2 * dpr));
    this.gapBarToHead = Math.round(1 * dpr);   // 1 CSS px above the head
    this.gapNameToBar = Math.round(2 * dpr);

    const nameColor = object.type === "monster" ? "#e84040" : "#43d637";
    // Font is sized in physical pixels (× dpr) — independent of the tile
    // scale, so the name reads at a constant CSS size on screen.
    const style = {
      font: `bold ${Math.round(10 * dpr)}px Tahoma`,
      fill: nameColor,
      align: "center",
      stroke: "#000000",
      strokeThickness: Math.max(1, Math.round(dpr)),
    };
    this.nameText = objectFactory.text(0, 0, titleCase(object.name), style);
    this.nameText.anchor.set(0.5);
    this.nameText.bringToTop();

    this.hpBar = objectFactory.graphics(0, 0);
    this._lastHp = null;
    this._lastX = null;
    this._lastY = null;
    this._reposition();
    this.drawBar(this._currentHp());
  }

  // Place name + bar so the bar's bottom sits `gapBarToHead` above the head.
  _reposition() {
    const sx = this.object.sprite.x + this.xOffset;
    const headTop = this.object.sprite.y - field * 0.75;
    const barBottom = headTop - this.gapBarToHead;
    this._barTop = barBottom - this.barH;
    this._barCx = sx;
    this.nameText.x = sx;
    this.nameText.y = this._barTop - this.gapNameToBar - this.nameText.height / 2;
  }

  _currentHp() {
    const cur = this.object.health;
    const max = this.object.maxHealth;
    if (typeof cur !== "number" || typeof max !== "number" || max <= 0) return 1.0;
    return Math.max(0, Math.min(1, cur / max));
  }

  drawBar(hp) {
    const bx = Math.round(this._barCx - this.barW / 2);
    const by = Math.round(this._barTop);
    this.hpBar.clear();
    this.hpBar.beginFill(0x000000, 1);
    this.hpBar.drawRect(bx, by, this.barW, this.barH);
    this.hpBar.endFill();
    const fw = Math.max(0, Math.round((this.barW - 2) * hp));
    if (fw > 0) {
      const color = hp > 0.6 ? 0x43d637 : hp > 0.3 ? 0xe8c530 : 0xd02020;
      this.hpBar.beginFill(color, 1);
      this.hpBar.drawRect(bx + 1, by + 1, fw, this.barH - 2);
      this.hpBar.endFill();
    }
    this._lastHp = hp;
  }

  update() {
    this._reposition();
    const hp = this._currentHp();
    if (hp !== this._lastHp || this._barCx !== this._lastX || this._barTop !== this._lastY) {
      this.drawBar(hp);
      this._lastX = this._barCx;
      this._lastY = this._barTop;
    }
  }

  destroy() {
    this.nameText.destroy();
    this.hpBar.destroy();
  }
}
