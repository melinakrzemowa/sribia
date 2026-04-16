import MainState from "./states/main";
import { field, panelWidth } from "./globals";
export default class Game extends Phaser.Game {
  constructor() {
    super(field * 15 + panelWidth, field * 11, Phaser.CANVAS, "game", {});

    this.state.add("Main", MainState, false);
    this.state.start("Main");
  }
}
