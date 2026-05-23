import Anthropic from "@anthropic-ai/sdk";
import {
  safeJsonParse,
  MODEL_ID,
  normalizeSynthesisAnomalies,
  extractAgentText,
  REQUEST_TIMEOUT_MS,
} from "./utils";

const SYSTEM_PROMPT = `You are an expert in multi-source evidence integration. You apply triangulation methodology (convergence across independent sources strengthens belief) and Bayesian-style belief updating (prior updated by evidence yields posterior severity).

YOUR JOB:
- Identify CONVERGENCE: findings detected by 2+ specialists from different angles → strongest signal, elevate severity.
- Identify CONTRADICTION: specialists disagree on a pattern → often important findings themselves; surface them.
- Identify ISOLATED findings: detected by only one specialist; rank by their own impact.
- Critically: UNEXPECTED findings often carry HIGHER value than aligned ones because the user could not have anticipated them. Weight severity accordingly.

COMPLETENESS RULE (mandatory):
You MUST include EVERY finding from every specialist in rankedAnomalies — do not drop weak or "noted" findings. The system's purpose is to surface signal at every level of significance so the user can decide what to pursue. Filtering is the user's job, not yours.

Each specialist finding carries a "significance" field ("investigate" | "monitor" | "noted") and a numeric "confidence". Use these together with the rules below to assign severity.

SEVERITY RULES (apply mechanically — first matching rule wins, top-down):
- HIGH:
    - detected by 2+ specialists (convergent — independent confirmation elevates regardless of any single specialist's significance), OR
    - a significant contradiction across specialists, OR
    - ( significance is "investigate" AND ( impactAsPercentOfTotal > 15 OR a high-impact unexpected discovery ) )
- MEDIUM:
    - ( significance is "investigate" AND impactAsPercentOfTotal between 5 and 15 inclusive ), OR
    - ( significance is "monitor" AND impactAsPercentOfTotal > 10 ), OR
    - a notable unexpected discovery
- LOW:
    - significance is "monitor", OR
    - ( significance is "investigate" AND impactAsPercentOfTotal < 5 )
- NOTE:
    - significance is "noted" (weak/marginal — recorded for awareness, not action)

If a specialist did not emit "significance", infer it from confidence: ≥0.7 → "investigate"; 0.40–0.69 → "monitor"; <0.40 → "noted".

SORT:
- severity desc (HIGH → MEDIUM → LOW → NOTE)
- then impactAsPercentOfTotal desc
- within the same severity tier, unexpected discoveries rank above aligned discoveries

Assign rank starting at 1 over the FULL list (including NOTE).

BREVITY:
- "evidence": carry the lead specialist's evidence verbatim if short, otherwise compress to its most informative 1–2 sentences. Do NOT pad.
- "impactDescription": one short sentence summarizing scale and direction (e.g., "≈25% YoY drift in category share").
- "synthesisNotes": brief overview of convergences/contradictions and how unexpected discoveries weighed in — 3–5 sentences max.
- Preserve titles verbatim; do not rewrite for stylistic reasons.

OUTPUT:
Return ONLY valid JSON, no preamble or markdown fences.

Schema:
{
  "rankedAnomalies": [
    {
      "id": string,                   // CRITICAL: preserve the EXACT id string from the lead specialist finding (e.g. "T001" / "D001" / "R001"). Do NOT invent new ids, do NOT renumber, do NOT add prefixes.
      "title": string,
      "severity": "HIGH" | "MEDIUM" | "LOW" | "NOTE",
      "significance": "investigate" | "monitor" | "noted",   // preserve from the lead specialist finding
      "confidence": number,                                   // preserve from the lead specialist finding (0..1)
      "evidence": string,
      "impactDescription": string,
      "sourceAgents": [string],       // e.g. ["temporal"], or ["temporal","distributional"] for convergent
      "convergenceType": "isolated" | "convergent" | "contradiction",
      "discoveryType": "aligned" | "unexpected" | "general",
      "rank": number
    }
  ],
  "synthesisNotes": string,
  "unexpectedDiscoveryCount": number,
  "significanceCounts": {
    "investigate": number,
    "monitor": number,
    "noted": number
  }
}`;

export async function synthesisAgent(specialistResults, inspectorProfile, orchestratorOutput, apiKey, signal) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const userMessage = `Inspector profile (for context):
\`\`\`json
${JSON.stringify({
  dataOverview: inspectorProfile?.dataOverview,
  potentialRelationships: inspectorProfile?.potentialRelationships,
}, null, 2)}
\`\`\`

Orchestrator output (for context):
\`\`\`json
${JSON.stringify({
  confirmedDomain: orchestratorOutput?.confirmedDomain,
  valueUnit: orchestratorOutput?.valueUnit,
  analyticalStrategy: orchestratorOutput?.analyticalStrategy,
  audience: orchestratorOutput?.audience,
  activateAgents: orchestratorOutput?.activateAgents,
}, null, 2)}
\`\`\`

Specialist results (any may be null if the specialist was not activated):
\`\`\`json
${JSON.stringify(specialistResults, null, 2)}
\`\`\`

Synthesize using triangulation + Bayesian belief updating. Apply the severity rules and sort rules mechanically. Return only the JSON object.`;

  const response = await client.messages.create(
    {
      model: MODEL_ID,
      // Synthesis preserves the union of all specialist findings (3 × ≥3 =
      // 9+ entries, often more), each with severity + significance + confidence +
      // evidence + impactDescription + sourceAgents + convergenceType + discoveryType
      // + rank, PLUS synthesisNotes prose and significanceCounts. With realistic
      // evidence lengths this easily exceeds 8192 tokens. 16384 is well within
      // Sonnet 4.6's output ceiling (64k) and gives comfortable headroom.
      max_tokens: 16384,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userMessage }],
    },
    { signal, timeout: REQUEST_TIMEOUT_MS }
  );

  const text = extractAgentText(response, "Synthesis");
  const parsed = safeJsonParse(text);
  parsed.rankedAnomalies = normalizeSynthesisAnomalies(parsed.rankedAnomalies);
  return parsed;
}
