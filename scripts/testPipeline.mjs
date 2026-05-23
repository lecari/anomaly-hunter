// End-to-end simulation of the non-LLM portion of the pipeline against the
// actual sampleCsvString. We don't hit Anthropic — we just verify that every
// utility on the data path produces sensible output.
import { sampleCsvString } from "../src/data/sampleData.js";
import {
  truncateCsv,
  countCsvRows,
  buildUserContextBlock,
  stripBom,
} from "../src/agents/utils.js";

let failures = 0;
function assert(label, cond, detail = "") {
  if (cond) {
    console.log(`OK    ${label}`);
  } else {
    failures++;
    console.error(`FAIL  ${label}  ${detail}`);
  }
}

// 1. sampleCsvString — exists, has header + many rows
assert("sampleCsvString defined", typeof sampleCsvString === "string" && sampleCsvString.length > 0);
assert("sampleCsvString has no BOM", sampleCsvString.charCodeAt(0) !== 0xfeff);
const headerLine = sampleCsvString.split("\n", 1)[0];
assert(
  "sampleCsvString header is canonical",
  headerLine === "date,amount,category,description",
  `got: ${headerLine}`
);

// 2. countCsvRows on sample
const rowCount = countCsvRows(sampleCsvString);
assert("sample row count in 600–900 range", rowCount >= 600 && rowCount <= 900, `rows=${rowCount}`);

// 3. truncateCsv leaves sample untruncated (it fits in 60K)
const inspectorSample = truncateCsv(sampleCsvString, 60000);
assert("Inspector view untruncated (sample fits)", inspectorSample.length === sampleCsvString.length);

// 4. truncateCsv at smaller cap preserves header
const tinyCap = truncateCsv(sampleCsvString, 5000);
const tinyHeader = tinyCap.split("\n", 1)[0];
assert("truncateCsv preserves header at 5K cap", tinyHeader === "date,amount,category,description");
assert("truncateCsv produces marker when truncated", tinyCap.includes("[... truncated;"));

// 5. validateCsv (inline copy, mirrors App.jsx)
function validateCsv(csv) {
  if (typeof csv !== "string" || csv.trim().length === 0) return "empty";
  const clean = csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv;
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return "too-short";
  const header = lines[0];
  if (!header.includes(",") && !header.includes(";") && !header.includes("\t")) return "no-delim";
  return null;
}
assert("validateCsv accepts sample", validateCsv(sampleCsvString) === null);
assert("validateCsv rejects empty", validateCsv("") === "empty");
assert("validateCsv rejects header-only", validateCsv("date,amount\n") === "too-short");
assert("validateCsv rejects pipe-delimited (no expected delim)", validateCsv("a|b\n1|2\n") === "no-delim");

// 6. buildUserContextBlock with the app's default userContext
const defaultCtx = { domainHint: null, analyticalObjective: null, notes: null, audience: "general" };
const block = buildUserContextBlock(defaultCtx);
assert("buildUserContextBlock keeps audience=general", block.includes('"audience": "general"'));
assert(
  "buildUserContextBlock drops null fields",
  !block.includes("domainHint") && !block.includes("analyticalObjective") && !block.includes("notes")
);

// 7. stripBom passthrough on sample
assert("stripBom on sample equals identity", stripBom(sampleCsvString) === sampleCsvString);

// 8. Sample contains the four embedded anomaly markers
const sampleAug = sampleCsvString.split("\n").filter((l) => l.startsWith("2024-08"));
const dentalRow = sampleAug.find((l) => l.includes("Dental procedure") && l.includes("1850"));
assert("sample contains the 1850 dental procedure in August", !!dentalRow);

const restJan = sampleCsvString
  .split("\n")
  .filter((l) => l.startsWith("2024-01") && l.includes(",Restaurants,"));
const restDec = sampleCsvString
  .split("\n")
  .filter((l) => l.startsWith("2024-12") && l.includes(",Restaurants,"));
assert(
  "restaurant acceleration: Dec > Jan transaction count",
  restDec.length > restJan.length,
  `Jan=${restJan.length} Dec=${restDec.length}`
);

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nPipeline simulation passed.");
