# Jordan Lab

A small educational web app for working with matrices, solving systems of linear equations, and exploring the simplex method.

## Features

- inverse matrix calculation;
- matrix rank calculation;
- solving a system of linear equations using the first method via the inverse matrix;
- simplex method solving with step-by-step protocol;
- random matrix and vector generation in the range from `-9` to `9`;
- shared matrix helpers for cloning and rounding intermediate data;
- browser alerts for validation and solver errors in the simplex flow;
- step-by-step computation protocol.

## Tech Stack

- TypeScript
- Vite
- Vitest

## Project Structure

- `index.html` - page markup.
- `src/main.ts` - UI logic, matrix generation, and protocol building.
- `src/simplex.ts` - simplex page wiring and result rendering.
- `src/style.css` - interface styles.
- `src/core/maths/matrix-math.ts` - matrix calculations.
- `src/core/maths/simplex-mjv-solver.ts` - simplex solver implementation.
- `src/core/maths/utils.ts` - shared matrix helpers.
- `src/core/logger.ts` - intermediate step logging.
- `src/tests/matrix-math.test.ts` - tests for matrix logic.
- `src/tests/simplex-mjv-solver.test.ts` - tests for simplex logic.

## Getting Started

Install dependencies:

```bash
pnpm install
```

Run the development server:

```bash
pnpm dev
```

Run tests:

```bash
pnpm test
```

## Note

The maximum matrix size in the interface is limited to `9 x 9`.

Simplex validation and solver errors are shown via browser alerts, while successful runs are written into the protocol output area.
