# CLAUDE.md — Project Conventions

Rules and constraints any Claude session working in this repo must follow.
Companion to `HANDOFF.md` (which tracks state); this file tracks **conventions
that should not regress.**

---

## Identity

**Anomaly Hunter** — a browser-only React/Vite SPA that runs anomaly detection
on any tabular CSV through 7 Claude agents working in coordination. The user
supplies their own Anthropic API key, held in browser memory only.

The point of the product: **surface what the user did not know to look for**.

---

## Tech stack — non-negotiable

- **React + Vite, JavaScript (NOT TypeScript)**. Spec mandates JS. Do not
  introduce `.ts` / `.tsx` files.
- **Tailwind CSS v3** (not v4). Do not migrate.
- **`@anthropic-ai/sdk`** with `dangerouslyAllowBrowser: true` on every
  client instance.
- **Model: `claude-sonnet-4-6`** — defined as `MODEL_ID` in
  `src/agents/utils.js`. Never hardcode the model elsewhere.
- **Node 20+** for `npm run dev`, `npm run build`, scripts.
- `papaparse` is installed but currently unused (kept for potential future use).
  Do not remove from deps without consulting.

---

## Core design principles

### 1. Discovery Principle (highest priority)

User-provided context (`domainHint`, `analyticalObjective`, `notes`,
`audience`) is a **prior, never a filter**.

- Inspector profiles **every** column regardless of any hint
- Orchestrator activates **every** specialist whose data-driven rule fires,
  regardless of stated objective
- Specialists apply **both** `prioritizedMethods` AND a mandatory
  `broaderScanMethods` scan
- Every anomaly is tagged `discoveryType: "aligned" | "unexpected" | "general"`
- Synthesis weights unexpected discoveries higher
- Narrative surfaces unexpected discoveries prominently

> If a change makes the system narrower based on user objective, it is wrong.

### 2. Honest disclosure with materiality

Specialists **never return empty results**. They report every finding,
classified by significance. The user filters, not the agent.

Each anomaly carries:
- `significance: "investigate" | "monitor" | "noted"` — recommended action level
- `confidence: number` (0–1) — quantitative reliability

Specialists must emit **≥3 anomalies per scan**. If the data is unremarkable
in that domain, emit `"noted"` entries describing methods applied + residual
signal observed. These are not failures — they are part of a complete scan.

**Forbidden**:
- Fabricating patterns
- Promoting `"noted"` to `"investigate"` to fill a quota
- Suppressing weak signals to look clean

### 3. Separation of concerns

- **Inspector** = descriptive only. Profiles columns; never flags anomalies.
- **Orchestrator** = strategic only. Activates specialists and weights their
  methods; never analyzes data.
- **Specialists** = analytical only. Each scans its domain (temporal /
  distributional / relational) and tags findings.
- **Synthesis** = integrative only. Triangulates across specialists; assigns
  severity; sorts; preserves all findings.
- **Narrative** = communicative only. Adapts to audience; produces prose;
  never invents findings.

Do not blur these boundaries.

---

## The 7 agents (do not refactor without consulting)

| # | File | Role | `max_tokens` |
| - | --- | --- | :-: |
| 1 | `src/agents/inspector.js` | EDA profile (Tukey · DAMA · ISO/IEC 25012) | 16384 |
| 2 | `src/agents/orchestrator.js` | CRISP-DM strategy + specialist instructions | 6144 |
| 3 | `src/agents/temporalAgent.js` | STL / PELT / Mann-K / Matrix Profile / drift | 8192 |
| 4 | `src/agents/distributionalAgent.js` | KS / PSI / JS / Wasserstein / Gini / HHI | 8192 |
| 5 | `src/agents/relationalAgent.js` | Pearson/Spearman/Kendall / MI / LOF / Mahal. / DBSCAN | 8192 |
| 6 | `src/agents/synthesisAgent.js` | Triangulation + Bayesian belief updating | **16384** |
| 7 | `src/agents/narrativeAgent.js` | Minto / SCQA / BLUF / SMART | 8192 |

