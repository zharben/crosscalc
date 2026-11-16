import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DIFFICULTY_CONFIG,
  DISPLAY_OP,
  buildCandidateEquations,
  generateBoard,
  isEquationMathValid,
  isEquationStateInvalid
} from '../src/generator.js';

describe('isEquationMathValid', () => {
  it('validates addition correctly', () => {
    assert.equal(isEquationMathValid(3, '+', 4, 7), true);
    assert.equal(isEquationMathValid(3, '+', 4, 8), false);
  });

  it('validates subtraction correctly', () => {
    assert.equal(isEquationMathValid(9, '-', 4, 5), true);
    assert.equal(isEquationMathValid(4, '-', 9, -5), true);
    assert.equal(isEquationMathValid(9, '-', 4, 6), false);
  });

  it('validates multiplication ("x" and "*") correctly', () => {
    assert.equal(isEquationMathValid(3, 'x', 5, 15), true);
    assert.equal(isEquationMathValid(4, '*', 5, 20), true);
    assert.equal(isEquationMathValid(3, 'x', 5, 14), false);
  });

  it('validates whole-number division ("/") and rejects remainders or zero divisor', () => {
    assert.equal(isEquationMathValid(10, '/', 2, 5), true);
    assert.equal(isEquationMathValid(10, '/', 5, 2), true);
    assert.equal(isEquationMathValid(7, '/', 2, 3), false);
    assert.equal(isEquationMathValid(7, '/', 2, 3.5), false);
    assert.equal(isEquationMathValid(10, '/', 0, 0), false);
  });

  it('returns false when any number is null or undefined', () => {
    assert.equal(isEquationMathValid(null, '+', 2, 3), false);
    assert.equal(isEquationMathValid(1, '+', null, 3), false);
    assert.equal(isEquationMathValid(1, '+', 2, null), false);
    assert.equal(isEquationMathValid(undefined, 'x', 2, 2), false);
  });
});

describe('isEquationStateInvalid', () => {
  it('detects invalid completed 3-number equations', () => {
    assert.equal(isEquationStateInvalid(3, '+', 4, 8, 10), true);
    assert.equal(isEquationStateInvalid(3, '+', 4, 7, 10), false);
    assert.equal(isEquationStateInvalid(8, '/', 2, 3, 10), true);
    assert.equal(isEquationStateInvalid(8, '/', 2, 4, 10), false);
  });

  it('detects impossible 2-number partial equations', () => {
    // 4 - 7 = ? has no positive integer solution
    assert.equal(isEquationStateInvalid(4, '-', 7, null, 10), true);
    // 8 + 5 = ? exceeds maxInt=10
    assert.equal(isEquationStateInvalid(8, '+', 5, null, 10), true);
    // 7 / 2 = ? is not a whole number
    assert.equal(isEquationStateInvalid(7, '/', 2, null, 10), true);
    // 6 + 2 = ? is valid (8 <= 10)
    assert.equal(isEquationStateInvalid(6, '+', 2, null, 10), false);
  });

  it('returns false when 0 or 1 numbers are filled', () => {
    assert.equal(isEquationStateInvalid(5, '+', null, null, 10), false);
    assert.equal(isEquationStateInvalid(null, '-', null, null, 10), false);
  });
});

