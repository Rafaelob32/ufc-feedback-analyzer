"use client";

import { useEffect, useRef, useState } from "react";
import UploadArea from "@/components/UploadArea";
import AnalysisPanel from "@/components/AnalysisPanel";
import ResultsPanel from "@/components/ResultsPanel";
import { listLocalModels } from "@/lib/ollamaConnection";
import SanitizationPanel from "@/components/SanitizationPanel";
import type { SanitizationSettings } from "@/lib/sanitizationSettings";
import { parseComments, sanitizeInWorker, ProcessingError } from "@/lib/commentProcessing";
import { analyzeComments, OLLAMA_MODEL, OllamaError } from "@/lib/ollama";
import type { AnalysisResult } from "@/lib/schema";
import type { RawComment, SanitizedComment } from "@/types";

export default function Home() {
  const [rawComments, setRawComments] = useState<readonly RawComment[]>([]);
  const [sanitizedComments, setSanitizedComments] = useState<readonly SanitizedComment[]>([]);
  const [sanitizationSettings, setSanitizationSettings] = useState<SanitizationSettings>({ namesText: "", registrationRule: "6-7" });
  const settingsRef = useRef(sanitizationSettings);
  const [readStatus, setReadStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [readError, setReadError] = useState("");
  const importRequest = useRef<AbortController | null>(null);
  const sanitizationRequest = useRef<AbortController | null>(null);
  const [isSanitizing, setIsSanitizing] = useState(false);
  const [sanitizationError, setSanitizationError] = useState("");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const analysisRequest = useRef<AbortController | null>(null);
  const [model, setModel] = useState(OLLAMA_MODEL);
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState("");
  const [modelRefresh, setModelRefresh] = useState(0);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });

  useEffect(() => {
    const controller = new AbortController();
    listLocalModels(controller.signal).then((available) => {
      if (controller.signal.aborted) return;
      setModels(available);
      setModel((previous) => available.includes(previous) ? previous : available[0] ?? "");
      setModelsError(available.length ? "" : "Nenhum DeepSeek-R1 local encontrado. Instale-o com ollama pull deepseek-r1 e atualize a lista.");
    }).catch((error) => {
      if (controller.signal.aborted) return;
      setModels([]);
      setModelsError(error instanceof OllamaError ? error.message : "Não foi possível consultar os modelos.");
    }).finally(() => {
      if (!controller.signal.aborted) setModelsLoading(false);
    });
    return () => controller.abort();
  }, [modelRefresh]);

  useEffect(() => () => {
    analysisRequest.current?.abort();
    analysisRequest.current = null;
    importRequest.current?.abort();
    importRequest.current = null;
    sanitizationRequest.current?.abort();
    sanitizationRequest.current = null;
  }, []);

  function invalidateAnalysis() {
    analysisRequest.current?.abort();
    analysisRequest.current = null;
    setAnalysisResult(null);
    setIsAnalyzing(false);
    setAnalysisError("");
    setProgress({ completed: 0, total: 0 });
  }

  function handleModelChange(next: string) {
    invalidateAnalysis();
    setModel(next);
  }

  function refreshModels() {
    invalidateAnalysis();
    setModelsLoading(true);
    setModelsError("");
    setModelRefresh((value) => value + 1);
  }

  async function handleAnalyze() {
    if (analysisRequest.current || sanitizationRequest.current || sanitizedComments.length === 0 || readStatus !== "success" || modelsLoading || !models.includes(model)) return;
    const request = new AbortController();
    analysisRequest.current = request;
    setAnalysisResult(null);
    setAnalysisError("");
    setIsAnalyzing(true);
    setProgress({ completed: 0, total: 0 });
    try {
      const result = await analyzeComments(sanitizedComments, request.signal, {
        model,
        onProgress: (completed, total) => {
          if (analysisRequest.current === request) setProgress({ completed, total });
        },
      });
      // Uma resposta de outra planilha/configuração nunca pode atualizar o estado.
      if (analysisRequest.current !== request) return;
      setAnalysisResult(result);
    } catch (error) {
      if (analysisRequest.current !== request) return;
      setAnalysisError(error instanceof OllamaError ? error.message : "Não foi possível concluir a análise. Tente novamente.");
    } finally {
      if (analysisRequest.current === request) {
        analysisRequest.current = null;
        setIsAnalyzing(false);
      }
    }
  }

  async function startSanitization(raw: readonly RawComment[], settings: SanitizationSettings) {
    sanitizationRequest.current?.abort();
    sanitizationRequest.current = null;
    setSanitizedComments([]);
    setSanitizationError("");
    setIsSanitizing(raw.length > 0);
    if (raw.length === 0) return;
    const request = new AbortController();
    sanitizationRequest.current = request;
    try {
      const comments = await sanitizeInWorker(raw, settings, request.signal);
      if (sanitizationRequest.current !== request) return;
      setSanitizedComments(comments);
    } catch (error) {
      if (sanitizationRequest.current !== request) return;
      setSanitizationError(error instanceof ProcessingError ? error.message : "Não foi possível higienizar os comentários. Tente novamente.");
    } finally {
      if (sanitizationRequest.current === request) {
        sanitizationRequest.current = null;
        setIsSanitizing(false);
      }
    }
  }

  function handleSettingsChange(settings: SanitizationSettings) {
    invalidateAnalysis();
    // Uma leitura pendente usará a configuração mais recente ao terminar.
    settingsRef.current = settings;
    setSanitizationSettings(settings);
    // Somente a coleção SANITIZED é substituída; RAW permanece intacto.
    void startSanitization(rawComments, settings);
  }

  async function handleFileSelect(file: File | null) {
    invalidateAnalysis();
    importRequest.current?.abort();
    importRequest.current = null;
    sanitizationRequest.current?.abort();
    sanitizationRequest.current = null;
    setIsSanitizing(false);
    setSanitizationError("");
    setRawComments([]);
    setSanitizedComments([]);
    setReadError("");
    if (!file) {
      setReadStatus("idle");
      return;
    }

    setReadStatus("loading");
    const request = new AbortController();
    importRequest.current = request;
    try {
      const comments = await parseComments(file, request.signal);
      // Trocar ou remover um arquivo invalida qualquer leitura anterior.
      if (importRequest.current !== request) return;
      setRawComments(comments);
      setReadStatus("success");
      void startSanitization(comments, settingsRef.current);
    } catch (error) {
      if (importRequest.current !== request) return;
      setReadError(error instanceof ProcessingError ? error.message : "Não foi possível ler a planilha. Tente novamente.");
      setReadStatus("error");
    } finally {
      if (importRequest.current === request) importRequest.current = null;
    }
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-4 focus:text-blue-800 focus:shadow-lg"
      >
        Pular para o conteúdo
      </a>

      <aside className="flex flex-col bg-[#142d4e] text-white lg:min-h-dvh">
        <div className="flex items-center gap-3 px-6 py-6 lg:px-7 lg:py-9">
          <span aria-hidden="true" className="grid size-10 place-items-center rounded-xl bg-white/10 text-xl font-bold text-[#c7ddff]">
            a
          </span>
          <div>
            <p className="text-2xl font-bold tracking-tight">avalia<span className="text-[#9dbff4]">.</span></p>
            <p className="mt-0.5 text-[10px] font-semibold tracking-[0.2em] text-[#b5c7df]">AVALIAÇÃO INSTITUCIONAL</p>
          </div>
          <span className="ml-auto rounded border border-white/20 px-2 py-1 text-[10px] text-[#c8d6e8] lg:hidden">PoC UFC</span>
        </div>

        <div className="hidden px-5 pt-10 lg:block">
          <p className="mb-4 px-3 text-[10px] font-bold tracking-[0.18em] text-[#9eb5d3]">ESPAÇO DE ANÁLISE</p>
          <a href="#importacao" className="flex items-center gap-3 rounded-lg border border-white/10 bg-[#244467] px-3 py-3.5 text-sm font-semibold">
            <span aria-hidden="true" className="grid size-6 place-items-center rounded-md bg-[#accbf5] text-xs text-[#142d4e]">01</span>
            Importar planilha
            <span aria-hidden="true" className="ml-auto size-1.5 rounded-full bg-[#accbf5]" />
          </a>
          <a href="#higienizacao" className="mt-2 flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-[#c8d6e8] hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            <span aria-hidden="true" className="grid size-6 place-items-center text-xs">02</span>
            Higienização dos dados
          </a>
          <a href="#analise" className="mt-2 flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-[#c8d6e8] hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            <span aria-hidden="true" className="grid size-6 place-items-center text-xs">03</span>
            Análise local
          </a>
          {analysisResult && <a href="#resultados" className="mt-2 flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-[#c8d6e8] hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white">
            <span aria-hidden="true" className="grid size-6 place-items-center text-xs">04</span>
            Resultados
          </a>}
        </div>

        <div className="mt-auto hidden px-7 pb-8 pt-16 lg:block">
          <div className="border-t border-white/15 pt-6">
            <p className="text-sm font-semibold">PoC UFC</p>
            <p className="mt-2 text-xs leading-5 text-[#afc1d9]">Pesquisa em análise de<br />avaliações institucionais.</p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 sm:px-10">
          <p className="text-sm text-slate-500">Espaço de análise <span aria-hidden="true" className="mx-2 text-slate-300">/</span> <span className="font-medium text-slate-800">Avaliações</span></p>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-600" />
            Ambiente local
          </span>
        </header>

        <main id="conteudo" className="mx-auto w-full max-w-[1100px] flex-1 px-5 py-10 sm:px-10 sm:py-14">
          <div className="mb-8 sm:mb-10">
            <p className="mb-4 text-[11px] font-bold tracking-[0.18em] text-[#47678f]">ANÁLISE · IA LOCAL</p>
            <h1 className="text-3xl leading-tight font-semibold tracking-tight text-[#172b43] sm:text-[38px]">Um novo olhar sobre<br className="hidden sm:block" /> as avaliações.</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">Importe sua planilha, revise a higienização e analise os comentários com o Ollama no seu computador.</p>
          </div>

          <UploadArea onFileSelect={handleFileSelect} />

          <div role="status" aria-live="polite" aria-atomic="true" aria-busy={readStatus === "loading"}>
            {readStatus === "loading" && (
              <p className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-900">Lendo planilha no navegador…</p>
            )}
            {readStatus === "success" && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
                <p className="font-semibold">
                  {rawComments.length === 0
                    ? "Nenhum comentário preenchido foi encontrado."
                    : rawComments.length === 1
                      ? "1 comentário identificado e carregado em memória."
                      : `${rawComments.length} comentários identificados e carregados em memória.`}
                </p>
                <p className="mt-1 text-xs leading-5">
                  {rawComments.length === 0
                    ? "A planilha foi reconhecida, mas não há comentários preenchidos."
                    : "Textos originais preservados e vinculados às linhas da planilha. Revise a versão higienizada antes de analisar."}
                </p>
              </div>
            )}
          </div>
          {readStatus === "error" && (
            <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">{readError}</p>
          )}

          <SanitizationPanel
            rawComments={rawComments}
            sanitizedComments={sanitizedComments}
            settings={sanitizationSettings}
            onSettingsChange={handleSettingsChange}
            isProcessing={isSanitizing}
            error={sanitizationError}
            onRetry={() => { void startSanitization(rawComments, settingsRef.current); }}
          />

          <AnalysisPanel
            commentCount={sanitizedComments.length}
            isLoading={isAnalyzing}
            hasResult={analysisResult !== null}
            error={analysisError}
            model={model}
            models={models}
            modelsLoading={modelsLoading}
            modelsError={modelsError}
            progress={progress}
            onModelChange={handleModelChange}
            onRefreshModels={refreshModels}
            onAnalyze={handleAnalyze}
            onCancel={invalidateAnalysis}
          />

          {analysisResult && <ResultsPanel result={analysisResult} rawComments={rawComments} model={model} />}

          <section aria-labelledby="privacidade-titulo" className="mt-6 flex items-start gap-3 rounded-xl border border-[#dce5ed] bg-[#eef3f8] px-5 py-5 sm:px-6">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mt-0.5 size-5 shrink-0 text-[#527396]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 4.5 6v5.2c0 4.4 3 7.6 7.5 9.8 4.5-2.2 7.5-5.4 7.5-9.8V6L12 3Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.5 12 2.5 2.5 4.5-5" />
            </svg>
            <div>
              <h2 id="privacidade-titulo" className="text-sm font-semibold text-[#2c4a6c]">Privacidade desde o primeiro passo</h2>
              <p className="mt-1 text-xs leading-5 text-[#4e6680] sm:text-sm">O arquivo e os comentários RAW ficam apenas na memória do navegador. Somente a versão SANITIZED é enviada ao Ollama local ao clicar em analisar. Remover o arquivo descarta os comentários e resultados; o dicionário de nomes e as configurações permanecem até recarregar ou fechar a página.</p>
            </div>
          </section>
        </main>

        <footer className="mx-5 flex flex-wrap justify-between gap-2 border-t border-slate-200 py-5 text-xs text-slate-500 sm:mx-10">
          <p>Avalia · Prova de conceito</p>
          <p>Integração com Ollama local</p>
        </footer>
      </div>
    </div>
  );
}
