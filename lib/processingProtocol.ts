import type { RawComment, SanitizedComment } from "../types/index.ts";
import type { SanitizationSettings } from "./sanitizationSettings.ts";

export type ProcessingRequest =
  | { kind: "parse"; file: File }
  | { kind: "sanitize"; raw: readonly RawComment[]; settings: SanitizationSettings };

export type ProcessingResponse =
  | { kind: "parse"; comments: readonly RawComment[] }
  | { kind: "sanitize"; comments: readonly SanitizedComment[] }
  | { kind: "error"; message: string };
