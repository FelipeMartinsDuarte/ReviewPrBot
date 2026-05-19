/**
 * Limites centralizados — evita loop de chamadas e estouro de tokens.
 * @readonly
 */
export const LIMITS = Object.freeze({
  /** Chamadas OpenAI por operação de review (4 steps + 1 merge) */
  MAX_OPENAI_CALLS_PER_REVIEW: 5,

  /** Chamadas OpenAI por score */
  MAX_OPENAI_CALLS_PER_SCORE: 1,

  /** Steps registráveis no pipeline */
  MAX_PIPELINE_STEPS: 8,

  /** Arquivos no PR enviados à API */
  MAX_FILES: 35,

  /** Linhas por arquivo (prioriza +/-) */
  MAX_LINES_PER_FILE: 120,

  /** Caracteres por linha de código */
  MAX_LINE_CONTENT_CHARS: 400,

  /** Comentários existentes no PR */
  MAX_EXISTING_COMMENTS: 25,

  /** Caracteres por comentário existente */
  MAX_COMMENT_BODY_CHARS: 600,

  /** Observações do usuário */
  MAX_USER_NOTES_CHARS: 1500,

  /** Contexto externo (.txt de outro PR, ex.: back ao revisar front) */
  MAX_EXTERNAL_CONTEXT_CHARS: 24_000,

  /** Tamanho máximo do arquivo .txt anexado */
  MAX_ATTACH_FILE_BYTES: 512_000,

  /** Payload JSON total aproximado (~28k tokens) */
  MAX_TOTAL_PAYLOAD_CHARS: 100_000,

  /** Conteúdo user message por request OpenAI */
  MAX_USER_MESSAGE_CHARS: 80_000,

  /** System prompt máximo */
  MAX_SYSTEM_PROMPT_CHARS: 12_000,

  /** Achados retornados ao usuário */
  MAX_FINDINGS: 20,

  /** Findings por step intermediário */
  MAX_FINDINGS_PER_STEP: 8,

  /** Resumo por step no merge */
  MAX_STEP_SUMMARY_CHARS: 2000,

  /** Timeout HTTP OpenAI */
  OPENAI_TIMEOUT_MS: 120_000,

  /** Tokens de saída */
  MAX_OUTPUT_TOKENS_REVIEW: 4096,
  MAX_OUTPUT_TOKENS_SCORE: 2048,
  MAX_OUTPUT_TOKENS_STEP: 2048,

  /** Cooldown entre mesma operação (ms) */
  COOLDOWN_REVIEW_MS: 45_000,
  COOLDOWN_SCORE_MS: 20_000,

  /** Máx. operações OpenAI por minuto (global) */
  MAX_OPENAI_CALLS_PER_MINUTE: 8,

  /** Tamanho máximo prData via messaging (bytes) */
  MAX_PR_MESSAGE_BYTES: 4_000_000,

  /** DOM: tentativas ao abrir editor de comentário */
  MAX_COMMENT_EDITOR_WAIT_ITERATIONS: 20,
  COMMENT_EDITOR_WAIT_MS: 200,

  /** Diálogo Finish your review (GitHub) */
  MAX_REVIEW_DIALOG_WAIT_ITERATIONS: 25,
  REVIEW_DIALOG_WAIT_MS: 200,

  /** Comentário geral no Submit review */
  MAX_PR_REVIEW_SUMMARY_CHARS: 16_000,
});
