export default class NameText {

  constructor(objectFactory, object) {
    this.objectFactory = objectFactory;
    this.object = object;

    let style = { font: "bold 12px Tahoma", fill: "#43d637", align: "center", stroke: '#000000', strokeThickness: 2};
    this.nameText = objectFactory.text(object.sprite.x, object.sprite.y - 24, object.name, style);
    this.nameText.anchor.set(0.5);
    this.nameText.bringToTop();
  }

  update() {
    this.nameText.x = this.object.sprite.x;
    this.nameText.y = this.object.sprite.y - 24;
    this.nameText.bringToTop();
  }

}