**Inspector must stay at 16384.** Per-column stats grow with column count;
wide CSVs (30+ columns) easily exceed 6144. Brevity rules in the prompt
prevent stat-bloat per column, but the headroom is mandatory.

**Synthesis must stay at 16384.** It preserves the verbatim union of all
specialist findings plus `synthesisNotes` prose. Lowering it causes
truncation. We already tuned this once — do not regress.

**Specialists must stay at 8192.** With ≥3 findings × 14 rich fields each,
4096 truncates routinely. We already tuned this once — do not regress.

`REQUEST_TIMEOUT_MS = 600000` (10 min) in `utils.js`. Matches SDK default.
Required because 3 parallel specialists can hit TPM limits and the SDK
retries internally with backoff. Do not lower.

---

## Mandatory patterns

### Concurrency — Promise.allSettled in parallel mode, never Promise.all

`runSpecialists` in `src/App.jsx` has TWO modes (selected by the
`sequentialSpecialists` state, toggled from `OptionalContextPanel`):

- **Parallel (default)**: `Promise.allSettled` over the activated specialists.
  Faster wall-clock; can stress TPM limits on small Anthropic tiers.
- **Sequential (opt-in)**: a for-of loop awaiting each specialist in turn.
  Continues on error so successes are preserved. Slower but reliable.

In BOTH modes, each specialist persists its result to React state on success
via a functional update:

```js
setSpecialistResults((prev) => ({ ...prev, [key]: result }));
```

This way, if one specialist fails, the others' results are preserved and
Retry can resume from where it left off. `Promise.all` would silently lose
sibling results on first rejection. We hit this bug once — do not regress.

### Cancellation — AbortController per run

```js
const abortRef = useRef(null);
// In startAnalysis / retryAgent:
abortRef.current = new AbortController();
// In resetForNewAnalysis:
abortRef.current?.abort();
```

Every agent function accepts `signal` as its last parameter and passes it to
`client.messages.create(body, { signal, timeout: REQUEST_TIMEOUT_MS })`.

Aborted promises throw `AbortError`. Use `isAbortError(err)` from utils to
distinguish deliberate abort from real failure. Do not pollute UI state
with phantom "error" rows on abort — use `markAgentFailure(key, err)` in
catch blocks.

### Post-parse enum normalization

LLMs occasionally drift on enum casing (`"high"` vs `"HIGH"`). After every
`safeJsonParse`, normalize enums via the helpers in `utils.js`:

```js
parsed.rankedAnomalies = normalizeSynthesisAnomalies(parsed.rankedAnomalies);
parsed.anomalies = normalizeSpecialistAnomalies(parsed.anomalies, defaultDiscovery);
```

Do not strip these calls. The UI's `SEVERITY_STYLES[v] || NOTE_fallback`
would silently degrade to NOTE styling on case mismatch.

### Truncation detection

Every agent must call `extractAgentText(response, "AgentName")` instead of
manually filtering `response.content`. The helper throws a user-friendly
error on `stop_reason === "max_tokens"`. Without it, `safeJsonParse` throws
a cryptic generic error.

### Prompt caching — required on all agents

Every agent's `system` field MUST be passed as a **block array** with
`cache_control: { type: "ephemeral" }` on the system prompt block:

```js
system: [
  { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }
]
```

NOT as a plain string. The 5-minute ephemeral cache gives ~90% input discount
on hits, which dramatically reduces retry cost and second-analysis latency.
If you ever add new agents, follow this convention. Do not regress to plain
string `system` — the savings are real and the syntactic difference is tiny.

### CSV ingest

Strip BOM at ingest only (single source of truth in `App.jsx`
`handleDataLoaded`). The `truncateCsv` helper also strips BOM defensively.
Use the RFC 4180 quote-aware `countCsvRows` — never `csv.split('\n').length`.

### React state

- All `setState` calls use functional updates when the new state depends on
  the previous: `setX((prev) => ...)`. Not the value-form, which can stale.
