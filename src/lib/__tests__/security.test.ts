import { createHmac } from "crypto";
import { afterEach, describe, expect, it } from "vitest";
import { verifyWebhookSignature } from "../payments/mercadopago";
import { hashPassword, verifyPassword } from "../auth/password";
import { hashToken, randomCode, randomToken } from "../crypto";
import { safeNext } from "../auth/session-utils";

describe("webhook Mercado Pago — assinatura x-signature", () => {
  const secret = "test-secret-123";
  afterEach(() => {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
  });
  it("aceita assinatura HMAC válida (manifest id/request-id/ts)", () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = secret;
    const ts = "1700000000000";
    const manifest = `id:abc123;request-id:req-1;ts:${ts};`;
    const v1 = createHmac("sha256", secret).update(manifest).digest("hex");
    expect(verifyWebhookSignature({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: "req-1", dataId: "ABC123" })).toBe(true);
  });
  it("rejeita assinatura adulterada, ausente ou sem segredo", () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = secret;
    expect(verifyWebhookSignature({ xSignature: "ts=1,v1=deadbeef", xRequestId: "r", dataId: "123" })).toBe(false);
    expect(verifyWebhookSignature({ xSignature: null, xRequestId: null, dataId: "123" })).toBe(false);
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    expect(verifyWebhookSignature({ xSignature: "ts=1,v1=x", xRequestId: null, dataId: "123" })).toBe(false);
  });
});

describe("senhas Argon2id", () => {
  it("hash verifica a senha correta e rejeita a errada", async () => {
    const h = await hashPassword("SenhaForte@123");
    expect(h.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(h, "SenhaForte@123")).toBe(true);
    expect(await verifyPassword(h, "senhaErrada")).toBe(false);
  }, 20000);
});

describe("tokens de sessão", () => {
  it("token opaco aleatório e hash determinístico", () => {
    const t = randomToken();
    expect(t.length).toBeGreaterThanOrEqual(40);
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toBe(t);
    expect(randomToken()).not.toBe(t);
  });
  it("código de certificado sem caracteres ambíguos", () => {
    const c = randomCode(12);
    expect(c).toHaveLength(12);
    expect(c).toMatch(/^[A-HJ-NP-Z2-9]+$/);
  });
});

describe("open redirect", () => {
  it("bloqueia destinos externos e protocol-relative", () => {
    expect(safeNext("https://evil.com", "/aluno")).toBe("/aluno");
    expect(safeNext("//evil.com", "/aluno")).toBe("/aluno");
    expect(safeNext("/admin\\evil", "/aluno")).toBe("/aluno");
    expect(safeNext("/aluno/notas", "/aluno")).toBe("/aluno/notas");
    expect(safeNext(null, "/aluno")).toBe("/aluno");
  });
});