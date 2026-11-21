import { cn } from "@/lib/utils";

/** Monograma GL institucional em vetor, nas cores oficiais da marca. */
export function LogoMark({ className, size = 40 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Gráfica Lima" className={cn("shrink-0", className)}>
      <rect x="1" y="1" width="62" height="62" rx="14" fill="#EAF3E9" />
      <rect x="1" y="1" width="62" height="62" rx="14" fill="none" stroke="#ACD0A8" strokeWidth="1.5" />
      <text x="9" y="46" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700" fontSize="36" fill="#07585B">G</text>
      <text x="29" y="50" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700" fontSize="36" fill="#087F80">L</text>
      <g transform="translate(45 10)">
        <rect x="0" y="0" width="5.5" height="5.5" rx="1" transform="rotate(45 2.75 2.75)" fill="#E8A23D" />
        <rect x="8" y="0" width="5.5" height="5.5" rx="1" transform="rotate(45 10.75 2.75)" fill="#3B82C4" />
        <rect x="0" y="8" width="5.5" height="5.5" rx="1" transform="rotate(45 2.75 10.75)" fill="#57A89C" />
        <rect x="8" y="8" width="5.5" height="5.5" rx="1" transform="rotate(45 10.75 10.75)" fill="#E5C04A" />
      </g>
    </svg>
  );
}

export function Logo({ className, onDark = false, size = 40 }: { className?: string; onDark?: boolean; size?: number }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      <span className="flex flex-col leading-none">
        <span className={cn("font-semibold tracking-tight", onDark ? "text-white" : "text-ink")} style={{ fontSize: size * 0.42 }}>
          Gráfica Lima
        </span>
        <span className={cn("uppercase tracking-[0.18em]", onDark ? "text-sage" : "text-muted")} style={{ fontSize: Math.max(8, size * 0.21), marginTop: size * 0.09 }}>
          Produtos e Informática
        </span>
      </span>
    </span>
  );
}