import { field } from "../globals";

export default class RightPanelState {
  constructor(game, mainState) {
    this.game = game;
    this.mainState = mainState;
    this.width = 200;
    this.panelX = field * 15;
  }

  create() {
    let yOffset = 10;
    const lineHeight = 20;
    const smallFont = { font: "10px Verdana, Arial, sans-serif", fill: "#ffffff" };
    const labelFont = { font: "bold 11px Verdana, Arial, sans-serif", fill: "#cccccc" };
    const titleFont = { font: "bold 12px Verdana, Arial, sans-serif", fill: "#ffffff" };

    // Create a fixed graphics object for the background
    this.background = this.game.add.graphics(0, 0);
    this.background.fixedToCamera = true;
    this.background.beginFill(0x808080);
    this.background.drawRect(this.panelX, 0, this.width, 600);
    this.background.endFill();

    // Player name
    this.nameText = this.game.add.text(this.panelX + 10, yOffset, "", titleFont);
    this.nameText.fixedToCamera = true;
    yOffset += 25;

    // Health bar
    this.healthBarBg = this.game.add.graphics(0, 0);
    this.healthBarBg.fixedToCamera = true;
    this.healthBarBg.beginFill(0x333333);
    this.healthBarBg.drawRect(this.panelX + 10, yOffset, 180, 18);
    this.healthBarBg.endFill();

    this.healthBar = this.game.add.graphics(0, 0);
    this.healthBar.fixedToCamera = true;

    this.healthText = this.game.add.text(this.panelX + 10, yOffset + 2, "", smallFont);
    this.healthText.fixedToCamera = true;
    yOffset += 23;

    // Mana bar
    this.manaBarBg = this.game.add.graphics(0, 0);
    this.manaBarBg.fixedToCamera = true;
    this.manaBarBg.beginFill(0x333333);
    this.manaBarBg.drawRect(this.panelX + 10, yOffset, 180, 18);
    this.manaBarBg.endFill();

    this.manaBar = this.game.add.graphics(0, 0);
    this.manaBar.fixedToCamera = true;

    this.manaText = this.game.add.text(this.panelX + 10, yOffset + 2, "", smallFont);
    this.manaText.fixedToCamera = true;
    yOffset += 28;

    // Level
    this.levelText = this.game.add.text(this.panelX + 10, yOffset, "", smallFont);
    this.levelText.fixedToCamera = true;
    yOffset += lineHeight;

    // Experience
    this.experienceText = this.game.add.text(this.panelX + 10, yOffset, "", smallFont);
    this.experienceText.fixedToCamera = true;
    yOffset += lineHeight + 5;

    // Position header
    this.positionLabel = this.game.add.text(this.panelX + 10, yOffset, "Position:", labelFont);
    this.positionLabel.fixedToCamera = true;
    yOffset += lineHeight;

    // Position values
    this.positionText = this.game.add.text(this.panelX + 10, yOffset, "", smallFont);
    this.positionText.fixedToCamera = true;
    yOffset += lineHeight + 10;

    // Skills header
    this.skillsLabel = this.game.add.text(this.panelX + 10, yOffset, "Skills:", labelFont);
    this.skillsLabel.fixedToCamera = true;
    yOffset += lineHeight;

    // Skills text objects
    this.skillsTexts = {};
    const skillNames = [
      { key: "melee_fighting", label: "Melee Fighting" },
      { key: "distance_fighting", label: "Distance Fighting" },
      { key: "shielding", label: "Shielding" },
      { key: "magic_level", label: "Magic Level" },
      { key: "crafting", label: "Crafting" },
      { key: "fishing", label: "Fishing" }
    ];

    skillNames.forEach(skill => {
      this.skillsTexts[skill.key] = this.game.add.text(
        this.panelX + 10,
        yOffset,
        "",
        smallFont
      );
      this.skillsTexts[skill.key].fixedToCamera = true;
      this.skillsTexts[skill.key].skillLabel = skill.label;
      yOffset += lineHeight;
    });

    this.updateBars();
  }

  updateBars() {
    const player = this.mainState.player;

    // Update player name
    this.nameText.text = player.name || "Loading...";

    // Update health bar
    const currentHealth = player.currentHealth || 100;
    const maxHealth = player.maxHealth || 100;
    this.healthBar.clear();
    this.healthBar.beginFill(0xff0000); // Red
    const healthWidth = (currentHealth / maxHealth) * 180;
    const healthBarY = 35; // Match the yOffset from create
    this.healthBar.drawRect(this.panelX + 10, healthBarY, healthWidth, 18);
    this.healthBar.endFill();
    this.healthText.text = `HP: ${currentHealth}/${maxHealth}`;

    // Update mana bar
    const currentMana = player.currentMana || 50;
    const maxMana = player.maxMana || 50;
    this.manaBar.clear();
    this.manaBar.beginFill(0x0000ff); // Blue
    const manaWidth = (currentMana / maxMana) * 180;
    const manaBarY = 58; // Match the yOffset from create
    this.manaBar.drawRect(this.panelX + 10, manaBarY, manaWidth, 18);
    this.manaBar.endFill();
    this.manaText.text = `MP: ${currentMana}/${maxMana}`;

    // Update level and experience
    this.levelText.text = `Level: ${player.level || 1}`;
    this.experienceText.text = `Experience: ${player.experience || 0}`;

    // Update position
    const x = player.position.x || 0;
    const y = player.position.y || 0;
    const z = player.position.z || 0;
    this.positionText.text = `X: ${x}, Y: ${y}, Z: ${z}`;

    // Update skills
    const skills = player.skills || {};
    Object.keys(this.skillsTexts).forEach(skillKey => {
      const skillData = skills[skillKey] || { level: 0, ticks: 0 };
      const textObj = this.skillsTexts[skillKey];
      const label = textObj.skillLabel;
      textObj.text = `${label}: ${skillData.level} (${skillData.ticks} ticks)`;
    });
  }

  update() {
    // Update bars every frame to reflect any changes
    this.updateBars();
  }

  render() {
    // Render logic for the right panel if needed
  }
}
