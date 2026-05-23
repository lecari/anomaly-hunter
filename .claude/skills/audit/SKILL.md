---
name: audit
description: Launch a focused, read-only audit of one dimension of the Anomaly Hunter codebase via an Explore subagent. Useful when investigating a category of concern (schema consistency, state machine, accessibility, CSV edge cases, etc.). Does not modify any code.
---

# /audit — Focused codebase audit

Argument: the dimension to audit (free text). Recognized canonical dimensions
listed below — anything else is passed through verbatim to the subagent.

## Canonical dimensions

| Dimension | Scope |
| --- | --- |
| `schema` / `contracts` / `data-flow` | Field-by-field consistency across the 7 agents and their UI consumers |
| `state` / `state-machine` / `flow` | `src/App.jsx` state transitions, retry paths, AbortController, isAnalyzing, error categorization |
| `a11y` / `accessibility` / `aria` | WCAG / ARIA / keyboard / focus / labels / live regions / reduced-motion |
| `responsive` / `mobile` | Layout at 360 / 640 / 1024 px breakpoints, touch targets, overflow |
| `csv` / `parsing` | CSV edge cases: RFC 4180 quoted newlines, BOM, CRLF, binary, delimiter |
| `security` / `xss` | Injection surfaces, API key handling, dangerous patterns |
| `performance` | Bundle composition, re-renders, hot paths, allocation in CSV path |
| `copy` / `text` / `readme` | README accuracy vs current UI, in-app text consistency, terminology drift |
| `prompts` / `agents` | Each agent's system prompt: schema declared vs consumer expectations, Discovery Principle enforcement, brevity rules |
| `tokens` / `budgets` | Per-agent `max_tokens` adequacy vs realistic output shapes |

## Procedure

1. Resolve the dimension argument to ONE canonical scope above (or accept it
   verbatim if it doesn't match).
2. Launch ONE Explore subagent (single Agent tool call, not multiple). The
   prompt MUST include:
   - The repo path: `/Users/lucaecari/Desktop/anomaly-hunter`
   - The dimension to focus on (with concrete file/line scope)
   - Output requirement: **concrete bugs only** — file path + line(s) +
     description + concrete fix. No subjective preferences. No "could be more
     elegant" suggestions.
   - Length cap: 400 words maximum.
   - Result format: `BUGS: [...]` or `NO BUGS FOUND`.
3. Report the subagent's response verbatim to the user.
4. Do NOT apply any fix automatically. The user triages.

## Reference: prompt template (adapt the focus paragraph)

> Audit FOCUS: `<dimension>` in `/Users/lucaecari/Desktop/anomaly-hunter`.
> Find any concrete bug, mismatch, or anti-pattern. Read the relevant files
> only (specify paths if you can predict them). Output format:
> - BUGS: [file:line | issue | concrete fix]
> - NO BUGS FOUND if everything checks out
> Max 400 words. Skip subjective style preferences.

## Constraints

- One subagent per `/audit` call. Don't fan out 10 audits at once unless
  explicitly asked.
- Read-only. The subagent's tool surface includes Read/Grep/etc. but NOT
  Edit/Write.
- If the user's argument doesn't match any canonical dimension, ask them to
  clarify scope rather than guessing.
