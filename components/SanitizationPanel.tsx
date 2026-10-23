"use client";

import { useState } from "react";
import type { RawComment, SanitizedComment } from "@/types";

export const registrationRules = {
  "6-7": { min: 6, max: 7 },
  "6": { min: 6, max: 6 },
  "7": { min: 7, max: 7 },
  "8": { min: 8, max: 8 },
} as const;

export interface SanitizationSettings {
  namesText: string;
  registrationRule: keyof typeof registrationRules;
}

interface SanitizationPanelProps {
  rawComments: readonly RawComment[];
  sanitizedComments: readonly SanitizedComment[];
  settings: SanitizationSettings;
  onSettingsChange: (settings: SanitizationSettings) => void;
}

export default function SanitizationPanel({
  rawComments, sanitizedComments, settings, onSettingsChange,
}: SanitizationPanelProps) {
  const [previewId, setPreviewId] = useState<number | null>(null);
  const original = rawComments.find((comment) => comment.id === previewId) ?? rawComments[0];
  const sanitized = sanitizedComments.find((comment) => comment.id === original?.id);

  return (
    <section id="higienizacao" aria-labelledby="sanitization-title" className="mt-6 scroll-mt-6 rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5 sm:px-7">
        <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#edf3fc] text-xs font-bold text-[#365e94]">02</span>
        <div>
          <h2 id="sanitization-title" className="text-base font-semibold text-[#172b43]">Higienização dos comentários</h2>
          <p className="mt-0.5 text-xs text-slate-500">Duas versões separadas, conectadas pelo mesmo ID.</p>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-7">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="known-names" className="block text-sm font-semibold text-slate-700">Nomes conhecidos</label>
            <textarea
              id="known-names"
              rows={3}
              value={settings.namesText}
              onChange={(event) => onSettingsChange({ ...settings, namesText: event.target.value })}
              autoComplete="off"
              spellCheck={false}
              aria-describedby="known-names-help"
              placeholder={"Um nome por linha"}
              className="mt-2 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285b9f]"
            />
            <p id="known-names-help" className="mt-1 text-xs leading-5 text-slate-500">Informe os nomes e suas variações. Maiúsculas e minúsculas são equivalentes. A lista fica só nesta página.</p>
          </div>
          <div>
            <label htmlFor="registration-rule" className="block text-sm font-semibold text-slate-700">Padrão de matrícula</label>
            <select
              id="registration-rule"
              value={settings.registrationRule}
              onChange={(event) => onSettingsChange({ ...settings, registrationRule: event.target.value as SanitizationSettings["registrationRule"] })}
              aria-describedby="registration-help"
              className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285b9f]"
            >
              <option value="6-7">6 a 7 dígitos</option>
              <option value="6">6 dígitos</option>
              <option value="7">7 dígitos</option>
              <option value="8">8 dígitos</option>
            </select>
            <p id="registration-help" className="mt-2 text-xs leading-5 text-slate-500">Mascara blocos numéricos completos. Números curtos, como nota 10 ou 2 faltas, são preservados.</p>
          </div>
        </div>

        <p className="text-xs leading-5 text-slate-500">E-mails comuns são mascarados automaticamente. As regras são reaplicadas após importar ou editar esta configuração. Nomes fora da lista e formatos não previstos podem permanecer no texto.</p>

        <p role="status" aria-live="polite" aria-atomic="true" className="rounded-lg bg-[#eef3f8] px-4 py-3 text-sm text-[#2c4a6c]">
          {rawComments.length === 0
            ? "Importe uma planilha com comentários para comparar as versões."
            : `${sanitizedComments.length} ${sanitizedComments.length === 1 ? "comentário higienizado" : "comentários higienizados"} em uma coleção separada. RAW preservado.`}
        </p>

        {original && sanitized && (
          <div>
            <label htmlFor="preview-comment" className="text-sm font-semibold text-slate-700">Comentário para comparar</label>
            <select
              id="preview-comment"
              value={original.id}
              onChange={(event) => setPreviewId(Number(event.target.value))}
              className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285b9f]"
            >
              {rawComments.map((comment) => (
                <option key={comment.id} value={comment.id}>ID {comment.id} · Linha {comment.rowIndex} · {comment.sheetName}</option>
              ))}
            </select>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <article aria-labelledby="raw-preview-title" className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 id="raw-preview-title" className="text-xs font-bold tracking-wide text-slate-600">RAW · ORIGINAL</h3>
                  <span className="text-xs text-slate-500">ID {original.id}</span>
                </div>
                <p className="text-sm leading-6 whitespace-pre-wrap break-words text-slate-800">{original.text}</p>
              </article>
              <article aria-labelledby="sanitized-preview-title" className="min-w-0 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 id="sanitized-preview-title" className="text-xs font-bold tracking-wide text-emerald-800">SANITIZED · MASCARADO</h3>
                  <span className="text-xs text-emerald-700">ID {sanitized.id}</span>
                </div>
                <p className="text-sm leading-6 whitespace-pre-wrap break-words text-emerald-950">{sanitized.text}</p>
              </article>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
