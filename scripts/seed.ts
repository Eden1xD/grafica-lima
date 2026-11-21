/**
 * Seed inicial — conteúdo institucional editável pelo painel.
 * Executar: npm exec tsx -- scripts/seed.ts   (após npx drizzle-kit push)
 * Não cria alunos/pagamentos/notas fictícios: apenas catálogo, equipe e estrutura.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/db";
import { classrooms, cohorts, classSessions, cohortTeachers, courseCategories, courses, coupons, teachers, userRoles, users } from "../src/db/schema";
import { hashPassword } from "../src/lib/auth/password";
import { generateSessionDates } from "../src/lib/domain";
import { addDaysISO, addMonthsISO, slugify, todayISO } from "../src/lib/utils";

const IMG = {
  lab: "https://images.pexels.com/photos/35571660/pexels-photo-35571660.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  office: "https://images.pexels.com/photos/5530520/pexels-photo-5530520.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  design: "https://images.pexels.com/photos/20432872/pexels-photo-20432872.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  manut: "https://images.pexels.com/photos/5530478/pexels-photo-5530478.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  web: "https://images.pexels.com/photos/5530484/pexels-photo-5530484.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  office2: "https://images.pexels.com/photos/5539293/pexels-photo-5539293.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
};

async function main() {
  const today = todayISO();
  console.log("→ Seed Gráfica Lima", today);

  // Admin
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@graficalima.com.br").toLowerCase();
  const adminPass = process.env.SEED_ADMIN_PASSWORD ?? "GraficaLima@2026";
  let [admin] = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
  if (!admin) {
    [admin] = await db
      .insert(users)
      .values({ name: "Administração Gráfica Lima", email: adminEmail, role: "admin", passwordHash: await hashPassword(adminPass), emailVerifiedAt: new Date() })
      .returning();
    await db.insert(userRoles).values({ userId: admin.id, role: "admin" }).onConflictDoNothing();
    console.log(`  ✔ Admin criado: ${adminEmail} (senha inicial: ${adminPass}) — ALTERE APÓS O PRIMEIRO ACESSO.`);
  } else {
    console.log("  • Admin já existe — mantido.");
  }

  // Professor
  const profEmail = (process.env.SEED_TEACHER_EMAIL ?? "professor@graficalima.com.br").toLowerCase();
  let [prof] = await db.select().from(users).where(eq(users.email, profEmail)).limit(1);
  if (!prof) {
    [prof] = await db
      .insert(users)
      .values({ name: "Carlos Lima", email: profEmail, role: "professor", passwordHash: await hashPassword(process.env.SEED_TEACHER_PASSWORD ?? "Professor@2026"), emailVerifiedAt: new Date() })
      .returning();
    await db.insert(userRoles).values({ userId: prof.id, role: "professor" }).onConflictDoNothing();
    console.log(`  ✔ Professor criado: ${profEmail}`);
  }
  let [teacher] = await db.select().from(teachers).where(eq(teachers.userId, prof.id)).limit(1);
  if (!teacher) {
    [teacher] = await db
      .insert(teachers)
      .values({ userId: prof.id, bio: "Instrutor de informática com foco em prática de laboratório e acompanhamento individual do aluno.", specialties: "Informática · Excel · Manutenção", publicVisible: true })
      .returning();
  }

  // Categorias
  const catNames = ["Informática", "Produtividade", "Design", "Desenvolvimento"];
  for (const name of catNames) {
    await db.insert(courseCategories).values({ name, slug: slugify(name) }).onConflictDoNothing();
  }
  const cats = await db.select().from(courseCategories);
  const cat = (name: string) => cats.find((c) => c.name === name)?.id ?? null;

  // Salas
  for (const [name, capacity] of [["Laboratório 1", 16], ["Laboratório 2", 12], ["Sala Teórica", 20]] as const) {
    await db.insert(classrooms).values({ name, capacity }).onConflictDoNothing();
  }
  const rooms = await db.select().from(classrooms);
  const room = (name: string) => rooms.find((r) => r.name === name)?.id ?? null;

  // Cursos (catálogo inicial editável — publique/ajuste valores reais no painel)
  const catalog = [
    {
      name: "Informática Essencial", cat: "Informática", img: IMG.lab, hours: 60, months: 4, price: 69000, entry: 12000, inst: 4, featured: true,
      short: "Do zero ao uso confiante do computador: Windows, internet, arquivos e ferramentas do dia a dia.",
      desc: "Curso presencial para quem quer dominar o computador de verdade. Aulas 100% práticas em laboratório, com exercícios guiados e revisão constante.\nIdeal para quem está começando ou quer se atualizar para o mercado de trabalho.",
      syllabus: "Introdução ao computador e Windows\nOrganização de arquivos e pastas\nInternet, e-mail e segurança digital\nWord: documentos profissionais\nExcel: primeiras planilhas\nApresentações e impressão\nProjeto final prático",
      prereq: "Nenhum. Turma para iniciantes.", materials: "Apostila digital, arquivos de exercício e acesso ao laboratório.",
    },
    {
      name: "Excel do Básico ao Avançado", cat: "Produtividade", img: IMG.office, hours: 48, months: 3, price: 59000, entry: 10000, inst: 3, featured: true,
      short: "Planilhas, fórmulas, gráficos, PROCV e dashboards para o trabalho e para concursos.",
      desc: "Domine a ferramenta mais exigida pelo mercado. Cada aula resolve um problema real: controle financeiro, relatórios, indicadores e automações simples.",
      syllabus: "Fundamentos de planilhas e formatação\nFórmulas e funções essenciais\nFunções de texto, data e lógica\nPROCV, PROCX e correspondência\nTabelas dinâmicas e gráficos\nDashboards e impressão\nAvaliação prática final",
      prereq: "Uso básico de computador (ou Informática Essencial).", materials: "Pasta de exercícios progressivos e modelos prontos.",
    },
    {
      name: "Design Gráfico na Prática", cat: "Design", img: IMG.design, hours: 80, months: 5, price: 99000, entry: 18000, inst: 5, featured: true,
      short: "Criação de peças profissionais: identidade visual, social media e materiais impressos.",
      desc: "Formação prática em design para quem quer criar peças de verdade: cartões, flyers, posts e identidade visual, com fundamentos de composição, cor e tipografia.",
      syllabus: "Fundamentos do design: cor, tipografia e composição\nFerramentas de edição de imagem\nVetores e identidade visual\nPeças para impressão e fechamento de arquivo\nSocial media e formatos digitais\nPortfólio orientado\nProjeto final com cliente fictício de treino",
      prereq: "Uso intermediário de computador.", materials: "Arquivos-fonte, kit de marcas para treino e apostila digital.",
    },
    {
      name: "Manutenção de Computadores", cat: "Informática", img: IMG.manut, hours: 72, months: 4, price: 89000, entry: 15000, inst: 4, featured: false,
      short: "Montagem, formatação, diagnóstico e reparo de PCs e notebooks — prática em bancada.",
      desc: "Aprenda manutenção com as mãos na massa: identificação de componentes, montagem, instalação de sistemas, backup e diagnóstico de defeitos comuns.",
      syllabus: "Hardware: componentes e compatibilidade\nMontagem e desmontagem guiada\nBIOS, particionamento e instalação de sistemas\nDrivers, backup e recuperação\nDiagnóstico de defeitos e limpeza\nRedes básicas para técnicos\nBancada final avaliada",
      prereq: "Uso básico de computador.", materials: "Kit de bancada compartilhado e checklist técnico.",
    },
    {
      name: "Introdução à Programação Web", cat: "Desenvolvimento", img: IMG.web, hours: 96, months: 6, price: 129000, entry: 22000, inst: 6, featured: false,
      short: "Lógica, HTML, CSS e JavaScript: construa e publique seu primeiro site completo.",
      desc: "Porta de entrada para a área de tecnologia. O aluno termina o curso com um site próprio publicado e base sólida de lógica de programação.",
      syllabus: "Lógica de programação\nHTML semântico\nCSS e responsividade\nJavaScript: fundamentos\nDOM e interatividade\nGit e publicação\nProjeto final: site completo",
      prereq: "Uso intermediário de computador.", materials: "Ambiente de desenvolvimento configurado no laboratório.",
    },
    {
      name: "Pacote Office Completo", cat: "Produtividade", img: IMG.office2, hours: 64, months: 4, price: 75000, entry: 13000, inst: 4, featured: false,
      short: "Word, Excel e PowerPoint integrados para rotina de escritório e estudos.",
      desc: "Formação completa nas ferramentas de escritório mais usadas, com projetos que simulam a rotina administrativa real.",
      syllabus: "Word: formatação profissional e malas diretas\nExcel: planilhas de controle\nPowerPoint: apresentações eficazes\nIntegração entre aplicativos\nOrganização digital e nuvem\nProjeto integrado final",
      prereq: "Uso básico de computador.", materials: "Modelos profissionais e exercícios integrados.",
    },
  ];

  const createdCourses: Array<{ id: string; months: number; name: string }> = [];
  for (const c of catalog) {
    const slug = slugify(c.name);
    const [existing] = await db.select().from(courses).where(eq(courses.slug, slug)).limit(1);
    if (existing) {
      createdCourses.push({ id: existing.id, months: existing.durationMonths, name: existing.name });
      continue;
    }
    const [row] = await db
      .insert(courses)
      .values({
        name: c.name, slug, categoryId: cat(c.cat), imageUrl: c.img,
        shortDescription: c.short, description: c.desc, syllabus: c.syllabus,
        prerequisites: c.prereq, materials: c.materials,
        workloadHours: c.hours, durationMonths: c.months,
        priceCents: c.price, entryCents: c.entry, maxInstallments: c.inst,
        minAttendancePct: 75, minGradeH: 700, certificateEnabled: true,
        featured: c.featured, status: "publicado",
      })
      .returning();
    createdCourses.push({ id: row.id, months: c.months, name: c.name });
    console.log(`  ✔ Curso: ${c.name}`);
  }

  // Turmas + aulas
  const start = addDaysISO(today, 21);
  const plans: Array<{ courseIdx: number; name: string; days: number[]; st: string; en: string; roomName: string; cap: number; status: "aberta" | "em_andamento"; startIso: string }> = [
    { courseIdx: 0, name: "TURMA A — noite", days: [2, 4], st: "19:00", en: "21:00", roomName: "Laboratório 1", cap: 14, status: "aberta", startIso: start },
    { courseIdx: 0, name: "TURMA B — manhã", days: [1, 3, 5], st: "09:00", en: "10:30", roomName: "Laboratório 2", cap: 10, status: "em_andamento", startIso: addDaysISO(today, -14) },
    { courseIdx: 1, name: "TURMA A — noite", days: [1, 3], st: "19:00", en: "21:00", roomName: "Laboratório 2", cap: 12, status: "aberta", startIso: addDaysISO(today, 28) },
    { courseIdx: 2, name: "TURMA A — tarde", days: [2, 4], st: "14:00", en: "16:00", roomName: "Laboratório 1", cap: 12, status: "aberta", startIso: addDaysISO(today, 35) },
    { courseIdx: 4, name: "TURMA A — sábado", days: [6], st: "08:00", en: "12:00", roomName: "Laboratório 1", cap: 14, status: "aberta", startIso: addDaysISO(today, 25) },
  ];
  for (const p of plans) {
    const course = createdCourses[p.courseIdx];
    if (!course) continue;
    const endDate = addMonthsISO(p.startIso, course.months);
    const [existing] = await db
      .select()
      .from(cohorts)
      .where(eq(cohorts.courseId, course.id))
      .limit(1)
      .then((rows) => [rows.find((r) => r.name === p.name)]);
    if (existing) continue;
    const [cohort] = await db
      .insert(cohorts)
      .values({
        courseId: course.id, teacherId: teacher.id, roomId: room(p.roomName),
        name: p.name, daysOfWeek: p.days, startTime: p.st, endTime: p.en,
        startDate: p.startIso, endDate, capacity: p.cap, status: p.status,
      })
      .returning();
    await db.insert(cohortTeachers).values({ cohortId: cohort.id, teacherId: teacher.id, isPrimary: true }).onConflictDoNothing();
    const dates = generateSessionDates(p.startIso, endDate, p.days);
    if (dates.length) {
      await db.insert(classSessions).values(dates.map((date) => ({ cohortId: cohort.id, date, startTime: p.st, endTime: p.en }))).onConflictDoNothing();
    }
    console.log(`  ✔ Turma: ${course.name} / ${p.name} (${dates.length} aulas)`);
  }

  // Cupom de boas-vindas
  await db
    .insert(coupons)
    .values({ code: "BEMVINDO10", type: "percentual", value: 10, maxUses: 100, validUntil: addDaysISO(today, 90), minTotalCents: 0 })
    .onConflictDoNothing();
  console.log("  ✔ Cupom BEMVINDO10 (10%, 90 dias, 100 usos)");

  console.log("→ Seed concluído. Configure endereço/contatos em /admin/configuracoes e revise o catálogo antes de divulgar.");
  await pool.end();
}

main().catch(async (err) => {
  console.error("Seed falhou:", err);
  await pool.end();
  process.exit(1);
});