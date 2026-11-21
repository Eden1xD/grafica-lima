"use server";

import { z } from "zod";
import { db } from "@/db";
import { leads, privacyRequests } from "@/db/schema";
import { limitAuth } from "@/lib/auth/rate-limit";
import { notify, userIdsByRole } from "@/lib/notifications";
import { type ActionState, errorToState, fail, ok, str, strOrNull } from "./types";

export async function createLeadAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    if (!(await limitAuth("lead", 5))) return fail("Muitas mensagens enviadas. Aguarde alguns minutos.");
    const name = str(fd, "name");
    const email = str(fd, "email").toLowerCase();
    const message = str(fd, "message");
    if (name.length < 3) return fail("Informe seu nome.");
    if (!z.string().email().safeParse(email).success) return fail("E-mail inválido.");
    if (message.length < 5) return fail("Escreva sua mensagem.");
    await db.insert(leads).values({
      name,
      email,
      phone: strOrNull(fd, "phone"),
      message,
      courseId: strOrNull(fd, "courseId"),
    });
    const staff = await userIdsByRole(["admin", "secretaria"]);
    await notify(staff, { type: "comercial", title: "Novo interessado pelo site", body: name, link: "/admin/leads" });
    return ok("Mensagem enviada! Nossa equipe entrará em contato em breve.");
  } catch (err) {
    return errorToState(err);
  }
}

export async function createPrivacyRequestAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    if (!(await limitAuth("privacy", 5))) return fail("Muitas solicitações. Aguarde alguns minutos.");
    const name = str(fd, "name");
    const email = str(fd, "email").toLowerCase();
    const type = z.enum(["acesso", "correcao", "eliminacao", "exportacao", "informacao"]).parse(str(fd, "type"));
    if (name.length < 3) return fail("Informe seu nome.");
    if (!z.string().email().safeParse(email).success) return fail("E-mail inválido.");
    await db.insert(privacyRequests).values({ name, email, type, message: str(fd, "message") });
    const admins = await userIdsByRole(["admin"]);
    await notify(admins, { type: "lgpd", title: "Nova solicitação LGPD", body: `Tipo: ${type}`, link: "/admin/privacidade" });
    return ok("Solicitação registrada. Responderemos pelo e-mail informado, conforme os prazos da LGPD.");
  } catch (err) {
    return errorToState(err);
  }
}