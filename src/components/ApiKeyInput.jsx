import { useState } from "react";

export default function ApiKeyInput({ value, onChange }) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <label htmlFor="api-key-input" className="block text-sm font-medium text-slate-200">
        Anthropic API key
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="api-key-input"
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="sk-ant-..."
          spellCheck={false}
          autoComplete="off"
          className="flex-1 rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="button"
          aria-pressed={show}
          aria-label={show ? "Hide API key" : "Show API key"}
          onClick={() => setShow((v) => !v)}
          className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500 leading-snug">
        Held in memory only for this session, used solely to call Anthropic's API directly from
        your browser, never stored elsewhere.
      </p>
    </div>
  );
}
