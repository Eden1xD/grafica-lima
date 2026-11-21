import type { Metadata } from "next";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { getCatalog } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { createLeadAction } from "@/server/actions/public";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, Select, Textarea } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contato" };

export default async function ContatoPage() {
  const cfg = await getSettings();
  const { items } = await getCatalog({ pageSize: 50 });
  const inst = cfg.institution;
  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <p className="text-xs font-bold uppercase tracking-widest text-brand">Contato</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">Fale com a gente</h1>
      <p className="mt-2 max-w-xl text-muted">Tire dúvidas sobre cursos, turmas, valores e matrículas. Respondemos em horário de atendimento.</p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <Card className="space-y-4 p-6 text-sm">
            {inst.address ? <p className="flex gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" /><span className="text-ink">{inst.address}{inst.city ? ` — ${inst.city}` : ""}</span></p> : null}
            {inst.phone ? <p className="flex gap-3"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-brand" /><span className="text-ink">{inst.phone}</span></p> : null}
            {inst.email ? <p className="flex gap-3"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand" /><span className="break-all text-ink">{inst.email}</span></p> : null}
            <p className="flex gap-3"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand" /><span className="text-ink">{inst.hours}</span></p>
            {inst.whatsapp ? (
              <a href={`https://wa.me/${inst.whatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl bg-success px-4 text-sm font-semibold text-white transition hover:opacity-90">
                <MessageCircle className="h-4 w-4" /> Chamar no WhatsApp
              </a>
            ) : null}
          </Card>
          {inst.mapsQuery ? (
            <Card className="overflow-hidden">
              <iframe title="Mapa da unidade" src={`https://www.google.com/maps?q=${encodeURIComponent(inst.mapsQuery)}&output=embed`} className="h-64 w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            </Card>
          ) : null}
        </div>

        <Card className="p-6">
          <h2 className="font-bold text-ink">Envie uma mensagem</h2>
          <p className="mt-1 text-sm text-muted">Sua mensagem vira um atendimento para nossa equipe comercial.</p>
          <ActionForm action={createLeadAction} submitLabel="Enviar mensagem" className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Nome completo"><Input name="name" required minLength={3} autoComplete="name" placeholder="Seu nome" /></Field>
            <Field label="E-mail"><Input name="email" type="email" required autoComplete="email" placeholder="voce@email.com" /></Field>
            <Field label="Telefone / WhatsApp (opcional)"><Input name="phone" autoComplete="tel" placeholder="(00) 00000-0000" /></Field>
            <Field label="Curso de interesse (opcional)">
              <Select name="courseId" defaultValue="">
                <option value="">Ainda não sei</option>
                {items.map((i) => (
                  <option key={i.course.id} value={i.course.id}>{i.course.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Mensagem" className="sm:col-span-2"><Textarea name="message" required minLength={5} rows={4} placeholder="Como podemos ajudar?" /></Field>
            <p className="text-xs text-muted sm:col-span-2">Ao enviar, você concorda com o tratamento dos dados para retorno do contato, conforme a <a className="text-brand underline" href="/privacidade">Política de Privacidade</a>.</p>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}