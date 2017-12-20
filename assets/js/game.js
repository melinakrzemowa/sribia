import MainState from "./states/main"

export default class Game extends Phaser.Game {

  constructor() {
    super(540, 540, Phaser.CANVAS, 'game', {});

    this.state.add('Main', MainState, false);
    this.state.start('Main');
  }

}
