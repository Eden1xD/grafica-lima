"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { uploadCertificateModel, saveCertificateModel, publishCertificateModel } from "@/server/actions/certificate-models";
import { DEFAULT_LAYOUT, type Layout, type FieldName, type Placement, type Sponsor, type TextElement, type ShapeElement } from "@/lib/certificate-layout";

type Model = { id: string; name: string; active: boolean; layout: unknown; sponsors: unknown; courseId: string | null };
type Item = FieldName | "qr" | `sponsor:${string}` | `text:${string}` | `shape:${string}`;
const W = 842, H = 595;
const names: { key: FieldName; label: string }[] = [
  { key: "studentName", label: "Nome do aluno" }, { key: "cpf", label: "CPF e declaração" },
  { key: "courseName", label: "Nome do curso" }, { key: "workload", label: "Carga horária" },
  { key: "issuedAt", label: "Data de emissão" }, { key: "code", label: "Código de verificação" },
  { key: "syllabus", label: "Conteúdo programático" },
];
const example: Record<FieldName, string> = {
  studentName: "NOME COMPLETO DO ALUNO", cpf: "CPF nº 000.000.000-00, concluiu com êxito o curso de",
  courseName: "NOME DO CURSO", workload: "com carga horária total de 45 horas.",
  issuedAt: "Jundiá - AL, 22 de novembro de 2026.", code: "Código do Certificado: EXEMPLO123",
  verifyUrl: "https://exemplo.com/verificar", syllabus: "CONTEÚDO PROGRAMÁTICO\nNOME DO CURSO - 45 HORAS\nMódulo I - Introdução\nMódulo II - Prática",
};
const button = "rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800";
const input = "w-full rounded-lg border border-slate-300 bg-transparent px-2.5 py-2 text-sm dark:border-slate-700";
const panel = "rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900";
const merge = (value: unknown): Layout => ({ ...DEFAULT_LAYOUT, ...((value && typeof value === "object" ? value : {}) as Layout), texts: Array.isArray((value as Layout)?.texts) ? (value as Layout).texts : [], shapes: Array.isArray((value as Layout)?.shapes) ? (value as Layout).shapes : [] });
const readSponsors = (value: unknown): Sponsor[] => Array.isArray(value) ? value as Sponsor[] : [];
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function PdfBackground({ url, page, onSize, onError }: { url: string; page: number; onSize: (w: number, h: number) => void; onError: (error: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let stopped = false;
    let loading: { destroy: () => Promise<void> } | undefined;
    let render: { cancel: () => void; promise: Promise<unknown> } | undefined;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const task = pdfjs.getDocument({ url, withCredentials: true });
        loading = task;
        const doc = await task.promise;
        if (stopped) return;
        if (page + 1 > doc.numPages) throw new Error("O modelo não possui esta página.");
        const pdfPage = await doc.getPage(page + 1);
        const natural = pdfPage.getViewport({ scale: 1 });
        onSize(natural.width, natural.height);
        const viewport = pdfPage.getViewport({ scale: 1.8 });
        const el = canvas.current;
        if (!el || stopped) return;
        el.width = Math.ceil(viewport.width); el.height = Math.ceil(viewport.height);
        const context = el.getContext("2d");
        if (!context) throw new Error("Canvas indisponível");
        render = pdfPage.render({ canvas: el, canvasContext: context, viewport });
        await render.promise;
        if (!stopped) onError("");
      } catch (error) {
        if (!stopped && !(error instanceof Error && error.name === "RenderingCancelledException")) onError(error instanceof Error ? error.message : "Erro ao renderizar PDF");
      }
    })();
    return () => { stopped = true; render?.cancel(); void loading?.destroy(); };
  }, [url, page, onSize, onError]);
  return <canvas ref={canvas} className="pointer-events-none absolute inset-0 h-full w-full" aria-label="Página do PDF" />;
}

