import { field } from "../globals";

export default class RightPanelState {
  constructor(game, mainState) {
    this.game = game;
    this.mainState = mainState;
    this.width = 200;
    this.panelX = field * 15;

    // Player stats (placeholder values until we have real data)
    this.maxHealth = 100;
    this.currentHealth = 70;
    this.maxMana = 50;
    this.currentMana = 30;
  }

  create() {
    // Create a fixed graphics object for the brown background
    this.background = this.game.add.graphics(0, 0);
    this.background.fixedToCamera = true;

    this.background.beginFill(0x808080);
    this.background.drawRect(this.panelX, 0, this.width, field * 11);
    this.background.endFill();

    // Create player name text
    this.nameText = this.game.add.text(this.panelX + 10, 20, "", {
      font: "bold 12px Verdana, Arial, sans-serif",
      fill: "#ffffff",
    });
    this.nameText.fixedToCamera = true;
    console.log(this.nameText);

    // Create health bar background
    this.healthBarBg = this.game.add.graphics(0, 0);
    this.healthBarBg.fixedToCamera = true;
    this.healthBarBg.beginFill(0x333333);
    this.healthBarBg.drawRect(this.panelX + 10, 50, 180, 20);
    this.healthBarBg.endFill();

    // Create health bar fill
    this.healthBar = this.game.add.graphics(0, 0);
    this.healthBar.fixedToCamera = true;

    // Create health text
    this.healthText = this.game.add.text(this.panelX + 10, 52, "", {
      font: "bold 10px Verdana, Arial, sans-serif",
      fill: "#ffffff",
    });
    this.healthText.fixedToCamera = true;

    // Create mana bar background
    this.manaBarBg = this.game.add.graphics(0, 0);
    this.manaBarBg.fixedToCamera = true;
    this.manaBarBg.beginFill(0x333333);
    this.manaBarBg.drawRect(this.panelX + 10, 80, 180, 20);
    this.manaBarBg.endFill();

    // Create mana bar fill
    this.manaBar = this.game.add.graphics(0, 0);
    this.manaBar.fixedToCamera = true;

    // Create mana text
    this.manaText = this.game.add.text(this.panelX + 10, 82, "", {
      font: "bold 10px Verdana, Arial, sans-serif",
      fill: "#ffffff",
    });
    this.manaText.fixedToCamera = true;

    this.updateBars();
  }

  updateBars() {
    // Update player name
    const playerName = this.mainState.player.name || "Loading...";
    this.nameText.text = playerName;

    // Update health bar
    this.healthBar.clear();
    this.healthBar.beginFill(0xff0000); // Red
    const healthWidth = (this.currentHealth / this.maxHealth) * 180;
    this.healthBar.drawRect(this.panelX + 10, 50, healthWidth, 20);
    this.healthBar.endFill();
    this.healthText.text = `HP: ${this.currentHealth}/${this.maxHealth}`;

    // Update mana bar
    this.manaBar.clear();
    this.manaBar.beginFill(0x0000ff); // Blue
    const manaWidth = (this.currentMana / this.maxMana) * 180;
    this.manaBar.drawRect(this.panelX + 10, 80, manaWidth, 20);
    this.manaBar.endFill();
    this.manaText.text = `MP: ${this.currentMana}/${this.maxMana}`;
  }

  update() {
    // Update bars every frame to reflect any changes
    this.updateBars();
  }

  render() {
    // Render logic for the right panel if needed
  }
}
