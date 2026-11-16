import {
  DISPLAY_OP,
  generateBoard,
  isEquationMathValid,
  isEquationStateInvalid
} from './generator.js';

export class CrossCalcGame {
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

    this.scrollHintTop = document.getElementById('scrollHintTop');
    this.scrollHintBottom = document.getElementById('scrollHintBottom');
    this.scrollHintLeft = document.getElementById('scrollHintLeft');
    this.scrollHintRight = document.getElementById('scrollHintRight');
    this.scrollHintTopText = document.getElementById('scrollHintTopText');
    this.scrollHintBottomText = document.getElementById('scrollHintBottomText');
    this.scrollHintLeftText = document.getElementById('scrollHintLeftText');
    this.scrollHintRightText = document.getElementById('scrollHintRightText');

    this.sidebarTitle = document.getElementById('sidebarTitle');
    this.sidebarSubtitle = document.getElementById('sidebarSubtitle');
    this.toggleHintsBtn = document.getElementById('toggleHintsBtn');
    this.tilePoolContainer = document.getElementById('tilePoolContainer');
    this.keypadContainer = document.getElementById('keypadContainer');
    this.sidebarFooter = document.getElementById('sidebarFooter');
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
    this.zoomInBtn.addEventListener('click', () => this.adjustZoom(0.15));
    this.zoomOutBtn.addEventListener('click', () => this.adjustZoom(-0.15));
    this.zoomResetBtn.addEventListener('click', () => this.fitBoardToViewport());

    // Scroll & Pan events for off-screen board indicators
    this.boardViewport.addEventListener('scroll', () => this.updateScrollIndicators(), {
      passive: true
    });
    this.initViewportPanning();

    // Tapping a directional indicator scrolls toward that off-screen area
    this.scrollHintTop.addEventListener('click', () => {
      this.boardViewport.scrollBy({ top: -220, behavior: 'smooth' });
    });
    this.scrollHintBottom.addEventListener('click', () => {
      this.boardViewport.scrollBy({ top: 220, behavior: 'smooth' });
    });
    this.scrollHintLeft.addEventListener('click', () => {
      this.boardViewport.scrollBy({ left: -220, behavior: 'smooth' });
    });
    this.scrollHintRight.addEventListener('click', () => {
      this.boardViewport.scrollBy({ left: 220, behavior: 'smooth' });
    });

    window.addEventListener('resize', () => {
      if (this.board) this.fitBoardToViewport();
    });

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
    this.tiles.sort((a, b) => a.value - b.value);

    if (config.allowHintsToggle) {
      this.toggleHintsBtn.classList.remove('hidden');
    } else {
      this.toggleHintsBtn.classList.add('hidden');
    }

    this.renderBoard();
    this.renderSidebar();
    this.updateEquationsStatus();

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
    const availW = Math.max(240, viewportRect.width - 72);
    const availH = Math.max(240, viewportRect.height - 72);

    const { rows, cols } = this.board;
    const gap = 5;
    const padding = 40;

    const maxCellW = Math.floor((availW - padding - (cols - 1) * gap) / cols);
    const maxCellH = Math.floor((availH - padding - (rows - 1) * gap) / rows);
    // Keep cells at least 44px so touch targets remain comfortable on tablets
    const idealCellSize = Math.max(44, Math.min(68, Math.min(maxCellW, maxCellH)));

