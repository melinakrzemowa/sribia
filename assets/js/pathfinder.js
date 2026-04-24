// A* pathfinding on an 8-direction tile grid.
//
// Returns an array of {x, y} tile coordinates from the tile just after `start`
// up to and including `end`, or null if no path exists within the node budget.
//
// `isBlocked(x, y)` is consulted for every tile we consider except `start`.
// The `end` tile itself must be walkable (we don't path onto blocking tiles).
//
// Diagonal cost is ~sqrt(2); heuristic is Chebyshev distance (admissible with
// diagonal movement of cost >= 1). Diagonals through two blocking orthogonal
// neighbors are disallowed (no corner cutting through walls).
export function findPath(start, end, isBlocked, opts = {}) {
  const maxNodes = opts.maxNodes || 800;

  if (start.x === end.x && start.y === end.y) return [];
  if (isBlocked(end.x, end.y)) return null;

  const key = (x, y) => x + "," + y;
  const heuristic = (x, y) =>
    Math.max(Math.abs(x - end.x), Math.abs(y - end.y));

  const nodes = new Map();
  const startKey = key(start.x, start.y);
  nodes.set(startKey, { x: start.x, y: start.y, g: 0, f: heuristic(start.x, start.y), parent: null, closed: false });
  const open = new Set([startKey]);

  let iter = 0;
  while (open.size > 0 && iter++ < maxNodes) {
    // Pick node in open set with the lowest f.
    let currentKey = null;
    let current = null;
    for (const k of open) {
      const n = nodes.get(k);
      if (!current || n.f < current.f) {
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
        // Disallow diagonal moves that would cut through two blockers.
        if (dx !== 0 && dy !== 0) {
          if (isBlocked(current.x + dx, current.y) &&
              isBlocked(current.x, current.y + dy)) continue;
        }
        const stepCost = dx !== 0 && dy !== 0 ? 1.4 : 1;
        const g = current.g + stepCost;
        if (existing && g >= existing.g) continue;
        const f = g + heuristic(nx, ny);
        if (existing) {
          existing.g = g;
          existing.f = f;
          existing.parent = current;
          open.add(nKey);
        } else {
          nodes.set(nKey, { x: nx, y: ny, g, f, parent: current, closed: false });
          open.add(nKey);
        }
      }
    }
  }
  return null;
}
