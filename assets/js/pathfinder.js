// A* pathfinding on an 8-direction tile grid.
//
// Returns an array of {x, y} tile coordinates from the tile just after `start`
// up to and including `end`, or null if no path exists within the node budget.
//
// `isBlocked(x, y)` is consulted for every tile we consider except `start`.
// The `end` tile itself must be walkable (we don't path onto blocking tiles).
//
// Diagonal moves cost 2 (matching the server-side double cooldown for
// diagonals) while cardinal moves cost 1. When a cardinal and diagonal
// route have the same total cost, ties are broken by preferring the
// route with fewer *tiles* (so a single diagonal wins over two cardinals
// covering the same delta). Manhattan distance is admissible here.
// Corner cutting through two orthogonal blockers is disallowed.
export function findPath(start, end, isBlocked, opts = {}) {
  const maxNodes = opts.maxNodes || 800;

  if (start.x === end.x && start.y === end.y) return [];
  if (isBlocked(end.x, end.y)) return null;

  const key = (x, y) => x + "," + y;
  const heuristic = (x, y) =>
    Math.abs(x - end.x) + Math.abs(y - end.y);

  // Each node additionally tracks `steps` (tile count from start) so we can
  // tie-break equal-cost paths by preferring fewer tiles.
  const nodes = new Map();
  const startKey = key(start.x, start.y);
  nodes.set(startKey, { x: start.x, y: start.y, g: 0, steps: 0, f: heuristic(start.x, start.y), parent: null, closed: false });
  const open = new Set([startKey]);

  let iter = 0;
  while (open.size > 0 && iter++ < maxNodes) {
    // Pick node with the lowest f; on ties, fewer steps (tiles) wins so
    // diagonal shortcuts beat equivalent cardinal sequences.
    let currentKey = null;
    let current = null;
    for (const k of open) {
      const n = nodes.get(k);
      if (!current ||
          n.f < current.f ||
          (n.f === current.f && n.steps < current.steps)) {
        current = n;
        currentKey = k;
      }
    }

    if (current.x === end.x && current.y === end.y) {
      const path = [];
      let node = current;
      while (node.parent) {
        path.unshift({ x: node.x, y: node.y });
        node = node.parent;
      }
      return path;
    }

    open.delete(currentKey);
    current.closed = true;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = current.x + dx;
        const ny = current.y + dy;
        const nKey = key(nx, ny);
        const existing = nodes.get(nKey);
        if (existing && existing.closed) continue;
        const atEnd = nx === end.x && ny === end.y;
        if (!atEnd && isBlocked(nx, ny)) continue;
        // No corner cutting through two blockers.
        if (dx !== 0 && dy !== 0) {
          if (isBlocked(current.x + dx, current.y) &&
              isBlocked(current.x, current.y + dy)) continue;
        }
        const stepCost = dx !== 0 && dy !== 0 ? 2 : 1;
        const g = current.g + stepCost;
        const steps = current.steps + 1;
        // Replace an existing node only if we got here more cheaply, or at
        // equal cost via fewer tiles.
        if (existing && (g > existing.g || (g === existing.g && steps >= existing.steps))) continue;
        const f = g + heuristic(nx, ny);
        if (existing) {
          existing.g = g;
          existing.steps = steps;
          existing.f = f;
          existing.parent = current;
          open.add(nKey);
        } else {
          nodes.set(nKey, { x: nx, y: ny, g, steps, f, parent: current, closed: false });
          open.add(nKey);
        }
      }
    }
  }
  return null;
}
