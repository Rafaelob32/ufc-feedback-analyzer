"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { AnalysisResult } from "@/lib/schema";
import { ASPECTS, SENTIMENTS, classificationRows, countSentiments, filterClassifications, type Aspect, type Sentiment } from "@/lib/results";
import type { RawComment } from "@/types";

const sentimentColors: Record<Sentiment, string> = {
  Positivo: "bg-emerald-100 text-emerald-900",
  Negativo: "bg-rose-100 text-rose-900",
  Neutro: "bg-slate-100 text-slate-700",
};
const barColors: Record<Sentiment, string> = {
  Positivo: "bg-emerald-600", Negativo: "bg-rose-600", Neutro: "bg-slate-500",
};

function EvidenceDialog({ comment, onClose }: { comment: RawComment; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    return () => { element?.close(); trigger?.focus(); };
  }, []);
  return (
    <dialog ref={dialog} onClose={(event) => { if (!event.currentTarget.open) onClose(); }} aria-labelledby="evidence-title" className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-800 shadow-2xl backdrop:bg-slate-950/50 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-wide text-[#47678f]">EVIDÊNCIA ORIGINAL · RAW</p>
          <h3 id="evidence-title" className="mt-2 text-xl font-semibold">Comentário [{comment.id}]</h3>
          <p className="mt-1 break-words text-xs text-slate-500">Linha {comment.rowIndex} · Aba {comment.sheetName}</p>
        </div>
        <button type="button" onClick={() => dialog.current?.close()} className="min-h-11 shrink-0 rounded-lg border border-slate-300 px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-blue-700">Fechar</button>
      </div>
      <p className="mt-6 whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 text-sm leading-7">{comment.text}</p>
      <p className="mt-4 text-xs leading-5 text-slate-500">Texto original mantido na memória deste navegador. Esta consulta não envia dados ao Ollama.</p>
    </dialog>
  );
}

