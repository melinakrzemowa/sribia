import MainState from "./states/main"
import { field } from "./globals"
export default class Game extends Phaser.Game {

  constructor() {
    super(field * 9, field * 9, Phaser.CANVAS, 'game', {});

    this.state.add('Main', MainState, false);
    this.state.start('Main');
  }

}
