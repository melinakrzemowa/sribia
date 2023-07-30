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

  getSpriteIndex(group, w, h, l, x, y, z, f) {
    return ((((((f % group.frames) * group.patternZ + z) * group.patternY + y) * group.patternX + x) * group.layers + l) * group.height + h) * group.width + w;
  };

  createEnv(itemData) {
    for (let w = 0; w < itemData.width; w++) {
      for (let h = 0; h < itemData.height; h++) {
        // we need to start from the back so we keep the highest layers on top
        for (var l = itemData.layers - 1; l >= 0; l--) {
          let index = this.getSpriteIndex(itemData, w, h, l, this.x % itemData.patternX, this.y % itemData.patternY, 0, 0)
          let spriteId = itemData.sprites[index]
        
          if (spriteId > 0) {
            let sheetNumber = Math.ceil(spriteId / 1000)
            let sprite = this.map.state.add.sprite((this.x - w) * field, (this.y - h) * field, 'tibia' + sheetNumber, spriteId.toString())
            this.map.state.group.add(sprite)
            sprite.scale.setTo(scale, scale);
            sprite.anchor.setTo(0.5, 0.5)
            sprite.gameObject = {position: {x: this.x, y: this.y}}

            if (itemData.frames > 1) {
              let frames = [];

              for (let f = 0; f < itemData.frames; f++) {
                let index = this.getSpriteIndex(itemData, w, h, l, this.x % itemData.patternX, this.y % itemData.patternY, 0, f)
                frames[f] = itemData.sprites[index].toString()
              }

              sprite.animations.add('idle', frames)
              sprite.animations.play('idle', 2, true);
            }
          }
        }
      }
    }
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
