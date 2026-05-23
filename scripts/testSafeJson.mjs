// Quick sanity test for utils against realistic LLM-output shapes and CSV edge cases.
import {
  safeJsonParse,
  truncateCsv,
  countCsvRows,
  buildUserContextBlock,
  stripBom,
  normalizeSeverity,
  normalizeSignificance,
  normalizeDiscoveryType,
  normalizeConvergence,
  normalizeSpecialistAnomalies,
  normalizeSynthesisAnomalies,
  extractAgentText,
  isAbortError,
} from "../src/agents/utils.js";

let failures = 0;

function expectEqual(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) {
    failures++;
    console.error(`FAIL  ${label}\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`);
  } else {
    console.log(`OK    ${label}`);
  }
}

function expectThrow(label, fn) {
  try {
    fn();
    failures++;
    console.error(`FAIL  ${label} (expected throw)`);
  } catch {
    console.log(`OK    ${label} (threw as expected)`);
  }
}

// 1. Plain JSON
expectEqual("plain JSON", safeJsonParse('{"a":1,"b":2}'), { a: 1, b: 2 });

// 2. JSON wrapped in ```json fences
expectEqual(
  "fenced ```json",
  safeJsonParse('```json\n{"a":1}\n```'),
  { a: 1 }
);

// 3. JSON with prose preamble
expectEqual(
  "prose before",
  safeJsonParse('Here is the JSON you asked for:\n{"a":1,"b":"x"}'),
  { a: 1, b: "x" }
);

// 4. JSON with prose after
expectEqual(
  "prose after",
  safeJsonParse('{"a":1}\n\nLet me know if anything else is needed.'),
  { a: 1 }
);

// 5. JSON containing a string with braces inside
expectEqual(
  "string contains braces",
  safeJsonParse('{"note":"value {x} is set"}'),
  { note: "value {x} is set" }
);

// 6. Nested JSON arrays and objects
const nested = '{"anomalies":[{"id":"T001","title":"x","methodsApplied":["STL","PELT"]}]}';
expectEqual(
  "nested array of objects",
  safeJsonParse(nested),
  { anomalies: [{ id: "T001", title: "x", methodsApplied: ["STL", "PELT"] }] }
);

// 7. Malformed: not a string
expectThrow("non-string input", () => safeJsonParse(123));

// 8. Malformed: no JSON object
expectThrow("no object", () => safeJsonParse("nothing here, just prose"));

// 9. Malformed: broken syntax
expectThrow("broken syntax", () => safeJsonParse('{"a":}'));

// truncateCsv tests
const csv = "h1,h2\nrow1a,row1b\nrow2a,row2b\nrow3a,row3b\n";
expectEqual("truncateCsv: fits", truncateCsv(csv, 1000), csv);

const truncated = truncateCsv(csv, 20);
const trimmedFirst = truncated.split("\n\n[...")[0];
const ok = trimmedFirst === "h1,h2\nrow1a,row1b" || trimmedFirst === "h1,h2\nrow1a,row1b\n";
console.log(
  `${ok ? "OK   " : "FAIL "} truncateCsv: cuts at newline boundary — first chunk = ${JSON.stringify(trimmedFirst)}`
);
if (!ok) failures++;

// countCsvRows
expectEqual("countCsvRows: simple", countCsvRows("h1,h2\na,1\nb,2\nc,3\n"), 3);
expectEqual("countCsvRows: no trailing newline", countCsvRows("h1\na\nb\nc"), 3);
expectEqual("countCsvRows: header-only", countCsvRows("h1,h2\n"), 0);
expectEqual("countCsvRows: empty", countCsvRows(""), 0);

// buildUserContextBlock — null fields are filtered, non-null preserved.
const ctxAllNull = buildUserContextBlock({
  domainHint: null,
  analyticalObjective: null,
  notes: null,
  audience: "general",
});
const containsAudience = ctxAllNull.includes('"audience": "general"');
const omitsNulls = !ctxAllNull.includes("null");
console.log(
  `${containsAudience && omitsNulls ? "OK   " : "FAIL "} buildUserContextBlock: drops nulls, keeps audience`
);
if (!(containsAudience && omitsNulls)) failures++;

const ctxEmpty = buildUserContextBlock({});
const isEmptyObjectBlock = ctxEmpty.includes("{}") && ctxEmpty.includes("no fields provided");
console.log(`${isEmptyObjectBlock ? "OK   " : "FAIL "} buildUserContextBlock: empty input falls back`);
if (!isEmptyObjectBlock) failures++;

// stripBom — present
expectEqual("stripBom: removes leading BOM", stripBom("﻿date,amount\n1,2"), "date,amount\n1,2");
expectEqual("stripBom: passthrough when no BOM", stripBom("date,amount"), "date,amount");
expectEqual("stripBom: empty string", stripBom(""), "");

// truncateCsv strips BOM in returned content
const bomCsv = "﻿h1,h2\na,1\nb,2\n";
expectEqual("truncateCsv: strips BOM (small file)", truncateCsv(bomCsv, 1000), "h1,h2\na,1\nb,2\n");

// countCsvRows correct when CSV has BOM
expectEqual("countCsvRows: BOM does not inflate count", countCsvRows("﻿h1\na\nb\nc\n"), 3);

