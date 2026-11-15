/**
 * CrossCalc Board Generator & Math Rules
 */

export const DIFFICULTY_CONFIG = {
  easy: {
    id: 'easy',
    label: 'Easy',
    minEquations: 5,
    maxEquations: 10,
    maxInt: 10,
    ops: ['+', '-'],
    divDenominators: [],
    defaultSidebarMode: 'pool',
    allowHintsToggle: false,
    getWeight(n) {
      // 1..5 are twice as likely as 6..10
      return n >= 1 && n <= 5 ? 2 : 1;
    }
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    minEquations: 7,
    maxEquations: 14,
    maxInt: 10,
    ops: ['+', '-', '/'],
    divDenominators: [2, 5],
    defaultSidebarMode: 'pool',
    allowHintsToggle: false,
    getWeight(n) {
      // 6..10 are twice as likely as 1..5
      return n >= 6 && n <= 10 ? 2 : 1;
    }
  },
  hard: {
    id: 'hard',
    label: 'Hard',
    minEquations: 7,
    maxEquations: 14,
    maxInt: 20,
    ops: ['+', '-', '/'],
    divDenominators: [2, 5, 10],
    defaultSidebarMode: 'keypad',
    allowHintsToggle: true,
    getWeight(n) {
      // 6..10 are twice as likely as 1..5, which are twice as likely as 11..20
      if (n >= 6 && n <= 10) return 4;
      if (n >= 1 && n <= 5) return 2;
      return 1;
    }
  },
  insane: {
    id: 'insane',
    label: 'Insane',
    minEquations: 10,
    maxEquations: 20,
    maxInt: 50,
    ops: ['+', '-', '/'],
    divDenominators: null, // Any integer denominator producing whole number result
    defaultSidebarMode: 'keypad',
    allowHintsToggle: true,
    getWeight() {
      return 1;
    }
  }
};

export const DISPLAY_OP = {
  '+': '+',
  '-': '−',
  '/': '÷',
  '=': '='
};

/**
 * Generates all valid candidate equations for a difficulty config.
 * Every equation is [a, op, b, '=', c] with 1 <= a, b, c <= maxInt.
 */
export function buildCandidateEquations(config) {
  const { maxInt, ops, divDenominators, getWeight } = config;
  const byOp = { '+': [], '-': [], '/': [] };

  for (let a = 1; a <= maxInt; a++) {
    for (let b = 1; b <= maxInt; b++) {
      // Addition
      if (ops.includes('+')) {
        const c = a + b;
        if (c >= 1 && c <= maxInt) {
          const w = getWeight(a) * getWeight(b) * getWeight(c);
          byOp['+'].push({ a, op: '+', b, c, weight: w });
        }
      }
      // Subtraction
      if (ops.includes('-')) {
        const c = a - b;
        if (c >= 1 && c <= maxInt) {
          const w = getWeight(a) * getWeight(b) * getWeight(c);
          byOp['-'].push({ a, op: '-', b, c, weight: w });
        }
      }
      // Division (whole number results only)
      if (ops.includes('/')) {
        const validDenom = !divDenominators || divDenominators.includes(b);
        if (validDenom && a % b === 0) {
          const c = a / b;
          if (c >= 1 && c <= maxInt) {
            const w = getWeight(a) * getWeight(b) * getWeight(c);
            byOp['/'].push({ a, op: '/', b, c, weight: w });
          }
        }
      }
    }
  }

  // Normalize operator group weights so division appears regularly when allowed,
  // while preserving relative number weights inside each operation.
  const all = [];
  const activeOps = ops.filter(op => byOp[op] && byOp[op].length > 0);
  const opShare = {
    '+': 0.42,
    '-': 0.42,
    '/': 0.16
  };

  for (const op of activeOps) {
    const list = byOp[op];
    const totalW = list.reduce((sum, item) => sum + item.weight, 0) || 1;
    const targetShare = activeOps.length === 2 ? 0.5 : (opShare[op] || 0.33);
    for (const item of list) {
      all.push({
        ...item,
        cells: [item.a, item.op, item.b, '=', item.c],
        normWeight: (item.weight / totalW) * targetShare
      });
    }
  }

  return all;
}

/**
 * Weighted random selection from an array of items.
 */
function weightedPick(items, weightFn) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += weightFn(items[i]);
  }
  if (total <= 0) {
    return items[Math.floor(Math.random() * items.length)];
  }
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weightFn(items[i]);
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/**
 * Generates a connected CrossCalc board matching the difficulty rules.
 */
