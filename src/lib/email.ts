import nodemailer from "nodemailer";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailOutbox } from "@/db/schema";
import { smtpConfigured } from "@/lib/settings";

/**
 * E-mail transacional real via SMTP quando configurado (SMTP_URL).
 * Sem SMTP, a mensagem fica na caixa de saída auditável do admin
 * (status "dev_caixa_saida") — nunca fingimos envio.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const [row] = await db.insert(emailOutbox).values({ toEmail: to, subject, html }).returning();
  if (!smtpConfigured()) {
    await db.update(emailOutbox).set({ status: "dev_caixa_saida" }).where(eq(emailOutbox.id, row.id));
    return;
  }
  try {
    const transport = nodemailer.createTransport(process.env.SMTP_URL as string);
    await transport.sendMail({
      from: process.env.EMAIL_FROM ?? "Gráfica Lima <nao-responder@graficalima.com.br>",
      to,
      subject,
      html,
    });
    await db.update(emailOutbox).set({ status: "enviado", sentAt: new Date() }).where(eq(emailOutbox.id, row.id));
  } catch (err) {
    await db
      .update(emailOutbox)
      .set({ status: "falhou", error: err instanceof Error ? err.message.slice(0, 500) : "erro" })
      .where(eq(emailOutbox.id, row.id));
  }
}

export function emailTemplate(title: string, body: string, cta?: { label: string; url: string }): string {
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#173331">
  <div style="background:#07585B;border-radius:12px;padding:20px 24px;color:#EAF3E9">
    <strong style="font-size:18px">Gráfica Lima</strong>
    <div style="font-size:12px;opacity:.8">Produtos e Informática</div>
  </div>
  <h1 style="font-size:20px;margin:24px 0 8px">${title}</h1>
  <p style="line-height:1.6;color:#3c554f">${body}</p>
  ${cta ? `<a href="${cta.url}" style="display:inline-block;margin:16px 0;background:#087F80;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">${cta.label}</a>` : ""}
  <p style="font-size:12px;color:#64746E;margin-top:32px">Você recebe este e-mail porque possui cadastro na plataforma Gráfica Lima. Se não foi você, ignore esta mensagem.</p>
</div>`;
}