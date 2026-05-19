export const GITHUB_SELECTORS = Object.freeze({
  /** Container principal do diff */
  diffViewer: '#diff-comparison-viewer-container',
  diffViewerFallback: '[class*="DiffComparisonViewer-module__Container"]',

  /** Arquivos na árvore lateral — id = caminho completo */
  fileTreeItem: 'li[role="treeitem"][id]',
  fileTreeItemWithPath: (path) =>
    `li[role="treeitem"][id="${CSS.escape(path)}"]`,

  /** Bloco de diff por arquivo */
  diffBlock: '[id^="diff-"]',
  diffBlockById: (id) => `#${CSS.escape(id)}`,
  filePathAttr: '[data-file-path]',

  /** Linhas de diff */
  diffLineRow: 'tr.diff-line-row',
  lineNumberCell: 'td.new-diff-line-number[data-line-number]',
  codeCell: 'td.diff-text-cell[data-line-number]',
  codeText: 'code.diff-text',
  codeInner: '.diff-text-inner',
  lineMarker: '.diff-text-marker',

  /** Atributos de linha (preferir data-line-anchor no lado right) */
  attrLineNumber: 'data-line-number',
  attrLineAnchor: 'data-line-anchor',
  attrDiffLineKey: 'data-diff-line-key',
  attrDiffSide: 'data-diff-side',
  attrFilePath: 'data-file-path',

  /** Tipos de linha via classe em code.diff-text */
  lineTypeAddition: 'code.diff-text.addition',
  lineTypeDeletion: 'code.diff-text.deletion',

  /** Comentários existentes no PR */
  reviewThread: '[data-testid="review-thread"]',
  commentHeader: '[data-testid="comment-header"]',
  commentBody: '.markdown-body',
  inlineThreadHeading: '.InlineReviewThread-module__inlineReviewThreadHeading__o7jqD',

  /** Editor inline (novo comentário — não submeter) */
  newCommentMarker: '[data-marker-navigation-new-thread="true"]',
  commentTextarea: 'textarea.prc-Textarea-TextArea-snlco[placeholder="Leave a comment"]',
  commentTextareaFallback: 'textarea.prc-Textarea-TextArea-snlco',
  addCommentEditor: '.AddCommentEditor-module__AddCommentEditor__SOA0y',
  inlineMarkersWrapper: '.InlineMarkers-module__markersWrapper__g3Aig',

  /** Resposta em thread existente */
  threadReplyRoot: '[data-marker-navigation-thread-reply="true"]',
  writeReplyButton:
    'button.CompactCommentButton-module__CompactCommentInputContainer__Ab_eI',

  /** aria-label útil para blocos de arquivo */
  diffForLabelPrefix: 'Diff for:',
});

/**
 * @param {string} className
 * @returns {'addition'|'deletion'|'context'}
 */
export function parseLineTypeFromClass(className) {
  if (typeof className !== 'string') {
    return 'context';
  }
  if (className.includes('addition')) {
    return 'addition';
  }
  if (className.includes('deletion')) {
    return 'deletion';
  }
  return 'context';
}

/**
 * Parse data-diff-line-key="b:10-l:9-r:10"
 * @param {string} key
 * @returns {{ base: number|null, left: number|null, right: number|null }}
 */
export function parseDiffLineKey(key) {
  const result = { base: null, left: null, right: null };
  if (typeof key !== 'string') {
    return result;
  }
  const base = key.match(/b:(\d+|null)/);
  const left = key.match(/l:(\d+|null)/);
  const right = key.match(/r:(\d+|null)/);
  if (base) {
    result.base = base[1] === 'null' ? null : Number(base[1]);
  }
  if (left) {
    result.left = left[1] === 'null' ? null : Number(left[1]);
  }
  if (right) {
    result.right = right[1] === 'null' ? null : Number(right[1]);
  }
  return result;
}
