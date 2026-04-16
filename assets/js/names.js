import { displayScale } from "./globals";

export default class NameText {
  constructor(objectFactory, object) {
    this.objectFactory = objectFactory;
    this.object = object;
    this.yOffset = Math.round(24 * displayScale);

    let style = {
      font: `bold ${Math.round(12 * displayScale)}px Tahoma`,
      fill: "#43d637",
      align: "center",
      stroke: "#000000",
      strokeThickness: Math.round(2 * displayScale),
    };
    this.nameText = objectFactory.text(
      object.sprite.x,
      object.sprite.y - this.yOffset,
      object.name,
      style
    );
    this.nameText.anchor.set(0.5);
    this.nameText.bringToTop();
    this.nameText.alpha = 0;
  }

  update() {
    this.nameText.x = this.object.sprite.x;
    this.nameText.y = this.object.sprite.y - this.yOffset;
    // this.nameText.bringToTop();
  }

  destroy() {
    this.nameText.destroy();
  }
}
