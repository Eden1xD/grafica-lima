/** Gráficos leves em SVG puro — sem bibliotecas externas, sem impacto no bundle. */

export function Bars({ data, height = 140 }: { data: Array<{ label: string; value: number }>; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / Math.max(1, data.length);
  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="h-36 w-full" role="img" aria-label="Gráfico de barras">
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 24);
          return (
            <g key={i}>
              <rect x={i * w + w * 0.22} y={height - 18 - h} width={w * 0.56} height={Math.max(2, h)} rx="1.5" fill="var(--brand)" opacity={0.85}>
                <title>{`${d.label}: ${d.value}`}</title>
              </rect>
            </g>
          );
        })}
        <line x1="0" y1={height - 17} x2="100" y2={height - 17} stroke="var(--line)" strokeWidth="0.5" />
      </svg>
      <div className="flex text-[10px] text-muted">
        {data.map((d, i) => (
          <span key={i} className="flex-1 truncate text-center">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Donut({ pct, size = 96, label }: { pct: number | null; size?: number; label?: string }) {
  const value = pct ?? 0;
  const r = 40;
  const c = 2 * Math.PI * r;
  const color = pct === null ? "var(--line)" : value >= 75 ? "var(--success)" : value >= 50 ? "var(--warn)" : "var(--danger)";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={label ?? `Percentual: ${value}%`}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--line)" strokeWidth="10" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 50 50)" />
      </svg>
      <span className="absolute text-lg font-bold text-ink">{pct === null ? "—" : `${value}%`}</span>
    </div>
  );
}