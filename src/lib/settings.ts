import { db } from "@/db";
import { siteSettings } from "@/db/schema";

export type SiteConfig = {
  institution: {
    name: string;
    tagline: string;
    cnpj: string;
    phone: string;
    whatsapp: string;
    email: string;
    address: string;
    city: string;
    hours: string;
    mapsQuery: string;
    instagram: string;
    facebook: string;
  };
  home: {
    heroBadge: string;
    heroTitle: string;
    heroSubtitle: string;
    marquee: string;
    show3d: boolean;
  };
  finance: {
    allowManual: boolean;
    allowPix: boolean;
    allowCard: boolean;
    contractText: string;
    cancellationText: string;
  };
  faq: Array<{ q: string; a: string }>;
  footer: { about: string };
  push: { publicKey: string; privateKey: string } | null;
};

export const DEFAULT_CONFIG: SiteConfig = {
  institution: {
    name: "Gráfica Lima",
    tagline: "Produtos e Informática",
    cnpj: "",
    phone: "",
    whatsapp: "",
    email: "",
    address: "",
    city: "",
    hours: "Segunda a sexta, 8h às 18h · Sábado, 8h às 12h",
    mapsQuery: "",
    instagram: "",
    facebook: "",
  },
  home: {
    heroBadge: "Cursos presenciais · matrículas abertas",
    heroTitle: "Aprenda na prática. Construa o seu futuro.",
    heroSubtitle:
      "Cursos presenciais de informática e tecnologia com turmas reduzidas, professores dedicados e certificado de conclusão. Estude perto de você, com equipamento de verdade.",
    marquee: "",
    show3d: true,
  },
  finance: {
    allowManual: true,
    allowPix: true,
    allowCard: true,
    contractText:
      "CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS\n\nA contratação do curso presencial selecionado inclui: acesso às aulas presenciais da turma escolhida, material didático indicado pelo professor e certificado de conclusão mediante cumprimento dos requisitos acadêmicos (frequência mínima e média configuradas no curso).\n\nO aluno se compromete a frequentar as aulas nos dias e horários contratados e a zelar pelos equipamentos da instituição. Valores, forma de pagamento e vencimentos são os exibidos no resumo da matrícula no momento da contratação.\n\nO cancelamento segue a política publicada em /cancelamentos, respeitando o Código de Defesa do Consumidor. Dados pessoais são tratados conforme a Política de Privacidade (/privacidade).",
    cancellationText:
      "Você pode solicitar o cancelamento da matrícula em até 7 dias corridos após a contratação, com reembolso integral dos valores pagos, conforme o art. 49 do Código de Defesa do Consumidor (direito de arrependimento para contratações fora do estabelecimento).\n\nApós o início das aulas, o reembolso considera as aulas já ministradas e os custos administrativos previstos em contrato. Solicitações são feitas pelo portal do aluno, pela secretaria ou pelo canal de contato, e respondidas em até 10 dias úteis.",
  },
  faq: [
    {
      q: "Os cursos são presenciais?",
      a: "Sim. Todos os cursos acontecem na nossa unidade, com aulas práticas em laboratório e acompanhamento do professor.",
    },
    {
      q: "Preciso ter computador em casa?",
      a: "Não é obrigatório. As aulas práticas são realizadas nos computadores da instituição. Recomendamos acesso a um computador para exercícios extras, mas não é requisito.",
    },
    {
      q: "Como funciona o pagamento?",
      a: "Você pode pagar o valor integral (Pix ou cartão) ou optar por entrada + mensalidades. Também é possível pagar presencialmente na secretaria.",
    },
    {
      q: "Recebo certificado?",
      a: "Sim. Ao concluir o curso com a frequência mínima e a média exigidas, você recebe um certificado digital com código de autenticidade verificável online.",
    },
    {
      q: "Menores de idade podem se matricular?",
      a: "Sim, mediante autorização e dados do responsável legal, informados durante a matrícula.",
    },
  ],
  footer: {
    about:
      "A Gráfica Lima — Produtos e Informática oferece cursos presenciais de informática e tecnologia, com foco em prática real e atendimento próximo.",
  },
  push: null,
};

type Section = keyof SiteConfig;

export async function getSettings(): Promise<SiteConfig> {
  try {
    const rows = await db.select().from(siteSettings);
    const cfg: SiteConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    for (const row of rows) {
      const key = row.key as Section;
      if (key in cfg) {
        (cfg as Record<string, unknown>)[key] =
          key === "faq" ? row.value : { ...(cfg[key] as object), ...(row.value as object) };
      }
    }
    return cfg;
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
}

export async function saveSetting<K extends Section>(key: K, value: SiteConfig[K]): Promise<void> {
  await db
    .insert(siteSettings)
    .values({ key, value: value as unknown as Record<string, unknown>, updatedAt: new Date() })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: value as unknown as Record<string, unknown>, updatedAt: new Date() } });
}

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function mercadopagoConfigured(): boolean {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
}

export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_URL);
}