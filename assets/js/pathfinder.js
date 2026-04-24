// A* pathfinding on a 4-direction tile grid (N/S/E/W only, no diagonals).
//
// Returns an array of {x, y} tile coordinates from the tile just after `start`
// up to and including `end`, or null if no path exists within the node budget.
//
// `isBlocked(x, y)` is consulted for every tile we consider except `start`.
// The `end` tile itself must be walkable (we don't path onto blocking tiles).
//
// Uses Manhattan distance as the heuristic (admissible for 4-directional
// movement with unit step cost).
export function findPath(start, end, isBlocked, opts = {}) {
  const maxNodes = opts.maxNodes || 800;

  if (start.x === end.x && start.y === end.y) return [];
  if (isBlocked(end.x, end.y)) return null;

  const key = (x, y) => x + "," + y;
  const heuristic = (x, y) =>
    Math.abs(x - end.x) + Math.abs(y - end.y);

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

    const deltas = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (const [dx, dy] of deltas) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const nKey = key(nx, ny);
      const existing = nodes.get(nKey);
      if (existing && existing.closed) continue;
      const atEnd = nx === end.x && ny === end.y;
      if (!atEnd && isBlocked(nx, ny)) continue;
      const g = current.g + 1;
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
  return null;
}
