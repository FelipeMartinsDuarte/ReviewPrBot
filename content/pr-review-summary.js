/**
 * Comentário geral do "Finish your review" — curto.
 * @param {object|null} _review
 * @param {object|null} score
 * @param {'approve'|'request_changes'} decision
 * @returns {string}
 */
export function buildPrReviewSummaryText(_review, score, decision) {
  if (decision === 'approve') {
    return 'LGTM';
  }

  const lines = ['Siga os pontos levantados na revisão e o resumo abaixo.', ''];

  if (score?.summary?.trim()) {
    lines.push(score.summary.trim());
  }

  if (Array.isArray(score?.blockers) && score.blockers.length) {
    lines.push('', 'Pontos principais:');
    for (const b of score.blockers.slice(0, 5)) {
      lines.push(`- ${b}`);
    }
  }

  return lines.join('\n').trim() || 'Siga os pontos levantados na revisão.';
}
