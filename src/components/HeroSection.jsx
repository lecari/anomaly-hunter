export default function HeroSection({ headingRef }) {
  return (
    <header className="text-center pt-12 pb-6">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-5xl md:text-6xl font-semibold tracking-tight text-white focus:outline-none"
      >
        Anomaly Hunter
      </h1>
      <p className="mt-3 text-lg text-slate-400">
        Multi-agent anomaly detection for any tabular dataset
      </p>
      <p className="mt-6 max-w-3xl mx-auto text-slate-300 leading-relaxed">
        Upload any CSV and a coordinated team of 7 expert AI agents will autonomously
        profile your data, design an analytical strategy, hunt for anomalies in parallel
        using state-of-the-art methodologies, and surface what matters most — including
        patterns you might not have thought to look for.
      </p>
    </header>
  );
}
