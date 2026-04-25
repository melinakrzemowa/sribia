import { displayScale } from "./globals";

// Name label + small health bar above an entity. `object` needs `sprite` and
// `name`; an optional `object.hp` (0..1 ratio) drives the bar fill, defaulting
// to full while the backend doesn't expose per-entity health.
// `object.type === "monster"` switches the name colour to red.
export default class NameText {
  constructor(objectFactory, object) {
    this.objectFactory = objectFactory;
    this.object = object;
    this.xOffset = Math.round(-8 * displayScale); // sprite anchor sits 0.75 from the left, so nudge name back over the head
    this.yOffset = Math.round(30 * displayScale); // sit above the head, not the body
    this.barYOffset = Math.round(5 * displayScale); // distance from name center down to bar top
    this.barW = Math.round(16 * displayScale);
    this.barH = Math.max(2, Math.round(1.5 * displayScale));

    const nameColor = object.type === "monster" ? "#e84040" : "#43d637";
    const style = {
      font: `bold ${Math.round(7 * displayScale)}px Tahoma`,
      fill: nameColor,
      align: "center",
      stroke: "#000000",
      strokeThickness: Math.max(1, Math.round(displayScale)),
    };
    this.nameText = objectFactory.text(
      object.sprite.x + this.xOffset,
      object.sprite.y - this.yOffset,
      object.name,
      style
    );
    this.nameText.anchor.set(0.5);
    this.nameText.bringToTop();

    this.hpBar = objectFactory.graphics(0, 0);
    this._lastHp = null;
    this._lastX = null;
    this._lastY = null;
    this.drawBar(this._currentHp());
  }

  _currentHp() {
    const cur = this.object.health;
    const max = this.object.maxHealth;
    if (typeof cur !== "number" || typeof max !== "number" || max <= 0) return 1.0;
    return Math.max(0, Math.min(1, cur / max));
  }

  drawBar(hp) {
    const x = this.object.sprite.x + this.xOffset;
    const y = this.object.sprite.y - this.yOffset + this.barYOffset;
    const bx = Math.round(x - this.barW / 2);
    const by = Math.round(y);
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
    const x = this.object.sprite.x + this.xOffset;
    const y = this.object.sprite.y - this.yOffset;
    this.nameText.x = x;
    this.nameText.y = y;
    const hp = this._currentHp();
    if (hp !== this._lastHp || x !== this._lastX || y !== this._lastY) {
      this.drawBar(hp);
      this._lastX = x;
      this._lastY = y;
    }
  }

  destroy() {
    this.nameText.destroy();
    this.hpBar.destroy();
  }
}