- `isAnalyzing` guard on both `startAnalysis` and `retryAgent` — set true at
  start, reset false in `finally`. Also reset in `resetForNewAnalysis`
  (otherwise next Analyze click is silently blocked).

---

## UI / visual conventions

### Severity (4-tier — do not collapse back to 3)

```js
HIGH    → rose      — bg-rose-500/15 text-rose-300 border-rose-500/30
MEDIUM  → amber     — bg-amber-500/15 text-amber-300 border-amber-500/30
LOW     → emerald   — bg-emerald-500/15 text-emerald-300 border-emerald-500/30
NOTE    → slate     — bg-slate-700/30 text-slate-300 border-slate-600
```

`AnomalyCard.jsx` and `CompactAnomalyRow.jsx` must keep these identical.

### Significance badge colors

```js
investigate → rose (action-level red)
monitor     → amber
noted       → slate (muted)
```

### Discovery framing

```js
unexpected → amber with 💡 emoji prefix
aligned    → slate
general    → no badge
```

### Card structure (do not regress)

`AnomalyCard` MUST have these labeled sections in this order:

1. Header: severity + significance + confidence + discovery + #rank + title
2. **"What was detected"** — narrative.what + collapsible "Show raw evidence"
3. **"Why this matters"** — narrative.whyItMatters
4. **"Impact for you"** (amber accent) — synthesis.impactDescription
5. **"Recommended action"** (indigo accent) — narrative.whatToDo
6. Footer: "Detected via" {agents} + convergence

### Other components

- `Results` always shows: DatasetProfileCard → ExecutiveSummary →
  "Detailed findings" heading + FindingsLegend (collapsible) → top-5
  AnomalyCards → optional "Also detected" CompactAnomalyRows → synthesisNotes
- `ExecutiveSummary` always shows BLUF prose + `keyTakeaways` bullet list
- `DatasetProfileCard` always shows the 4 ISO/IEC 25012 dimensions with
  interpretation labels (Excellent / Good / Acceptable / Needs attention)
- `EmptyState` is rare (specialists emit ≥3 findings by contract)

### Accessibility — mandatory

- Every `<input>` / `<select>` / `<textarea>` has `id` + `<label htmlFor>`
- Every `<button>` has explicit `type="button"`
- Toggle buttons: `aria-pressed` or `aria-expanded` as appropriate
- Live regions: `role="status" aria-live="polite"` on AgentProgress;
  `role="alert" aria-live="assertive"` on error banners
- Every decorative emoji has `aria-hidden="true"`
- Drag-drop and other div-as-button need `role="button" tabIndex={0}` +
  `onKeyDown` (Enter/Space)
- Focus management: screen heading components accept `headingRef` and
  attach to their h1/h2 with `tabIndex={-1}`
- `@media (prefers-reduced-motion: reduce)` is honored in `index.css`

---

## Privacy & security — non-negotiable

- API key is in React state only. **Never** localStorage / sessionStorage /
  cookies / IndexedDB / any persistence.
- Never log the API key. Never include it in error messages.
- Never use `dangerouslySetInnerHTML`, `eval`, `Function()` constructor.
- All LLM output is rendered as plain text in JSX (React auto-escapes).
- User CSV is read via `FileReader.readAsText`, never executed.
- `dangerouslyAllowBrowser: true` is intentional — documented in README.

---

## Testing — run before declaring "done"

```bash
npm run verify                                  # all of the below in one shot
```

Which expands to (and individual stages can be run via npm scripts of the same name):

```bash
npm run lint                                    # ESLint, must be clean
npm run test:utils                              # ~50 utils tests
npm run test:pipeline                           # 16 e2e sim checks
npm run build                                   # Vite production build
```

GitHub Actions CI (`.github/workflows/ci.yml`) runs the same `npm run verify`
on every push to main and every PR.

End-to-end manual test if pipeline touched: `npm run dev`, sample data, full
run. A full run takes ≈3–5 minutes (synthesis is the slow leg).

---

## File organization

