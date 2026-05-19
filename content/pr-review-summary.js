import { FINDING_STATUS } from '../shared/constants.js';

/**
 * Monta o texto do comentário geral do PR a partir da revisão e do score.
 * @param {object|null} review
 * @param {object|null} score
 * @returns {string}
 */
export function buildPrReviewSummaryText(review, score) {
  const lines = [
    '## MobilinhoReviewer — Resumo da revisão',
    '',
  ];

  if (score) {
    const decision = score.decision === 'APROVA' ? 'APROVA' : 'REPROVA';
    lines.push(
      `**Score:** ${score.score ?? '—'}/100 — ${decision}`,
      '',
      '**Resumo executivo:**',
      score.summary?.trim() || '—',
      ''
    );
    if (Array.isArray(score.blockers) && score.blockers.length) {
      lines.push('**Bloqueadores:**');
      for (const b of score.blockers) {
        lines.push(`- ${b}`);
      }
      lines.push('');
    }
    if (Array.isArray(score.recommendations) && score.recommendations.length) {
      lines.push('**Recomendações:**');
      for (const r of score.recommendations) {
        lines.push(`- ${r}`);
      }
      lines.push('');
    }
  }

  const findings = (review?.findings ?? []).filter(
    (f) => f.status !== FINDING_STATUS.REJECTED
  );

  if (findings.length) {
    lines.push('---', '', '### Comentários relativos ao código', '');
    for (const f of findings) {
      const cat = f.category ?? 'NORMAL';
      lines.push(
        `#### [${cat}] \`${f.file ?? '?'}\` · linha ${f.line ?? '?'}`,
        '',
        `**${f.title ?? 'Sem título'}**`,
        ''
      );
      const body =
        f.status === FINDING_STATUS.ACCEPTED && f.githubComment?.trim()
          ? f.githubComment.trim()
          : (f.githubComment?.trim() || f.analysis?.trim() || '—');
      lines.push(body, '', '---', '');
    }
  } else if (!score) {
    lines.push('_Nenhum achado nem score disponível._');
  }

  return lines.join('\n').trim();
}