describe('DIFFICULTY_CONFIG & buildCandidateEquations', () => {
  it('configures Easy rules accurately', () => {
    const cfg = DIFFICULTY_CONFIG.easy;
    assert.equal(cfg.minEquations, 5);
    assert.equal(cfg.maxEquations, 10);
    assert.equal(cfg.maxInt, 10);
    assert.deepEqual(cfg.ops, ['+', '-']);
    assert.equal(cfg.defaultSidebarMode, 'pool');
    assert.equal(cfg.allowHintsToggle, false);

    // 1..5 are twice as likely as 6..10
    for (let n = 1; n <= 5; n++) {
      assert.equal(cfg.getWeight(n), 2);
    }
    for (let n = 6; n <= 10; n++) {
      assert.equal(cfg.getWeight(n), 1);
    }
    assert.equal(cfg.getWeight(1), 2 * cfg.getWeight(6));
  });

  it('configures Medium rules accurately', () => {
    const cfg = DIFFICULTY_CONFIG.medium;
    assert.equal(cfg.minEquations, 7);
    assert.equal(cfg.maxEquations, 14);
    assert.equal(cfg.maxInt, 10);
    assert.deepEqual(cfg.ops, ['+', '-', 'x', '/']);
    assert.deepEqual(cfg.divDenominators, [2, 5]);
    assert.equal(cfg.defaultSidebarMode, 'pool');
    assert.equal(cfg.allowHintsToggle, false);

    // 6..10 are twice as likely as 1..5
    for (let n = 1; n <= 5; n++) {
      assert.equal(cfg.getWeight(n), 1);
    }
    for (let n = 6; n <= 10; n++) {
      assert.equal(cfg.getWeight(n), 2);
    }
    assert.equal(cfg.getWeight(6), 2 * cfg.getWeight(1));
  });

  it('configures Hard rules accurately', () => {
    const cfg = DIFFICULTY_CONFIG.hard;
    assert.equal(cfg.minEquations, 7);
    assert.equal(cfg.maxEquations, 14);
    assert.equal(cfg.maxInt, 20);
    assert.deepEqual(cfg.ops, ['+', '-', 'x', '/']);
    assert.deepEqual(cfg.divDenominators, [2, 5, 10]);
    assert.equal(cfg.defaultSidebarMode, 'keypad');
    assert.equal(cfg.allowHintsToggle, true);

    // 6..10 are 2x as likely as 1..5, which are 2x as likely as 11..20
    for (let n = 1; n <= 5; n++) assert.equal(cfg.getWeight(n), 2);
    for (let n = 6; n <= 10; n++) assert.equal(cfg.getWeight(n), 4);
    for (let n = 11; n <= 20; n++) assert.equal(cfg.getWeight(n), 1);
    assert.equal(cfg.getWeight(6), 2 * cfg.getWeight(1));
    assert.equal(cfg.getWeight(1), 2 * cfg.getWeight(11));
  });

  it('configures Insane rules accurately', () => {
    const cfg = DIFFICULTY_CONFIG.insane;
    assert.equal(cfg.minEquations, 10);
    assert.equal(cfg.maxEquations, 20);
    assert.equal(cfg.maxInt, 50);
    assert.deepEqual(cfg.ops, ['+', '-', 'x', '/']);
    assert.equal(cfg.divDenominators, null);
    assert.equal(cfg.defaultSidebarMode, 'keypad');
    assert.equal(cfg.allowHintsToggle, true);

    for (let n = 1; n <= 50; n++) {
      assert.equal(cfg.getWeight(n), 1);
    }
  });

  it('builds valid candidate equations for every difficulty', () => {
    for (const [diffKey, cfg] of Object.entries(DIFFICULTY_CONFIG)) {
      const candidates = buildCandidateEquations(cfg);
      assert.ok(candidates.length > 0, `Expected candidates for ${diffKey}`);

      const seenOps = new Set();
      for (const eq of candidates) {
        seenOps.add(eq.op);
        assert.ok(cfg.ops.includes(eq.op), `Unexpected op ${eq.op} in ${diffKey}`);

        // Zero is never used and all 3 integers are within [1, maxInt]
        for (const num of [eq.a, eq.b, eq.c]) {
          assert.equal(Number.isInteger(num), true);
          assert.ok(num >= 1 && num <= cfg.maxInt, `Number ${num} out of bounds for ${diffKey}`);
        }

        // Division denominator restrictions and never resulting in 1
        if (eq.op === '/') {
          assert.notEqual(eq.c, 1, `Division result should not be 1 in ${diffKey}`);
          assert.notEqual(eq.b, 1, `Division denominator should not be 1 in ${diffKey}`);
          if (cfg.divDenominators) {
            assert.ok(
              cfg.divDenominators.includes(eq.b),
              `Invalid division denominator ${eq.b} in ${diffKey}`
            );
          }
        }

        // Equation math must be valid
        assert.equal(isEquationMathValid(eq.a, eq.op, eq.b, eq.c), true);
        assert.deepEqual(eq.cells, [eq.a, eq.op, eq.b, '=', eq.c]);
      }

      // Every allowed operator for the difficulty should appear in the candidate pool
      for (const allowedOp of cfg.ops) {
        assert.ok(seenOps.has(allowedOp), `Expected operator ${allowedOp} in ${diffKey} pool`);
      }
    }
  });

  it('maps all operators to display symbols', () => {
    assert.equal(DISPLAY_OP['+'], '+');
    assert.equal(DISPLAY_OP['-'], '−');
    assert.equal(DISPLAY_OP['x'], '×');
    assert.equal(DISPLAY_OP['/'], '÷');
    assert.equal(DISPLAY_OP['='], '=');
  });
});

/**
 * Helper that simulates a player solving a board purely by chaining equations
 * that have 2 known numbers and 1 unknown number.
 */
function canSolveByPureDeduction(board) {
  const knownKeys = new Set();
  const allPlayableKeys = new Set();

  for (const cell of board.grid.values()) {
    if (cell.type === 'num') {
      if (cell.prefilled) {
        knownKeys.add(cell.key);
      } else {
        allPlayableKeys.add(cell.key);
      }
    }
  }

  let progress = true;
  while (progress) {
    progress = false;
    for (const eq of board.equations) {
      const unknownInEq = eq.numCoords.filter(k => !knownKeys.has(k));
      if (unknownInEq.length === 1) {
        knownKeys.add(unknownInEq[0]);
        progress = true;
      }
    }
  }

  for (const k of allPlayableKeys) {
    if (!knownKeys.has(k)) return false;
  }
  return true;
}

