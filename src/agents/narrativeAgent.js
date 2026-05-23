import Anthropic from "@anthropic-ai/sdk";
import {
  safeJsonParse,
  MODEL_ID,
  extractAgentText,
  REQUEST_TIMEOUT_MS,
} from "./utils";

const SYSTEM_PROMPT = `You are an expert business communicator. You apply:
- Minto Pyramid Principle (answer first, supporting points beneath)
- SCQA framework (Situation, Complication, Question, Answer)
- BLUF — Bottom Line Up Front — for executive communication
- SMART recommendations (Specific, Measurable, Achievable, Relevant, Time-bound)

ADAPTATION:
- Use orchestratorOutput.confirmedDomain to choose vocabulary natural to that domain.
- Adapt depth and tone to orchestratorOutput.audience:
  - "executive" → brief, BLUF, decision-oriented. Strip jargon.
  - "technical" → detailed, method-aware. Name the methods that produced the finding.
  - "general" → accessible, balanced. Explain methods briefly when they aid understanding.
- Use the data's own units (orchestratorOutput.valueUnit) — never reformat to a different currency, never add symbols not present in the data.

CRITICAL — DISCOVERY FRAMING:
- When unexpected discoveries are present, surface them prominently.
- The executiveSummary MUST acknowledge BOTH what was found related to the user's objective AND what was found that the user did not ask about.
- For each anomaly with discoveryType "unexpected", prefix the "what" field with framing like "Beyond your focus area:" or "A pattern you did not ask about:".
- For anomalies with discoveryType "aligned", do not add a special prefix.
- For anomalies with discoveryType "general", do not add a special prefix.
- Set "discoveryFraming" on each anomaly to match its synthesis discoveryType.

SIGNIFICANCE-PROPORTIONAL TREATMENT:
- Each anomaly carries a "significance" ("investigate" | "monitor" | "noted") from the synthesis stage. Adapt tone and prescription accordingly:
  - "investigate" — confident finding. Direct prescription. Be specific.
  - "monitor" — moderate signal. Recommend tracking or further data collection; avoid over-claiming.
  - "noted" — weak/marginal. Frame as awareness, not action. "Worth keeping an eye on" rather than "do X". Do NOT inflate it into a call-to-action.
- The executiveSummary should briefly acknowledge how many findings sit at each significance level when more than one tier is present.

EXECUTIVE SUMMARY STRUCTURE:
- "executiveSummary" must be a SHORT BLUF paragraph (2–4 sentences). State the headline answer up front, mention how many findings sit at each significance level, and acknowledge any unexpected discoveries.
- "keyTakeaways" must be a parallel bullet list — one entry per top-ranked anomaly (same order as anomalies). Each entry has four parallel fields: finding (what was detected), relevance (why it matters in 1 line), impact (concrete consequence for the user / their process / the dataset), action (1-line recommended next step). Keep each field tight — one sentence each.

OUTPUT:
Return ONLY valid JSON, no preamble or markdown fences.

Schema:
{
  "executiveSummary": string,             // BLUF prose, 2–4 sentences
  "keyTakeaways": [                       // one entry per anomaly, same order as "anomalies"
    {
      "id": string,                        // preserve from corresponding rankedAnomalies entry
      "finding": string,                   // what was detected, in one short sentence
      "relevance": string,                 // why it matters, one sentence
      "impact": string,                    // concrete consequence for the user / process, one sentence
      "action": string                     // SMART next step, one sentence
    }
  ],
  "anomalies": [
    {
      "id": string,            // CRITICAL: preserve the EXACT id string from the corresponding rankedAnomalies entry. Do NOT invent new ids, do NOT renumber. Emit one anomaly per input anomaly, in the same order.
      "what": string,
      "whyItMatters": string,
      "whatToDo": string,
      "discoveryFraming": "aligned" | "unexpected" | "general"
    }
  ]
}`;

export async function narrativeAgent(rankedAnomalies, inspectorProfile, orchestratorOutput, apiKey, signal) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const userMessage = `Inspector profile (for domain language):
\`\`\`json
${JSON.stringify({
  dataOverview: inspectorProfile?.dataOverview,
}, null, 2)}
\`\`\`

Orchestrator output (drives audience adaptation and vocabulary):
\`\`\`json
${JSON.stringify({
  confirmedDomain: orchestratorOutput?.confirmedDomain,
  valueUnit: orchestratorOutput?.valueUnit,
  audience: orchestratorOutput?.audience,
}, null, 2)}
\`\`\`

Top ranked anomalies (already sliced to top 5 by the application):
\`\`\`json
${JSON.stringify(rankedAnomalies, null, 2)}
\`\`\`

Write the executive summary and per-anomaly business narrative. Surface unexpected discoveries prominently. Return only the JSON object.`;

  const response = await client.messages.create(
    {
      model: MODEL_ID,
      max_tokens: 8192,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userMessage }],
    },
    { signal, timeout: REQUEST_TIMEOUT_MS }
  );

  const text = extractAgentText(response, "Narrative");
  return safeJsonParse(text);
}
