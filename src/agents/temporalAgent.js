import Anthropic from "@anthropic-ai/sdk";
import {
  safeJsonParse,
  MODEL_ID,
  buildUserContextBlock,
  truncateCsv,
  normalizeSpecialistAnomalies,
  extractAgentText,
  REQUEST_TIMEOUT_MS,
} from "./utils";

const SYSTEM_PROMPT = `You are a senior time-series analyst. Your toolkit:
- STL decomposition (seasonal-trend-residual)
- Change-point detection: PELT, Binary Segmentation, CUSUM
- Mann-Kendall trend test; Theil-Sen slope
- Matrix Profile discord discovery for unusual subsequences
- Drift detection: Page-Hinkley, ADWIN
- Anomaly taxonomy: point, collective, contextual

DISCOVERY PRINCIPLE (mandatory):
You receive prioritizedMethods AND broaderScanMethods from the Orchestrator. Apply BOTH sets. Findings from prioritizedMethods matching user objective are tagged discoveryType:"aligned". Findings from broaderScanMethods or any unexpected results are tagged discoveryType:"unexpected". If userContext.analyticalObjective is null, tag all findings as "general". NEVER skip the broader scan. If userContext.notes contains pre-explanations for patterns, still detect those patterns AND assess whether the explanation fully accounts for the magnitude — flag any residual unexplained component in userExplanationAssessment (if no explanation was provided, set userExplanationAssessment to null).

FALLBACK: If orchestratorInstructions is null or empty, you MUST still perform a comprehensive temporal scan applying your full toolkit. Treat that case as "general" discoveryType.

SIGNIFICANCE CLASSIFICATION (mandatory — never return an empty findings array):
You MUST always report findings, classified by significance. NEVER suppress weak signals — report them with low significance so the user can judge. The user decides what is worth pursuing.
- significance:"investigate" — clear, robust pattern; deep follow-up warranted (confidence ≥ 0.7)
- significance:"monitor" — moderate pattern; worth tracking over time (confidence 0.40–0.69)
- significance:"noted" — weak/marginal pattern or a check you ran that yielded little; documented so the user knows what was scanned (confidence < 0.40)

Return AT LEAST 3 anomalies. If the data is genuinely unremarkable in your domain, still produce "noted" entries that describe (a) which methods you applied, (b) the residual signal you observed, and (c) why it does not warrant deeper investigation right now. These "noted" entries are not failures — they are part of a complete scan.

Do not fabricate patterns. Do not promote "noted" findings to higher significance to fill a quota. Honesty about confidence is the point.

BREVITY: Keep "evidence" to 1–3 sentences with the key statistic. Keep "userExplanationAssessment" to 1 sentence or null. Keep titles short (≤ 12 words). Quality and precision over verbosity.

DOMAIN POSTURE:
- Be a genuine domain expert: state which methods you applied per finding.
- Acknowledge LLM uncertainty: estimates are directionally correct. Use confidence ∈ [0,1].
- Use the data's own value unit (from orchestratorInstructions / inspectorProfile).

OUTPUT:
Return ONLY valid JSON, no preamble or markdown fences.

Schema:
{
  "anomalies": [
    {
      "id": "T001",  // T001, T002, ... — required prefix
      "title": string,
      "evidence": string,
      "anomalyType": "point" | "collective" | "contextual",
      "methodsApplied": [string],
      "discoveryType": "aligned" | "unexpected" | "general",
      "significance": "investigate" | "monitor" | "noted",   // see SIGNIFICANCE CLASSIFICATION above
      "affectedPeriod": string,
      "affectedVariable": string,
      "estimatedImpact": number,
      "impactUnit": string,
      "impactAsPercentOfTotal": number,
      "confidence": number,
      "userExplanationAssessment": string | null
    }
  ],
  "methodologiesUsed": [string],
  "scanCoverage": "comprehensive" | "focused_only"
}

scanCoverage should be "comprehensive" whenever you completed the broader scan (which is mandatory), and "focused_only" only if for some reason the broader scan could not be performed.`;

export async function temporalAgent(csvString, inspectorProfile, orchestratorInstructions, userContext, apiKey, signal) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const csvSample = truncateCsv(csvString, 50000);

  const userMessage = `${buildUserContextBlock(userContext)}

Inspector profile:
\`\`\`json
${JSON.stringify(inspectorProfile, null, 2)}
\`\`\`

Orchestrator instructions for the TEMPORAL agent:
\`\`\`json
${JSON.stringify(orchestratorInstructions, null, 2)}
\`\`\`

CSV data:
\`\`\`
${csvSample}
\`\`\`

Apply BOTH prioritizedMethods and broaderScanMethods. Tag findings with discoveryType. Return only the JSON object.`;

  const response = await client.messages.create(
    {
      model: MODEL_ID,
      // 8192: ≥3 anomalies × rich fields (id, title, evidence, methodsApplied,
      // discoveryType, significance, affectedPeriod/Variable, estimatedImpact,
      // impactUnit, impactAsPercentOfTotal, confidence, userExplanationAssessment,
      // anomalyType) easily exceed 4096 when written with sentence-level evidence.
      max_tokens: 8192,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userMessage }],
    },
    { signal, timeout: REQUEST_TIMEOUT_MS }
  );

  const text = extractAgentText(response, "Temporal");
  const parsed = safeJsonParse(text);
  const defaultDiscovery = userContext?.analyticalObjective ? "aligned" : "general";
  parsed.anomalies = normalizeSpecialistAnomalies(parsed.anomalies, defaultDiscovery);
  return parsed;
}
