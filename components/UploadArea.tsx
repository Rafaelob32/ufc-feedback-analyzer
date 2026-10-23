"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { validateFileSize } from "@/lib/importLimits";

const acceptedExtension = /\.(xls|xlsx)$/i;

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const unit = bytes < 1024 * 1024 ? "KB" : "MB";
  const divisor = unit === "KB" ? 1024 : 1024 * 1024;
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(bytes / divisor)} ${unit}`;
}

interface UploadAreaProps {
  onFileSelect: (file: File | null) => void;
}

export default function UploadArea({ onFileSelect }: UploadAreaProps) {
  // A referência ao File existe somente nesta sessão, sem persistência.
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectButtonRef = useRef<HTMLButtonElement>(null);
  const dragDepth = useRef(0);

  function selectFile(files: FileList) {
    if (files.length === 0) return;
    if (files.length !== 1) {
      setError("Selecione apenas uma planilha por vez.");
      return;
    }

    const file = files[0];
    if (!acceptedExtension.test(file.name)) {
      setError("Formato não aceito. Selecione uma planilha .xls ou .xlsx.");
      return;
    }

    try { validateFileSize(file.size); }
    catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível selecionar o arquivo.");
      return;
    }
    setSelectedFile(file);
    setError("");
    onFileSelect(file);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) selectFile(event.target.files);
    // Permite selecionar novamente o mesmo arquivo após removê-lo.
    event.target.value = "";
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!event.dataTransfer.types.includes("Files")) return;
    dragDepth.current += 1;
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    selectFile(event.dataTransfer.files);
  }

  function removeFile() {
    setSelectedFile(null);
    setError("");
    onFileSelect(null);
    selectButtonRef.current?.focus();
  }

  return (
    <section id="importacao" aria-labelledby="upload-title" className="rounded-2xl border border-slate-200 bg-white shadow-[0_4px_24px_-12px_rgba(23,43,67,0.12)]">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5 sm:px-7">
        <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#edf3fc] text-xs font-bold text-[#365e94]">01</span>
        <div>
          <h2 id="upload-title" className="text-base font-semibold text-[#172b43]">Selecione sua planilha</h2>
          <p className="mt-0.5 text-xs text-slate-500">O primeiro passo da sua análise.</p>
        </div>
        <span className="ml-auto hidden rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-bold tracking-wider text-slate-500 sm:block">EXCEL</span>
      </div>

      <div className="p-5 sm:p-7">
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDrop={handleDrop}
          className={`flex min-h-[276px] flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors motion-reduce:transition-none ${isDragging ? "border-[#386bc0] bg-[#eaf1fc]" : "border-[#c9d6e8] bg-[#f9fbfe]"}`}
        >
          <span aria-hidden="true" className="mb-5 grid size-14 place-items-center rounded-2xl border border-[#dce6f5] bg-white text-[#3e6aaa] shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h7l4 4v4M7 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4M14 3v5h4M9 11h3M9 15h2m4 2 3-3 3 3m-3-3v7" />
            </svg>
          </span>
          <p className="text-base font-semibold text-[#2b466a] sm:text-lg">{isDragging ? "Solte sua planilha aqui" : "Arraste sua planilha até aqui"}</p>
          <p id="upload-formats" className="mt-2 text-xs text-slate-500 sm:text-sm">Uma planilha Excel .xls ou .xlsx · Até 10 MB</p>
          <input
            ref={inputRef}
            type="file"
            accept=".xls,.xlsx"
            aria-label="Selecionar planilha Excel"
            aria-describedby="upload-formats upload-scope"
            onChange={handleChange}
            className="hidden"
          />
          <button
            ref={selectButtonRef}
            type="button"
            onClick={() => inputRef.current?.click()}
            aria-describedby={`upload-formats upload-scope${error ? " upload-error" : ""}`}
            className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#285b9f] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#204c88] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#285b9f] motion-reduce:transition-none"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 6V4.5A1.5 1.5 0 0 1 4 3h4l2 2h6A1.5 1.5 0 0 1 17.5 6.5V7M3 7h14l-1.5 9h-12L2 7h1Z" />
            </svg>
            {selectedFile ? "Trocar planilha" : "Selecionar planilha"}
          </button>
        </div>

        {error && <p id="upload-error" role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

        <div role="status" aria-live="polite" aria-atomic="true">
          {selectedFile && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-[#d3e2d9] bg-[#f3f8f5] px-4 py-3">
              <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-md bg-[#e0eee5] text-[#326647]">✓</span>
              <div className="min-w-0 flex-1 basis-32">
                <p className="text-xs font-medium text-[#326647]">Arquivo selecionado</p>
                <p className="mt-0.5 text-sm font-semibold break-all text-slate-800">{selectedFile.name}</p>
                <p className="mt-1 text-xs text-slate-600">{formatFileSize(selectedFile.size)} · Apenas neste navegador</p>
              </div>
              <button
                type="button"
                onClick={removeFile}
                aria-label={`Remover ${selectedFile.name}`}
                className="min-h-11 rounded-md px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-[#e0eee5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285b9f]"
              >
                Remover
              </button>
            </div>
          )}
        </div>

        <p id="upload-scope" className="mt-5 flex items-start gap-2 text-xs leading-5 text-slate-500">
          <span aria-hidden="true" className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-slate-300 text-[10px] font-semibold">i</span>
          A leitura usa a primeira aba. Aceita o relatório de questões abertas do SIGAA/UFC, com blocos por disciplina, ou uma tabela com “Comentário” ou “Comentários” na primeira linha preenchida. No relatório SIGAA, são importados os comentários de docentes e discentes; cabeçalhos e avisos de ausência de comentários são ignorados.
        </p>
      </div>
    </section>
  );
}
