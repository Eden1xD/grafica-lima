/**
 * Regras de negócio puras — testadas em src/lib/__tests__/domain.test.ts
 * Valores financeiros em centavos inteiros; notas em centésimos (8,5 => 850).
 */

export type CouponRule = {
  type: "percentual" | "fixo";
  value: number;
  active: boolean;
  validUntil: string | null;
  maxUses: number | null;
  usedCount: number;
  minTotalCents: number;
};

export function applyCoupon(
  totalCents: number,
  coupon: CouponRule,
  todayIso: string,
): { ok: true; discountCents: number } | { ok: false; reason: string } {
  if (!coupon.active) return { ok: false, reason: "Cupom inativo." };
  if (coupon.validUntil && coupon.validUntil < todayIso) return { ok: false, reason: "Cupom expirado." };
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) return { ok: false, reason: "Cupom esgotado." };
  if (totalCents < coupon.minTotalCents) return { ok: false, reason: "Valor mínimo não atingido para este cupom." };
  const discount =
    coupon.type === "percentual"
      ? Math.round((totalCents * Math.min(Math.max(coupon.value, 0), 100)) / 100)
      : Math.min(coupon.value, totalCents);
  return { ok: true, discountCents: Math.min(discount, totalCents) };
}

/** Divide o valor em entrada + N mensalidades iguais (soma exata em centavos). */
export function splitInstallments(
  totalCents: number,
  entryCents: number,
  months: number,
): { entryCents: number; installments: number[] } {
  const entry = Math.max(0, Math.min(entryCents, totalCents));
  const rest = totalCents - entry;
  const n = Math.max(1, Math.floor(months));
  const base = Math.floor(rest / n);
  const arr = Array.from({ length: n }, () => base);
  arr[n - 1] += rest - base * n;
  return { entryCents: entry, installments: arr };
}

export function weightedAverageH(items: Array<{ scoreH: number; weightH: number }>): number | null {
  const valid = items.filter((i) => i.weightH > 0);
  if (valid.length === 0) return null;
  const totalWeight = valid.reduce((s, i) => s + i.weightH, 0);
  const sum = valid.reduce((s, i) => s + i.scoreH * i.weightH, 0);
  return Math.round(sum / totalWeight);
}

export function attendanceStats(records: Array<{ status: "presente" | "ausente" | "justificado" }>): {
  total: number;
  present: number;
  justified: number;
  pct: number | null;
} {
  const total = records.length;
  const present = records.filter((r) => r.status === "presente").length;
  const justified = records.filter((r) => r.status === "justificado").length;
  return { total, present, justified, pct: total === 0 ? null : Math.round((present / total) * 100) };
}

export function certificateEligibility(input: {
  concluded: boolean;
  avgH: number | null;
  minGradeH: number;
  attendancePct: number | null;
  minAttendancePct: number;
}): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!input.concluded) reasons.push("Matrícula ainda não concluída.");
  if (input.avgH === null) reasons.push("Sem notas publicadas suficientes.");
  else if (input.avgH < input.minGradeH) reasons.push("Média final abaixo do mínimo exigido.");
  if (input.attendancePct === null) reasons.push("Sem registros de frequência.");
  else if (input.attendancePct < input.minAttendancePct) reasons.push("Frequência abaixo do mínimo exigido.");
  return { eligible: reasons.length === 0, reasons };
}

export function isMinor(birthDateIso: string, todayIso: string): boolean {
  const [by, bm, bd] = birthDateIso.split("-").map(Number);
  const [ty, tm, td] = todayIso.split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age < 18;
}

export function isValidCpf(raw: string): boolean {
  const cpf = raw.replace(/\D+/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

/** Gera as datas de aula de uma turma entre início e fim nos dias da semana configurados. */
export function generateSessionDates(startIso: string, endIso: string, daysOfWeek: number[]): string[] {
  if (daysOfWeek.length === 0 || endIso < startIso) return [];
  const out: string[] = [];
  const [y, m, d] = startIso.split("-").map(Number);
  const cur = new Date(Date.UTC(y, m - 1, d));
  const end = new Date(endIso + "T00:00:00Z");
  let guard = 0;
  while (cur <= end && guard < 800) {
    if (daysOfWeek.includes(cur.getUTCDay())) out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
    guard++;
  }
  return out;
}

export function seatCountLabel(capacity: number, taken: number): { available: number; full: boolean } {
  const available = Math.max(0, capacity - taken);
  return { available, full: available === 0 };
}