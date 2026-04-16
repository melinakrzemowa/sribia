import MainState from "./states/main";
import { canvasWidth, canvasHeight } from "./globals";
export default class Game extends Phaser.Game {
  constructor() {
    // Canvas fills the entire physical viewport.
    // SHOW_ALL scales it down to CSS viewport at 1:1 physical pixel mapping.
    super(canvasWidth, canvasHeight, Phaser.CANVAS, "game", {});

    this.state.add("Main", MainState, false);
    this.state.start("Main");
  }
}
