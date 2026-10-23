"use client";

interface AnalysisPanelProps {
  commentCount: number;
  isLoading: boolean;
  hasResult: boolean;
  error: string;
  model: string;
  models: string[];
  modelsLoading: boolean;
  modelsError: string;
  progress: { completed: number; total: number };
  onModelChange: (model: string) => void;
  onRefreshModels: () => void;
  onAnalyze: () => void;
  onCancel: () => void;
}

export default function AnalysisPanel({
  commentCount, isLoading, hasResult, error, model, models, modelsLoading, modelsError,
  progress, onModelChange, onRefreshModels, onAnalyze, onCancel,
}: AnalysisPanelProps) {
  return (
    <section id="analise" aria-labelledby="analise-titulo" className="mt-6 scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.16em] text-[#47678f]">03 · ANÁLISE LOCAL</p>
          <h2 id="analise-titulo" className="mt-2 text-lg font-semibold text-[#172b43]">Analisar com o Ollama</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-600">Somente DeepSeek-R1 local</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Revise a amostra acima antes de analisar. Somente os comentários SANITIZED e seus IDs serão enviados ao Ollama neste computador.
      </p>
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-52 text-sm font-semibold text-slate-700">
          <label htmlFor="local-model">Modelo local</label>
          <select id="local-model" value={models.includes(model) ? model : ""} disabled={modelsLoading || isLoading || !models.length} onChange={(event) => onModelChange(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal disabled:opacity-60">
            {!models.length && <option value="">{modelsLoading ? "Consultando Ollama…" : "Nenhum modelo disponível"}</option>}
            {models.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        <button type="button" disabled={modelsLoading || isLoading} onClick={onRefreshModels} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-medium disabled:opacity-40">Atualizar modelos</button>
      </div>
      {modelsError && <p role="alert" className="mt-3 text-sm leading-6 text-red-800">{modelsError}</p>}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={commentCount === 0 || isLoading || modelsLoading || !models.includes(model)}
          onClick={onAnalyze}
          className="rounded-lg bg-[#244b7b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#183959] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isLoading ? "Analisando com IA…" : "Analisar com IA"}
        </button>
        {isLoading && (
          <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-700">
            Cancelar análise
          </button>
        )}
        {!isLoading && <p className="text-xs text-slate-500">{commentCount === 0 ? "Importe uma planilha para começar." : `${commentCount} comentários higienizados disponíveis.`}</p>}
      </div>
      <div role="status" aria-live="polite" aria-atomic="true">
        {isLoading && (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <span aria-hidden="true" className="size-4 shrink-0 animate-spin rounded-full border-2 border-blue-200 border-t-blue-800 motion-reduce:animate-none" />
            {progress.total === 0 ? "Verificando o modelo local…" : "Lote " + Math.min(progress.completed + 1, progress.total) + " de " + progress.total + " · " + progress.completed + " concluídos. O carregamento inicial pode demorar."}
          </p>
        )}
        {hasResult && <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">Análise concluída e validada com sucesso! <a href="#resultados" className="underline underline-offset-4">Ver resultados</a></p>}
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      <p className="mt-4 text-xs leading-5 text-slate-500">Alterar o modelo, a planilha ou a higienização descarta o resultado anterior. O resultado validado fica apenas na memória desta página.</p>
    </section>
  );
}
