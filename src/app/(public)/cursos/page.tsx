import Link from "next/link";
import type { Metadata } from "next";
import { Search, SlidersHorizontal } from "lucide-react";
import { getCatalog } from "@/lib/catalog";
import { CourseCard } from "@/components/course-card";
import { Button, EmptyState, LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cursos presenciais", description: "Catálogo de cursos presenciais de informática e tecnologia com vagas em tempo real." };

const PAGE_SIZE = 9;

export default async function CursosPage({ searchParams }: { searchParams: Promise<{ q?: string; categoria?: string; ordem?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, total, categories } = await getCatalog({ q: sp.q, category: sp.categoria, order: sp.ordem, page, pageSize: PAGE_SIZE });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const linkFor = (p: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.categoria) params.set("categoria", sp.categoria);
    if (sp.ordem) params.set("ordem", sp.ordem);
    params.set("page", String(p));
    return `/cursos?${params.toString()}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="text-xs font-bold uppercase tracking-widest text-brand">Catálogo</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">Cursos presenciais</h1>
      <p className="mt-2 max-w-2xl text-muted">Escolha um curso, veja as turmas com vagas disponíveis e faça sua matrícula online em poucos minutos.</p>

      <form method="GET" action="/cursos" className="mt-8 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-3 shadow-sm">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Buscar curso…" aria-label="Buscar curso" className="h-10 w-full rounded-xl border border-line bg-bg pl-9 pr-3 text-sm focus:border-brand focus:outline-none" />
        </div>
        <select name="categoria" defaultValue={sp.categoria ?? ""} aria-label="Categoria" className="h-10 rounded-xl border border-line bg-bg px-3 text-sm focus:border-brand focus:outline-none">
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>{c.name}</option>
          ))}
        </select>
        <select name="ordem" defaultValue={sp.ordem ?? ""} aria-label="Ordenação" className="h-10 rounded-xl border border-line bg-bg px-3 text-sm focus:border-brand focus:outline-none">
          <option value="">Mais recentes</option>
          <option value="nome">Nome (A–Z)</option>
          <option value="preco-asc">Menor preço</option>
          <option value="preco-desc">Maior preço</option>
        </select>
        <Button type="submit" size="md"><SlidersHorizontal className="h-4 w-4" />Filtrar</Button>
      </form>

      <p className="mt-6 text-sm text-muted">{total} {total === 1 ? "curso encontrado" : "cursos encontrados"}</p>

      {items.length > 0 ? (
        <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <CourseCard key={item.course.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState
            title="Nenhum curso encontrado"
            description="Ajuste a busca ou os filtros. Se preferir, fale conosco para saber das próximas turmas."
            action={<LinkButton href="/contato" variant="soft">Falar com a equipe</LinkButton>}
          />
        </div>
      )}

      {pages > 1 ? (
        <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Paginação">
          {page > 1 ? <Link href={linkFor(page - 1)} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-muted hover:text-brand">← Anterior</Link> : null}
          <span className="px-2 text-sm text-muted">Página {page} de {pages}</span>
          {page < pages ? <Link href={linkFor(page + 1)} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-muted hover:text-brand">Próxima →</Link> : null}
        </nav>
      ) : null}
    </div>
  );
}