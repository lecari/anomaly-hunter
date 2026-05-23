// Deterministic sample generator for Anomaly Hunter.
// Produces a year of CHF transactions (2024) with embedded anomalies.
// Writes both the raw CSV and a JS module exporting it as a template literal.

const fs = require("fs");
const path = require("path");

// Mulberry32 deterministic PRNG.
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20240117);

function uniform(min, max) {
  return min + (max - min) * rand();
}
function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}
function pad(n) {
  return n < 10 ? "0" + n : "" + n;
}
function fmtDate(year, month1, day) {
  return `${year}-${pad(month1)}-${pad(day)}`;
}
function daysInMonth(year, month1) {
  return new Date(year, month1, 0).getDate();
}
function randomDay(year, month1) {
  return 1 + Math.floor(rand() * daysInMonth(year, month1));
}
function round2(x) {
  return Math.round(x * 100) / 100;
}

const merchants = {
  Groceries: ["Migros", "Coop", "Denner", "Aldi Suisse", "Lidl", "Manor Food", "Coop Pronto", "Spar"],
  Housing: ["Monthly rent"],
  Transport: ["SBB ticket", "ZVV monthly", "Shell fuel", "Migrol fuel", "Mobility carshare", "Taxi"],
  Restaurants: ["Burger Stop", "Pizzeria Roma", "Cafe Linde", "Sushi Bar", "Thai Kitchen", "Bistro Central", "Doner Imbiss", "Kebab Express", "Sandwich Co", "Brasserie"],
  Entertainment: ["Cinema Pathe", "Spotify", "Netflix", "Concert ticket", "Hallenbad", "Museum entry", "Theatre"],
  Health: ["Pharmacy Sun", "Pharmacy Plus", "Apotheke", "Optician"],
  Shopping: ["Zara", "H&M", "Galaxus", "Digitec", "Interdiscount", "Ikea", "Bookshop", "Decathlon", "Manor"],
  Travel: ["Booking.com", "Swiss Air", "Airbnb", "Hotel stay", "Trainline"],
};

const transactions = [];
const year = 2024;

// HOUSING — exactly one per month
for (let m = 1; m <= 12; m++) {
  transactions.push({
    date: fmtDate(year, m, 1),
    amount: round2(2200 + uniform(-15, 15)),
    category: "Housing",
    description: "Monthly rent",
  });
}

// GROCERIES — baseline ~7 tx/month at 30-150; Oct-Nov anomaly: tx count doubles, avg halves, total stays ~500
for (let m = 1; m <= 12; m++) {
  let count, perTxLow, perTxHigh, target;
  if (m === 10 || m === 11) {
    count = 14 + Math.floor(rand() * 3); // 14-16
    perTxLow = 25;
    perTxHigh = 55;
    target = 500;
  } else {
    count = 7 + Math.floor(rand() * 2); // 7-8
    perTxLow = 30;
    perTxHigh = 150;
    target = null;
  }
  let amounts = [];
  for (let i = 0; i < count; i++) amounts.push(uniform(perTxLow, perTxHigh));
  if (target !== null) {
    const sum = amounts.reduce((a, b) => a + b, 0);
    const scale = target / sum;
    amounts = amounts.map((a) => a * scale);
  }
  for (const a of amounts) {
    transactions.push({
      date: fmtDate(year, m, randomDay(year, m)),
      amount: round2(a),
      category: "Groceries",
      description: pick(merchants.Groceries),
    });
  }
}

// RESTAURANTS — acceleration: Jan ~5 tx × ~40 → Dec ~10 tx × ~65
for (let m = 1; m <= 12; m++) {
  const t = (m - 1) / 11; // 0..1
  const txCount = Math.round(5 + 5 * t); // 5..10
  const avg = 40 + 25 * t; // 40..65
  for (let i = 0; i < txCount; i++) {
    transactions.push({
      date: fmtDate(year, m, randomDay(year, m)),
      amount: round2(avg + uniform(-12, 12)),
      category: "Restaurants",
      description: pick(merchants.Restaurants),
    });
  }
}

// TRANSPORT — 20-25 tx/month, 20-80 (commute + occasional)
for (let m = 1; m <= 12; m++) {
  const count = 20 + Math.floor(rand() * 6);
  for (let i = 0; i < count; i++) {
    transactions.push({
      date: fmtDate(year, m, randomDay(year, m)),
      amount: round2(uniform(20, 80)),
      category: "Transport",
      description: pick(merchants.Transport),
    });
  }
}

