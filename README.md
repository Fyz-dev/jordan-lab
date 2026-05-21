# Jordan Lab

A small educational web app for working with matrices and solving systems of linear equations using the Jordan elimination method.

## Features

- inverse matrix calculation;
- matrix rank calculation;
- solving a system of linear equations using the first method via the inverse matrix;
- random matrix and vector generation in the range from `-9` to `9`;
- step-by-step computation protocol.

## Tech Stack

- TypeScript
- Vite
- Vitest

## Project Structure

- `index.html` - page markup.
- `src/main.ts` - UI logic, matrix generation, and protocol building.
- `src/style.css` - interface styles.
- `src/core/maths/matrix-math.ts` - matrix calculations.
- `src/core/logger.ts` - intermediate step logging.
- `src/tests/matrix-math.test.ts` - tests for matrix logic.

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
