import {field} from "./globals"

export default class MapTile {

  constructor(map, x, y) {
    this.map = map;

    this.x = x;
    this.y = y;
    this.blocks = false;
    this.envSprites = [];
    this.objects = [];
  }

  createEnv(name) {
    let sprite = this.map.state.group.create(this.x * field, this.y * field, name);
    sprite.scale.setTo(0.25, 0.25);
    sprite.anchor.setTo(0.5, 1)
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
