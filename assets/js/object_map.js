const mapSize = 10000;

export default class ObjectMap {

  constructor(state) {
    this.map = new Map();
    this.state = state;

  }

  get(x, y) {
    return this.map.get(x * mapSize + y);
  }

  set(x, y, object) {
    return this.map.set(x * mapSize + y, object);
  }

  delete(x, y) {
    return this.map.delete(x * mapSize + y);
  }

}
