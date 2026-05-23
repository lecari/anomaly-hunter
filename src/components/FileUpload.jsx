import { useRef, useState } from "react";

export default function FileUpload({ onLoaded, fileName, onClear }) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  function readFile(file) {
    setError("");
    if (!file) return;
    const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";
    if (!isCsv) {
      setError("Please drop a .csv file.");
      onClear?.();
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onLoaded(String(reader.result || ""), file.name);
    reader.onerror = () => {
      setError("Could not read the file.");
      onClear?.();
    };
    reader.readAsText(file);
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-200">Data (CSV)</label>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a CSV file: drag and drop, or activate to browse"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          readFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`mt-2 rounded-md border-2 border-dashed cursor-pointer transition px-4 py-6 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
          dragOver ? "border-indigo-400 bg-indigo-500/5" : "border-slate-700 bg-slate-900/40 hover:bg-slate-900/70"
        }`}
      >
        {fileName ? (
          <div className="flex items-center justify-center gap-3 text-sm">
            <span className="text-slate-200">Loaded: <span className="font-mono">{fileName}</span></span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear?.();
              }}
              className="text-xs text-slate-400 underline hover:text-slate-200"
            >
              clear
            </button>
          </div>
        ) : (
          <div>
            <div className="text-sm text-slate-200">Drag & drop a CSV here, or click to browse</div>
            <div className="text-xs text-slate-500 mt-1">
              CSV with headers; date column recommended; works with 50+ rows
            </div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            readFile(f);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
    </div>
  );
}