```
src/agents/           1 file per agent + utils.js (shared helpers)
src/components/       1 file per visual component (kebab is fine but JSX uses PascalCase)
src/data/             generated fixtures (currently sampleData.js)
src/App.jsx           state machine + 7-call orchestration
src/main.jsx          ErrorBoundary > StrictMode > App
src/index.css         Tailwind + pulse-dot + reduced-motion + print
scripts/              Node scripts: generators + tests
public/               static assets (favicon)
```

Add new agents to `src/agents/` following the existing file template
(import utils, accept signal, use extractAgentText, normalize enums on output).

---

## Anti-patterns (do NOT do these)

- ❌ Lower any agent's `max_tokens` without measuring truncation risk first
- ❌ Switch specialists from `Promise.allSettled` to `Promise.all`
- ❌ Persist the API key anywhere
- ❌ Add TypeScript files
- ❌ Migrate to Tailwind v4
- ❌ Filter specialist findings by significance before showing them
- ❌ Suppress unexpected discoveries because they "don't fit the user's hint"
- ❌ Skip the broader scan because user objective is narrow
- ❌ Hard-code currency symbols or locale-specific number formats
- ❌ Add `dangerouslySetInnerHTML` anywhere
- ❌ Remove `aria-hidden` from decorative emojis to "save bytes"
- ❌ Replace functional `setState` updates with value-form updates
- ❌ Hard-code "claude-sonnet-4-6" outside `src/agents/utils.js`
- ❌ Add a new render-time error path without checking ErrorBoundary still catches it
- ❌ Bypass `safeJsonParse` / `extractAgentText` / normalize helpers
- ❌ Commit without running `npm run verify` first
- ❌ Force-push to `main` or rewrite history on the published remote
- ❌ Install CLI tools via `/usr/local/brew` on this Apple Silicon Mac — always use the ARM brew at `/opt/homebrew` under `arch -arm64`

---

## Repository state + change workflow

The project is **published** at https://github.com/lecari/anomaly-hunter
(public, MIT-licensed). `origin` remote is already configured for HTTPS push.
`gh` CLI is installed at `/opt/homebrew/bin/gh` and authenticated as user
`lecari` with `repo, gist, read:org, workflow` scopes.

### For every change

1. Edit the code.
2. **Run `npm run verify`** — single command runs lint + util tests +
   pipeline simulation + production build. Must exit 0.
3. `git add . && git commit -m "..." && git push`.
4. GitHub Actions CI (`.github/workflows/ci.yml`) runs the same
   `npm run verify` on every push. Verify the run is green:
   `/opt/homebrew/bin/gh run list --limit 1`.

If you push something that fails CI, **fix it forward** with another commit —
do not force-push or rewrite history on `main`.

### Mac architecture caveat

The host is an Apple Silicon (M4) Mac. Both Intel and ARM Homebrew are
installed. **For any new CLI binary**, always use the ARM-native brew under
`arch -arm64`:

```bash
arch -arm64 /opt/homebrew/bin/brew install <package>
```

Installing via the Intel `/usr/local/brew` produced a broken Rosetta x86_64
binary for `gh` once already. Do not regress.

### Tracked vs ignored

- `.claude/skills/*/SKILL.md` is **tracked** (skills are project-level)
- `.claude/settings.local.json` is **gitignored** (per-machine permissions)
- `LICENSE`, `README.md`, `CLAUDE.md`, `HANDOFF.md` all tracked
- `/*.csv`, `/*.xlsx` at root are gitignored (user-uploaded test datasets)
- Sample data lives at `src/data/sampleData.js` (NOT a CSV file — a JS string),
  generated by `scripts/generateSample.cjs`. This IS tracked.

---

## When in doubt

1. Read `HANDOFF.md` first for the latest state and decisions
2. Check `src/agents/utils.js` for shared helpers before writing new ones
3. Mirror the patterns in an existing agent / component when adding a new one
4. If a test fails, fix the code — not the test (unless the test is wrong on its face)
5. If a fix requires changing one of the conventions above, surface it
   explicitly before applying — these are deliberate, not accidental
