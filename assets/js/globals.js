let mapSize = 65000;
let size = 32;

const BASE_FIELD = 32;
const TILE_COLS = 15;
const TILE_ROWS = 11;

// Sidebar is fixed at 200 CSS pixels; chat placeholder at the bottom.
const SIDEBAR_CSS_WIDTH = 200;
const CHAT_CSS_HEIGHT = 100;

const dpr = window.devicePixelRatio || 1;

// Canvas fills the entire physical viewport (mutable for resize)
let canvasWidth = Math.round(window.innerWidth * dpr);
let canvasHeight = Math.round(window.innerHeight * dpr);

// Fixed-size regions in canvas pixels
const sidebarWidth = Math.round(SIDEBAR_CSS_WIDTH * dpr);
const chatHeight = Math.round(CHAT_CSS_HEIGHT * dpr);

// Tile area = everything left of sidebar and above chat.
// Custom chat height in CSS pixels (set by dragging the play/chat border).
const savedChatCSS = parseInt(localStorage.getItem("sribia_chatH"), 10);
const effectiveChatH = (savedChatCSS > 20 && savedChatCSS < window.innerHeight - 100)
  ? Math.round(savedChatCSS * dpr)
  : chatHeight;
const tileAreaWidth = canvasWidth - sidebarWidth;
const tileAreaHeight = canvasHeight - effectiveChatH;

// Field scales to fill the tile area
const fieldFromWidth = tileAreaWidth / TILE_COLS;
const fieldFromHeight = tileAreaHeight / TILE_ROWS;
let field = Math.max(BASE_FIELD, Math.floor(Math.min(fieldFromWidth, fieldFromHeight)));

let scale = field / size;
// displayScale is used for in-game elements (names, debug text) that scale with field
let displayScale = field / BASE_FIELD;

// Recalculate field/scale for a new viewport size. Updates the live exports.
// customTileH: optional custom tile area height in canvas pixels (for chat resize)
function recalcField(viewportW, viewportH, customTileH) {
  const physW = Math.round(viewportW * dpr);
  const physH = Math.round(viewportH * dpr);
  const tileW = physW - sidebarWidth;
  const tileH = customTileH != null ? customTileH : (physH - chatHeight);
  const oldField = field;
  field = Math.max(BASE_FIELD, Math.floor(Math.min(tileW / TILE_COLS, tileH / TILE_ROWS)));
  scale = field / size;
  displayScale = field / BASE_FIELD;
  canvasWidth = physW;
  canvasHeight = physH;
  return oldField;
}

export {
  mapSize, field, size, scale, displayScale, dpr,
  canvasWidth, canvasHeight, sidebarWidth, chatHeight,
  recalcField,
};
