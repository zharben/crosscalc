/**
 * CrossCalc — Math Crossword Game
 * Optimized for tablets and GitHub Pages deployment.
 */

const DIFFICULTY_CONFIG = {
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

const DISPLAY_OP = {
  '+': '+',
  '-': '−',
  '/': '÷',
  '=': '='
};

/**
 * Generates all valid candidate equations for a difficulty config.
 * Every equation is [a, op, b, '=', c] with 1 <= a, b, c <= maxInt.
 */
function buildCandidateEquations(config) {
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
 * Weighted random selection from an array of items with `normWeight` or `score`.
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
function generateBoard(difficultyKey) {
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

    // Helper to check if placing `eqCandidate` starting at (startR, startC) with dir ('H'|'V') is valid
    function canPlace(eqCandidate, startR, startC, dir) {
      const dr = dir === 'V' ? 1 : 0;
      const dc = dir === 'H' ? 1 : 0;
      const pr = dir === 'H' ? 1 : 0; // perpendicular delta
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
          // Only number positions (0, 2, 4) may intersect
          if (i !== 0 && i !== 2 && i !== 4) return null;
          if (existing.type !== 'num') return null;
          if (existing.value !== val) return null;
          // Cannot overlap an equation running in the same direction
          for (const eqId of existing.eqIds) {
            if (equations[eqId].dir === dir) return null;
            intersectedEqIds.add(eqId);
          }
          // Limit cell to at most 2 equations (1 H and 1 V)
          if (existing.eqIds.size >= 2) return null;
          intersections++;
        } else {
          // Non-intersecting cell cannot have perpendicular adjacent cells
          // (prevents parallel equations from touching side-by-side)
          if (getCell(r + pr, c + pc)) return null;
          if (getCell(r - pr, c - pc)) return null;
        }
      }

      if (equations.length > 0 && intersections === 0) return null;
      // Prefer tree-like single intersections so chaining is clean and unambiguous
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

      // Collect all open anchor number cells (currently belonging to only 1 equation)
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

      // Shuffle anchors and try to find valid placements
      anchors.sort(() => Math.random() - 0.5);

      let placed = false;
      for (const anchor of anchors) {
        const { cell, newDir, eq: parentEq } = anchor;
        const dr = newDir === 'V' ? 1 : 0;
        const dc = newDir === 'H' ? 1 : 0;

        // Try intersecting at pos 0, 2, or 4 of the new equation
        const posOrder = [0, 2, 4].sort(() => Math.random() - 0.5);
        const possiblePlacements = [];

        for (const intersectPos of posOrder) {
          const startR = cell.r - intersectPos * dr;
          const startC = cell.c - intersectPos * dc;
          const matchingEqs = indexByPosVal[intersectPos].get(cell.value) || [];

          for (const cand of matchingEqs) {
            const check = canPlace(cand, startR, startC, newDir);
            if (check) {
              // Favor compact bounding box
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

  // Decide which number cells are prefilled vs blank so that:
  // 1. Every equation has at least 1 blank cell.
  // 2. Completing one equation chains into connected equations.
  // 3. The entire board is 100% solvable by pure deduction.
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
  // Build adjacency list of equations sharing number cells
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

  // Order equations using BFS starting from root (and optionally a second seed on big boards)
  const visitedEq = new Set();
  const orderedEqs = [];
  const parentEdge = new Map(); // eqId -> sharedKey from parent
  const childSharedKeys = new Map(); // eqId -> Set of sharedKeys leading to children

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
        parentEdge.set(neighborId, sharedKey);
        childSharedKeys.get(currId).add(sharedKey);
        queue.push(neighborId);
      }
    }
  }

  // Add any disconnected equations (shouldn't happen, but safe fallback)
  for (const eq of equations) {
    if (!visitedEq.has(eq.id)) orderedEqs.push(eq);
  }

  const prefilledKeys = new Set();
  const knownKeys = new Set();

  for (let idx = 0; idx < orderedEqs.length; idx++) {
    const eq = orderedEqs[idx];
    const numKeys = eq.numCoords; // [coord0, coord2, coord4]
    const childrenKeys = childSharedKeys.get(eq.id);

    // Choose which cell of `eq` will be the "target unknown" deduced by solving `eq`.
    // Prefer a child intersection cell that isn't known yet so solving `eq` chains into the child!
    const unknownCandidates = numKeys.filter(k => !knownKeys.has(k));

    if (unknownCandidates.length > 0) {
      // Sort candidates: prefer child intersection keys so completing this equation unlocks the next
      unknownCandidates.sort((k1, k2) => {
        const c1 = childrenKeys.has(k1) ? 1 : 0;
        const c2 = childrenKeys.has(k2) ? 1 : 0;
        return c2 - c1 || (Math.random() - 0.5);
      });

      const deducedKey = unknownCandidates[0];

      // All other number cells of this equation that aren't already known must be prefilled
      for (const k of numKeys) {
        if (k !== deducedKey && !knownKeys.has(k)) {
          prefilledKeys.add(k);
          knownKeys.add(k);
        }
      }

      // Now `deducedKey` becomes known via solving `eq`!
      knownKeys.add(deducedKey);
    }
  }

  // Mark cells on grid
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
function isEquationMathValid(a, op, b, c) {
  if (a == null || b == null || c == null) return false;
  if (op === '+') return a + b === c;
  if (op === '-') return a - b === c;
  if (op === '/') return b !== 0 && a % b === 0 && a / b === c;
  return false;
}

/* ==========================================================================
   Game Controller & UI State
   ========================================================================== */

class CrossCalcGame {
  constructor() {
    this.currentDifficultyKey = 'easy';
    this.selectedStartDifficulty = 'easy';
    this.board = null;
    this.sidebarMode = 'pool'; // 'pool' | 'keypad'
    this.selectedCellKey = null;
    this.selectedTileId = null;
    this.tiles = []; // { id, value, usedByCellKey }
    this.zoomScale = 1;
    this.timerSeconds = 0;
    this.timerInterval = null;
    this.isSolved = false;
    this.hasActiveGame = false;

    this.initDOM();
    this.bindEvents();
  }

  initDOM() {
    this.difficultyBadge = document.getElementById('difficultyBadge');
    this.equationsSolvedText = document.getElementById('equationsSolvedText');
    this.timerText = document.getElementById('timerText');
    this.progressBarFill = document.getElementById('progressBarFill');

    this.boardViewport = document.getElementById('boardViewport');
    this.boardGrid = document.getElementById('boardGrid');
    this.boardHelperBanner = document.getElementById('boardHelperBanner');

    this.sidebarTitle = document.getElementById('sidebarTitle');
    this.sidebarSubtitle = document.getElementById('sidebarSubtitle');
    this.toggleHintsBtn = document.getElementById('toggleHintsBtn');
    this.tilePoolContainer = document.getElementById('tilePoolContainer');
    this.keypadContainer = document.getElementById('keypadContainer');
    this.eraseSquareBtn = document.getElementById('eraseSquareBtn');

    this.zoomInBtn = document.getElementById('zoomInBtn');
    this.zoomOutBtn = document.getElementById('zoomOutBtn');
    this.zoomResetBtn = document.getElementById('zoomResetBtn');
    this.clearBoardBtn = document.getElementById('clearBoardBtn');
    this.newGameBtn = document.getElementById('newGameBtn');

    this.startModal = document.getElementById('startModal');
    this.difficultyCards = Array.from(document.querySelectorAll('.difficulty-card'));
    this.startGameBtn = document.getElementById('startGameBtn');
    this.cancelNewGameBtn = document.getElementById('cancelNewGameBtn');

    this.victoryModal = document.getElementById('victoryModal');
    this.victoryDifficulty = document.getElementById('victoryDifficulty');
    this.victoryEquations = document.getElementById('victoryEquations');
    this.victoryTime = document.getElementById('victoryTime');
    this.sameDiffLabel = document.getElementById('sameDiffLabel');
    this.playAgainSameDiffBtn = document.getElementById('playAgainSameDiffBtn');
    this.changeDiffVictoryBtn = document.getElementById('changeDiffVictoryBtn');

    this.confettiCanvas = document.getElementById('confettiCanvas');
  }

  bindEvents() {
    // Difficulty selection in Start Modal
    for (const card of this.difficultyCards) {
      card.addEventListener('click', () => {
        this.selectedStartDifficulty = card.dataset.difficulty;
        this.difficultyCards.forEach(c =>
          c.classList.toggle('selected', c.dataset.difficulty === this.selectedStartDifficulty)
        );
      });
    }

    this.startGameBtn.addEventListener('click', () => {
      this.startModal.classList.add('hidden');
      this.startNewGame(this.selectedStartDifficulty);
    });

    this.cancelNewGameBtn.addEventListener('click', () => {
      this.startModal.classList.add('hidden');
    });

    this.newGameBtn.addEventListener('click', () => {
      this.openStartModal();
    });

    this.clearBoardBtn.addEventListener('click', () => {
      this.resetPlayerNumbers();
    });

    // Hints toggle button (switches between keypad and tile pool on Hard/Insane)
    this.toggleHintsBtn.addEventListener('click', () => {
      this.sidebarMode = this.sidebarMode === 'keypad' ? 'pool' : 'keypad';
      this.renderSidebar();
    });

    this.eraseSquareBtn.addEventListener('click', () => {
      if (this.selectedCellKey) {
        this.clearCell(this.selectedCellKey);
      }
    });

    // Zoom controls
    this.zoomInBtn.addEventListener('click', () => this.adjustZoom(0.12));
    this.zoomOutBtn.addEventListener('click', () => this.adjustZoom(-0.12));
    this.zoomResetBtn.addEventListener('click', () => this.fitBoardToViewport());

    window.addEventListener('resize', () => {
      if (this.board) this.fitBoardToViewport();
    });

    // Keyboard support for tablets with keyboards / desktop testing
    window.addEventListener('keydown', e => this.handleKeyDown(e));

    // Victory buttons
    this.playAgainSameDiffBtn.addEventListener('click', () => {
      this.victoryModal.classList.add('hidden');
      this.stopConfetti();
      this.startNewGame(this.currentDifficultyKey);
    });

    this.changeDiffVictoryBtn.addEventListener('click', () => {
      this.victoryModal.classList.add('hidden');
      this.stopConfetti();
      this.openStartModal();
    });
  }

  openStartModal() {
    this.selectedStartDifficulty = this.currentDifficultyKey;
    this.difficultyCards.forEach(c =>
      c.classList.toggle('selected', c.dataset.difficulty === this.selectedStartDifficulty)
    );
    if (this.hasActiveGame && !this.isSolved) {
      this.cancelNewGameBtn.classList.remove('hidden');
    } else {
      this.cancelNewGameBtn.classList.add('hidden');
    }
    this.startModal.classList.remove('hidden');
  }

  startNewGame(difficultyKey) {
    this.currentDifficultyKey = difficultyKey;
    this.board = generateBoard(difficultyKey);
    this.isSolved = false;
    this.hasActiveGame = true;
    this.selectedCellKey = null;
    this.selectedTileId = null;

    const config = this.board.difficulty;
    this.sidebarMode = config.defaultSidebarMode;

    // Header badge
    this.difficultyBadge.textContent = config.label;
    this.difficultyBadge.className = `difficulty-badge ${config.id}`;

    // Build tile pool from all non-prefilled number cells
    this.tiles = [];
    for (const cell of this.board.grid.values()) {
      if (cell.type === 'num' && !cell.prefilled) {
        this.tiles.push({
          id: `tile-${this.tiles.length}`,
          value: cell.value,
          usedByCellKey: null
        });
      }
    }
    // Sort tiles ascending so kids can easily scan numbers in the pool
    this.tiles.sort((a, b) => a.value - b.value);

    // Hints button visibility (only on Hard and Insane)
    if (config.allowHintsToggle) {
      this.toggleHintsBtn.classList.remove('hidden');
    } else {
      this.toggleHintsBtn.classList.add('hidden');
    }

    this.renderBoard();
    this.renderSidebar();
    this.updateEquationsStatus();

    // Select first blank square automatically for convenience
    const firstPlayable = Array.from(this.board.grid.values()).find(
      c => c.type === 'num' && !c.prefilled
    );
    if (firstPlayable) {
      this.selectCell(firstPlayable.key);
    }

    requestAnimationFrame(() => this.fitBoardToViewport());
    this.startTimer();
  }

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerSeconds = 0;
    this.updateTimerDisplay();
    this.timerInterval = setInterval(() => {
      if (!this.isSolved) {
        this.timerSeconds++;
        this.updateTimerDisplay();
      }
    }, 1000);
  }

  updateTimerDisplay() {
    const mins = Math.floor(this.timerSeconds / 60);
    const secs = this.timerSeconds % 60;
    this.timerText.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  fitBoardToViewport() {
    if (!this.board) return;
    const viewportRect = this.boardViewport.getBoundingClientRect();
    const availW = Math.max(240, viewportRect.width - 48);
    const availH = Math.max(240, viewportRect.height - 48);

    const { rows, cols } = this.board;
    const gap = 5;
    const padding = 40;

    const maxCellW = Math.floor((availW - padding - (cols - 1) * gap) / cols);
    const maxCellH = Math.floor((availH - padding - (rows - 1) * gap) / rows);
    const idealCellSize = Math.max(36, Math.min(68, Math.min(maxCellW, maxCellH)));

    document.documentElement.style.setProperty('--cell-size', `${idealCellSize}px`);
    document.documentElement.style.setProperty(
      '--cell-font-size',
      `${Math.max(1.0, idealCellSize * 0.026).toFixed(2)}rem`
    );

    this.zoomScale = 1;
    this.boardGrid.style.transform = `scale(1)`;
  }

  adjustZoom(delta) {
    this.zoomScale = Math.max(0.6, Math.min(1.6, this.zoomScale + delta));
    this.boardGrid.style.transform = `scale(${this.zoomScale})`;
  }

  renderBoard() {
    const { rows, cols, grid } = this.board;
    this.boardGrid.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
    this.boardGrid.style.gridTemplateRows = `repeat(${rows}, var(--cell-size))`;
    this.boardGrid.innerHTML = '';

    this.cellElements = new Map();

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const key = `${r},${c}`;
        const cellData = grid.get(key);
        const div = document.createElement('div');

        if (!cellData) {
          div.className = 'cell empty-space';
        } else if (cellData.type === 'op') {
          div.className = 'cell operator';
          div.textContent = DISPLAY_OP[cellData.value] || cellData.value;
          this.cellElements.set(key, div);
        } else if (cellData.prefilled) {
          div.className = 'cell prefilled';
          if (cellData.eqIds.size > 1) div.classList.add('intersection');
          div.textContent = cellData.value;
          this.cellElements.set(key, div);
        } else {
          div.className = 'cell playable';
          if (cellData.eqIds.size > 1) div.classList.add('intersection');
          div.dataset.key = key;
          if (cellData.userValue !== null) {
            div.textContent = cellData.userValue;
            div.classList.add('filled');
          }

          div.addEventListener('click', () => this.onPlayableCellClick(key));
          this.cellElements.set(key, div);
        }

        this.boardGrid.appendChild(div);
      }
    }
  }

  renderSidebar() {
    const config = this.board.difficulty;

    if (this.sidebarMode === 'pool') {
      this.sidebarTitle.textContent = 'Number Tiles';
      this.sidebarSubtitle.textContent = 'Tap or drag a tile into a square on the board';
      this.tilePoolContainer.classList.remove('hidden');
      this.keypadContainer.classList.add('hidden');
      if (config.allowHintsToggle) {
        this.toggleHintsBtn.textContent = '🔢 Use Keypad';
        this.toggleHintsBtn.classList.add('active');
      }
      this.renderTilePool();
    } else {
      this.sidebarTitle.textContent = 'Number Keypad';
      this.sidebarSubtitle.textContent = `Tap a number (1–${config.maxInt}) for the selected square`;
      this.tilePoolContainer.classList.add('hidden');
      this.keypadContainer.classList.remove('hidden');
      if (config.allowHintsToggle) {
        this.toggleHintsBtn.textContent = '💡 Hints: Show Tile Pool';
        this.toggleHintsBtn.classList.remove('active');
      }
      this.renderKeypad();
    }

    this.updateEraseButtonState();
  }

  renderTilePool() {
    this.tilePoolContainer.innerHTML = '';

    for (const tile of this.tiles) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tile-btn';
      if (tile.usedByCellKey) btn.classList.add('used');
      if (this.selectedTileId === tile.id && !tile.usedByCellKey) {
        btn.classList.add('selected-tile');
      }
      btn.textContent = tile.value;
      btn.dataset.tileId = tile.id;

      // Tap to place into currently selected cell, or select tile first
      btn.addEventListener('click', () => {
        if (tile.usedByCellKey) return;
        if (this.selectedCellKey) {
          this.placeTileInCell(tile.id, this.selectedCellKey);
        } else {
          this.selectedTileId = this.selectedTileId === tile.id ? null : tile.id;
          this.renderTilePool();
        }
      });

      // Pointer drag-and-drop support for tablets
      this.attachTileDragEvents(btn, tile);

      this.tilePoolContainer.appendChild(btn);
    }
  }

  renderKeypad() {
    const maxInt = this.board.difficulty.maxInt;
    this.keypadContainer.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = `keypad-grid ${maxInt > 20 ? 'large-range' : ''}`;

    for (let n = 1; n <= maxInt; n++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'keypad-btn';
      btn.textContent = n;
      btn.addEventListener('click', () => {
        if (this.selectedCellKey) {
          this.placeNumberInCell(n, this.selectedCellKey);
        } else {
          this.boardHelperBanner.textContent = 'Tap an empty square on the board first!';
        }
      });
      grid.appendChild(btn);
    }

    this.keypadContainer.appendChild(grid);
  }

  attachTileDragEvents(btn, tile) {
    let ghost = null;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let hoveredCellEl = null;

    const onPointerMove = e => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!isDragging && Math.hypot(dx, dy) > 8) {
        isDragging = true;
        ghost = document.createElement('div');
        ghost.className = 'drag-ghost';
        ghost.textContent = tile.value;
        document.body.appendChild(ghost);
      }
      if (isDragging && ghost) {
        ghost.style.left = `${e.clientX}px`;
        ghost.style.top = `${e.clientY}px`;

        const targetEl = document.elementFromPoint(e.clientX, e.clientY);
        const playableCell = targetEl ? targetEl.closest('.cell.playable') : null;
        if (hoveredCellEl && hoveredCellEl !== playableCell) {
          hoveredCellEl.classList.remove('drag-over');
        }
        if (playableCell) {
          playableCell.classList.add('drag-over');
          hoveredCellEl = playableCell;
        } else {
          hoveredCellEl = null;
        }
      }
    };

    const onPointerUp = e => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      if (hoveredCellEl) {
        hoveredCellEl.classList.remove('drag-over');
      }
      if (ghost) {
        ghost.remove();
        ghost = null;
      }

      if (isDragging) {
        const targetEl = document.elementFromPoint(e.clientX, e.clientY);
        const playableCell = targetEl ? targetEl.closest('.cell.playable') : null;
        if (playableCell && playableCell.dataset.key) {
          this.selectCell(playableCell.dataset.key);
          this.placeTileInCell(tile.id, playableCell.dataset.key);
        }
        isDragging = false;
      }
    };

    btn.addEventListener('pointerdown', e => {
      if (tile.usedByCellKey) return;
      startX = e.clientX;
      startY = e.clientY;
      isDragging = false;
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    });
  }

  onPlayableCellClick(cellKey) {
    // If a tile was already selected in pool mode, place it immediately
    if (this.sidebarMode === 'pool' && this.selectedTileId) {
      const tileId = this.selectedTileId;
      this.selectedTileId = null;
      this.selectCell(cellKey);
      this.placeTileInCell(tileId, cellKey);
      return;
    }

    // If tapping the already-selected filled cell, clear it on second tap for quick tablet editing
    const cell = this.board.grid.get(cellKey);
    if (this.selectedCellKey === cellKey && cell && cell.userValue !== null) {
      this.clearCell(cellKey);
      return;
    }

    this.selectCell(cellKey);
  }

  selectCell(cellKey) {
    this.selectedCellKey = cellKey;
    const selectedCell = this.board.grid.get(cellKey);

    // Highlight selected cell and the equation(s) it belongs to
    const activeEqIds = selectedCell ? selectedCell.eqIds : new Set();

    for (const [k, el] of this.cellElements.entries()) {
      const cData = this.board.grid.get(k);
      el.classList.toggle('selected', k === cellKey);

      let inActiveEq = false;
      if (cData) {
        for (const id of cData.eqIds) {
          if (activeEqIds.has(id)) {
            inActiveEq = true;
            break;
          }
        }
      }
      el.classList.toggle('in-active-equation', inActiveEq);
    }

    this.updateEraseButtonState();
    this.updateHelperBanner();
  }

  placeTileInCell(tileId, cellKey) {
    const cell = this.board.grid.get(cellKey);
    const tile = this.tiles.find(t => t.id === tileId);
    if (!cell || cell.prefilled || !tile || tile.usedByCellKey) return;

    // Free previous tile on this cell if any
    if (cell.assignedTileId) {
      const oldTile = this.tiles.find(t => t.id === cell.assignedTileId);
      if (oldTile) oldTile.usedByCellKey = null;
    }

    cell.userValue = tile.value;
    cell.assignedTileId = tile.id;
    tile.usedByCellKey = cellKey;

    this.animateAndRenderCell(cellKey);
    this.renderSidebar();
    this.updateEquationsStatus();
    this.advanceToNextEmptyCell(cellKey);
  }

  placeNumberInCell(numberVal, cellKey) {
    const cell = this.board.grid.get(cellKey);
    if (!cell || cell.prefilled) return;

    // Free previous tile if any
    if (cell.assignedTileId) {
      const oldTile = this.tiles.find(t => t.id === cell.assignedTileId);
      if (oldTile) oldTile.usedByCellKey = null;
      cell.assignedTileId = null;
    }

    cell.userValue = numberVal;

    // Sync with an available matching tile in the pool so switching to Hints/Pool stays accurate
    const matchingTile = this.tiles.find(
      t => !t.usedByCellKey && t.value === numberVal
    );
    if (matchingTile) {
      matchingTile.usedByCellKey = cellKey;
      cell.assignedTileId = matchingTile.id;
    }

    this.animateAndRenderCell(cellKey);
    this.renderSidebar();
    this.updateEquationsStatus();
    this.advanceToNextEmptyCell(cellKey);
  }

  clearCell(cellKey) {
    const cell = this.board.grid.get(cellKey);
    if (!cell || cell.prefilled) return;

    if (cell.assignedTileId) {
      const oldTile = this.tiles.find(t => t.id === cell.assignedTileId);
      if (oldTile) oldTile.usedByCellKey = null;
      cell.assignedTileId = null;
    }
    cell.userValue = null;

    const el = this.cellElements.get(cellKey);
    if (el) {
      el.textContent = '';
      el.classList.remove('filled', 'pop-anim');
    }

    this.renderSidebar();
    this.updateEquationsStatus();
    this.updateEraseButtonState();
    this.updateHelperBanner();
  }

  resetPlayerNumbers() {
    if (!this.board) return;
    for (const cell of this.board.grid.values()) {
      if (cell.type === 'num' && !cell.prefilled) {
        cell.userValue = null;
        cell.assignedTileId = null;
      }
    }
    for (const tile of this.tiles) {
      tile.usedByCellKey = null;
    }
    this.renderBoard();
    this.renderSidebar();
    this.updateEquationsStatus();

    const firstPlayable = Array.from(this.board.grid.values()).find(
      c => c.type === 'num' && !c.prefilled
    );
    if (firstPlayable) this.selectCell(firstPlayable.key);
  }

  animateAndRenderCell(cellKey) {
    const cell = this.board.grid.get(cellKey);
    const el = this.cellElements.get(cellKey);
    if (!cell || !el) return;

    el.textContent = cell.userValue !== null ? cell.userValue : '';
    el.classList.toggle('filled', cell.userValue !== null);
    el.classList.remove('pop-anim');
    void el.offsetWidth; // trigger reflow
    el.classList.add('pop-anim');
  }

  advanceToNextEmptyCell(fromCellKey) {
    const currentCell = this.board.grid.get(fromCellKey);
    if (!currentCell) return;

    // First look for another empty cell in the same equation(s)
    for (const eqId of currentCell.eqIds) {
      const eq = this.board.equations[eqId];
      for (const k of eq.numCoords) {
        const c = this.board.grid.get(k);
        if (c && !c.prefilled && c.userValue === null) {
          this.selectCell(k);
          return;
        }
      }
    }

    // Otherwise find any equation that currently has 2 filled numbers and 1 empty number (ready to chain!)
    for (const eq of this.board.equations) {
      const emptyCells = eq.numCoords
        .map(k => this.board.grid.get(k))
        .filter(c => c && !c.prefilled && c.userValue === null);
      if (emptyCells.length === 1) {
        this.selectCell(emptyCells[0].key);
        return;
      }
    }

    // Otherwise any remaining empty playable cell
    for (const cell of this.board.grid.values()) {
      if (cell.type === 'num' && !cell.prefilled && cell.userValue === null) {
        this.selectCell(cell.key);
        return;
      }
    }
  }

  /**
   * Immediately evaluates all equations and highlights completed ones as correct or wrong.
   */
  updateEquationsStatus() {
    const { grid, equations } = this.board;

    // Reset equation validation classes on all cells
    for (const el of this.cellElements.values()) {
      el.classList.remove('eq-correct', 'eq-wrong');
    }

    let solvedCount = 0;
    const cellStates = new Map(); // key -> { hasCorrect: bool, hasWrong: bool }

    for (const eq of equations) {
      const cA = grid.get(eq.coords[0]);
      const cB = grid.get(eq.coords[2]);
      const cC = grid.get(eq.coords[4]);

      const valA = cA.prefilled ? cA.value : cA.userValue;
      const valB = cB.prefilled ? cB.value : cB.userValue;
      const valC = cC.prefilled ? cC.value : cC.userValue;

      if (valA !== null && valB !== null && valC !== null) {
        const valid = isEquationMathValid(valA, eq.op, valB, valC);
        if (valid) solvedCount++;

        for (const coord of eq.coords) {
          if (!cellStates.has(coord)) {
            cellStates.set(coord, { hasCorrect: false, hasWrong: false });
          }
          const st = cellStates.get(coord);
          if (valid) st.hasCorrect = true;
          else st.hasWrong = true;
        }
      }
    }

    // Apply classes (if an intersection cell belongs to a wrong equation, show wrong so player notices)
    for (const [coord, st] of cellStates.entries()) {
      const el = this.cellElements.get(coord);
      if (!el) continue;
      if (st.hasWrong) {
        el.classList.add('eq-wrong');
      } else if (st.hasCorrect) {
        el.classList.add('eq-correct');
      }
    }

    const totalEquations = equations.length;
    this.equationsSolvedText.textContent = `${solvedCount} / ${totalEquations} Equations`;
    const pct = totalEquations > 0 ? Math.round((solvedCount / totalEquations) * 100) : 0;
    this.progressBarFill.style.width = `${pct}%`;

    this.updateEraseButtonState();
    this.updateHelperBanner();

    if (solvedCount === totalEquations && totalEquations > 0 && !this.isSolved) {
      this.handleVictory();
    }
  }

  updateEraseButtonState() {
    if (!this.selectedCellKey || !this.board) {
      this.eraseSquareBtn.disabled = true;
      return;
    }
    const cell = this.board.grid.get(this.selectedCellKey);
    this.eraseSquareBtn.disabled = !cell || cell.prefilled || cell.userValue === null;
  }

  updateHelperBanner() {
    if (!this.board || !this.selectedCellKey) {
      this.boardHelperBanner.textContent =
        'Tap an empty square on the board, then pick a number from the sidebar!';
      return;
    }

    const cell = this.board.grid.get(this.selectedCellKey);
    if (!cell) return;

    // Show the active equation(s) for the selected square
    const previews = [];
    for (const eqId of cell.eqIds) {
      const eq = this.board.equations[eqId];
      const parts = eq.coords.map((coord, idx) => {
        const c = this.board.grid.get(coord);
        if (idx === 1 || idx === 3) return DISPLAY_OP[c.value] || c.value;
        const v = c.prefilled ? c.value : c.userValue;
        if (coord === this.selectedCellKey) return v !== null ? `[${v}]` : '[ ? ]';
        return v !== null ? v : '?';
      });
      previews.push(parts.join(' '));
    }

    this.boardHelperBanner.textContent = `Active Equation:  ${previews.join('   •   ')}`;
  }

  handleKeyDown(e) {
    if (!this.board || this.isSolved) return;
    if (!this.startModal.classList.contains('hidden')) return;

    if (e.key === 'Backspace' || e.key === 'Delete') {
      if (this.selectedCellKey) {
        this.clearCell(this.selectedCellKey);
      }
    }
  }

  handleVictory() {
    this.isSolved = true;
    if (this.timerInterval) clearInterval(this.timerInterval);

    const config = this.board.difficulty;
    this.victoryDifficulty.textContent = config.label;
    this.victoryEquations.textContent = this.board.equations.length;
    this.victoryTime.textContent = this.timerText.textContent;
    this.sameDiffLabel.textContent = config.label;

    this.launchConfetti();
    setTimeout(() => {
      this.victoryModal.classList.remove('hidden');
    }, 450);
  }

  launchConfetti() {
    const canvas = this.confettiCanvas;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#4f46e5', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#a855f7'];
    const particles = Array.from({ length: 90 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      w: 8 + Math.random() * 8,
      h: 6 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      vy: 2.5 + Math.random() * 4,
      vx: (Math.random() - 0.5) * 3,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.15
    }));

    this.confettiActive = true;
    const render = () => {
      if (!this.confettiActive) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.spin;
        if (p.y > canvas.height) {
          p.y = -10;
          p.x = Math.random() * canvas.width;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }

  stopConfetti() {
    this.confettiActive = false;
  }
}

// Initialize in browser environment
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    window.crossCalcGame = new CrossCalcGame();
  });
}

// Export for automated verification tests if run under Node
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DIFFICULTY_CONFIG,
    generateBoard,
    isEquationMathValid
  };
}
