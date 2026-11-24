"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, CalendarDays, Check, CheckCircle2, ChevronLeft, Copy, CreditCard, Landmark, MapPin, QrCode, ShieldCheck } from "lucide-react";
import { IDLE } from "@/lib/action-state";
import { saveCheckoutProfileAction, couponPreviewAction, createEnrollmentAction } from "@/server/actions/enrollment";
import { checkPaymentStatusAction } from "@/server/actions/finance";
import { isMinor, splitInstallments } from "@/lib/domain";
import { brl, cn, fmtDate, onlyDigits, todayISO } from "@/lib/utils";
import { Alert, Badge, btnCls, Card, Field, Input, Select, Spinner } from "@/components/ui";
import { toast } from "@/components/action-form";
type Profile = {
  cpf: string; birthDate: string; phone: string; cep: string; street: string; number: string;
  complement: string; district: string; city: string; state: string; guardianName: string; guardianCpf: string; guardianPhone: string;
};
type Props = {
  cohortId: string;
  userName: string;
  userEmail: string;
  emailVerified: boolean;
  course: { name: string; priceCents: number; entryCents: number; maxInstallments: number };
  cohort: { name: string; startDate: string; endDate: string; days: string; time: string; available: number };
  address: string;
  profile: Profile | null;
  methods: { manual: boolean; pix: boolean; card: boolean; gatewayConfigured: boolean };
  contractText: string;
  cancellationText: string;
};
const STEPS = ["Dados pessoais", "Revisão e contrato", "Pagamento"];
export function CheckoutClient(p: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [plan, setPlan] = useState<"integral" | "mensal">("integral");
  const [months, setMonths] = useState(p.course.maxInstallments);
  const [method, setMethod] = useState<"pix" | "cartao" | "manual">(p.methods.pix ? "pix" : p.methods.card ? "cartao" : "manual");
  const [accepted, setAccepted] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountCents: number } | null>(null);
  const [birthDate, setBirthDate] = useState(p.profile?.birthDate ?? "");
  const [addr, setAddr] = useState({ cep: p.profile?.cep ?? "", street: p.profile?.street ?? "", district: p.profile?.district ?? "", city: p.profile?.city ?? "", state: p.profile?.state ?? "" });
  const [cepLoading, setCepLoading] = useState(false);
  const [pix, setPix] = useState<{ paymentId: string; qrCode: string; qrBase64: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [profileState, profileAction, profilePending] = useActionState(saveCheckoutProfileAction, IDLE);
  const [couponState, couponAction, couponPending] = useActionState(couponPreviewAction, IDLE);
  const [enrollState, enrollAction, enrollPending] = useActionState(createEnrollmentAction, IDLE);
  const minor = birthDate ? isMinor(birthDate, todayISO()) : false;
  const net = p.course.priceCents - (appliedCoupon?.discountCents ?? 0);
  const split = splitInstallments(net, p.course.entryCents, months);
  useEffect(() => {
    if (profileState.status === "ok") setStep(1);
    if (profileState.status === "error" && profileState.message) toast("error", profileState.message);
  }, [profileState]);
  useEffect(() => {
    if (couponState.status === "ok" && couponState.data) {
      setAppliedCoupon({ code: String(couponState.data.code), discountCents: Number(couponState.data.discountCents) });
      toast("ok", `Cupom aplicado: −${brl(Number(couponState.data.discountCents))}`);
    }
    if (couponState.status === "error") {
      setAppliedCoupon(null);
      if (couponState.message) toast("error", couponState.message);
    }
  }, [couponState]);
  useEffect(() => {
    if (enrollState.status === "error" && enrollState.message) toast("error", enrollState.message);
    if (enrollState.status === "ok" && enrollState.data) {
      const d = enrollState.data;
      if (d.notice) toast("error", String(d.notice));
      if (d.mode === "card" && d.url) window.location.href = String(d.url);
      else if (d.mode === "pix") setPix({ paymentId: String(d.paymentId), qrCode: String(d.qrCode), qrBase64: String(d.qrBase64) });
      else router.push(`/matricula/confirmacao?enrollment=${d.enrollmentId}`);
    }
  }, [enrollState, router]);
  async function checkNow(paymentId: string) {
    setChecking(true);
    try {
      const fd = new FormData();
      fd.set("paymentId", paymentId);
      const res = await checkPaymentStatusAction(IDLE, fd);
      if (res.data?.status === "aprovado") {
        if (pollRef.current) clearInterval(pollRef.current);
        toast("ok", "Pagamento confirmado!");
        router.push(`/matricula/confirmacao?enrollment=${enrollState.data?.enrollmentId ?? ""}`);
      } else if (res.data?.status === "recusado") {
        toast("error", "Pagamento não aprovado pelo provedor.");
      } else if (res.message) {
        toast("ok", res.message);
      }
    } finally {
      setChecking(false);
    }
  }
  useEffect(() => {
    if (!pix) return;
    pollRef.current = setInterval(() => void checkNow(pix.paymentId), 6000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pix]);
  async function lookupCep() {
    const digits = onlyDigits(addr.cep);
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = (await res.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
      if (!data.erro) {
        setAddr((a) => ({ ...a, street: data.logradouro || a.street, district: data.bairro || a.district, city: data.localidade || a.city, state: data.uf || a.state }));
        toast("ok", "Endereço preenchido pelo CEP.");
      }
    } catch {
      toast("error", "Não foi possível consultar o CEP. Preencha manualmente.");
    } finally {
      setCepLoading(false);
    }
  }
  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
      <div className="min-w-0">
        {/* Progresso */}
        <ol className="mb-5 flex items-center gap-2 sm:mb-8" aria-label="Etapas da matrícula">
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-2">
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold", i < step ? "bg-success text-white" : i === step ? "bg-brand text-white" : "bg-surface2 text-muted")}>
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={cn("hidden text-xs font-semibold sm:block", i === step ? "text-ink" : "text-muted")}>{s}</span>
              {i < STEPS.length - 1 ? <span className="h-px flex-1 bg-line" aria-hidden /> : null}
            </li>
          ))}
        </ol>
        {/* ETAPA 1 — DADOS */}
        {step === 0 ? (
          <Card className="w-full min-w-0 p-4 sm:p-6">
            <h1 className="text-lg font-bold text-ink">Seus dados para a matrícula</h1>
            <p className="mt-1 text-sm text-muted">Olá, {p.userName.split(" ")[0]}! Precisamos destes dados para o contrato. Eles ficam salvos para as próximas matrículas.</p>
            {!p.emailVerified ? <Alert variant="warn" className="mt-3">Seu e-mail ainda não foi verificado — confira sua caixa de entrada (opcional para pagar, recomendado para recuperar a conta).</Alert> : null}
            <form action={profileAction} className="mt-6 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="CPF"><Input name="cpf" required defaultValue={p.profile?.cpf ?? ""} inputMode="numeric" placeholder="000.000.000-00" /></Field>
              <Field label="Data de nascimento"><Input name="birthDate" type="date" required value={birthDate} onChange={(e) => setBirthDate(e.target.value)} /></Field>
              <Field label="Telefone / WhatsApp"><Input name="phone" required defaultValue={p.profile?.phone ?? ""} autoComplete="tel" placeholder="(00) 00000-0000" /></Field>
              <Field label="CEP" hint={cepLoading ? "Buscando endereço…" : "Preenchemos o endereço automaticamente."}>
                <Input name="cep" required value={addr.cep} onChange={(e) => setAddr({ ...addr, cep: e.target.value })} onBlur={lookupCep} inputMode="numeric" placeholder="00000-000" />
              </Field>
              <Field label="Endereço" className="sm:col-span-2"><Input name="street" required value={addr.street} onChange={(e) => setAddr({ ...addr, street: e.target.value })} placeholder="Rua / Avenida" /></Field>
              <Field label="Número"><Input name="number" required defaultValue={p.profile?.number ?? ""} placeholder="Nº" /></Field>
              <Field label="Complemento (opcional)"><Input name="complement" defaultValue={p.profile?.complement ?? ""} placeholder="Apto, bloco…" /></Field>
              <Field label="Bairro"><Input name="district" required value={addr.district} onChange={(e) => setAddr({ ...addr, district: e.target.value })} /></Field>
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_72px] gap-3">
                <Field label="Cidade"><Input name="city" required value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} /></Field>
                <Field label="UF"><Input name="state" required maxLength={2} value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value.toUpperCase() })} /></Field>
              </div>
              {minor ? (
                <div className="sm:col-span-2 rounded-2xl border border-warn/40 bg-warn-soft p-4">
                  <p className="text-sm font-bold text-warn">Menor de idade — responsável legal obrigatório</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <Field label="Nome do responsável"><Input name="guardianName" required defaultValue={p.profile?.guardianName ?? ""} /></Field>
                    <Field label="CPF do responsável"><Input name="guardianCpf" required defaultValue={p.profile?.guardianCpf ?? ""} /></Field>
                    <Field label="Telefone do responsável"><Input name="guardianPhone" required defaultValue={p.profile?.guardianPhone ?? ""} /></Field>
                  </div>
                </div>
              ) : null}
              <div className="sm:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted">Seus dados são salvos com segurança (LGPD).</p>
                <button type="submit" disabled={profilePending} className={btnCls("primary", "md")}>
                  {profilePending ? <Spinner /> : null} Salvar e continuar
                </button>
              </div>
              {profileState.status === "error" && profileState.message ? <Alert variant="danger" className="sm:col-span-2">{profileState.message}</Alert> : null}
            </form>
          </Card>
        ) : null}
        {/* ETAPA 2 — REVISÃO */}
        {step === 1 ? (
          <div className="space-y-5">
            <Card className="w-full min-w-0 p-4 sm:p-6">
              <h2 className="text-lg font-bold text-ink">Forma de pagamento do curso</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className={cn("cursor-pointer rounded-2xl border-2 p-4 transition", plan === "integral" ? "border-brand bg-brand-soft" : "border-line hover:border-brand/40")}>
                  <input type="radio" name="planradio" className="sr-only" checked={plan === "integral"} onChange={() => setPlan("integral")} />
                  <p className="font-bold text-ink">Pagamento integral</p>
                  <p className="mt-1 text-2xl font-bold text-brand-deep dark:text-brand">{brl(net)}</p>
                  <p className="text-xs text-muted">Pix à vista ou cartão parcelado pelo gateway</p>
                </label>
                <label className={cn("cursor-pointer rounded-2xl border-2 p-4 transition", plan === "mensal" ? "border-brand bg-brand-soft" : "border-line hover:border-brand/40")}>
                  <input type="radio" name="planradio" className="sr-only" checked={plan === "mensal"} onChange={() => setPlan("mensal")} />
                  <p className="font-bold text-ink">Entrada + mensalidades</p>
                  <p className="mt-1 text-2xl font-bold text-brand-deep dark:text-brand">{brl(split.entryCents)} <span className="text-sm font-semibold text-muted">+ {months}x {brl(split.installments[0] ?? 0)}</span></p>
                  <p className="text-xs text-muted">Mensalidades administradas pela instituição</p>
                </label>
              </div>
              {plan === "mensal" ? (
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                  <Field label="Número de mensalidades">
                    <Select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
                      {Array.from({ length: p.course.maxInstallments }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>{n}x</option>
                      ))}
                    </Select>
                  </Field>
                  <p className="pb-2.5 text-xs text-muted">Vencimento da 1ª mensalidade: {fmtDate(p.cohort.startDate)} (demais a cada mês).</p>
                </div>
              ) : null}
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Cupom de desconto</p>
                <form action={couponAction} className="mt-2 flex flex-wrap gap-2">
                  <input type="hidden" name="cohortId" value={p.cohortId} />
                  <Input name="coupon" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="CÓDIGO" className="min-w-0 flex-1 font-mono uppercase" />
                  <button type="submit" disabled={couponPending} className={btnCls("secondary", "md")}>{couponPending ? <Spinner /> : null} Aplicar</button>
                  {appliedCoupon ? <Badge variant="success" className="self-center">−{brl(appliedCoupon.discountCents)}</Badge> : null}
                </form>
              </div>
            </Card>
            <Card className="w-full min-w-0 p-4 sm:p-6">
              <h2 className="text-lg font-bold text-ink">Contrato de prestação de serviços</h2>
              <div className="mt-3 max-h-52 overflow-y-auto whitespace-pre-wrap rounded-xl border border-line bg-bg p-4 text-xs leading-relaxed text-muted">{p.contractText}</div>
              <details className="mt-3 text-xs text-muted">
                <summary className="cursor-pointer font-semibold text-brand">Política de cancelamento</summary>
                <p className="mt-2 whitespace-pre-wrap leading-relaxed">{p.cancellationText}</p>
              </details>
              <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm text-ink">
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5" />
                Li e aceito o contrato e a política de cancelamento.
              </label>
            </Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button onClick={() => setStep(0)} className={btnCls("ghost", "md")}><ChevronLeft className="h-4 w-4" /> Voltar</button>
              <button onClick={() => setStep(2)} disabled={!accepted} className={btnCls("primary", "md")}>Ir para pagamento</button>
            </div>
          </div>
        ) : null}
        {/* ETAPA 3 — PAGAMENTO */}
        {step === 2 ? (
          <Card className="w-full min-w-0 p-4 sm:p-6">
            {pix ? (
              <div className="text-center">
                <h2 className="flex items-center justify-center gap-2 text-lg font-bold text-ink"><QrCode className="h-5 w-5 shrink-0 text-brand" /> Pague com Pix</h2>
                <p className="mt-1 text-sm text-muted">Escaneie o QR Code ou use o copia e cola. A confirmação é automática.</p>
                {pix.qrBase64 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`data:image/png;base64,${pix.qrBase64}`} alt="QR Code Pix" className="mx-auto mt-5 h-auto w-56 max-w-full rounded-2xl border border-line bg-white p-2" />
                ) : null}
                <div className="mx-auto mt-4 flex min-w-0 max-w-md flex-col gap-2 sm:flex-row">
                  <input readOnly value={pix.qrCode} aria-label="Pix copia e cola" className="h-10 w-full min-w-0 flex-1 truncate rounded-xl border border-line bg-bg px-3 font-mono text-xs" onFocus={(e) => e.target.select()} />
                  <button
                    className={btnCls("secondary", "md")}
                    onClick={async () => {
                      await navigator.clipboard.writeText(pix.qrCode);
                      toast("ok", "Código Pix copiado!");
                    }}
                  >
                    <Copy className="h-4 w-4" /> Copiar
                  </button>
                </div>
                <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted"><Spinner className="text-brand" /> Aguardando confirmação do pagamento… (verificamos a cada 6s)</p>
                <button onClick={() => void checkNow(pix.paymentId)} disabled={checking} className={btnCls("soft", "sm", "mt-3")}>
                  {checking ? <Spinner /> : <CheckCircle2 className="h-4 w-4" />} Já paguei — verificar agora
                </button>
              </div>
            ) : (
              <div>
                <h2 className="text-lg font-bold text-ink">Como você quer pagar?</h2>
                <p className="mt-1 text-sm text-muted">
                  {plan === "integral" ? `Valor único de ${brl(net)}.` : `Entrada de ${brl(split.entryCents)} agora + ${months} mensalidades de ${brl(split.installments[0] ?? 0)}.`}
                </p>
                <form action={enrollAction} className="mt-5 space-y-3">
                  <input type="hidden" name="cohortId" value={p.cohortId} />
                  <input type="hidden" name="plan" value={plan} />
                  <input type="hidden" name="months" value={months} />
                  <input type="hidden" name="coupon" value={appliedCoupon?.code ?? ""} />
                  <input type="hidden" name="accept" value={accepted ? "on" : ""} />
                  {[
                    { id: "pix" as const, icon: QrCode, title: "Pix", desc: "QR Code com confirmação automática", enabled: p.methods.pix },
                    { id: "cartao" as const, icon: CreditCard, title: "Cartão de crédito", desc: `Checkout seguro do gateway · até ${p.course.maxInstallments}x`, enabled: p.methods.card },
                    { id: "manual" as const, icon: Landmark, title: "Pagar na secretaria", desc: "Reserva de 48h · dinheiro, Pix ou cartão presencial", enabled: p.methods.manual },
                  ].map((m) => (
                    <label key={m.id} className={cn("flex w-full min-w-0 flex-wrap items-start gap-2 rounded-xl border-2 p-3 transition sm:flex-nowrap sm:items-center sm:gap-3 sm:p-4", !m.enabled ? "cursor-not-allowed opacity-50" : "cursor-pointer", method === m.id && m.enabled ? "border-brand bg-brand-soft" : "border-line hover:border-brand/40")}>
                      <input type="radio" name="method" value={m.id} disabled={!m.enabled} checked={method === m.id} onChange={() => setMethod(m.id)} />
                      <m.icon className="h-5 w-5 shrink-0 text-brand" />
                      <span className="min-w-0 flex-1 break-words">
                        <span className="block text-sm font-bold text-ink">{m.title}</span>
                        <span className="block text-xs text-muted">{m.enabled ? m.desc : "Indisponível no momento"}</span>
                      </span>
                      {m.id === "pix" && m.enabled ? <Badge variant="success">Recomendado</Badge> : null}
                    </label>
                  ))}
                  {!p.methods.gatewayConfigured ? (
                    <Alert variant="info" className="text-xs">Pagamentos online temporariamente indisponíveis. Você pode reservar sua vaga e pagar na secretaria, quando disponível.</Alert>
                  ) : null}
                  <div className="flex flex-col-reverse gap-3 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <button type="button" onClick={() => setStep(1)} className={btnCls("ghost", "md")}><ChevronLeft className="h-4 w-4" /> Voltar</button>
                    <button type="submit" disabled={enrollPending || !accepted || !(method === "manual" ? p.methods.manual : method === "pix" ? p.methods.pix : p.methods.card)} className={cn(btnCls("primary", "lg"), "w-full min-w-0 whitespace-normal text-center leading-snug sm:w-auto")}>
                      {enrollPending ? <Spinner /> : <ShieldCheck className="h-4 w-4" />}
                      {method === "manual" ? "Reservar minha vaga" : method === "pix" ? "Gerar Pix" : "Ir para checkout seguro"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </Card>
        ) : null}
      </div>
      {/* RESUMO LATERAL */}
      <aside className="h-fit min-w-0 space-y-4 lg:sticky lg:top-24">
        <Card className="min-w-0 break-words p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Resumo da matrícula</p>
          <p className="mt-2 font-bold text-ink">{p.course.name}</p>
          <p className="text-sm text-muted">{p.cohort.name}</p>
          <div className="mt-3 space-y-1.5 text-xs text-muted">
            <p className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 shrink-0 text-brand" />{p.cohort.days} · {p.cohort.time}</p>
            <p className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 shrink-0 text-brand" />{fmtDate(p.cohort.startDate)} a {fmtDate(p.cohort.endDate)}</p>
            {p.address ? <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0 text-brand" />{p.address}</p> : null}
          </div>
          <div className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
            <div className="flex flex-wrap justify-between gap-x-2 text-muted"><span>Valor do curso</span><span>{brl(p.course.priceCents)}</span></div>
            {appliedCoupon ? <div className="flex flex-wrap justify-between gap-x-2 text-success"><span>Cupom {appliedCoupon.code}</span><span>−{brl(appliedCoupon.discountCents)}</span></div> : null}
            <div className="flex flex-wrap justify-between gap-x-2 font-bold text-ink"><span>Total</span><span>{brl(net)}</span></div>
            {plan === "mensal" ? (
              <div className="rounded-xl bg-bg p-3 text-xs text-muted">
                <p className="flex flex-wrap justify-between gap-x-2"><span>Entrada (agora)</span><strong className="text-ink">{brl(split.entryCents)}</strong></p>
                {split.installments.map((v, i) => (
                  <p key={i} className="mt-1 flex flex-wrap justify-between gap-x-2"><span>Mensalidade {i + 1}</span><span>{brl(v)}</span></p>
                ))}
              </div>
            ) : null}
          </div>
          <Badge variant={p.cohort.available <= 3 ? "warn" : "success"} className="mt-4">
            {p.cohort.available} {p.cohort.available === 1 ? "vaga restante" : "vagas restantes"}
          </Badge>
        </Card>
        <Card className="flex items-start gap-2.5 p-4 text-xs text-muted">
          <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          Matrícula confirmada somente após a confirmação real do pagamento. Sem cobranças duplicadas: cada cobrança tem identificador único.
        </Card>
      </aside>
    </div>
  );
}