// ENTERTAINMENT — 4-6 tx/month
for (let m = 1; m <= 12; m++) {
  const count = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < count; i++) {
    transactions.push({
      date: fmtDate(year, m, randomDay(year, m)),
      amount: round2(uniform(12, 70)),
      category: "Entertainment",
      description: pick(merchants.Entertainment),
    });
  }
}

// HEALTH — 1-2 tx/month, 80-300; August anomaly inserted below
for (let m = 1; m <= 12; m++) {
  const count = 1 + Math.floor(rand() * 2);
  for (let i = 0; i < count; i++) {
    transactions.push({
      date: fmtDate(year, m, randomDay(year, m)),
      amount: round2(uniform(80, 300)),
      category: "Health",
      description: pick(merchants.Health),
    });
  }
}
// HEALTH OUTLIER in August
transactions.push({
  date: fmtDate(year, 8, 14),
  amount: 1850.0,
  category: "Health",
  description: "Dental procedure",
});

// SHOPPING — weight shift Jan-Jun ~8% of monthly total → Jul-Dec ~16%.
// Monthly totals across other categories ~3500-4500 (rent dominates). Use rough share targets.
function monthlyOtherTotal(m) {
  // estimate by summing previously generated transactions for this month
  return transactions
    .filter((tx) => parseInt(tx.date.slice(5, 7), 10) === m && tx.category !== "Shopping" && tx.category !== "Travel")
    .reduce((s, tx) => s + tx.amount, 0);
}

for (let m = 1; m <= 12; m++) {
  const targetShare = m <= 6 ? 0.08 : 0.16;
  const otherTotal = monthlyOtherTotal(m);
  // share s of (other + shopping) total → shopping = s/(1-s) * other
  const shoppingTarget = (targetShare / (1 - targetShare)) * otherTotal;
  const count = 3 + Math.floor(rand() * 4); // 3-6
  let amounts = [];
  for (let i = 0; i < count; i++) amounts.push(uniform(20, 200));
  const sum = amounts.reduce((a, b) => a + b, 0);
  const scale = shoppingTarget / sum;
  amounts = amounts.map((a) => a * scale);
  for (const a of amounts) {
    transactions.push({
      date: fmtDate(year, m, randomDay(year, m)),
      amount: round2(Math.max(15, a)),
      category: "Shopping",
      description: pick(merchants.Shopping),
    });
  }
}

// TRAVEL — occasional, larger amounts. ~6-10 transactions over the year.
const travelMonths = [3, 5, 7, 7, 9, 12];
for (const m of travelMonths) {
  transactions.push({
    date: fmtDate(year, m, randomDay(year, m)),
    amount: round2(uniform(180, 650)),
    category: "Travel",
    description: pick(merchants.Travel),
  });
}

// Sort by date.
transactions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

// Emit CSV
const header = "date,amount,category,description";
const rows = transactions.map(
  (tx) => `${tx.date},${tx.amount.toFixed(2)},${tx.category},${tx.description.replace(/,/g, " ")}`
);
const csv = [header, ...rows].join("\n");

// Quick stats for sanity
const byMonthCategory = {};
for (const tx of transactions) {
  const m = tx.date.slice(0, 7);
  byMonthCategory[m] = byMonthCategory[m] || {};
  byMonthCategory[m][tx.category] = (byMonthCategory[m][tx.category] || 0) + tx.amount;
}
console.error(`Total transactions: ${transactions.length}`);
const months = Object.keys(byMonthCategory).sort();
for (const m of months) {
  const cats = byMonthCategory[m];
  const total = Object.values(cats).reduce((a, b) => a + b, 0);
  console.error(
    `${m}  total=${total.toFixed(0)}  Rest=${(cats.Restaurants || 0).toFixed(0)}  Shop=${(cats.Shopping || 0).toFixed(0)}  Groc=${(cats.Groceries || 0).toFixed(0)}  Health=${(cats.Health || 0).toFixed(0)}`
  );
}

// Write JS module
const outPath = path.join(__dirname, "..", "src", "data", "sampleData.js");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
const moduleContent = `// Auto-generated by scripts/generateSample.cjs — do not edit by hand.
// Deterministic personal-finance dataset (CHF, calendar year 2024) with embedded anomalies.
// One example of the kind of CSV Anomaly Hunter handles; the app works with any tabular CSV.

export const sampleCsvString = \`${csv}\`;
`;
fs.writeFileSync(outPath, moduleContent);
console.error(`\nWrote ${outPath} (${moduleContent.length} bytes)`);