export function generateBoard(difficultyKey) {
  const config = DIFFICULTY_CONFIG[difficultyKey] || DIFFICULTY_CONFIG.easy;
  const targetEquations =
    Math.floor(Math.random() * (config.maxEquations - config.minEquations + 1)) +
    config.minEquations;

  const candidates = buildCandidateEquations(config);

  // Index candidates by position (0, 2, 4) and integer value for fast lookup
  const indexByPosVal = {
    0: new Map(),
    2: new Map(),
    4: new Map()
  };
  for (const eq of candidates) {
    for (const pos of [0, 2, 4]) {
      const val = eq.cells[pos];
      if (!indexByPosVal[pos].has(val)) {
        indexByPosVal[pos].set(val, []);
      }
      indexByPosVal[pos].get(val).push(eq);
    }
  }

  let bestAttempt = null;

  for (let attempt = 0; attempt < 40; attempt++) {
    const grid = new Map(); // "r,c" -> { r, c, type: 'num'|'op', value, eqIds: Set }
    const equations = [];

    const key = (r, c) => `${r},${c}`;
    const getCell = (r, c) => grid.get(key(r, c));

    function canPlace(eqCandidate, startR, startC, dir) {
      const dr = dir === 'V' ? 1 : 0;
      const dc = dir === 'H' ? 1 : 0;
      const pr = dir === 'H' ? 1 : 0;
      const pc = dir === 'V' ? 1 : 0;

      // Cell before start and after end along the main axis must be empty
      if (getCell(startR - dr, startC - dc)) return null;
      if (getCell(startR + 5 * dr, startC + 5 * dc)) return null;

      let intersections = 0;
      const intersectedEqIds = new Set();

      for (let i = 0; i < 5; i++) {
        const r = startR + i * dr;
        const c = startC + i * dc;
        const val = eqCandidate.cells[i];
        const existing = getCell(r, c);

        if (existing) {
          if (i !== 0 && i !== 2 && i !== 4) return null;
          if (existing.type !== 'num') return null;
          if (existing.value !== val) return null;
          for (const eqId of existing.eqIds) {
            if (equations[eqId].dir === dir) return null;
            intersectedEqIds.add(eqId);
          }
          if (existing.eqIds.size >= 2) return null;
          intersections++;
        } else {
          // Non-intersecting cell cannot have perpendicular adjacent cells
          if (getCell(r + pr, c + pc)) return null;
          if (getCell(r - pr, c - pc)) return null;
        }
      }

      if (equations.length > 0 && intersections === 0) return null;
      if (intersections > 1) return null;

      return { intersections, intersectedEqIds };
    }

    function placeEquation(eqCandidate, startR, startC, dir, parentEqId = null) {
      const eqId = equations.length;
      const dr = dir === 'V' ? 1 : 0;
      const dc = dir === 'H' ? 1 : 0;
      const coords = [];

      for (let i = 0; i < 5; i++) {
        const r = startR + i * dr;
        const c = startC + i * dc;
        const k = key(r, c);
        const val = eqCandidate.cells[i];
        const isNum = i === 0 || i === 2 || i === 4;

        let cell = grid.get(k);
        if (!cell) {
          cell = {
            r,
            c,
            key: k,
            type: isNum ? 'num' : 'op',
            value: val,
            eqIds: new Set()
          };
          grid.set(k, cell);
        }
        cell.eqIds.add(eqId);
        coords.push(k);
      }

      equations.push({
        id: eqId,
        dir,
        startR,
        startC,
        a: eqCandidate.a,
        op: eqCandidate.op,
        b: eqCandidate.b,
        c: eqCandidate.c,
        cells: eqCandidate.cells,
        coords,
        parentEqId
      });
    }

    // 1. Place the first equation at (0, 0) horizontally
    const firstEq = weightedPick(candidates, item => item.normWeight);
    placeEquation(firstEq, 0, 0, 'H', null);

    // 2. Iteratively grow the crossword up to targetEquations
    let guard = 0;
    while (equations.length < targetEquations && guard < 200) {
      guard++;

      const anchors = [];
      for (const eq of equations) {
        for (const pos of [0, 2, 4]) {
          const cellKey = eq.coords[pos];
          const cell = grid.get(cellKey);
          if (cell && cell.eqIds.size === 1) {
            anchors.push({
              eq,
              cell,
              newDir: eq.dir === 'H' ? 'V' : 'H'
            });
          }
        }
      }

      if (anchors.length === 0) break;
      anchors.sort(() => Math.random() - 0.5);

      let placed = false;
      for (const anchor of anchors) {
        const { cell, newDir, eq: parentEq } = anchor;
        const dr = newDir === 'V' ? 1 : 0;
        const dc = newDir === 'H' ? 1 : 0;

        const posOrder = [0, 2, 4].sort(() => Math.random() - 0.5);
        const possiblePlacements = [];

        for (const intersectPos of posOrder) {
          const startR = cell.r - intersectPos * dr;
          const startC = cell.c - intersectPos * dc;
          const matchingEqs = indexByPosVal[intersectPos].get(cell.value) || [];

          for (const cand of matchingEqs) {
            const check = canPlace(cand, startR, startC, newDir);
            if (check) {
              const distFromOrigin = Math.abs(startR) + Math.abs(startC);
              const compactnessBoost = 1 / (1 + distFromOrigin * 0.08);
              possiblePlacements.push({
                cand,
                startR,
                startC,
                newDir,
                parentEqId: parentEq.id,
                score: cand.normWeight * compactnessBoost
              });
            }
          }
        }

        if (possiblePlacements.length > 0) {
          const chosen = weightedPick(possiblePlacements, p => p.score);
          placeEquation(
            chosen.cand,
            chosen.startR,
            chosen.startC,
            chosen.newDir,
            chosen.parentEqId
          );
          placed = true;
          break;
        }
      }

      if (!placed) break;
    }

    if (!bestAttempt || equations.length > bestAttempt.equations.length) {
      bestAttempt = { grid, equations };
    }
    if (equations.length >= targetEquations) {
      break;
    }
  }

  const { grid, equations } = bestAttempt;

  // Normalize coordinates so minRow = 0, minCol = 0
  let minR = Infinity, maxR = -Infinity;
  let minC = Infinity, maxC = -Infinity;
  for (const cell of grid.values()) {
    if (cell.r < minR) minR = cell.r;
    if (cell.r > maxR) maxR = cell.r;
    if (cell.c < minC) minC = cell.c;
    if (cell.c > maxC) maxC = cell.c;
  }

  const normalizedGrid = new Map();
  for (const cell of grid.values()) {
    cell.r -= minR;
    cell.c -= minC;
    cell.key = `${cell.r},${cell.c}`;
    normalizedGrid.set(cell.key, cell);
  }

  for (const eq of equations) {
    eq.startR -= minR;
    eq.startC -= minC;
    const dr = eq.dir === 'V' ? 1 : 0;
    const dc = eq.dir === 'H' ? 1 : 0;
    eq.coords = [];
    for (let i = 0; i < 5; i++) {
      eq.coords.push(`${eq.startR + i * dr},${eq.startC + i * dc}`);
    }
    eq.numCoords = [eq.coords[0], eq.coords[2], eq.coords[4]];
  }

  assignPrefilledCells(normalizedGrid, equations);

  const rows = maxR - minR + 1;
  const cols = maxC - minC + 1;

  return {
    difficulty: config,
    rows,
    cols,
    grid: normalizedGrid,
    equations
  };
}

