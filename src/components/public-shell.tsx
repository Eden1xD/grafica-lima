import Link from "next/link";
import { MessageCircle, MapPin, Phone, Mail, Clock, ShieldCheck } from "lucide-react";

function Instagram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
    </svg>
  );
}

function Facebook({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}
import { getSettings } from "@/lib/settings";
import { getSessionUser, homeForUser } from "@/lib/auth/session";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";
import { LinkButton } from "@/components/ui";
import { MobileNav } from "@/components/public-nav";

const NAV = [
  { href: "/cursos", label: "Cursos" },
  { href: "/sobre", label: "Sobre" },
  { href: "/contato", label: "Contato" },
  { href: "/faq", label: "Dúvidas" },
];

export async function PublicHeader() {
  const user = await getSessionUser();
  const portalHref = user ? await homeForUser(user) : "/entrar";
  return (
    <header className="public-mobile-header sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-md">
      <div className="public-mobile-header__inner relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
  <Link href="/" aria-label="Página inicial" className="hidden md:block">
    <Logo size={38} />
  </Link>

  <Link href="/" aria-label="Página inicial" className="md:hidden">
    <Logo size={34} />
  </Link>

  <nav
    className="hidden items-center gap-1 md:flex"
    aria-label="Navegação principal"
  >
    {NAV.map((l) => (
      <Link
        key={l.href}
        href={l.href}
        className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-brand-soft hover:text-brand-deep dark:hover:text-brand"
      >
        {l.label}
      </Link>
    ))}
  </nav>

  <div className="flex items-center gap-2">
    <ThemeToggle />

    <div className="hidden items-center gap-2 md:flex">
      {user ? (
        <LinkButton href={portalHref} variant="primary" size="sm">
          Meu portal
        </LinkButton>
      ) : (
        <>
          <Link
            href="/entrar"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-muted transition hover:text-brand"
          >
            Entrar
          </Link>
          <LinkButton href="/cursos" size="sm">
            Matricule-se
          </LinkButton>
        </>
      )}
    </div>

    <MobileNav authed={!!user} portalHref={portalHref} />
  </div>
</div>
    </header>
  );
}

export async function PublicFooter() {
  const cfg = await getSettings();
  const inst = cfg.institution;
  const year = new Date().getFullYear();
  return (
    <footer className="mt-20 bg-sidebar text-sidebar-ink">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo onDark size={40} />
          <p className="mt-4 text-sm leading-relaxed text-sidebar-ink/75">{cfg.footer.about}</p>
          <div className="mt-4 flex gap-2">
            {inst.instagram ? (
              <a href={inst.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 transition hover:bg-white/20">
                <Instagram className="h-4 w-4" />
              </a>
            ) : null}
            {inst.facebook ? (
              <a href={inst.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 transition hover:bg-white/20">
                <Facebook className="h-4 w-4" />
              </a>
            ) : null}
            {inst.whatsapp ? (
              <a href={`https://wa.me/${inst.whatsapp}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 transition hover:bg-white/20">
                <MessageCircle className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        </div>
        <nav aria-label="Institucional">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-sage">Institucional</p>
          <ul className="space-y-2 text-sm text-sidebar-ink/80">
            <li><Link className="hover:text-white" href="/cursos">Cursos</Link></li>
            <li><Link className="hover:text-white" href="/sobre">Sobre nós</Link></li>
            <li><Link className="hover:text-white" href="/faq">Perguntas frequentes</Link></li>
            <li><Link className="hover:text-white" href="/contato">Contato</Link></li>
          </ul>
        </nav>
        <nav aria-label="Legal">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-sage">Transparência</p>
          <ul className="space-y-2 text-sm text-sidebar-ink/80">
            <li><Link className="hover:text-white" href="/termos">Termos de uso</Link></li>
            <li><Link className="hover:text-white" href="/privacidade">Privacidade e LGPD</Link></li>
            <li><Link className="hover:text-white" href="/cancelamentos">Cancelamentos</Link></li>
            <li>
              <Link className="inline-flex items-center gap-1.5 hover:text-white" href="/certificados/verificar">
                <ShieldCheck className="h-3.5 w-3.5" /> Verificar certificado
              </Link>
            </li>
          </ul>
        </nav>
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-sage">Atendimento</p>
          <ul className="space-y-2.5 text-sm text-sidebar-ink/80">
            {inst.address ? (
              <li className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sage" /><span>{inst.address}{inst.city ? ` — ${inst.city}` : ""}</span></li>
            ) : null}
            {inst.phone ? (
              <li className="flex gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-sage" /><span>{inst.phone}</span></li>
            ) : null}
            {inst.email ? (
              <li className="flex gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-sage" /><span className="break-all">{inst.email}</span></li>
            ) : null}
            <li className="flex gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-sage" /><span>{inst.hours}</span></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-sidebar-ink/60">
          <span>© {year} {inst.name} — {inst.tagline}{inst.cnpj ? ` · CNPJ ${inst.cnpj}` : ""}</span>
          <span>Cursos livres presenciais · certificado próprio com verificação online</span>
        </div>
      </div>
    </footer>
  );
}