    this.baseCellSize = idealCellSize;
    this.zoomScale = 1;
    this.applyCellSize(idealCellSize);
  }

  adjustZoom(delta) {
    if (!this.board) return;
    this.zoomScale = Math.max(0.65, Math.min(1.75, this.zoomScale + delta));
    const newCellSize = Math.round((this.baseCellSize || 52) * this.zoomScale);
    this.applyCellSize(newCellSize);
  }

  applyCellSize(cellSize) {
    document.documentElement.style.setProperty('--cell-size', `${cellSize}px`);
    document.documentElement.style.setProperty(
      '--cell-font-size',
      `${Math.max(1.0, cellSize * 0.026).toFixed(2)}rem`
    );
    requestAnimationFrame(() => this.updateScrollIndicators());
  }

  initViewportPanning() {
    let isPointerDown = false;
    let isPanning = false;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;

    this.boardViewport.addEventListener('pointerdown', e => {
      if (e.button !== undefined && e.button !== 0) return;
      isPointerDown = true;
      isPanning = false;
      startX = e.clientX;
      startY = e.clientY;
      startScrollLeft = this.boardViewport.scrollLeft;
      startScrollTop = this.boardViewport.scrollTop;
    });

    window.addEventListener('pointermove', e => {
      if (!isPointerDown) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!isPanning && Math.hypot(dx, dy) > 8) {
        isPanning = true;
        this.boardViewport.classList.add('panning');
      }
      if (isPanning) {
        this.boardViewport.scrollLeft = startScrollLeft - dx;
        this.boardViewport.scrollTop = startScrollTop - dy;
      }
    });

    const endPan = () => {
      if (!isPointerDown) return;
      if (isPanning) {
        this.wasJustPanning = true;
        setTimeout(() => {
          this.wasJustPanning = false;
        }, 60);
      }
      isPointerDown = false;
      isPanning = false;
      this.boardViewport.classList.remove('panning');
    };

    window.addEventListener('pointerup', endPan);
    window.addEventListener('pointercancel', endPan);
  }

  /**
   * Checks whether the board extends past any edge of the visible viewport
   * and shows directional indicators telling the player where to drag.
   */
  updateScrollIndicators() {
    if (!this.board || !this.boardViewport) return;

    const vp = this.boardViewport;
    const threshold = 10;

    const hasTop = vp.scrollTop > threshold;
    const hasBottom = vp.scrollHeight - vp.clientHeight - vp.scrollTop > threshold;
    const hasLeft = vp.scrollLeft > threshold;
    const hasRight = vp.scrollWidth - vp.clientWidth - vp.scrollLeft > threshold;

    // Count how many empty playable squares are currently off-screen in each direction
    const vpRect = vp.getBoundingClientRect();
    let emptyTop = 0;
    let emptyBottom = 0;
    let emptyLeft = 0;
    let emptyRight = 0;

    for (const [key, el] of this.cellElements.entries()) {
      const cell = this.board.grid.get(key);
      if (!cell || cell.type !== 'num' || cell.prefilled || cell.userValue !== null) {
        continue;
      }
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      if (centerY < vpRect.top + 6) emptyTop++;
      if (centerY > vpRect.bottom - 6) emptyBottom++;
      if (centerX < vpRect.left + 6) emptyLeft++;
      if (centerX > vpRect.right - 6) emptyRight++;
    }

    const updateHint = (btnEl, textEl, isVisible, emptyCount, dragPrompt) => {
      btnEl.classList.toggle('hidden', !isVisible);
      btnEl.classList.toggle('has-unsolved', emptyCount > 0);
      if (isVisible) {
        textEl.textContent =
          emptyCount > 0
            ? `${dragPrompt} (${emptyCount} empty)`
            : dragPrompt;
      }
    };

    updateHint(this.scrollHintTop, this.scrollHintTopText, hasTop, emptyTop, 'Drag down for more');
    updateHint(this.scrollHintBottom, this.scrollHintBottomText, hasBottom, emptyBottom, 'Drag up for more');
    updateHint(this.scrollHintLeft, this.scrollHintLeftText, hasLeft, emptyLeft, 'Drag right for more');
    updateHint(this.scrollHintRight, this.scrollHintRightText, hasRight, emptyRight, 'Drag left for more');
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

      btn.addEventListener('click', () => {
        if (tile.usedByCellKey) return;
        if (this.selectedCellKey) {
          this.placeTileInCell(tile.id, this.selectedCellKey);
        } else {
          this.selectedTileId = this.selectedTileId === tile.id ? null : tile.id;
          this.renderTilePool();
        }
      });

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
    if (this.wasJustPanning) return;
    if (this.sidebarMode === 'pool' && this.selectedTileId) {
      const tileId = this.selectedTileId;
      this.selectedTileId = null;
      this.selectCell(cellKey);
      this.placeTileInCell(tileId, cellKey);
      return;
    }

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

    if (this.isCellInInvalidEquation(cellKey)) {
      this.selectCell(cellKey);
    } else {
      this.advanceToNextEmptyCell(cellKey);
    }
  }

  placeNumberInCell(numberVal, cellKey) {
    const cell = this.board.grid.get(cellKey);
    if (!cell || cell.prefilled) return;

    if (cell.assignedTileId) {
      const oldTile = this.tiles.find(t => t.id === cell.assignedTileId);
      if (oldTile) oldTile.usedByCellKey = null;
      cell.assignedTileId = null;
    }

    cell.userValue = numberVal;

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

    if (this.isCellInInvalidEquation(cellKey)) {
      this.selectCell(cellKey);
    } else {
      this.advanceToNextEmptyCell(cellKey);
    }
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
    void el.offsetWidth;
    el.classList.add('pop-anim');
  }

  advanceToNextEmptyCell(fromCellKey) {
    const currentCell = this.board.grid.get(fromCellKey);
    if (!currentCell) return;

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

    for (const eq of this.board.equations) {
      const emptyCells = eq.numCoords
        .map(k => this.board.grid.get(k))
        .filter(c => c && !c.prefilled && c.userValue === null);
      if (emptyCells.length === 1) {
        this.selectCell(emptyCells[0].key);
        return;
      }
    }

    for (const cell of this.board.grid.values()) {
      if (cell.type === 'num' && !cell.prefilled && cell.userValue === null) {
        this.selectCell(cell.key);
        return;
      }
    }
  }

  isCellInInvalidEquation(cellKey) {
    if (!this.board || !cellKey) return false;
    const cell = this.board.grid.get(cellKey);
    if (!cell || cell.type !== 'num') return false;

    const maxInt = this.board.difficulty.maxInt;
    for (const eqId of cell.eqIds) {
      const eq = this.board.equations[eqId];
      const cA = this.board.grid.get(eq.coords[0]);
      const cB = this.board.grid.get(eq.coords[2]);
      const cC = this.board.grid.get(eq.coords[4]);

      const valA = cA.prefilled ? cA.value : cA.userValue;
      const valB = cB.prefilled ? cB.value : cB.userValue;
      const valC = cC.prefilled ? cC.value : cC.userValue;

      if (isEquationStateInvalid(valA, eq.op, valB, valC, maxInt)) {
        return true;
      }
    }
    return false;
  }

  updateEquationsStatus() {
    const { grid, equations, difficulty } = this.board;

    for (const el of this.cellElements.values()) {
      el.classList.remove('eq-correct', 'eq-wrong');
    }

    let solvedCount = 0;
    const cellStates = new Map();

    for (const eq of equations) {
      const cA = grid.get(eq.coords[0]);
      const cB = grid.get(eq.coords[2]);
      const cC = grid.get(eq.coords[4]);

      const valA = cA.prefilled ? cA.value : cA.userValue;
      const valB = cB.prefilled ? cB.value : cB.userValue;
      const valC = cC.prefilled ? cC.value : cC.userValue;

      const allFilled = valA !== null && valB !== null && valC !== null;
      const invalidState = isEquationStateInvalid(valA, eq.op, valB, valC, difficulty.maxInt);

      if (allFilled && !invalidState) {
        solvedCount++;
        for (const coord of eq.coords) {
          if (!cellStates.has(coord)) {
            cellStates.set(coord, { hasCorrect: false, hasWrong: false });
          }
          cellStates.get(coord).hasCorrect = true;
        }
      } else if (invalidState) {
        for (const coord of eq.coords) {
          const c = grid.get(coord);
          // Highlight filled or operator cells in the invalid equation
          if (allFilled || c.type === 'op' || c.prefilled || c.userValue !== null) {
            if (!cellStates.has(coord)) {
              cellStates.set(coord, { hasCorrect: false, hasWrong: false });
            }
            cellStates.get(coord).hasWrong = true;
          }
        }
      }
    }

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
    this.updateScrollIndicators();

    if (solvedCount === totalEquations && totalEquations > 0 && !this.isSolved) {
      this.handleVictory();
    }
  }

  updateEraseButtonState() {
    if (!this.selectedCellKey || !this.board) {
      this.eraseSquareBtn.disabled = true;
      if (this.sidebarFooter) this.sidebarFooter.classList.add('hidden');
      return;
    }
    const cell = this.board.grid.get(this.selectedCellKey);
    const canClear = Boolean(cell && !cell.prefilled && cell.userValue !== null);
    this.eraseSquareBtn.disabled = !canClear;
    if (this.sidebarFooter) {
      this.sidebarFooter.classList.toggle('hidden', !canClear);
    }
  }

  updateHelperBanner() {
    if (!this.board || !this.selectedCellKey) {
      this.boardHelperBanner.textContent =
        'Tap an empty square on the board, then pick a number from the sidebar!';
      return;
    }

    const cell = this.board.grid.get(this.selectedCellKey);
    if (!cell) return;

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
