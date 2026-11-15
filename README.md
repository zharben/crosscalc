# CrossCalc — Math Crossword Game

**CrossCalc** is a tablet-optimized educational math crossword game built for GitHub Pages. Players complete interlocking horizontal and vertical math equations by selecting or dragging integers from the sidebar.

## Features & Rules

- **Crossword-Style Chaining**: Equations intersect at shared number squares. Solving one equation reveals numbers that help solve connected equations!
- **No Zeroes**: All integers on the board are positive whole numbers ($\ge 1$).
- **Standard 5-Cell Equations**: Every equation follows `A [op] B = C` using `+`, `−`, or `÷` (with whole-number division results only).
- **Immediate Equation Highlighting**: Completed equations immediately light up green when mathematically valid (or gently shake in red if they don't add up).
- **Tablet-First Experience**:
  - Supports both **tap-to-place** and **touch drag-and-drop** for number tiles.
  - Responsive layout adapts automatically to both landscape (side dock) and portrait (bottom dock) tablet orientations.
  - Auto-fits the crossword board to the screen with manual zoom controls (`+`, `−`, `Fit`).

## Difficulty Modes

Difficulty is selected when starting a new game:

| Difficulty | Equations | Number Range & Weighting | Allowed Operations | Sidebar Mode |
| :--- | :--- | :--- | :--- | :--- |
| **Easy** | 5 – 10 | `1–10` (`1–5` are 2× as likely as `6–10`) | `+`, `−` | Tile Pool |
| **Medium** | 7 – 14 | `1–10` (`6–10` are 2× as likely as `1–5`) | `+`, `−`, `÷` (denominator `2` or `5`) | Tile Pool |
| **Hard** | 7 – 14 | `1–20` (`6–10` 2× as likely as `1–5`, which are 2× as likely as `11–20`) | `+`, `−`, `÷` (denominator `2`, `5`, or `10`) | Keypad + Optional **Hints** Tile Pool toggle |
| **Insane** | 10 – 20 | `1–50` (uniform random) | `+`, `−`, `÷` (any whole-number denominator) | Keypad + Optional **Hints** Tile Pool toggle |

## Hosting on GitHub Pages

This project consists of static HTML, CSS, and JavaScript files (`index.html`, `styles.css`, `app.js`) with zero build dependencies:

1. Push the repository to GitHub.
2. Go to **Settings → Pages** in your GitHub repository.
3. Under **Build and deployment**, select **Deploy from a branch**, choose your main branch and `/ (root)` folder, and click **Save**.
