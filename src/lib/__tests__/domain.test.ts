import { describe, expect, it } from "vitest";
import {
  applyCoupon, attendanceStats, certificateEligibility, generateSessionDates,
  isMinor, isValidCpf, seatCountLabel, splitInstallments, weightedAverageH,
} from "../domain";
import { addMonthsISO, parseMoneyToCents, parseScoreToHundredths, slugify } from "../utils";

const baseCoupon = { type: "percentual" as const, value: 10, active: true, validUntil: null, maxUses: null, usedCount: 0, minTotalCents: 0 };

describe("cupons", () => {
  it("aplica percentual corretamente", () => {
    const r = applyCoupon(69000, baseCoupon, "2026-01-15");
    expect(r).toEqual({ ok: true, discountCents: 6900 });
  });
  it("cupom fixo nunca excede o total", () => {
    const r = applyCoupon(5000, { ...baseCoupon, type: "fixo", value: 9000 }, "2026-01-15");
    expect(r.ok && r.discountCents).toBe(5000);
  });
  it("rejeita cupom expirado, inativo, esgotado e abaixo do mínimo", () => {
    expect(applyCoupon(1000, { ...baseCoupon, validUntil: "2026-01-01" }, "2026-01-15").ok).toBe(false);
    expect(applyCoupon(1000, { ...baseCoupon, active: false }, "2026-01-15").ok).toBe(false);
    expect(applyCoupon(1000, { ...baseCoupon, maxUses: 5, usedCount: 5 }, "2026-01-15").ok).toBe(false);
    expect(applyCoupon(1000, { ...baseCoupon, minTotalCents: 2000 }, "2026-01-15").ok).toBe(false);
  });
});

describe("parcelamento (integridade financeira em centavos)", () => {
  it("soma das parcelas + entrada é exatamente o total", () => {
    const { entryCents, installments } = splitInstallments(69000, 12000, 4);
    expect(entryCents + installments.reduce((a, b) => a + b, 0)).toBe(69000);
    expect(installments).toHaveLength(4);
  });
  it("distribui o resto na última parcela", () => {
    const { installments } = splitInstallments(10000, 0, 3);
    expect(installments.reduce((a, b) => a + b, 0)).toBe(10000);
    expect(installments[2]).toBe(installments[0] + 1);
    const odd = splitInstallments(10001, 0, 3).installments;
    expect(odd.reduce((a, b) => a + b, 0)).toBe(10001);
    expect(odd[2]).toBe(odd[0] + 2);
  });
  it("entrada nunca excede o total", () => {
    const r = splitInstallments(1000, 5000, 2);
    expect(r.entryCents).toBe(1000);
    expect(r.installments.reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe("notas e frequência", () => {
  it("média ponderada", () => {
    expect(weightedAverageH([{ scoreH: 850, weightH: 100 }, { scoreH: 700, weightH: 300 }])).toBe(738);
    expect(weightedAverageH([])).toBeNull();
  });
  it("frequência: falta justificada não conta como presença", () => {
    const s = attendanceStats([{ status: "presente" }, { status: "presente" }, { status: "justificado" }, { status: "ausente" }]);
    expect(s.pct).toBe(50);
    expect(s.total).toBe(4);
  });
  it("elegibilidade de certificado exige conclusão, média e frequência", () => {
    const ok = certificateEligibility({ concluded: true, avgH: 800, minGradeH: 700, attendancePct: 80, minAttendancePct: 75 });
    expect(ok.eligible).toBe(true);
    const bad = certificateEligibility({ concluded: false, avgH: 600, minGradeH: 700, attendancePct: 50, minAttendancePct: 75 });
    expect(bad.eligible).toBe(false);
    expect(bad.reasons.length).toBe(3);
  });
});

describe("CPF e menoridade", () => {
  it("valida CPF com dígitos verificadores", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("529.982.247-26")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
  });
  it("detecta menor de 18 na data de referência", () => {
    expect(isMinor("2010-06-15", "2026-01-15")).toBe(true);
    expect(isMinor("2008-01-10", "2026-01-15")).toBe(false);
    expect(isMinor("2008-02-01", "2026-01-15")).toBe(true);
  });
});

describe("calendário e vagas", () => {
  it("gera aulas apenas nos dias configurados", () => {
    const dates = generateSessionDates("2026-02-02", "2026-02-15", [1, 3]); // seg e qua
    expect(dates).toEqual(["2026-02-02", "2026-02-04", "2026-02-09", "2026-02-11"]);
  });
  it("período inválido não gera aulas", () => {
    expect(generateSessionDates("2026-02-15", "2026-02-01", [1])).toEqual([]);
  });
  it("controle de vagas", () => {
    expect(seatCountLabel(15, 15)).toEqual({ available: 0, full: true });
    expect(seatCountLabel(15, 12).available).toBe(3);
  });
});

describe("parsing e formatação", () => {
  it("valores monetários pt-BR", () => {
    expect(parseMoneyToCents("1.234,56")).toBe(123456);
    expect(parseMoneyToCents("R$ 890,00")).toBe(89000);
    expect(parseMoneyToCents("1234.56")).toBe(123456);
    expect(parseMoneyToCents("abc")).toBeNull();
    expect(parseMoneyToCents("-5")).toBeNull();
  });
  it("notas com vírgula", () => {
    expect(parseScoreToHundredths("8,5")).toBe(850);
    expect(parseScoreToHundredths("10")).toBe(1000);
  });
  it("slug e datas", () => {
    expect(slugify("Informática Essencial")).toBe("informatica-essencial");
    expect(addMonthsISO("2026-01-31", 1)).toBe("2026-02-28");
  });
});