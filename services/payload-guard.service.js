import { LIMITS } from '../shared/limits.js';
import { assertArray, isNonEmptyString, isPlainObject } from '../shared/validators.js';

/**
 * @typedef {object} SafePrPayload
 * @property {string} prUrl
 * @property {string} userNotes
 * @property {object[]} files
 * @property {object[]} compactFiles
 * @property {object[]} existingComments
 * @property {object} stats
 */

/**
 * Valida e compacta dados do PR antes de qualquer chamada OpenAI.
 * @param {object} prData
 * @param {string} [userNotes]
 * @param {string} [externalContext]
 * @returns {SafePrPayload}
 */
export function preparePrPayload(prData, userNotes = '', externalContext = '') {
  if (!isPlainObject(prData)) {
    throw new Error('Dados do PR inválidos');
  }

  const prUrl =
    typeof prData.prUrl === 'string' ? prData.prUrl.slice(0, 500) : '';
  const rawFiles = assertArray(prData.files, 'files');
  const rawComments = assertArray(prData.existingComments, 'existingComments');

  const trimmedNotes = truncate(
    String(userNotes ?? '').trim(),
    LIMITS.MAX_USER_NOTES_CHARS
  );
  const trimmedExternal = truncate(
    String(externalContext ?? '').trim(),
    LIMITS.MAX_EXTERNAL_CONTEXT_CHARS
  );

  const files = capFiles(rawFiles);
  const existingComments = capComments(rawComments);
  const compactFiles = files.map(compactFileForApi);

  const payload = {
    prUrl,
    userNotes: trimmedNotes,
    externalContext: trimmedExternal,
    files,
    compactFiles,
    existingComments,
    stats: {
      fileCount: files.length,
      truncatedFiles: rawFiles.length > LIMITS.MAX_FILES,
      truncatedComments: rawComments.length > LIMITS.MAX_EXISTING_COMMENTS,
    },
  };

  enforceTotalSize(payload);
  return payload;
}

/**
 * Payload leve para etapas intermediárias (sem reenviar diff inteiro repetido).
 * @param {SafePrPayload} safe
 * @param {Record<string, string>} [previousSummaries]
 */
export function buildStepUserPayload(safe, previousSummaries = {}) {
  const body = {
    prUrl: safe.prUrl,
    files: safe.compactFiles,
    existingComments: safe.existingComments,
    previousSteps: trimSummaries(previousSummaries),
    stats: safe.stats,
  };
  if (safe.userNotes) {
    body.userNotes = safe.userNotes;
  }
  if (safe.externalContext) {
    body.externalContextFromOtherReview = safe.externalContext;
  }
  return stringifyCapped(body, LIMITS.MAX_USER_MESSAGE_CHARS);
}

/**
 * Payload de consolidação — sem diff bruto, só resumos e achados parciais.
 * @param {SafePrPayload} safe
 * @param {object[]} stepResults
 */
export function buildMergeUserPayload(safe, stepResults) {
  const steps = stepResults.map((s) => ({
    step: s.id,
    summary: truncate(String(s.result?.summary ?? ''), LIMITS.MAX_STEP_SUMMARY_CHARS),
    findings: capStepFindings(s.result?.findings),
  }));

  const body = {
    prUrl: safe.prUrl,
    stats: safe.stats,
    filePaths: safe.compactFiles.map((f) => f.path),
    stepResults: steps,
    existingComments: safe.existingComments,
  };
  if (safe.userNotes) {
    body.userNotes = safe.userNotes;
  }
  if (safe.externalContext) {
    body.externalContextFromOtherReview = safe.externalContext;
  }
  return stringifyCapped(body, LIMITS.MAX_USER_MESSAGE_CHARS);
}

/**
 * @param {object} prData
 */
export function validatePrMessageSize(prData) {
  const json = JSON.stringify(prData);
  const bytes = new TextEncoder().encode(json).byteLength;
  if (bytes > LIMITS.MAX_PR_MESSAGE_BYTES) {
    throw new Error(
      `PR muito grande para enviar (${Math.round(bytes / 1024)}KB). Expanda menos arquivos ou revise em partes.`
    );
  }
}

/**
 * @param {object[]} rawFiles
 */
