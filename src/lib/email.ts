
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailOutbox } from "@/db/schema";

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const [row] = await db
    .insert(emailOutbox)
    .values({ toEmail: to, subject, html })
    .returning();

  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.EMAIL_FROM ??
    "Gráfica Lima <onboarding@resend.dev>";

  if (!apiKey) {
    await db
      .update(emailOutbox)
      .set({
        status: "dev_caixa_saida",
        error: "RESEND_API_KEY não configurada.",
      })
      .where(eq(emailOutbox.id, row.id));

    console.error("[EMAIL] RESEND_API_KEY não configurada.");
    return;
  }

  try {
    const response = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          html,
        }),
        cache: "no-store",
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.message ??
          `Erro Resend: HTTP ${response.status}`
      );
    }

    await db
      .update(emailOutbox)
      .set({
        status: "enviado",
        sentAt: new Date(),
        error: null,
      })
      .where(eq(emailOutbox.id, row.id));

    console.info(
      "[EMAIL] Aceito pelo Resend:",
      result.id
    );
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Erro desconhecido";

    await db
      .update(emailOutbox)
      .set({
        status: "falhou",
        error: message.slice(0, 500),
      })
      .where(eq(emailOutbox.id, row.id));

    console.error("[EMAIL] Falha no envio:", message);
  }
}

export function emailTemplate(
  title: string,
  body: string,
  cta?: { label: string; url: string }
): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#173331">
      <div style="background:#07585B;border-radius:12px;padding:20px 24px;color:#EAF3E9">
        <strong style="font-size:18px">Gráfica Lima</strong>
        <div style="font-size:12px;opacity:.8">Produtos e Informática</div>
      </div>

      <h1 style="font-size:20px;margin:24px 0 8px">${title}</h1>

      <p style="line-height:1.6;color:#3c554f">${body}</p>

      ${
        cta
          ? `<a href="${cta.url}"
              style="display:inline-block;margin:16px 0;background:#087F80;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">
              ${cta.label}
            </a>`
          : ""
      }

      <p style="font-size:12px;color:#64746E;margin-top:32px">
        Você recebe este e-mail porque possui cadastro na plataforma
        Gráfica Lima. Se não foi você, ignore esta mensagem.
      </p>
    </div>
  `;
}
