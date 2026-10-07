export function AuthIllustration() {
  return (
    <div className="relative mx-auto mt-12 max-w-lg" aria-label="Illustration of connected blood network signals">
      <div className="absolute inset-8 rounded-full border border-red-200/20" />
      <div className="absolute inset-16 rounded-full border border-red-200/15" />
      <svg viewBox="0 0 520 320" role="img" className="relative w-full overflow-visible">
        <path d="M75 188C144 74 216 248 290 128S402 75 462 154" fill="none" stroke="rgba(242,228,226,.42)" strokeWidth="1.5" strokeDasharray="5 8" />
        <path d="M78 188C164 211 228 76 311 195S405 247 462 154" fill="none" stroke="rgba(180,35,24,.7)" strokeWidth="1.5" />
        <path d="M78 188C164 211 228 76 311 195S405 247 462 154" fill="none" stroke="rgba(242,228,226,.75)" strokeWidth="1" strokeDasharray="2 12" />
        {[
          ["75", "188", "Hospital"],
          ["177", "115", "Request"],
          ["290", "128", "AI signal"],
          ["350", "210", "Blood bank"],
          ["462", "154", "Response"],
        ].map(([cx, cy, label], index) => (
          <g key={label}>
            <circle cx={cx} cy={cy} r={index === 2 ? "12" : "8"} fill={index === 2 ? "#b42318" : "#f7f5f2"} stroke={index === 2 ? "#f2e4e2" : "#d99b94"} strokeWidth="2" />
            {index === 2 && <circle cx={cx} cy={cy} r="4" fill="#fff" />}
            <text x={cx} y={Number(cy) + 30} textAnchor="middle" fill="rgba(255,255,255,.62)" fontSize="10" fontFamily="Arial, sans-serif">{label}</text>
          </g>
        ))}
      </svg>
      <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[0.65rem] font-medium text-red-100">
        <span className="size-1.5 animate-pulse-soft rounded-full bg-emerald-300" />
        Network intelligence ready
      </div>
    </div>
  );
}
