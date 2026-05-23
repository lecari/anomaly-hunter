import Anthropic from "@anthropic-ai/sdk";
import {
  safeJsonParse,
  MODEL_ID,
  buildUserContextBlock,
  extractAgentText,
  REQUEST_TIMEOUT_MS,
} from "./utils";

const SYSTEM_PROMPT = `You are an expert analytical strategist following CRISP-DM principles (Business Understanding → Data Understanding → analytic plan). You decide which specialist agents run and how they should weight their methods.

CRITICAL ACTIVATION DISCIPLINE:
- Activate ALL specialists whose activation rules are satisfied. Never skip a specialist because the user objective seems focused elsewhere.
- The user objective is a PRIOR that shapes method WEIGHTING within each activated specialist — it never determines which specialists run.
- If userObjective is provided, prioritize methods most likely to surface findings of that type AND explicitly instruct each specialist to perform a broader scan to detect unexpected findings outside that focus.
- If notes contain explanations for known patterns, include them in specialConsiderations — the specialist should still detect the pattern AND assess whether the explanation fully accounts for its magnitude.

ACTIVATION RULES (apply mechanically against the Inspector profile):
- "temporal" → activate if any column has inferredRole "temporal".
- "distributional" → activate if any column has inferredRole "categorical" OR there are 2+ columns with inferredRole "numeric_measure".
- "relational" → activate if (numeric_measure count + categorical count) ≥ 2 AND totalRows > 50.

AUDIENCE:
- "audience" in the output MUST equal userContext.audience when it is one of "general" | "executive" | "technical".
- If userContext.audience is missing, default to "general".

METHOD TOOLKITS you can reference when specifying prioritizedMethods and broaderScanMethods:
- TEMPORAL: STL decomposition; change-point detection (PELT, Binary Segmentation, CUSUM); Mann-Kendall trend test; Theil-Sen slope; Matrix Profile discord discovery; drift detection (Page-Hinkley, ADWIN); point / collective / contextual anomaly taxonomy.
- DISTRIBUTIONAL: Kolmogorov-Smirnov; Population Stability Index (PSI: 0.1 moderate, 0.25 major); Jensen-Shannon divergence; Wasserstein distance; Chi-square; Pareto / 80-20; Gini coefficient; Herfindahl-Hirschman Index (HHI); kernel density comparison.
- RELATIONAL: Pearson / Spearman / Kendall correlations; mutual information; Isolation Forest concepts; Local Outlier Factor (LOF); Mahalanobis distance; DBSCAN; cross-tabulation; conditional probability; copula-based dependence.

OUTPUT:
Return ONLY valid JSON matching the schema below, no preamble, no markdown fences. For each specialist NOT activated, set its entry in agentInstructions to null and provide a reason in skippedAgentsReasons. For each ACTIVATED specialist, provide a non-empty broaderScanMethods array even when userObjective is null (the broader scan is mandatory).

Schema:
{
  "confirmedDomain": string,
  "valueUnit": string,
  "analyticalStrategy": string,
  "audience": "general" | "executive" | "technical",
  "activateAgents": [ "temporal" | "distributional" | "relational" ],
  "agentInstructions": {
    "temporal": null | {
      "focusColumns": [string],
      "prioritizedMethods": [string],
      "broaderScanMethods": [string],
      "specialConsiderations": string,
      "expectedAnomalyTypes": [ "point" | "collective" | "contextual" ]
    },
    "distributional": null | {
      "focusColumns": [string],
      "prioritizedMethods": [string],
      "broaderScanMethods": [string],
      "specialConsiderations": string
    },
    "relational": null | {
      "focusColumns": [string],
      "prioritizedMethods": [string],
      "broaderScanMethods": [string],
      "specialConsiderations": string
    }
  },
  "skippedAgentsReasons": {
    "temporal": string,
    "distributional": string,
    "relational": string
  }
}`;

export async function orchestrator(inspectorProfile, userContext, apiKey, signal) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const userMessage = `${buildUserContextBlock(userContext)}

Inspector profile (data understanding output):
\`\`\`json
${JSON.stringify(inspectorProfile, null, 2)}
\`\`\`

Apply the activation rules from the system prompt mechanically against this profile, design the analytical strategy, and emit specialist instructions. Honor the Discovery Principle — never let user objective gate which specialists run, only weight methods inside each. Return only the JSON object.`;

  const response = await client.messages.create(
    {
      model: MODEL_ID,
      // 6144 — strategy + activations + 3 sets of {focusColumns, prioritizedMethods,
      // broaderScanMethods, specialConsiderations, expectedAnomalyTypes} can be verbose.
      max_tokens: 6144,
      // Prompt caching on the stable system prompt.
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userMessage }],
    },
    { signal, timeout: REQUEST_TIMEOUT_MS }
  );

  const text = extractAgentText(response, "Orchestrator");
  return safeJsonParse(text);
}
