import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Termos de uso" };

export default async function TermosPage() {
  const cfg = await getSettings();
  return (
    <article className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-bold tracking-tight text-ink">Termos de uso</h1>
      <p className="mt-2 text-sm text-muted">Última atualização: janeiro de 2026 · {cfg.institution.name} — {cfg.institution.tagline}</p>
      <div className="prose-sm mt-8 space-y-6 text-sm leading-relaxed text-muted">
        <section>
          <h2 className="text-lg font-bold text-ink">1. Objeto</h2>
          <p className="mt-2">Esta plataforma oferece divulgação e matrícula em cursos livres presenciais, portal do aluno, portal do professor e serviços administrativos da {cfg.institution.name}. Os cursos são de qualificação profissional, na modalidade de cursos livres, com certificado próprio — não há declaração de reconhecimento pelo MEC.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-ink">2. Conta e segurança</h2>
          <p className="mt-2">O cadastro exige nome, e-mail e senha (ou conta Google). Você é responsável pela guarda de suas credenciais. Notifique a instituição em caso de uso indevido. Contas podem ser bloqueadas em caso de fraude ou violação destes termos.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-ink">3. Matrícula e pagamento</h2>
          <p className="mt-2">A matrícula é confirmada após o aceite do contrato e a confirmação do pagamento exigido (integral, entrada ou primeira mensalidade), por gateway de pagamento ou registro presencial na secretaria. Vagas são limitadas por turma e reservadas por tempo limitado enquanto o pagamento estiver pendente. Valores, descontos e vencimentos são exibidos de forma clara antes da confirmação.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-ink">4. Obrigações do aluno</h2>
          <p className="mt-2">Frequentar as aulas contratadas, respeitar as normas da unidade, zelar pelos equipamentos e manter seus dados atualizados. A frequência mínima e a média exigidas para certificação são informadas na página de cada curso.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-ink">5. Propriedade intelectual</h2>
          <p className="mt-2">Materiais didáticos, marca e conteúdo da plataforma pertencem à instituição ou a seus licenciadores, sendo vedada a reprodução não autorizada.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-ink">6. Cancelamento e reembolso</h2>
          <p className="mt-2">Aplica-se a política publicada em <a href="/cancelamentos" className="text-brand underline">/cancelamentos</a>, em conformidade com o Código de Defesa do Consumidor, incluindo o direito de arrependimento de 7 dias para contratações online.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-ink">7. Privacidade</h2>
          <p className="mt-2">O tratamento de dados pessoais segue a <a href="/privacidade" className="text-brand underline">Política de Privacidade</a> e a Lei nº 13.709/2018 (LGPD).</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-ink">8. Foro e legislação</h2>
          <p className="mt-2">Aplicam-se as leis brasileiras, em especial o CDC, o Marco Civil da Internet e a LGPD, com foro do domicílio do consumidor quando aplicável.</p>
        </section>
      </div>
    </article>
  );
}