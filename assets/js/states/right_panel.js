import { field, displayScale, panelWidth } from "../globals";

export default class RightPanelState {
  constructor(game, mainState) {
    this.game = game;
    this.mainState = mainState;
    this.width = panelWidth;
    this.panelX = field * 15;

    // Scaled layout values
    this.margin = Math.round(10 * displayScale);
    this.barWidth = Math.round(180 * displayScale);
    this.barHeight = Math.round(20 * displayScale);
    this.nameY = Math.round(20 * displayScale);
    this.healthY = Math.round(50 * displayScale);
    this.manaY = Math.round(80 * displayScale);

    // Player stats (placeholder values until we have real data)
    this.maxHealth = 100;
    this.currentHealth = 70;
    this.maxMana = 50;
    this.currentMana = 30;
  }

  create() {
    const px = this.panelX;
    const m = this.margin;

    // Create a fixed graphics object for the brown background
    this.background = this.game.add.graphics(0, 0);
    this.background.fixedToCamera = true;

    this.background.beginFill(0x808080);
    this.background.drawRect(px, 0, this.width, field * 11);
    this.background.endFill();

    // Create player name text
    this.nameText = this.game.add.text(px + m, this.nameY, "", {
      font: `bold ${Math.round(12 * displayScale)}px Verdana, Arial, sans-serif`,
      fill: "#ffffff",
    });
    this.nameText.fixedToCamera = true;

    // Create health bar background
    this.healthBarBg = this.game.add.graphics(0, 0);
    this.healthBarBg.fixedToCamera = true;
    this.healthBarBg.beginFill(0x333333);
    this.healthBarBg.drawRect(px + m, this.healthY, this.barWidth, this.barHeight);
    this.healthBarBg.endFill();

    // Create health bar fill
    this.healthBar = this.game.add.graphics(0, 0);
    this.healthBar.fixedToCamera = true;

    // Create health text
    this.healthText = this.game.add.text(px + m, this.healthY + Math.round(2 * displayScale), "", {
      font: `bold ${Math.round(10 * displayScale)}px Verdana, Arial, sans-serif`,
      fill: "#ffffff",
    });
    this.healthText.fixedToCamera = true;

    // Create mana bar background
    this.manaBarBg = this.game.add.graphics(0, 0);
    this.manaBarBg.fixedToCamera = true;
    this.manaBarBg.beginFill(0x333333);
    this.manaBarBg.drawRect(px + m, this.manaY, this.barWidth, this.barHeight);
    this.manaBarBg.endFill();

    // Create mana bar fill
    this.manaBar = this.game.add.graphics(0, 0);
    this.manaBar.fixedToCamera = true;

    // Create mana text
    this.manaText = this.game.add.text(px + m, this.manaY + Math.round(2 * displayScale), "", {
      font: `bold ${Math.round(10 * displayScale)}px Verdana, Arial, sans-serif`,
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
    const healthWidth = (this.currentHealth / this.maxHealth) * this.barWidth;
    this.healthBar.drawRect(this.panelX + this.margin, this.healthY, healthWidth, this.barHeight);
    this.healthBar.endFill();
    this.healthText.text = `HP: ${this.currentHealth}/${this.maxHealth}`;

    // Update mana bar
    this.manaBar.clear();
    this.manaBar.beginFill(0x0000ff); // Blue
    const manaWidth = (this.currentMana / this.maxMana) * this.barWidth;
    this.manaBar.drawRect(this.panelX + this.margin, this.manaY, manaWidth, this.barHeight);
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
