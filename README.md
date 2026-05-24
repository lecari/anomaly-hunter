# Anomaly Hunter

[![CI](https://github.com/lecari/anomaly-hunter/actions/workflows/ci.yml/badge.svg)](https://github.com/lecari/anomaly-hunter/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Claude](https://img.shields.io/badge/Claude-Sonnet%204.6-D97757)](https://www.anthropic.com)

A domain-agnostic, multi-agent anomaly detection web app. Drop in any tabular CSV — sales, sensor logs, transactions, HR data, lab measurements — and a coordinated team of seven Claude-powered expert agents will autonomously profile the data, design an analytical strategy, hunt for anomalies in parallel using state-of-the-art methodologies, synthesize convergent evidence, and write a tailored narrative for your audience.

Everything runs in your browser. Nothing is stored anywhere except your tab.

---

## Discovery Principle

User-provided context (domain hint, analytical objective, notes, audience) is a **prior, never a filter**.

- The Inspector profiles every column comprehensively regardless of any hint.
- The Orchestrator activates every specialist whose data-driven activation rule fires, regardless of the user's stated objective.
- Specialists apply both the methods prioritized by the user objective *and* a mandatory broader scan, so unexpected patterns are still detected.
- Every finding is classified as `aligned` (matches the stated objective), `unexpected` (does not match but was detected), or `general` (no objective provided).
- Synthesis weights unexpected findings appropriately — they often carry higher value because the user could not have anticipated them.
- The narrative surfaces unexpected discoveries prominently with explicit framing such as "Beyond your focus area:" or "A pattern you did not ask about:".

The real value of Anomaly Hunter is surfacing what the user did not know to look for.

---

## What you get

```
Dataset profile
  - Inferred domain · confidence
  - Value unit · time period · rows × cols
  - Data quality score with completeness / consistency / validity / uniqueness breakdown
  - Hint-match indicator if a domain hint was provided

Executive summary
  - BLUF-style, audience-adapted
  - Acknowledges both aligned findings and unexpected discoveries
  - Significance breakdown: how many findings sit at each tier

Top 5 narrated anomaly cards (with full prose)
  - Severity (HIGH / MEDIUM / LOW / NOTE)
  - Significance (Investigate / Monitor / Noted only) + numeric confidence
  - Discovery framing (Aligned with your focus / 💡 Unexpected discovery)
  - Title · evidence (monospace) · why it matters · what to do
  - Methodologies applied · source agents · convergence indicator

"Also detected — for awareness" section
  - All remaining findings the specialists flagged
  - Compact, expandable rows with evidence on demand
```

## Significance-stratified reporting

Each specialist agent is contractually obligated to report **every** finding it produces, regardless of strength, classified by `significance`:

- **Investigate** — clear, robust pattern; deep follow-up warranted (confidence ≥ 0.7)
- **Monitor** — moderate pattern; worth tracking over time (confidence 0.40–0.69)
- **Noted only** — weak/marginal pattern or a check that yielded little; documented so you know what was scanned (confidence < 0.40)

Specialists never return empty results. If the data is genuinely unremarkable in their domain, they still emit "noted" entries describing which methods were applied and what residual signal they observed. Honesty about confidence is the point — the system surfaces signal at every level so you can decide what to pursue. Filtering is your job, not the agent's.

---

## Multi-agent architecture

```
                          ┌──────────────────────────────┐
   CSV + user context ──▶ │ 1. Inspector                 │  Tukey · DAMA · ISO/IEC 25012
                          │   data profile               │
                          └──────────────┬───────────────┘
                                         ▼
                          ┌──────────────────────────────┐
                          │ 2. Orchestrator              │  CRISP-DM
                          │   strategy + activations     │
                          └──┬───────────┬────────────┬──┘
                             │           │            │      run in parallel
                             ▼           ▼            ▼
                     ┌─────────────┐ ┌──────────────┐ ┌──────────────┐
                     │ 3. Temporal │ │ 4. Distribut.│ │ 5. Relational│
                     │  STL/PELT/  │ │  KS/PSI/JS/  │ │  Pearson/MI/ │
                     │  Mann-K/MP  │ │  Wasserstein │ │  LOF/Mahal.  │
                     └──────┬──────┘ └──────┬───────┘ └──────┬───────┘
                            └──────────┬───┴──────────────┘
                                       ▼
                          ┌──────────────────────────────┐
                          │ 6. Synthesis                 │  Triangulation + Bayesian
                          │   ranked anomalies           │
                          └──────────────┬───────────────┘
                                         ▼
                          ┌──────────────────────────────┐
                          │ 7. Narrative                 │  Minto / SCQA / BLUF / SMART
                          │   audience-tailored report   │
                          └──────────────────────────────┘
```

Each agent is one separate Claude API call.

---

## Domain expertise embedded in each agent

- **Inspector** — Exploratory Data Analysis following Tukey's principles, DAMA-DMBOK data management framework, ISO/IEC 25012 data quality dimensions (completeness, accuracy, consistency, timeliness, uniqueness, validity).
- **Orchestrator** — CRISP-DM (Business Understanding → Data Understanding → analytic plan); strategy design with method weighting and mandatory broader scan.
- **Temporal** — STL decomposition; change-point detection (PELT, Binary Segmentation, CUSUM); Mann-Kendall trend test; Theil-Sen slope; Matrix Profile discord discovery; drift detection (Page-Hinkley, ADWIN); point / collective / contextual anomaly taxonomy.
- **Distributional** — Kolmogorov-Smirnov; Population Stability Index (PSI: 0.1 / 0.25 thresholds); Jensen-Shannon divergence; Wasserstein distance; Chi-square; Pareto / 80-20; Gini coefficient; Herfindahl-Hirschman Index; kernel density comparison.
- **Relational** — Pearson / Spearman / Kendall correlations; mutual information; Isolation Forest concepts; Local Outlier Factor (LOF); Mahalanobis distance; DBSCAN; cross-tabulation; conditional probability; copula-based dependence.
- **Synthesis** — Triangulation across independent specialists; Bayesian-style belief updating; mechanical severity rules; unexpected-discovery uplift.
- **Narrative** — Minto Pyramid Principle; SCQA framework; BLUF executive communication; SMART recommendations; audience adaptation (executive / technical / general); domain-native vocabulary.

---

## Optional user context

Four optional inputs sharpen focus without limiting discovery:

| Input | What it does | What it does NOT do |
| --- | --- | --- |
| **Domain hint** | Helps the Inspector validate column roles; gives the Narrative natural vocabulary. | Restrict which columns are profiled or which specialists run. |
| **Analytical objective** ("find waste", "detect risk", "spot outliers"…) | Weights which methods each specialist prioritizes. | Suppress the mandatory broader scan; cause unexpected findings to be skipped. |
| **Notes** | Pre-explanations the agents will weigh when interpreting magnitude. | Filter out patterns the user has already mentioned — they are still detected, and unexplained residuals are flagged. |
| **Report audience** (general / executive / technical) | Adjusts the Narrative's depth, tone, and method-language. | Change which methods were applied — only how they are communicated. |

Every finding ends up tagged as `aligned`, `unexpected`, or `general`. Unexpected findings are surfaced prominently.

---

## Separation of concerns

- **Inspector** — *descriptive only*. Profiles the data; never flags anomalies.
- **Orchestrator** — *strategic only*. Decides which specialists run and how they should weight their methods; never analyzes the data itself.
- **Specialists** — *analytical only*. Each operates within its domain (temporal / distributional / relational), surfaces anomalies, and tags discovery type.
- **Synthesis** — *integrative only*. Combines specialist outputs; identifies convergence and contradiction; applies severity rules; sorts.
- **Narrative** — *communicative only*. Produces audience-adapted prose; never invents findings the Synthesis did not provide.

This separation keeps each prompt focused, the JSON contracts small, and the pipeline easy to debug.

---

## Why multi-agent

- **Orchestration autonomy** — the Orchestrator decides activation mechanically from the data profile, so the same code adapts to any CSV.
- **Parallelism** — by default the three specialists run as concurrent Claude calls via `Promise.allSettled`, cutting wall-clock latency roughly to the slowest specialist. An opt-in "Run specialists one at a time" toggle in the optional context panel switches to sequential execution for accounts that hit Anthropic's per-minute token limits.
- **Prompt caching** — every agent's system prompt is sent as a `cache_control: ephemeral` block, so retries and back-to-back analyses hit the Anthropic prompt cache (≈90% input discount + much lower latency on cache hits).
- **Convergence detection** — when two or three specialists independently flag a related pattern, the Synthesis stage elevates severity. A single-agent solution cannot triangulate.
- **Discovery uplift** — separating method weighting (Orchestrator) from broader-scan execution (Specialists) is what makes the Discovery Principle enforceable.

---

## Local setup

```bash
npm install
npm run dev
```

Then open the URL Vite prints (typically `http://localhost:5173`).

You will need an Anthropic API key. Paste it into the app — it is held in memory only for that browser session and is sent directly to Anthropic's API from your browser via the `@anthropic-ai/sdk` with `dangerouslyAllowBrowser: true`.

### Verifying changes

A single command runs lint + utility unit tests + pipeline simulation + production build, in that order:

```bash
npm run verify
```

Or the individual pieces:

```bash
npm run lint           # ESLint across all JS/JSX
npm run test:utils     # ~50 unit tests for parsing, normalization, CSV helpers
npm run test:pipeline  # 16 end-to-end checks against the sample dataset
npm run build          # Vite production build
```

`npm run verify` is what CI runs on every push.

---

## Deployment

This is a static Vite build, so any static host works. To deploy on Vercel:

1. `npm run build` produces a `dist/` folder.
2. Push the project to GitHub.
3. Import the repo into Vercel — Vercel auto-detects Vite and runs `npm run build` with output in `dist`. No environment variables are required (the API key is supplied at runtime by the end user).

---

## API key & privacy

- The Anthropic API key is provided by the end user inside the browser.
- It is held in React state only — never written to localStorage, sessionStorage, cookies, or any backend.
- Every Claude API call goes directly from the user's browser to `api.anthropic.com`. There is no intermediate server.
- Refreshing the page clears the key.
- This is appropriate for personal / demo use. For production-grade deployments you would normally proxy the API through a backend that holds the key.

---

## Sample dataset

The "Try with sample data" button loads a deterministic year (2024) of CHF personal-finance transactions with four embedded anomalies:

1. A restaurant-spend acceleration through the year.
2. A mid-year shift in the share of total spend going to shopping.
3. A grocery-frequency anomaly: same total, doubled transaction count, halved average.
4. A single very large health transaction in August.

This is just one example of the kind of CSV the system handles — the application is fully domain-agnostic.

---

## License

[MIT](./LICENSE) © 2025 Luca Ecari. All dependencies used are MIT-licensed or compatible (React, Vite, Tailwind CSS, PostCSS, ESLint, `@anthropic-ai/sdk`, `papaparse`).
