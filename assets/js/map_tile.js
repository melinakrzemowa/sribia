import {field, scale, size} from "./globals"

export default class MapTile {

  constructor(map, x, y) {
    this.map = map;

    this.x = x;
    this.y = y;
    this.blocks = false;
    this.envSprites = [];
    this.objects = [];
  }

  createEnv(name, frame, itemData) {
    let sprite = this.map.state.add.tileSprite(this.x * field, this.y * field, itemData.width * size, itemData.height * size, name, frame)
    this.map.state.group.add(sprite)

    // let sprite = this.map.state.group.create(this.x * field, this.y * field, name, frame);
    sprite.scale.setTo(scale, scale);
    sprite.anchor.setTo(1 - 1 / itemData.width, 1 - 1 / itemData.height);
    sprite.env = true;
    this.envSprites.push(sprite);
    return sprite;
  }

  putObject(object) {
    return this.objects.push(object);
  }

  getObjects() {
    return this.objects;
  }

  deleteObject(object) {
    var index = this.objects.indexOf(object);
    if (index > -1) {
      this.objects.splice(index, 1);
    }
  }

}
