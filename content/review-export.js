import { FINDING_STATUS } from '../shared/constants.js';
import { getCanonicalPrUrl } from '../shared/pr-url.js';

/**
 * @param {object} review
 * @param {object} [score]
 * @param {string} [prUrl]
 * @returns {string}
 */
export function buildReviewExportText(review, score, prUrl) {
  const url = prUrl ?? getCanonicalPrUrl();
  const lines = [
    'MobilinhoReviewer — Exportação',
    '='.repeat(50),
    `PR: ${url}`,
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    '',
  ];

  if (review) {
    appendReviewSection(lines, review);
  }

  if (score) {
    appendScoreSection(lines, score);
  }

  if (!review && !score) {
    lines.push('(Nenhuma análise disponível para exportar)');
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
  return `mobilinho-review-pr${num}-${date}.txt`;
}
