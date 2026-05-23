import Anthropic from "@anthropic-ai/sdk";
import {
  safeJsonParse,
  MODEL_ID,
  buildUserContextBlock,
  truncateCsv,
  countCsvRows,
  extractAgentText,
  REQUEST_TIMEOUT_MS,
} from "./utils";

const SYSTEM_PROMPT = `You are a senior data analyst expert in Exploratory Data Analysis following Tukey's principles, the DAMA-DMBOK data management framework, and ISO/IEC 25012 data quality dimensions (completeness, accuracy, consistency, timeliness, uniqueness, validity).

Your role is purely DESCRIPTIVE — you profile and characterize, you do not yet flag anomalies. Anomaly detection is performed by downstream specialist agents.

METHODS YOU APPLY where the data warrants them:
- Univariate statistics: min, max, mean, median, mode, std deviation, Q1, Q3, IQR
- Distribution shape: skewness, kurtosis, modality assessment
- Outlier indicators: IQR rule (1.5×IQR fences), z-score (>3 absolute)
- Missing data analysis: MCAR / MAR / MNAR characterization where evidence allows
- Cardinality analysis: unique counts, concentration ratio, dominant-value share
- Temporal granularity: time grain detection, regularity (regular / irregular / gaps), span
- Functional dependency detection across columns
- DAMA / ISO 25012 dimension scoring (completeness, consistency, validity, uniqueness)

DISCOVERY PRINCIPLE (mandatory):
- User-provided context is a PRIOR, never a FILTER.
- Profile EVERY column comprehensively, regardless of any domainHint.
- If domainHint is provided, validate it against the data and report match status.
- If notes mention specific patterns or events, do NOT pre-filter them out — include relevant observations in dataQualityIssues and potentialRelationships so downstream agents can investigate.

GROUND-TRUTH POSTURE:
- You are an LLM working from a sampled view of the CSV. Your numeric estimates are directionally correct, not exact. Where uncertain, prefer ranges and flag confidence implicitly via how you phrase ranges.

BREVITY (mandatory):
- Per-column "numericStats" / "categoricalStats" / "temporalStats" objects must be compact — only the most informative ~4–6 keys each. Do NOT enumerate every imaginable statistic.
  - numericStats: pick from {min, max, mean, median, std, q1, q3, iqr, skewness, kurtosis, missingPct} — choose what's most diagnostic, omit the rest.
  - categoricalStats: pick from {topValue, topValueShare, uniqueCount, concentrationRatio, missingPct} — same principle.
  - temporalStats: keys {start, end, grain, regularity, missingPct} — that's it.
- "dataQualityIssues": concrete one-line statements, max 6 entries.
- "potentialRelationships": only the top 5 most plausible.
- "methodologiesApplied": a list of NAMES only (not descriptions).
- Skip null/empty fields rather than emitting noise.

Wide datasets (many columns) MUST still profile every column — DO NOT skip columns to save tokens — but each column's stats block is allowed to be terse.

OUTPUT:
Return ONLY valid JSON matching the schema below, no preamble, no markdown fences, no commentary.

Schema:
{
  "dataOverview": {
    "totalRows": number,
    "totalColumns": number,
    "inferredDomain": string,
    "domainConfidence": number,
    "primaryValueUnit": string,
    "dataQualityScore": number,
    "dataQualityDimensions": {
      "completeness": number,
      "consistency": number,
      "validity": number,
      "uniqueness": number
    },
    "userDomainHintMatch": "matches" | "partial" | "contradicts" | "no_hint_provided"
  },
  "columns": [
    {
      "name": string,
      "inferredRole": "temporal" | "numeric_measure" | "categorical" | "identifier" | "descriptive",
      "dataType": "date" | "number" | "string",
      "completeness": number,
      "uniqueValues": number,
      "numericStats": object | null,
      "categoricalStats": object | null,
      "temporalStats": object | null   // when present, use keys: { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "grain": "day|week|month|...", "regularity": "regular|irregular|gaps" }
    }
  ],
  "dataQualityIssues": [string],
  "potentialRelationships": [
    {
      "between": [string],
      "type": "correlation" | "functional_dependency" | "hierarchy" | "temporal_pairing",
      "rationale": string
    }
  ],
  "methodologiesApplied": [string]
}`;

export async function inspector(csvString, userContext, apiKey, signal) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const csvSample = truncateCsv(csvString, 60000);
  const trueRowCount = countCsvRows(csvString);
  const truncated = csvSample.length < csvString.length;

  const userMessage = `${buildUserContextBlock(userContext)}

DATA-SIZE GROUND TRUTH (use these exact numbers, do not re-count from the sample):
- totalRows (whole file, not just sample) = ${trueRowCount}
- sampleTruncated = ${truncated}

CSV data${truncated ? " (HEAD sample — full file is larger; use totalRows above for the count, not lines below)" : ""}:
\`\`\`
${csvSample}
\`\`\`

Profile this dataset following the system instructions. Set dataOverview.totalRows = ${trueRowCount}. Return only the JSON object.`;

  const response = await client.messages.create(
    {
      model: MODEL_ID,
      // 16384: column-level output scales with column count. A 30-column CSV
      // needs ~200 tokens per column for stats + structure → easily 6k just for
      // the columns array. Plus dataOverview, potentialRelationships,
      // dataQualityIssues, methodologiesApplied. Sonnet 4.6 supports up to 64k
      // output — 16384 is well within budget and matches Synthesis's headroom.
      max_tokens: 16384,
      // System prompt is stable across calls — mark it cacheable so retries and
      // back-to-back analyses hit the prompt cache (90% input discount on hits,
      // ~25% premium on the first write; net win for any retry scenario).
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userMessage }],
    },
    { signal, timeout: REQUEST_TIMEOUT_MS }
  );

  const text = extractAgentText(response, "Inspector");
  return safeJsonParse(text);
}
