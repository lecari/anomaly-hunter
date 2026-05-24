---
name: verify
description: Run the full pre-commit verification pipeline for Anomaly Hunter (lint, unit tests, end-to-end pipeline simulation, production build). Use this before declaring any change "done" — it catches regressions in seconds.
---

# /verify — Anomaly Hunter pre-flight check

Runs the standard verification sequence and reports the result.
Stop and surface the failure if any step fails.

## Single command (preferred)

```bash
npm run verify
```

This is the same script CI runs on every push (`.github/workflows/ci.yml`).
It chains: `lint && test:utils && test:pipeline && build`. A single
non-zero exit means at least one stage failed; read the output above
the failure to find the cause.

## Or run the stages individually (when you want isolation)

```bash
npm run lint           # ESLint across all JS/JSX
npm run test:utils     # ~50 unit tests on src/agents/utils.js
npm run test:pipeline  # 16 end-to-end checks against sample data
npm run build          # Vite production build
```

## How to interpret

| Stage | Pass signal |
| --- | --- |
| lint | No error/warning lines after `> eslint .` |
| test:utils | Final line: `All utils tests passed.` |
| test:pipeline | Final line: `Pipeline simulation passed.` |
| build | `✓ 14X modules transformed.` + a `dist/` block |

## When NOT to use

- Right after `git clone` before `npm install` (will fail on missing `node_modules`).
- During an active multi-file edit — finish the edit first.

## What this does NOT do

- Does not commit, push, or modify any source file.
- Does not run the dev server (use `npm run dev` for that).
- Does not test the live LLM pipeline against Anthropic — that requires manual
  use of the app with a real API key.
