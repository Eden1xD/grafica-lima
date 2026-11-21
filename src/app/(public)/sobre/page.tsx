import type { Metadata } from "next";
import { Award, HeartHandshake, MonitorSmartphone, Target, Users } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { Card, LinkButton } from "@/components/ui";
import { LogoMark } from "@/components/logo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sobre nós" };

export default async function SobrePage() {
  const cfg = await getSettings();
  return (
    <div className="mx-auto max-w-4xl px-4 py-14">
      <div className="flex items-center gap-4">
        <LogoMark size={64} />
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand">Sobre nós</p>
          <h1 className="text-3xl font-bold tracking-tight text-ink">{cfg.institution.name}</h1>
          <p className="text-sm text-muted">{cfg.institution.tagline}</p>
        </div>
      </div>

      <p className="mt-8 text-lg leading-relaxed text-muted">{cfg.footer.about}</p>
      <p className="mt-4 leading-relaxed text-muted">
        Nossa unidade física reúne laboratório de informática, salas de aula e uma equipe próxima do aluno.
        Acreditamos que tecnologia se aprende fazendo: por isso nossas turmas são reduzidas e cada aula tem prática
        orientada em equipamento real. Do primeiro clique ao projeto final, o aluno é acompanhado de perto —
        com frequência registrada, atividades avaliadas e certificado verificável ao concluir.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <Card className="p-6">
          <Target className="h-6 w-6 text-brand" />
          <h2 className="mt-3 font-bold text-ink">Missão</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">Formar pessoas para o mercado de trabalho com ensino prático, acessível e de qualidade, perto de casa.</p>
        </Card>
        <Card className="p-6">
          <HeartHandshake className="h-6 w-6 text-brand" />
          <h2 className="mt-3 font-bold text-ink">Compromisso</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">Transparência em valores e regras, respeito aos dados pessoais (LGPD) e atendimento humano em cada etapa.</p>
        </Card>
        <Card className="p-6">
          <MonitorSmartphone className="h-6 w-6 text-brand" />
          <h2 className="mt-3 font-bold text-ink">Estrutura</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">Laboratório com computadores para prática individual, salas organizadas e calendário acadêmico digital.</p>
        </Card>
        <Card className="p-6">
          <Award className="h-6 w-6 text-brand" />
          <h2 className="mt-3 font-bold text-ink">Certificação</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">Certificado próprio de curso livre, com código de autenticidade e verificação pública online. Não declaramos reconhecimento pelo MEC.</p>
        </Card>
      </div>

      <div className="mt-12 rounded-3xl bg-brand-deep p-8 text-center">
        <Users className="mx-auto h-8 w-8 text-sage" />
        <h2 className="mt-3 text-xl font-bold text-white">Venha conhecer a unidade</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-sage">Agende uma visita, tire dúvidas e veja o laboratório antes de se matricular.</p>
        <div className="mt-5 flex justify-center gap-3">
          <LinkButton href="/contato" className="bg-sage text-brand-deep hover:bg-white">Falar com a equipe</LinkButton>
          <LinkButton href="/cursos" variant="secondary" className="border-white/30 bg-transparent text-white hover:text-sage">Ver cursos</LinkButton>
        </div>
      </div>
    </div>
  );
}