export default function ResultsPanel({ result, rawComments, model }: {
  result: AnalysisResult; rawComments: readonly RawComment[]; model: string;
}) {
  const [tab, setTab] = useState<"summary" | "absa">("summary");
  const [aspect, setAspect] = useState<Aspect | "">("");
  const [sentiment, setSentiment] = useState<Sentiment | "">("");
  const [page, setPage] = useState(0);
  const [evidenceId, setEvidenceId] = useState<number | null>(null);
  const summaryTab = useRef<HTMLButtonElement>(null);
  const absaTab = useRef<HTMLButtonElement>(null);
  const rawById = useMemo(() => new Map(rawComments.map((comment) => [comment.id, comment])), [rawComments]);
  const rows = useMemo(() => classificationRows(result), [result]);
  const filtered = useMemo(() => filterClassifications(rows, aspect, sentiment), [rows, aspect, sentiment]);
  const counts = countSentiments(filtered);
  const classified = new Set(rows.map(({ commentId }) => commentId)).size;
  const pageCount = Math.max(1, Math.ceil(filtered.length / 25));
  const currentPage = Math.min(page, pageCount - 1);
  const evidence = evidenceId === null ? undefined : rawById.get(evidenceId);

  function moveTab(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? "summary" : event.key === "End" ? "absa" : tab === "summary" ? "absa" : "summary";
    setTab(next);
    (next === "summary" ? summaryTab : absaTab).current?.focus();
  }

  function citation(id: number) {
    return <button type="button" key={id} onClick={() => setEvidenceId(id)} aria-label={"Ver comentário original " + id} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-blue-50 px-2 font-semibold text-blue-800 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">[{id}]</button>;
  }

  return (
    <section id="resultados" aria-labelledby="results-title" className="mt-6 min-w-0 scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
      <p className="text-[10px] font-bold tracking-[0.16em] text-[#47678f]">04 · RESULTADOS</p>
      <h2 id="results-title" className="mt-2 text-xl font-semibold text-[#172b43]">Cada conclusão, sua evidência</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">Clique nos números para conferir o texto original. As interpretações do modelo precisam de revisão humana.</p>
      <p className="mt-2 break-words text-xs text-slate-500">Modelo: {model} · {rawComments.length} comentários enviados · {classified} com classificação ABSA.</p>
      <div role="tablist" aria-label="Resultados da análise" className="mt-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {(["summary", "absa"] as const).map((name) => (
          <button key={name} ref={name === "summary" ? summaryTab : absaTab} id={name + "-tab"} type="button" role="tab" aria-selected={tab === name} aria-controls={name + "-panel"} tabIndex={tab === name ? 0 : -1} onKeyDown={moveTab} onClick={() => setTab(name)} className={"min-h-11 rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 " + (tab === name ? "bg-[#244b7b] text-white" : "text-slate-600 hover:bg-slate-100")}>
            {name === "summary" ? "Sumário rastreável" : "Dashboard ABSA"}
          </button>
        ))}
      </div>
      <div id="summary-panel" role="tabpanel" aria-labelledby="summary-tab" hidden={tab !== "summary"} tabIndex={0} className="mt-5 space-y-4 focus-visible:outline-2 focus-visible:outline-blue-700">
        {result.summary.length === 0 && <p className="py-4 text-sm text-slate-600">O modelo não retornou pontos de síntese para estes comentários.</p>}
        {result.summary.map((item, index) => (
          <article key={index} className="rounded-xl border border-slate-200 p-4">
            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">{item.text || "O modelo não forneceu texto para este ponto."}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2"><span className="mr-1 text-xs text-slate-500">Evidências</span>{[...new Set(item.evidenceIds)].map(citation)}</div>
          </article>
        ))}
        <p className="text-xs leading-5 text-slate-500">Em relatórios maiores, os pontos de síntese são reunidos dos lotes analisados; assuntos semelhantes podem aparecer em mais de um ponto.</p>
      </div>
      <div id="absa-panel" role="tabpanel" aria-labelledby="absa-tab" hidden={tab !== "absa"} tabIndex={0} className="mt-5 space-y-5 focus-visible:outline-2 focus-visible:outline-blue-700">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="text-sm font-semibold text-slate-700">
            <label htmlFor="aspect-filter">Aspecto</label>
            <select id="aspect-filter" value={aspect} onChange={(event) => { setAspect(event.target.value as Aspect | ""); setPage(0); }} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal">
              <option value="">Todos os aspectos</option>{ASPECTS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <div className="text-sm font-semibold text-slate-700">
            <label htmlFor="sentiment-filter">Sentimento</label>
            <select id="sentiment-filter" value={sentiment} onChange={(event) => { setSentiment(event.target.value as Sentiment | ""); setPage(0); }} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal">
              <option value="">Todos os sentimentos</option>{SENTIMENTS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
        </div>
        <figure className="rounded-xl bg-slate-50 p-4">
          <figcaption className="text-sm font-semibold">Classificações por sentimento</figcaption>
          <ul className="mt-4 space-y-3">
            {counts.map(({ sentiment: label, count }) => (
              <li key={label} className="grid grid-cols-[70px_1fr_32px] items-center gap-3 text-xs">
                <span>{label}</span><div aria-hidden="true" className="h-3 overflow-hidden rounded-full bg-slate-200"><div className={"h-full rounded-full " + barColors[label]} style={{ width: (filtered.length ? count / filtered.length * 100 : 0) + "%" }} /></div><span className="text-right font-semibold">{count}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-5 text-slate-500">Contagem de pares de aspecto e sentimento por comentário, após os filtros. Um comentário pode contribuir com mais de uma classificação; repetições idênticas contam uma vez.</p>
        </figure>
        <p role="status" className="text-sm text-slate-600">{filtered.length} classificações encontradas. {rawComments.length - classified} comentários sem classificação retornada.</p>
        {filtered.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 p-5 text-sm text-slate-500">Nenhuma classificação corresponde aos filtros.</p> : (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Classificações ABSA com links para os comentários originais</caption>
                <thead className="bg-slate-50 text-xs text-slate-600"><tr><th scope="col" className="p-3">Evidência</th><th scope="col" className="p-3">Aspecto</th><th scope="col" className="p-3">Sentimento</th></tr></thead>
                <tbody>{filtered.slice(currentPage * 25, (currentPage + 1) * 25).map((row) => (
                  <tr key={JSON.stringify(row)} className="border-t border-slate-100">
                    <td className="p-2">{citation(row.commentId)}</td><td className="p-3">{row.aspect}</td>
                    <td className="p-3"><span className={"rounded-full px-2.5 py-1 text-xs font-medium " + sentimentColors[row.sentiment]}>{row.sentiment}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {pageCount > 1 && <nav aria-label="Páginas de classificações" className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="min-h-11 rounded-lg border px-3 disabled:opacity-40">Anterior</button>
              <span>Página {currentPage + 1} de {pageCount}</span>
              <button type="button" disabled={currentPage + 1 === pageCount} onClick={() => setPage(currentPage + 1)} className="min-h-11 rounded-lg border px-3 disabled:opacity-40">Próxima</button>
            </nav>}
          </>
        )}
      </div>
      {evidence && <EvidenceDialog key={evidence.id} comment={evidence} onClose={() => setEvidenceId(null)} />}
    </section>
  );
}