/**
 * Selects prefilled number squares so the puzzle chains logically and is 100% deducible.
 */
function assignPrefilledCells(grid, equations) {
  const adj = new Map();
  for (const eq of equations) adj.set(eq.id, []);

  for (const cell of grid.values()) {
    if (cell.type === 'num' && cell.eqIds.size > 1) {
      const ids = Array.from(cell.eqIds);
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          adj.get(ids[i]).push({ neighborId: ids[j], sharedKey: cell.key });
          adj.get(ids[j]).push({ neighborId: ids[i], sharedKey: cell.key });
        }
      }
    }
  }

  const visitedEq = new Set();
  const orderedEqs = [];
  const childSharedKeys = new Map();

  for (const eq of equations) {
    childSharedKeys.set(eq.id, new Set());
  }

  const queue = [0];
  visitedEq.add(0);

  while (queue.length > 0) {
    const currId = queue.shift();
    orderedEqs.push(equations[currId]);

    const neighbors = adj.get(currId) || [];
    for (const { neighborId, sharedKey } of neighbors) {
      if (!visitedEq.has(neighborId)) {
        visitedEq.add(neighborId);
        childSharedKeys.get(currId).add(sharedKey);
        queue.push(neighborId);
      }
    }
  }

  for (const eq of equations) {
    if (!visitedEq.has(eq.id)) orderedEqs.push(eq);
  }

  const prefilledKeys = new Set();
  const knownKeys = new Set();

  for (let idx = 0; idx < orderedEqs.length; idx++) {
    const eq = orderedEqs[idx];
    const numKeys = eq.numCoords;
    const childrenKeys = childSharedKeys.get(eq.id);

    const unknownCandidates = numKeys.filter(k => !knownKeys.has(k));

    if (unknownCandidates.length > 0) {
      unknownCandidates.sort((k1, k2) => {
        const c1 = childrenKeys.has(k1) ? 1 : 0;
        const c2 = childrenKeys.has(k2) ? 1 : 0;
        return c2 - c1 || (Math.random() - 0.5);
      });

      const deducedKey = unknownCandidates[0];

      for (const k of numKeys) {
        if (k !== deducedKey && !knownKeys.has(k)) {
          prefilledKeys.add(k);
          knownKeys.add(k);
        }
      }

      knownKeys.add(deducedKey);
    }
  }

  for (const cell of grid.values()) {
    if (cell.type === 'num') {
      cell.prefilled = prefilledKeys.has(cell.key);
      cell.userValue = null;
      cell.assignedTileId = null;
    }
  }
}

/**
 * Evaluates a single equation `a op b = c`
 */
export function isEquationMathValid(a, op, b, c) {
  if (a == null || b == null || c == null) return false;
  if (op === '+') return a + b === c;
  if (op === '-') return a - b === c;
  if (op === '/') return b !== 0 && a % b === 0 && a / b === c;
  return false;
}
