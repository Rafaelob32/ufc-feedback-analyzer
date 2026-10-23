/** Comentário original de uma única importação, sem qualquer sanitização. */
export interface RawComment {
  /** ID determinístico igual à linha do Excel; não deve ser renumerado. */
  readonly id: number;
  readonly text: string;
  /** Número da linha na planilha, começando em 1 (inclui cabeçalho e vazias). */
  readonly rowIndex: number;
  readonly sheetName: string;
}

/** Cópia mascarada independente; mantém exclusivamente o ID e o texto tratado. */
export interface SanitizedComment {
  readonly id: number;
  readonly text: string;
}
