---
name: verify
description: Run the full pre-commit verification pipeline for Anomaly Hunter (lint, unit tests, end-to-end pipeline simulation, production build). Use this before declaring any change "done" — it catches regressions in seconds.
---

# /verify — Anomaly Hunter pre-flight check

Runs the four standard verification steps in order and reports each result.
Stop and surface the failure if any step fails.

## Steps (run as a single Bash invocation, in this exact order)

```bash
echo "=== 1/4 ESLint ==="
npm run lint 2>&1 | tail -5

echo ""
echo "=== 2/4 Util unit tests ==="
node scripts/testSafeJson.mjs 2>&1 | tail -3

echo ""
echo "=== 3/4 Pipeline simulation ==="
node scripts/testPipeline.mjs 2>&1 | tail -3

echo ""
echo "=== 4/4 Production build ==="
npx vite build 2>&1 | grep -E "(error|Error|✓|dist/)" | head -8
rm -rf dist
```

## How to interpret

| Step | Pass signal |
| --- | --- |
| ESLint | No error/warning lines after `> eslint .` |
| testSafeJson.mjs | Final line: `All utils tests passed.` |
| testPipeline.mjs | Final line: `Pipeline simulation passed.` |
| vite build | `✓ 14X modules transformed.` + a `dist/` block |

## When NOT to use

- Right after `git clone` before `npm install` (will fail on missing `node_modules`).
- During an active multi-file edit — finish the edit first.

## What this does NOT do

- Does not commit, push, or modify any source file.
- Does not run the dev server (use `npm run dev` for that).
- Does not test the live LLM pipeline against Anthropic — that requires manual
  use of the app with a real API key.