function capFiles(rawFiles) {
  const sorted = [...rawFiles].sort((a, b) => {
    const aChanges = countChanges(a);
    const bChanges = countChanges(b);
    return bChanges - aChanges;
  });

  return sorted.slice(0, LIMITS.MAX_FILES).map((file) => {
    const path = typeof file.path === 'string' ? file.path : 'unknown';
    const lines = Array.isArray(file.lines) ? file.lines : [];
    const prioritized = prioritizeLines(lines);
    const capped = prioritized.slice(0, LIMITS.MAX_LINES_PER_FILE).map(compactLine);

    return {
      path,
      lines: capped,
      patch: truncate(
        typeof file.patch === 'string'
          ? file.patch
          : buildPatchFromLines(capped),
        LIMITS.MAX_LINES_PER_FILE * (LIMITS.MAX_LINE_CONTENT_CHARS + 20)
      ),
    };
  });
}

/**
 * @param {object} file
 */
function compactFileForApi(file) {
  return {
    path: file.path,
    patch: truncate(file.patch ?? '', 8000),
    changedLines: (file.lines ?? []).slice(0, LIMITS.MAX_LINES_PER_FILE),
  };
}

/**
 * @param {object[]} lines
 */
function prioritizeLines(lines) {
  const weight = (l) => {
    if (l.lineType === 'addition' || l.lineType === 'deletion') {
      return 0;
    }
    return 1;
  };
  return [...lines].sort((a, b) => weight(a) - weight(b));
}

/**
 * @param {object} line
 */
function compactLine(line) {
  return {
    lineNumber: line.lineNumber ?? line.newLineNumber,
    lineType: line.lineType ?? 'context',
    content: truncate(String(line.content ?? ''), LIMITS.MAX_LINE_CONTENT_CHARS),
  };
}

/**
 * @param {object[]} lines
 */
function buildPatchFromLines(lines) {
  return lines
    .map((l) => {
      const sign =
        l.lineType === 'addition' ? '+' : l.lineType === 'deletion' ? '-' : ' ';
      return `${sign} ${l.lineNumber}: ${l.content}`;
    })
    .join('\n');
}

/**
 * @param {object} file
 */
function countChanges(file) {
  const lines = Array.isArray(file.lines) ? file.lines : [];
  return lines.filter(
    (l) => l.lineType === 'addition' || l.lineType === 'deletion'
  ).length;
}

/**
 * @param {object[]} raw
 */
function capComments(raw) {
  return raw.slice(0, LIMITS.MAX_EXISTING_COMMENTS).map((c) => ({
    line: typeof c.line === 'number' ? c.line : null,
    author: truncate(String(c.author ?? 'unknown'), 80),
    body: truncate(String(c.body ?? ''), LIMITS.MAX_COMMENT_BODY_CHARS),
  }));
}

/**
 * @param {unknown} findings
 */
function capStepFindings(findings) {
  if (!Array.isArray(findings)) {
    return [];
  }
  return findings.slice(0, LIMITS.MAX_FINDINGS_PER_STEP).map((f) => ({
    id: f.id,
    file: f.file,
    line: f.line,
    category: f.category,
    title: truncate(String(f.title ?? ''), 200),
  }));
}

/**
 * @param {Record<string, string>} summaries
 */
function trimSummaries(summaries) {
  const out = {};
  for (const [key, val] of Object.entries(summaries)) {
    out[key] = truncate(String(val), LIMITS.MAX_STEP_SUMMARY_CHARS);
  }
  return out;
}

/**
 * @param {SafePrPayload} payload
 */
function enforceTotalSize(payload) {
  const size = JSON.stringify({
    compactFiles: payload.compactFiles,
    existingComments: payload.existingComments,
    userNotes: payload.userNotes,
  }).length;

  if (size > LIMITS.MAX_TOTAL_PAYLOAD_CHARS) {
    throw new Error(
      `Diff excede o limite seguro (${Math.round(size / 1024)}KB). Reduza arquivos visíveis no PR ou use um PR menor.`
    );
  }
}

/**
 * @param {object} body
 * @param {number} maxChars
 */
function stringifyCapped(body, maxChars) {
  let json = JSON.stringify(body);
  if (json.length <= maxChars) {
    return json;
  }
  json = JSON.stringify({
    ...body,
    _truncated: true,
    files: Array.isArray(body.files) ? body.files.slice(0, 10) : body.files,
  });
  if (json.length > maxChars) {
    throw new Error('Payload ainda excede limite após truncagem. PR muito grande.');
  }
  return json;
}

/**
 * @param {string} text
 * @param {number} max
 */
function truncate(text, max) {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}…[truncado]`;
}
