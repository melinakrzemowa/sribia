let mapSize = 65000;
let size = 32;

// Scale the tile field size so the canvas matches the physical display resolution,
// eliminating blurry upscaling of text and sprites.
const BASE_FIELD = 32;
const TILE_COLS = 15;
const TILE_ROWS = 11;
const BASE_PANEL_WIDTH = 200;

const dpr = window.devicePixelRatio || 1;
const physicalWidth = window.innerWidth * dpr;
const physicalHeight = window.innerHeight * dpr;
const fieldFromWidth = physicalWidth / (TILE_COLS + BASE_PANEL_WIDTH / BASE_FIELD);
const fieldFromHeight = physicalHeight / TILE_ROWS;
let field = Math.max(BASE_FIELD, Math.floor(Math.min(fieldFromWidth, fieldFromHeight)));

let scale = field / size;
let displayScale = field / BASE_FIELD;
let panelWidth = Math.round(BASE_PANEL_WIDTH * displayScale);

export { mapSize, field, size, scale, displayScale, panelWidth };