export function CertificateModelsEditor({ models }: { models: Model[] }) {
  const [id, setId] = useState(models[0]?.id ?? "");
  const [layout, setLayout] = useState<Layout>(() => merge(models[0]?.layout));
  const [sponsors, setSponsors] = useState<Sponsor[]>(() => readSponsors(models[0]?.sponsors));
  const [selected, setSelected] = useState<Item>("studentName");
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [showFields, setShowFields] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [snap, setSnap] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [pageSize, setPageSize] = useState({ width: W, height: H });
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ key: Item; dx: number; dy: number } | null>(null);
  const onSize = useCallback((width: number, height: number) => setPageSize(old => old.width === width && old.height === height ? old : { width, height }), []);
  const onError = useCallback((error: string) => setPdfError(error), []);
  const url = id ? `/api/certificados/modelos/${encodeURIComponent(id)}/arquivo` : "";
  const model = models.find(m => m.id === id);
  const texts = layout.texts ?? [], shapes = layout.shapes ?? [];
  const current: (Placement & { width?: number; height?: number; text?: string; type?: string }) | undefined =
    selected === "qr" ? layout.qr : selected.startsWith("sponsor:") ? sponsors.find(s => s.id === selected.slice(8)) :
    selected.startsWith("text:") ? texts.find(t => t.id === selected.slice(5)) :
    selected.startsWith("shape:") ? shapes.find(s => s.id === selected.slice(6)) as Placement | undefined : layout[selected as FieldName];

  function chooseModel(nextId: string) {
    const next = models.find(m => m.id === nextId); if (!next) return;
    setId(next.id); setLayout(merge(next.layout)); setSponsors(readSponsors(next.sponsors));
    setSelected("studentName"); setPage(0); setMessage(""); setPdfError("");
  }
  function update(key: string, value: string | number | boolean, item: Item = selected) {
    if (item.startsWith("sponsor:")) setSponsors(prev => prev.map(s => s.id === item.slice(8) ? { ...s, [key]: value } : s));
    else if (item.startsWith("text:")) setLayout(prev => ({ ...prev, texts: (prev.texts ?? []).map(t => t.id === item.slice(5) ? { ...t, [key]: value } : t) }));
    else if (item.startsWith("shape:")) setLayout(prev => ({ ...prev, shapes: (prev.shapes ?? []).map(s => s.id === item.slice(6) ? { ...s, [key]: value } : s) }));
    else if (item === "qr") setLayout(prev => ({ ...prev, qr: { ...prev.qr!, [key]: value } }));
    else setLayout(prev => ({ ...prev, [item]: { ...prev[item as FieldName]!, [key]: value } }));
  }
  function addText() {
    const id = crypto.randomUUID();
    setLayout(prev => ({ ...prev, texts: [...(prev.texts ?? []), { id, name: "Texto personalizado", text: "Novo texto", page, x: 90, y: 90, size: 16, maxWidth: 320, color: "#222222" }] }));
    setSelected(`text:${id}`);
  }
  function addShape(type: ShapeElement["type"]) {
    const id = crypto.randomUUID();
    setLayout(prev => ({ ...prev, shapes: [...(prev.shapes ?? []), { id, name: type === "line" ? "Linha" : type === "ellipse" ? "Círculo" : "Retângulo", type, page, x: 90, y: 120, width: 140, height: type === "line" ? 0 : 55, color: "#0d9488", opacity: 0.5, borderWidth: 2 }] }));
    setSelected(`shape:${id}`);
  }
  function duplicate() {
    if (selected.startsWith("text:")) { const t = texts.find(t => t.id === selected.slice(5)); if (!t) return; const id = crypto.randomUUID(); setLayout(prev => ({ ...prev, texts: [...(prev.texts ?? []), { ...t, id, x: t.x + 15, y: t.y + 15 }] })); setSelected(`text:${id}`); }
    else if (selected.startsWith("shape:")) { const s = shapes.find(s => s.id === selected.slice(6)); if (!s) return; const id = crypto.randomUUID(); setLayout(prev => ({ ...prev, shapes: [...(prev.shapes ?? []), { ...s, id, x: s.x + 15, y: s.y + 15 }] })); setSelected(`shape:${id}`); }
  }
  function remove() {
    if (selected.startsWith("sponsor:")) setSponsors(prev => prev.filter(s => s.id !== selected.slice(8)));
    else if (selected.startsWith("text:")) setLayout(prev => ({ ...prev, texts: (prev.texts ?? []).filter(t => t.id !== selected.slice(5)) }));
    else if (selected.startsWith("shape:")) setLayout(prev => ({ ...prev, shapes: (prev.shapes ?? []).filter(s => s.id !== selected.slice(6)) }));
    else return;
    setSelected("studentName");
  }
  function addSponsor(file: File) {
    if (file.size > 300_000 || !["image/png", "image/jpeg"].includes(file.type)) { setMessage("Envie PNG/JPG de até 300 KB."); return; }
    const reader = new FileReader();
    reader.onload = () => { const id = crypto.randomUUID(); setSponsors(prev => [...prev, { id, name: file.name, image: String(reader.result), page, x: 420, y: 430, width: 90, height: 60 }]); setSelected(`sponsor:${id}`); };
    reader.readAsDataURL(file);
  }
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setMessage("");
    try { await action(); setMessage(success); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Erro ao salvar."); }
    finally { setBusy(false); }
  }
  const pctX = (x: number) => `${x / pageSize.width * 100}%`;
  const pctY = (y: number) => `${y / pageSize.height * 100}%`;
  const posStyle = (x: number, y: number): CSSProperties => ({ left: pctX(x), top: pctY(y) });
  function startDrag(e: ReactPointerEvent<HTMLElement>, key: Item, x: number, y: number) {
    e.preventDefault(); e.stopPropagation();
    const rect = stage.current?.getBoundingClientRect(); if (!rect) return;
    drag.current = { key, dx: (e.clientX - rect.left) / rect.width * pageSize.width - x, dy: (e.clientY - rect.top) / rect.height * pageSize.height - y };
    setSelected(key); stage.current?.setPointerCapture(e.pointerId);
  }
  function moveDrag(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current || !stage.current) return;
    const rect = stage.current.getBoundingClientRect();
    const step = snap ? 10 : 1;
    const x = Math.round(clamp((e.clientX - rect.left) / rect.width * pageSize.width - drag.current.dx, 0, pageSize.width) / step) * step;
    const y = Math.round(clamp((e.clientY - rect.top) / rect.height * pageSize.height - drag.current.dy, 0, pageSize.height) / step) * step;
    update("x", x, drag.current.key); update("y", y, drag.current.key);
  }
  function select(item: Item) {
    setSelected(item);
    const p = item === "qr" ? layout.qr : item.startsWith("sponsor:") ? sponsors.find(s => s.id === item.slice(8)) : item.startsWith("text:") ? texts.find(t => t.id === item.slice(5)) : item.startsWith("shape:") ? shapes.find(s => s.id === item.slice(6)) : layout[item as FieldName];
    if (p) setPage(p.page);
  }
  const textSelected = selected !== "qr" && !selected.startsWith("sponsor:") && !selected.startsWith("shape:");
  const shapeSelected = selected.startsWith("shape:");
  const imageSelected = selected.startsWith("sponsor:");
  const numberInput = (key: string, label: string, min?: number, max?: number) => <label className="block text-xs font-semibold text-slate-500">{label}<input className={`${input} mt-1`} type="number" min={min} max={max} value={Number((current as unknown as Record<string, unknown>)?.[key] ?? 0)} onChange={e => update(key, Number(e.target.value))} /></label>;
  const toggle = (key: string, label: string) => <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean((current as unknown as Record<string, unknown>)?.[key])} onChange={e => update(key, e.target.checked)} />{label}</label>;
  const overlayStyle = (p: Placement): CSSProperties => ({ ...posStyle(p.x, p.y), width: pctX(p.maxWidth ?? 340), fontSize: `${p.size / pageSize.width * 100}cqw`, fontFamily: p.font === "TimesRoman" ? "Times New Roman, serif" : p.font === "Courier" ? "monospace" : "Arial, sans-serif", fontWeight: p.bold ? 700 : 400, fontStyle: p.italic ? "italic" : "normal", color: p.color ?? "#222222", textAlign: p.align ?? "left", lineHeight: p.lineHeight ?? 1.35, opacity: p.opacity ?? 1, transform: `rotate(${p.rotation ?? 0}deg)`, transformOrigin: "top left" });

  return <main className="mx-auto max-w-[1800px] space-y-4 px-3 py-5 lg:px-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-teal-600">Gráfica Lima / Certificados</p><h1 className="text-2xl font-bold">Editor visual de certificados</h1><p className="text-sm text-slate-500">Edite os elementos sobre o PDF original e salve o modelo.</p></div>{model?.active && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Modelo publicado</span>}</header>
    <form action={async fd => { await run(async () => { const next = await uploadCertificateModel(fd); window.location.href = `/admin/certificados/modelos?modelo=${encodeURIComponent(String(next))}`; }, "Modelo enviado."); }} className={`${panel} flex flex-wrap items-end gap-3`}>
      <label className="min-w-40 flex-1 text-xs font-semibold">Nome do novo modelo<input name="name" required placeholder="Ex.: Certificado Gráfica Lima" className={`${input} mt-1`} /></label>
      <label className="min-w-52 flex-1 text-xs font-semibold">PDF de frente e verso<input name="file" type="file" required accept="application/pdf" className={`${input} mt-1`} /></label>
      <button disabled={busy} className={button}>Enviar PDF</button>
    </form>
    {!id ? <div className={panel}>Envie um PDF para começar.</div> : <>
      <div className={`${panel} flex flex-wrap items-center gap-2`}>
        <select aria-label="Modelo" className={`${input} max-w-xs`} value={id} onChange={e => chooseModel(e.target.value)}>{models.map(m => <option key={m.id} value={m.id}>{m.name}{m.active ? " • Publicado" : ""}</option>)}</select>
        <div className="flex-1" />
        <a className={button} href={url} target="_blank" rel="noreferrer">Abrir PDF original</a>
        <button type="button" disabled={busy} className={button} onClick={() => void run(() => saveCertificateModel(id, layout, sponsors), "Alterações salvas.")}>Salvar alterações</button>
        <button type="button" disabled={busy} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600" onClick={() => void run(async () => { await saveCertificateModel(id, layout, sponsors); await publishCertificateModel(id); }, "Modelo publicado. Atualize para ver o status.")}>Publicar modelo</button>
      </div>
      <div className="grid items-start gap-3 xl:grid-cols-[210px_minmax(0,1fr)_310px]">
        <aside className={`${panel} space-y-4`}><h2 className="font-semibold">Adicionar elementos</h2>
          <button className={`${button} w-full`} type="button" onClick={addText}>+ Texto livre</button>
          <button className={`${button} w-full`} type="button" onClick={() => addShape("rectangle")}>+ Retângulo</button>
          <button className={`${button} w-full`} type="button" onClick={() => addShape("line")}>+ Linha</button>
          <button className={`${button} w-full`} type="button" onClick={() => addShape("ellipse")}>+ Círculo</button>
          <label className="block text-xs font-semibold">Adicionar imagem / assinatura<input type="file" accept="image/png,image/jpeg" className={`${input} mt-2 text-xs`} onChange={e => { const file = e.target.files?.[0]; if (file) addSponsor(file); e.target.value = ""; }} /></label>
          <div className="border-t pt-3 dark:border-slate-700"><h3 className="mb-2 text-sm font-semibold">Campos automáticos</h3><div className="space-y-1">{names.map(f => <button key={f.key} type="button" onClick={() => select(f.key)} className={`w-full rounded-md px-2 py-2 text-left text-xs ${selected === f.key ? "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}>{f.label}</button>)}<button type="button" onClick={() => select("qr")} className="w-full rounded-md px-2 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800">QR Code</button></div></div>
          {(texts.length > 0 || shapes.length > 0 || sponsors.length > 0) && <div className="border-t pt-3 dark:border-slate-700"><h3 className="mb-2 text-sm font-semibold">Elementos adicionados</h3>{texts.map(t => <button key={t.id} type="button" onClick={() => select(`text:${t.id}`)} className="block w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800">T · {t.name ?? t.text}</button>)}{shapes.map(s => <button key={s.id} type="button" onClick={() => select(`shape:${s.id}`)} className="block w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800">▢ {s.name ?? s.type}</button>)}{sponsors.map(s => <button key={s.id} type="button" onClick={() => select(`sponsor:${s.id}`)} className="block w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800">▧ {s.name}</button>)}</div>}
        </aside>
        <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3 dark:border-slate-800"><div className="flex gap-1">{["Frente", "Verso"].map((label, i) => <button type="button" key={label} className={`${button} ${page === i ? "border-teal-500 bg-teal-50 dark:bg-teal-950" : ""}`} onClick={() => setPage(i)}>{label}</button>)}</div><div className="flex flex-wrap items-center gap-2 text-xs"><label><input type="checkbox" checked={showFields} onChange={e => setShowFields(e.target.checked)} /> Campos</label><label><input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} /> Grade</label><label><input type="checkbox" checked={snap} onChange={e => setSnap(e.target.checked)} /> Encaixe</label><button type="button" className={button} onClick={() => setZoom(z => clamp(z - 25, 50, 200))}>−</button><span>{zoom}%</span><button type="button" className={button} onClick={() => setZoom(z => clamp(z + 25, 50, 200))}>+</button></div></div>
          <div className="overflow-auto bg-slate-200 p-4 dark:bg-slate-950"><div className="mx-auto" style={{ width: `${zoom}%`, minWidth: 300 }}><div ref={stage} className="relative isolate w-full overflow-hidden bg-white shadow-xl" style={{ aspectRatio: `${pageSize.width}/${pageSize.height}`, touchAction: "none", containerType: "inline-size" }} onPointerMove={moveDrag} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
            <PdfBackground url={url} page={page} onSize={onSize} onError={onError} />
            {showGrid && <div className="pointer-events-none absolute inset-0 z-10" style={{ backgroundImage: "linear-gradient(#0d948826 1px,transparent 1px),linear-gradient(90deg,#0d948826 1px,transparent 1px)", backgroundSize: `${pctX(10)} ${pctY(10)}` }} />}
            {showFields && shapes.filter(s => s.page === page && !s.hidden).map(s => <div key={s.id} title={s.name ?? s.type} onPointerDown={e => startDrag(e, `shape:${s.id}`, s.x, s.y)} className={`absolute z-20 cursor-grab border-2 ${selected === `shape:${s.id}` ? "border-teal-500" : "border-sky-400 border-dashed"}`} style={{ ...posStyle(s.x, s.y), width: pctX(s.width), height: pctY(Math.max(s.height, 2)), background: s.type === "line" ? "transparent" : s.color ?? "#0d9488", opacity: s.opacity ?? 1, borderRadius: s.type === "ellipse" ? "50%" : 0, borderBottom: s.type === "line" ? `${s.borderWidth ?? 2}px solid ${s.color ?? "#0d9488"}` : undefined }} />)}
            {showFields && names.map(({ key }) => { const p = layout[key]; if (!p || p.page !== page || p.hidden) return null; return <div key={key} title={key} onPointerDown={e => startDrag(e, key, p.x, p.y)} className={`absolute z-30 cursor-grab select-none whitespace-pre-wrap border px-0.5 ${selected === key ? "border-teal-500 bg-teal-100/50" : "border-dashed border-sky-400 bg-white/20"}`} style={overlayStyle(p)}>{example[key]}</div>; })}
            {showFields && texts.filter(t => t.page === page && !t.hidden).map(t => <div key={t.id} onPointerDown={e => startDrag(e, `text:${t.id}`, t.x, t.y)} className={`absolute z-30 cursor-grab select-none whitespace-pre-wrap border px-0.5 ${selected === `text:${t.id}` ? "border-teal-500 bg-teal-100/50" : "border-dashed border-sky-400 bg-white/20"}`} style={overlayStyle(t)}>{t.text}</div>)}
            {showFields && layout.qr?.page === page && !layout.qr.hidden && <div onPointerDown={e => startDrag(e, "qr", layout.qr!.x, layout.qr!.y)} className={`absolute z-30 flex cursor-grab items-center justify-center border-2 bg-white/85 text-xs font-bold text-slate-900 ${selected === "qr" ? "border-teal-600" : "border-sky-500"}`} style={{ ...posStyle(layout.qr.x, layout.qr.y), width: pctX(layout.qr.size), height: pctY(layout.qr.size) }}>QR</div>}
            {showFields && sponsors.filter(s => s.page === page && !s.hidden).map(s => <img key={s.id} src={s.image} alt={s.name} draggable={false} onPointerDown={e => startDrag(e, `sponsor:${s.id}`, s.x, s.y)} className={`absolute z-30 cursor-grab border-2 object-contain ${selected === `sponsor:${s.id}` ? "border-teal-600" : "border-sky-500"}`} style={{ ...posStyle(s.x, s.y), width: pctX(s.width), height: pctY(s.height), opacity: s.opacity ?? 1, transform: `rotate(${s.rotation ?? 0}deg)` }} />)}
          </div></div>{pdfError && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">Erro ao mostrar PDF: {pdfError}. Confira a instalação de pdfjs-dist e o arquivo enviado.</p>}</div>
          <p className="border-t px-3 py-2 text-xs text-slate-500 dark:border-slate-800">O fundo é o PDF real. Arraste os campos e salve. O arquivo-base deve estar limpo para não duplicar textos.</p>
        </section>
        <aside className={`${panel} space-y-4`}><h2 className="font-semibold">Propriedades</h2><select className={input} value={selected} onChange={e => select(e.target.value as Item)}>{names.map(n => <option key={n.key} value={n.key}>{n.label}</option>)}<option value="qr">QR Code</option>{texts.map(t => <option key={t.id} value={`text:${t.id}`}>{t.name ?? t.text}</option>)}{shapes.map(s => <option key={s.id} value={`shape:${s.id}`}>{s.name ?? s.type}</option>)}{sponsors.map(s => <option key={s.id} value={`sponsor:${s.id}`}>{s.name}</option>)}</select>
          {current && <><div className="grid grid-cols-2 gap-2">{numberInput("x", "Posição X")}{numberInput("y", "Posição Y")}</div><label className="block text-xs font-semibold text-slate-500">Página<select className={`${input} mt-1`} value={current.page} onChange={e => { update("page", Number(e.target.value)); setPage(Number(e.target.value)); }}><option value={0}>Frente</option><option value={1}>Verso</option></select></label>
            {textSelected && <><h3 className="border-t pt-3 text-sm font-semibold dark:border-slate-700">Tipografia</h3>{selected.startsWith("text:") && <label className="block text-xs font-semibold">Conteúdo<textarea className={`${input} mt-1 min-h-24`} value={(current as TextElement).text} onChange={e => update("text", e.target.value)} /></label>}
              <label className="block text-xs font-semibold text-slate-500">Família da fonte<select className={`${input} mt-1`} value={current.font ?? "Helvetica"} onChange={e => update("font", e.target.value)}><option value="Helvetica">Helvetica / Arial</option><option value="TimesRoman">Times New Roman</option><option value="Courier">Courier</option></select></label>
              <div className="grid grid-cols-2 gap-2">{numberInput("size", "Tamanho", 3, 150)}{numberInput("maxWidth", "Largura máxima", 20, 842)}</div>
              <div className="flex flex-wrap gap-4">{toggle("bold", "Negrito")}{toggle("italic", "Itálico")}{toggle("hidden", "Ocultar")}</div>
              <label className="block text-xs font-semibold text-slate-500">Alinhamento<select className={`${input} mt-1`} value={current.align ?? "left"} onChange={e => update("align", e.target.value)}><option value="left">Esquerda</option><option value="center">Centralizado</option><option value="right">Direita</option></select></label>
              <div className="grid grid-cols-2 gap-2">{numberInput("lineHeight", "Entrelinhas", 0.8, 3)}{numberInput("rotation", "Rotação", -360, 360)}</div>
            </>}
            {(textSelected || shapeSelected) && <label className="block text-xs font-semibold text-slate-500">Cor<input type="color" className="mt-1 h-10 w-full cursor-pointer" value={current.color ?? "#222222"} onChange={e => update("color", e.target.value)} /></label>}
            {(textSelected || shapeSelected || imageSelected) && <label className="block text-xs font-semibold text-slate-500">Opacidade ({Math.round((current.opacity ?? 1) * 100)}%)<input type="range" className="mt-2 w-full" min={0} max={100} value={Math.round((current.opacity ?? 1) * 100)} onChange={e => update("opacity", Number(e.target.value) / 100)} /></label>}
            {shapeSelected && <div className="grid grid-cols-2 gap-2">{numberInput("width", "Largura", 1, 842)}{numberInput("height", "Altura", 0, 595)}</div>}
            {imageSelected && <><div className="grid grid-cols-2 gap-2">{numberInput("width", "Largura", 1, 842)}{numberInput("height", "Altura", 1, 595)}</div>{numberInput("rotation", "Rotação", -360, 360)}</>}
            {selected === "qr" && numberInput("size", "Tamanho do QR", 10, 250)}
            {!textSelected && toggle("hidden", "Ocultar elemento")}
            {(selected.startsWith("text:") || shapeSelected) && <button type="button" className={`${button} w-full`} onClick={duplicate}>Duplicar elemento</button>}
            {(selected.startsWith("text:") || shapeSelected || imageSelected) && <button type="button" className={`${button} w-full border-rose-400 text-rose-600`} onClick={remove}>Excluir elemento</button>}
          </>}
          <p className="border-t pt-3 text-xs leading-relaxed text-slate-500 dark:border-slate-700">Fontes Helvetica, Times e Courier são suportadas pelo gerador. A assinatura já incorporada ao PDF-base continua preservada.</p>
        </aside>
      </div>
    </>}
    {message && <p role="status" className="rounded-lg border border-teal-300 bg-teal-50 p-3 text-sm text-teal-900 dark:bg-teal-950 dark:text-teal-100">{message}</p>}
  </main>;
}