// truncateCsv 50% guard: a single very long row should not be reduced to nothing.
const wideRow = "h1,h2\n" + "x".repeat(120) + "\n"; // ~127 chars total
const truncatedWide = truncateCsv(wideRow, 80); // forces truncation
// Should NOT collapse to just "h1,h2"; the 50% guard keeps the partial row.
const collapsedToHeaderOnly = truncatedWide.startsWith("h1,h2\n\n[...");
console.log(
  `${!collapsedToHeaderOnly ? "OK   " : "FAIL "} truncateCsv: 50% guard preserves partial wide row`
);
if (collapsedToHeaderOnly) failures++;

// Enum normalizers
expectEqual("normalizeSeverity: high → HIGH", normalizeSeverity("high"), "HIGH");
expectEqual("normalizeSeverity: 'MEDIUM' passthrough", normalizeSeverity("MEDIUM"), "MEDIUM");
expectEqual("normalizeSeverity: garbage → NOTE", normalizeSeverity("ultra"), "NOTE");
expectEqual("normalizeSignificance: INVESTIGATE → investigate", normalizeSignificance("INVESTIGATE"), "investigate");
expectEqual("normalizeSignificance: garbage → noted", normalizeSignificance("urgent"), "noted");
expectEqual("normalizeDiscoveryType: UNEXPECTED → unexpected", normalizeDiscoveryType("UNEXPECTED"), "unexpected");
expectEqual("normalizeConvergence: ISOLATED → isolated", normalizeConvergence("ISOLATED"), "isolated");

// normalizeSpecialistAnomalies: infers significance from confidence when missing
const specOut = normalizeSpecialistAnomalies(
  [
    { id: "T001", confidence: 0.9, discoveryType: "ALIGNED" },
    { id: "T002", confidence: 0.5 },
    { id: "T003", confidence: 0.2, significance: "MONITOR" },
  ],
  "general"
);
expectEqual(
  "normalizeSpecialistAnomalies: confidence>0.7 infers investigate",
  specOut[0].significance,
  "investigate"
);
expectEqual(
  "normalizeSpecialistAnomalies: discoveryType lowercased",
  specOut[0].discoveryType,
  "aligned"
);
expectEqual(
  "normalizeSpecialistAnomalies: missing significance inferred from mid confidence",
  specOut[1].significance,
  "monitor"
);
expectEqual(
  "normalizeSpecialistAnomalies: missing discoveryType uses default",
  specOut[1].discoveryType,
  "general"
);
expectEqual(
  "normalizeSpecialistAnomalies: MONITOR cased",
  specOut[2].significance,
  "monitor"
);

// normalizeSynthesisAnomalies
const synOut = normalizeSynthesisAnomalies([
  { id: "R001", severity: "high", significance: "Investigate", discoveryType: "UNEXPECTED", convergenceType: "CONVERGENT", confidence: 0.8 },
  { id: "R002", severity: "note", confidence: 0.1, discoveryType: "general", convergenceType: "isolated" },
]);
expectEqual("normalizeSynthesisAnomalies: severity HIGH", synOut[0].severity, "HIGH");
expectEqual("normalizeSynthesisAnomalies: significance investigate", synOut[0].significance, "investigate");
expectEqual("normalizeSynthesisAnomalies: convergent", synOut[0].convergenceType, "convergent");
expectEqual("normalizeSynthesisAnomalies: NOTE preserved", synOut[1].severity, "NOTE");
expectEqual(
  "normalizeSynthesisAnomalies: inferred from low confidence",
  synOut[1].significance,
  "noted"
);

// countCsvRows: quote-aware — newline inside quoted field should NOT count
expectEqual(
  'countCsvRows: ignores newline inside quoted field',
  countCsvRows('name,note\nA,"hello\nworld"\nB,"x"\n'),
  2
);
expectEqual(
  'countCsvRows: escaped quote inside quoted field',
  countCsvRows('name,note\nA,"she said ""hi"""\nB,"x"\n'),
  2
);

// extractAgentText
const okText = extractAgentText(
  { stop_reason: "end_turn", content: [{ type: "text", text: '{"x":1}' }] },
  "Test"
);
expectEqual("extractAgentText: normal response", okText, '{"x":1}');

expectThrow("extractAgentText: throws on max_tokens", () =>
  extractAgentText(
    { stop_reason: "max_tokens", content: [{ type: "text", text: "{partial" }] },
    "Test"
  )
);
expectThrow("extractAgentText: throws on empty content", () =>
  extractAgentText({ stop_reason: "end_turn", content: [] }, "Test")
);
expectThrow("extractAgentText: throws on whitespace content", () =>
  extractAgentText({ stop_reason: "end_turn", content: [{ type: "text", text: "   " }] }, "Test")
);

// isAbortError
expectEqual("isAbortError: AbortError name", isAbortError(new DOMException("aborted", "AbortError")), true);
expectEqual("isAbortError: arbitrary error", isAbortError(new Error("network failure")), false);
expectEqual("isAbortError: null", isAbortError(null), false);
expectEqual(
  "isAbortError: message contains 'aborted'",
  isAbortError({ message: "Request was aborted by the user" }),
  true
);

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll utils tests passed.");
