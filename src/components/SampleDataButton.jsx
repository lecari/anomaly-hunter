import { sampleCsvString } from "../data/sampleData";

export default function SampleDataButton({ onUse }) {
  return (
    <button
      type="button"
      onClick={() => onUse(sampleCsvString, "sample-personal-finance-2024.csv")}
      className="text-sm rounded-md border border-slate-700 bg-slate-900/60 px-4 py-2 text-slate-200 hover:bg-slate-800 hover:border-slate-600"
    >
      Try with sample data
    </button>
  );
}