describe('generateBoard', () => {
  for (const diffKey of ['easy', 'medium', 'hard', 'insane']) {
    it(`generates valid, connected, deductively solvable boards for ${diffKey}`, () => {
      const cfg = DIFFICULTY_CONFIG[diffKey];

      for (let run = 0; run < 15; run++) {
        const board = generateBoard(diffKey);

        // 1. Equation count within difficulty limits
        assert.ok(
          board.equations.length >= cfg.minEquations &&
            board.equations.length <= cfg.maxEquations,
          `Equation count ${board.equations.length} outside [${cfg.minEquations}, ${cfg.maxEquations}] for ${diffKey}`
        );

        // 2. Validate each equation and its placement on the grid
        for (const eq of board.equations) {
          assert.equal(eq.coords.length, 5);
          assert.equal(eq.numCoords.length, 3);
          assert.equal(isEquationMathValid(eq.a, eq.op, eq.b, eq.c), true);

          const dr = eq.dir === 'V' ? 1 : 0;
          const dc = eq.dir === 'H' ? 1 : 0;

          // Cell immediately before and after equation along its axis must be empty
          const beforeKey = `${eq.startR - dr},${eq.startC - dc}`;
          const afterKey = `${eq.startR + 5 * dr},${eq.startC + 5 * dc}`;
          assert.equal(board.grid.has(beforeKey), false);
          assert.equal(board.grid.has(afterKey), false);

          let blankCountInEq = 0;
          for (let i = 0; i < 5; i++) {
            const cell = board.grid.get(eq.coords[i]);
            assert.ok(cell, `Missing grid cell at ${eq.coords[i]}`);
            assert.equal(cell.value, eq.cells[i]);
            assert.ok(cell.eqIds.has(eq.id));

            if (i === 1 || i === 3) {
              assert.equal(cell.type, 'op');
              assert.equal(cell.eqIds.size, 1, 'Operator cells must not intersect');
            } else {
              assert.equal(cell.type, 'num');
              assert.ok(cell.value >= 1 && cell.value <= cfg.maxInt);
              assert.ok(cell.eqIds.size <= 2, 'At most 2 equations can share a cell');
              if (!cell.prefilled) blankCountInEq++;
            }
          }

          // Every equation must have at least 1 blank cell for the player to fill
          assert.ok(blankCountInEq >= 1, 'Every equation must have at least 1 blank cell');
        }

        // 3. Connectedness: all equations form a single connected crossword
        const visited = new Set([0]);
        const queue = [0];
        while (queue.length > 0) {
          const currId = queue.shift();
          const eq = board.equations[currId];
          for (const numCoord of eq.numCoords) {
            const cell = board.grid.get(numCoord);
            for (const neighborEqId of cell.eqIds) {
              if (!visited.has(neighborEqId)) {
                visited.add(neighborEqId);
                queue.push(neighborEqId);
              }
            }
          }
        }
        assert.equal(
          visited.size,
          board.equations.length,
          'All equations on the board must be connected'
        );

        // 4. Solvable by pure deduction (chaining equations without guessing)
        assert.equal(
          canSolveByPureDeduction(board),
          true,
          `Board on ${diffKey} should be 100% solvable by deduction`
        );
      }
    });
  }

  it('produces increasingly large multiplication and division problems from Medium to Hard to Insane and avoids division results of 1', () => {
    const stats = {};

    for (const diffKey of ['medium', 'hard', 'insane']) {
      let mulSum = 0;
      let mulCount = 0;
      let divSum = 0;
      let divCount = 0;

      for (let i = 0; i < 40; i++) {
        const board = generateBoard(diffKey);
        for (const eq of board.equations) {
          if (eq.op === 'x') {
            mulSum += eq.c;
            mulCount++;
          } else if (eq.op === '/') {
            assert.notEqual(eq.c, 1, `Division equation ${eq.a}/${eq.b}=${eq.c} must not equal 1`);
            divSum += eq.a;
            divCount++;
          }
        }
      }

      stats[diffKey] = {
        avgMul: mulSum / Math.max(1, mulCount),
        avgDiv: divSum / Math.max(1, divCount)
      };
    }

    assert.ok(
      stats.hard.avgMul > stats.medium.avgMul,
      `Expected Hard avg multiplication product (${stats.hard.avgMul}) > Medium (${stats.medium.avgMul})`
    );
    assert.ok(
      stats.insane.avgMul > stats.hard.avgMul,
      `Expected Insane avg multiplication product (${stats.insane.avgMul}) > Hard (${stats.hard.avgMul})`
    );
    assert.ok(
      stats.hard.avgDiv > stats.medium.avgDiv,
      `Expected Hard avg division dividend (${stats.hard.avgDiv}) > Medium (${stats.medium.avgDiv})`
    );
    assert.ok(
      stats.insane.avgDiv > stats.hard.avgDiv,
      `Expected Insane avg division dividend (${stats.insane.avgDiv}) > Hard (${stats.hard.avgDiv})`
    );
  });
});
