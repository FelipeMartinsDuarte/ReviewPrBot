import { FINDING_STATUS } from '../shared/constants.js';
import { getCanonicalPrUrl } from '../shared/pr-url.js';
import { buildPatchFromLines } from './github-scraper.js';
import { LIMITS } from '../shared/limits.js';

/**
 * @param {object|null} review
 * @param {object|null} score
 * @param {string} [prUrl]
 * @param {object|null} [prData]
 * @returns {string}
 */
export function buildReviewExportText(review, score, prUrl, prData) {
  const url = prUrl ?? getCanonicalPrUrl();
  const lines = [
    'FelipeDosReview — Exportação',
    '='.repeat(50),
    `PR: ${url}`,
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    '',
    'Use este arquivo no outro PR: marque "Incluir .txt anexado" antes de Revisar PR / Medir Score.',
    '',
  ];

  if (review || score) {
    lines.push('PARTE 1 — ANÁLISE FELIPEDOSREVIEW', '='.repeat(50), '');
    if (review) {
      appendReviewSection(lines, review);
    }
    if (score) {
      appendScoreSection(lines, score);
    }
    lines.push('');
  } else {
    lines.push(
      '(Sem análise salva neste PR — exportando diff e comentários do GitHub.)',
      ''
    );
  }

  if (prData) {
    appendDiffSection(lines, prData);
    appendExistingCommentsSection(lines, prData);
  }

  lines.push('', '— Fim do arquivo —');
  return lines.join('\n');
}

/**
 * @param {string[]} lines
 * @param {object} review
 */
function appendReviewSection(lines, review) {
  lines.push('RESUMO DAS ETAPAS', '-'.repeat(50));
  const s = review.stepsSummary ?? {};
  lines.push(`Tree Sit: ${s.treeSit ?? '—'}`);
  lines.push(`Validações: ${s.validations ?? '—'}`);
  lines.push(`Compilação: ${s.compilation ?? '—'}`);
  lines.push(`Funcional: ${s.functional ?? '—'}`);
  lines.push('');

  const findings = (review.findings ?? []).filter(
    (f) => f.status !== FINDING_STATUS.REJECTED
  );
  lines.push(`ACHADOS (${findings.length})`, '-'.repeat(50));

  for (const f of findings) {
    lines.push('');
    lines.push(`[${f.category ?? 'NORMAL'}] ${f.title ?? 'Sem título'}`);
    lines.push(`Arquivo: ${f.file ?? '?'} · Linha ${f.line ?? '?'}`);
    if (f.status === FINDING_STATUS.ACCEPTED) {
      lines.push('Status: aceito');
    }
    lines.push('');
    lines.push('Análise:');
    lines.push(f.analysis ?? '');
    lines.push('');
    lines.push('Comentário sugerido (GitHub):');
    lines.push(f.githubComment ?? '');
    lines.push('-'.repeat(40));
  }
}

/**
 * @param {string[]} lines
 * @param {object} score
 */
function appendScoreSection(lines, score) {
  lines.push('', 'SCORE DO PR', '-'.repeat(50));
  lines.push(`Decisão: ${score.decision ?? '—'}`);
  lines.push(`Pontuação: ${score.score ?? '—'}/100`);
  lines.push('');
  lines.push('Resumo:');
  lines.push(score.summary ?? '');
  if (Array.isArray(score.blockers) && score.blockers.length) {
    lines.push('', 'Bloqueadores:');
    for (const b of score.blockers) {
      lines.push(`- ${b}`);
    }
  }
  if (Array.isArray(score.recommendations) && score.recommendations.length) {
    lines.push('', 'Recomendações:');
    for (const r of score.recommendations) {
      lines.push(`- ${r}`);
    }
  }
}

/**
 * @param {string[]} lines
 * @param {object} prData
 */
function appendDiffSection(lines, prData) {
  lines.push('PARTE 2 — DIFF COMPLETO DO PR (/changes)', '='.repeat(50), '');

  const meta = prData.exportMeta ?? {};
  const files = prData.files ?? [];

  if (meta.filesTruncated) {
    lines.push(
      `Aviso: há mais arquivos no PR do que o limite de exportação (${LIMITS.MAX_EXPORT_FILES}). Role a página e expanda arquivos no diff.`
    );
  }
  if (meta.linesTruncatedFiles?.length) {
    lines.push(
      `Aviso: linhas truncadas em: ${meta.linesTruncatedFiles.join(', ')}`
    );
  }
  if (files.length === 0) {
    lines.push(
      '(Nenhuma linha de diff capturada. Role a página, expanda os arquivos e exporte de novo.)'
    );
    return;
  }

  lines.push(`Arquivos exportados: ${files.length}`, '');

  let totalChars = 0;
  let diffTruncated = false;

  for (const file of files) {
    const header = `\n${'='.repeat(60)}\nFILE: ${file.path}\n${'='.repeat(60)}\n`;
    const patch =
      file.patch?.trim() ||
      buildPatchFromLines(file.lines ?? []);

    const block = header + (patch || '(arquivo sem linhas no DOM)') + '\n';
    if (totalChars + block.length > LIMITS.MAX_EXPORT_TOTAL_CHARS) {
      diffTruncated = true;
      break;
    }
    lines.push(block);
    totalChars += block.length;
  }

  if (diffTruncated) {
    lines.push(
      '',
      `… Diff truncado no limite de ~${Math.round(LIMITS.MAX_EXPORT_TOTAL_CHARS / 1000)}k caracteres. Exporte de novo após carregar mais arquivos na página.`
    );
  }
}

/**
 * @param {string[]} lines
 * @param {object} prData
 */
function appendExistingCommentsSection(lines, prData) {
  const comments = prData.existingComments ?? [];
  if (comments.length === 0) {
    return;
  }

  lines.push('', 'COMENTÁRIOS JÁ EXISTENTES NO PR', '-'.repeat(50));
  for (const c of comments) {
    lines.push('');
    if (c.line) {
      lines.push(`Linha ${c.line} · ${c.author ?? '?'}`);
    } else {
      lines.push(String(c.author ?? '?'));
    }
    lines.push(c.body ?? '');
    lines.push('-'.repeat(30));
  }
}

/**
 * @param {string} filename
 * @param {string} content
 */
export function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * @param {string} prUrl
 */
export function buildExportFilename(prUrl) {
  const match = prUrl.match(/\/pull\/(\d+)/);
  const num = match ? match[1] : 'pr';
  const date = new Date().toISOString().slice(0, 10);
  return `felipedosreview-pr${num}-${date}.txt`;
}
