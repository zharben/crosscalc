# CrossCalc — Math Crossword Game

**CrossCalc** is a tablet-optimized educational math crossword game built with **Vite.js** and deployed via **GitHub Actions** to GitHub Pages. Players complete interlocking horizontal and vertical math equations by selecting or dragging integers from the sidebar.

## Features & Rules

- **Crossword-Style Chaining**: Equations intersect at shared number squares. Solving one equation reveals numbers that help solve connected equations!
- **No Zeroes**: All integers on the board are positive whole numbers ($\ge 1$).
- **Standard 5-Cell Equations**: Every equation follows `A [op] B = C` using `+`, `−`, `×`, or `÷` (with whole-number division results only).
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
| **Medium** | 7 – 14 | `1–10` (`6–10` are 2× as likely as `1–5`) | `+`, `−`, `×`, `÷` (denominator `2` or `5`) | Tile Pool |
| **Hard** | 7 – 14 | `1–20` (`6–10` 2× as likely as `1–5`, which are 2× as likely as `11–20`) | `+`, `−`, `×`, `÷` (denominator `2`, `5`, or `10`) | Keypad + Optional **Hints** Tile Pool toggle |
| **Insane** | 10 – 20 | `1–50` (uniform random) | `+`, `−`, `×`, `÷` (any whole-number denominator) | Keypad + Optional **Hints** Tile Pool toggle |

## Local Development (Vite.js)

```bash
# Install dependencies
npm install

# Start Vite development server
npm run dev

# Build production bundle into ./dist
npm run build

# Preview production build locally
npm run preview
```

## GitHub Pages Deployment Workflow

This repository includes an automated GitHub Actions workflow at `.github/workflows/deploy.yml` that builds the Vite app and deploys `./dist` to GitHub Pages whenever changes are pushed to `main`.

To enable it in your GitHub repository:
1. Go to **Settings → Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Push to the `main` branch (or trigger the workflow manually from the **Actions** tab).
