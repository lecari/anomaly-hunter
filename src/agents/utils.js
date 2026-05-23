export function safeJsonParse(text) {
  if (typeof text !== "string") {
    throw new Error("safeJsonParse: input is not a string");
  }

  let cleaned = text.trim();

  cleaned = cleaned.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "");

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error("safeJsonParse: no JSON object found in response");
  }

  cleaned = cleaned.slice(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`safeJsonParse: failed to parse JSON — ${err.message}`, { cause: err });
  }
}

export const MODEL_ID = "claude-sonnet-4-6";

// Per-request timeout in milliseconds. Three specialists run in parallel with
// up to 8192 max_tokens each. When the user's account hits TPM (tokens-per-minute)
// limits, the SDK retries internally with exponential backoff — that eats into
// the timeout. 10 minutes matches the SDK default and is the most permissive
// reasonable ceiling; a slow call still resolves, a true hang still gets cut.
export const REQUEST_TIMEOUT_MS = 600000;

// Extract the text content of an Anthropic Messages response and surface a
// human-friendly error if the model hit its max_tokens ceiling (which would
// otherwise yield malformed JSON and a cryptic safeJsonParse failure).
export function extractAgentText(response, agentLabel) {
  if (response?.stop_reason === "max_tokens") {
    throw new Error(
      `${agentLabel} response was truncated because it hit the max_tokens limit. ` +
        `Try a smaller dataset, narrower userContext.notes, or fewer columns. (stop_reason=max_tokens)`
    );
  }
  const text = (response?.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  if (!text.trim()) {
    throw new Error(`${agentLabel} returned no text content.`);
  }
  return text;
}

// Convert an AbortError from fetch/SDK into a clear user-facing message so the
// caller can distinguish "user navigated away" from "real failure".
export function isAbortError(err) {
  if (!err) return false;
  if (err.name === "AbortError") return true;
  const msg = String(err.message || err).toLowerCase();
  return msg.includes("aborted") || msg.includes("abortsignal");
}

// Strip a leading UTF-8 BOM (U+FEFF) if present. Excel "Save as CSV" emits BOMs
// that would otherwise be glued onto the first header cell name.
export function stripBom(csv) {
  if (typeof csv !== "string") return "";
  return csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv;
}

// Truncate a CSV string at the last newline that fits within maxChars, so the
// trailing row is never half-cut. Returns the original string if it fits.
// Guards against degenerate "header-only" output when the cap is hit too early.
export function truncateCsv(csv, maxChars) {
  if (typeof csv !== "string") return "";
  const stripped = stripBom(csv);
  if (stripped.length <= maxChars) return stripped;
  const slice = stripped.slice(0, maxChars);
  const lastNewline = slice.lastIndexOf("\n");
  // Only cut at lastNewline if it leaves at least 50% of the budget filled —
  // otherwise the cap landed mid-row of a wide CSV and trimming would drop too much.
  const safe = lastNewline > maxChars * 0.5 ? slice.slice(0, lastNewline) : slice;
  return `${safe}\n\n[... truncated; full CSV length ${stripped.length} characters ...]`;
}

// Count CSV data rows in a quote-aware way (RFC 4180): a newline inside a
// quoted field does NOT start a new row. Used so the Inspector knows the
// TRUE row count even when we truncate the body.
export function countCsvRows(csv) {
  if (typeof csv !== "string" || csv.length === 0) return 0;
  const s = stripBom(csv);
  let rows = 0;
  let inQuote = false;
  let sawContent = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    if (ch === 34 /* " */) {
      // RFC 4180: a doubled quote inside a quoted field is an escape.
      if (inQuote && s.charCodeAt(i + 1) === 34) {
        i++;
      } else {
        inQuote = !inQuote;
      }
      sawContent = true;
    } else if (ch === 10 /* \n */ && !inQuote) {
      rows++;
      sawContent = false;
    } else if (ch !== 13 /* \r */) {
      sawContent = true;
    }
  }
  // If the file doesn't end with a newline but had content on the last line.
  if (sawContent) rows++;
  // Subtract the header row.
  return Math.max(0, rows - 1);
}

// LLM-output enum normalizers. The system prompts dictate exact casing, but
// models occasionally drift (e.g. "high" instead of "HIGH"). These helpers
// rescue those cases so the UI doesn't silently fall back to default styling.

const SEVERITIES = new Set(["HIGH", "MEDIUM", "LOW", "NOTE"]);
const SIGNIFICANCES = new Set(["investigate", "monitor", "noted"]);
const DISCOVERY_TYPES = new Set(["aligned", "unexpected", "general"]);
const CONVERGENCE_TYPES = new Set(["isolated", "convergent", "contradiction"]);
const ANOMALY_TYPES = new Set(["point", "collective", "contextual"]);

function normalizeEnum(value, set, fallback, transform) {
  if (typeof value !== "string") return fallback;
  const candidate = transform(value.trim());
  return set.has(candidate) ? candidate : fallback;
}

export function normalizeSeverity(v) {
  return normalizeEnum(v, SEVERITIES, "NOTE", (s) => s.toUpperCase());
}
export function normalizeSignificance(v) {
  return normalizeEnum(v, SIGNIFICANCES, "noted", (s) => s.toLowerCase());
}
export function normalizeDiscoveryType(v) {
  return normalizeEnum(v, DISCOVERY_TYPES, "general", (s) => s.toLowerCase());
}
export function normalizeConvergence(v) {
  return normalizeEnum(v, CONVERGENCE_TYPES, "isolated", (s) => s.toLowerCase());
}
export function normalizeAnomalyType(v) {
  return normalizeEnum(v, ANOMALY_TYPES, "point", (s) => s.toLowerCase());
}

// Map specialist-shape anomalies (significance + confidence + discoveryType + maybe anomalyType).
export function normalizeSpecialistAnomalies(list, defaultDiscovery = "general") {
  if (!Array.isArray(list)) return [];
  return list.map((a) => ({
    ...a,
    significance: normalizeSignificance(a?.significance ?? inferSignificanceFromConfidence(a?.confidence)),
    discoveryType: normalizeDiscoveryType(a?.discoveryType ?? defaultDiscovery),
    ...(a?.anomalyType !== undefined ? { anomalyType: normalizeAnomalyType(a.anomalyType) } : {}),
  }));
}

// Map synthesis-shape ranked anomalies (severity + significance + convergenceType + discoveryType).
export function normalizeSynthesisAnomalies(list) {
  if (!Array.isArray(list)) return [];
  return list.map((a) => ({
    ...a,
    severity: normalizeSeverity(a?.severity),
    significance: normalizeSignificance(a?.significance ?? inferSignificanceFromConfidence(a?.confidence)),
    discoveryType: normalizeDiscoveryType(a?.discoveryType),
    convergenceType: normalizeConvergence(a?.convergenceType),
  }));
}

function inferSignificanceFromConfidence(c) {
  if (typeof c !== "number") return "noted";
  if (c >= 0.7) return "investigate";
  if (c >= 0.4) return "monitor";
  return "noted";
}

// Serialize userContext while dropping null fields so the model isn't told
// "domainHint: null" as if it were a deliberate value.
export function buildUserContextBlock(userContext) {
  if (!userContext) {
    return 'userContext: {} // no fields provided';
  }
  const cleaned = {};
  for (const [k, v] of Object.entries(userContext)) {
    if (v !== null && v !== undefined && v !== "") cleaned[k] = v;
  }
  if (Object.keys(cleaned).length === 0) {
    return 'userContext: {} // no fields provided';
  }
  return `userContext:\n${JSON.stringify(cleaned, null, 2)}`;
}
