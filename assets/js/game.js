import MobileDetect from "mobile-detect"
import MainState from "./states/main"
import { field } from "./globals"
export default class Game extends Phaser.Game {

  constructor() {
    var md = new MobileDetect(window.navigator.userAgent);
    if (md.mobile()) {
      super(field * 11, field * 15, Phaser.CANVAS, 'game', {});
    }
    else {
      super(field * 15, field * 11, Phaser.CANVAS, 'game', {});
    }

    this.state.add('Main', MainState, false);
    this.state.start('Main');
  }

}
