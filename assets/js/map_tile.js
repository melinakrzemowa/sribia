import {field, scale} from "./globals"

export default class MapTile {

  constructor(map, x, y) {
    this.map = map;

    this.x = x;
    this.y = y;
    this.blocks = false;
    this.envSprites = [];
    this.objects = [];
  }

  createEnv(name, frame, anchor_x, anchor_y) {
    let sprite = this.map.state.group.create(this.x * field, this.y * field, name, frame);
    sprite.scale.setTo(scale, scale);
    sprite.anchor.setTo(anchor_x, anchor_y);
    sprite.env = true;
    this.envSprites.push(sprite);
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
