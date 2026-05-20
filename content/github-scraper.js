import {
  GITHUB_SELECTORS,
  parseLineTypeFromClass,
  parseDiffLineKey,
} from '../shared/github-selectors.js';
import { LIMITS } from '../shared/limits.js';
import { isPrChangesPage, getCanonicalPrUrl } from '../shared/pr-url.js';
import { assertNonEmptyString, isNonEmptyString } from '../shared/validators.js';

export { isPrChangesPage };

/**
 * @returns {string}
 */
export function getPrUrl() {
  return getCanonicalPrUrl();
}

/**
 * @returns {{ prUrl: string, files: object[], existingComments: object[] }}
 */
export function scrapePullRequest() {
  return scrapePullRequestWithLimits({
    maxFiles: LIMITS.MAX_FILES,
    maxLinesPerFile: LIMITS.MAX_LINES_PER_FILE,
    maxLineContentChars: LIMITS.MAX_LINE_CONTENT_CHARS,
    maxExistingComments: LIMITS.MAX_EXISTING_COMMENTS,
    maxCommentBodyChars: LIMITS.MAX_COMMENT_BODY_CHARS,
  });
}

/**
 * Coleta diff amplo para exportação .txt (anexar em outro PR).
 * @returns {{ prUrl: string, files: object[], existingComments: object[], exportMeta: object }}
 */
export function scrapePullRequestForExport() {
  return scrapePullRequestWithLimits({
    maxFiles: LIMITS.MAX_EXPORT_FILES,
    maxLinesPerFile: LIMITS.MAX_EXPORT_LINES_PER_FILE,
    maxLineContentChars: LIMITS.MAX_EXPORT_LINE_CONTENT_CHARS,
    maxExistingComments: LIMITS.MAX_EXPORT_EXISTING_COMMENTS,
    maxCommentBodyChars: LIMITS.MAX_COMMENT_BODY_CHARS,
    trackTruncation: true,
  });
}

/**
 * @param {object} cfg
 */
function scrapePullRequestWithLimits(cfg) {
  if (!isPrChangesPage()) {
    throw new Error('Não está na aba Files changed do PR');
  }

  const { files, filesTruncated, linesTruncatedFiles } = scrapeFiles(cfg);
  const existingComments = scrapeExistingComments(cfg);

  const result = {
    prUrl: getPrUrl(),
    files,
    existingComments,
  };

  if (cfg.trackTruncation) {
    result.exportMeta = {
      filesTruncated,
      linesTruncatedFiles,
      fileCount: files.length,
    };
  }

  return result;
}

/**
 * @param {object} cfg
 * @returns {{ files: object[], filesTruncated: boolean, linesTruncatedFiles: string[] }}
 */
function scrapeFiles(cfg) {
  const pathElements = document.querySelectorAll(
    `${GITHUB_SELECTORS.filePathAttr}`
  );
  const paths = new Set();

  for (const el of pathElements) {
    const path = el.getAttribute(GITHUB_SELECTORS.attrFilePath);
    if (isNonEmptyString(path)) {
      paths.add(path.trim());
    }
  }

  if (paths.size === 0) {
    document.querySelectorAll(GITHUB_SELECTORS.fileTreeItem).forEach((item) => {
      const id = item.getAttribute('id');
      if (isNonEmptyString(id) && id.includes('/')) {
        paths.add(id.trim());
      }
    });
  }

  const pathList = [...paths];
  const filesTruncated = pathList.length > cfg.maxFiles;
  const linesTruncatedFiles = [];
  const files = [];
  let count = 0;

  for (const filePath of pathList) {
    if (count >= cfg.maxFiles) {
      break;
    }
    const fileData = scrapeFileDiff(filePath, cfg, linesTruncatedFiles);
    if (fileData.lines.length > 0) {
      files.push(fileData);
      count += 1;
    }
  }

  return { files, filesTruncated, linesTruncatedFiles };
}

/**
 * @param {string} filePath
 * @param {object} cfg
 * @param {string[]} linesTruncatedFiles
 */
function scrapeFileDiff(filePath, cfg, linesTruncatedFiles) {
  const diffRoot = findDiffRootForFile(filePath);
  const lines = [];

  if (!diffRoot) {
    return { path: filePath, lines: [], patch: '' };
  }

  const rows = diffRoot.querySelectorAll(GITHUB_SELECTORS.diffLineRow);
  let hitLineCap = false;

  for (const row of rows) {
    if (lines.length >= cfg.maxLinesPerFile) {
      hitLineCap = true;
      break;
    }
    const line = parseDiffRow(row, filePath, cfg.maxLineContentChars);
    if (line) {
      lines.push(line);
    }
  }

  if (hitLineCap) {
    linesTruncatedFiles.push(filePath);
  }

  const patch = buildPatchFromLines(lines);
  return { path: filePath, lines, patch };
}

/**
 * @param {string} filePath
 * @returns {Element|null}
 */
export function findDiffRootForFile(filePath) {
  const byAttr = document.querySelector(
    `[${GITHUB_SELECTORS.attrFilePath}="${CSS.escape(filePath)}"]`
  );
  if (byAttr) {
    const block = byAttr.closest('[id^="diff-"]');
    if (block) {
      return block;
    }
  }

  const anchor = document.querySelector(
    `${GITHUB_SELECTORS.fileTreeItemWithPath(filePath)} a[href^="#diff-"]`
  );
  if (anchor) {
    const href = anchor.getAttribute('href');
    if (href?.startsWith('#')) {
      return document.getElementById(href.slice(1));
    }
  }

  const label = document.querySelector(
    `[aria-label="${GITHUB_SELECTORS.diffForLabelPrefix} ${filePath}"]`
  );
  return label?.closest('[id^="diff-"]') ?? null;
}

/**
 * @param {Element} row
 * @param {string} filePath
 */
/**
 * @param {Element} row
 * @param {string} filePath
 * @param {number} maxLineContentChars
 */
function parseDiffRow(row, filePath, maxLineContentChars) {
  const codeEl = row.querySelector(GITHUB_SELECTORS.codeText);
  if (!codeEl) {
    return null;
  }

  const lineType = parseLineTypeFromClass(codeEl.className);
  const markerEl = codeEl.querySelector(GITHUB_SELECTORS.lineMarker);
  const marker = markerEl?.textContent?.trim() ?? '';
  const inner = codeEl.querySelector(GITHUB_SELECTORS.codeInner);
  let content = (inner?.textContent ?? codeEl.textContent ?? '').trim();
  if (content.length > maxLineContentChars) {
    content = `${content.slice(0, maxLineContentChars)}…`;
  }

  const rightCell =
    row.querySelector(
      `${GITHUB_SELECTORS.codeCell}[${GITHUB_SELECTORS.attrDiffSide}="right"]`
    ) ??
    row.querySelector(GITHUB_SELECTORS.codeCell);

  const lineNumber = parseInt(
    rightCell?.getAttribute(GITHUB_SELECTORS.attrLineNumber) ?? '',
    10
  );
  const lineAnchor =
    rightCell?.getAttribute(GITHUB_SELECTORS.attrLineAnchor) ?? '';
  const diffLineKey =
    rightCell?.getAttribute(GITHUB_SELECTORS.attrDiffLineKey) ?? '';
  const parsedKey = parseDiffLineKey(diffLineKey);

  if (!Number.isFinite(lineNumber) || lineNumber < 1) {
    return null;
  }

  return {
    file: filePath,
    lineNumber,
    oldLineNumber: parsedKey.left,
    newLineNumber: parsedKey.right ?? lineNumber,
    lineType,
    marker,
    content,
    lineAnchor,
    diffLineKey: parsedKey,
    side: 'RIGHT',
  };
}

/**
 * @param {object[]} lines
 * @returns {string}
 */
export function buildPatchFromLines(lines) {
  return lines
    .map((l) => {
      const sign =
        l.lineType === 'addition' ? '+' : l.lineType === 'deletion' ? '-' : ' ';
      const old = l.oldLineNumber ?? '';
      const neu = l.newLineNumber ?? l.lineNumber ?? '';
      return `${sign} L${old}->${neu}: ${l.content}`;
    })
    .join('\n');
}

/**
 * @param {object} cfg
 * @returns {object[]}
 */
function scrapeExistingComments(cfg) {
  const comments = [];
  const threads = document.querySelectorAll(GITHUB_SELECTORS.reviewThread);

  for (const thread of threads) {
    if (comments.length >= cfg.maxExistingComments) {
      break;
    }
    const heading = thread
      .closest('[class*="InlineReviewThread"]')
      ?.querySelector(GITHUB_SELECTORS.inlineThreadHeading);
    const lineRef = heading?.textContent?.match(/R(\d+)/)?.[1];

    const bodies = thread.querySelectorAll(GITHUB_SELECTORS.commentBody);
    for (const body of bodies) {
      const text = body.textContent?.trim();
      if (!isNonEmptyString(text)) {
        continue;
      }
      const author =
        thread
          .querySelector('[data-testid="github-avatar"]')
          ?.getAttribute('alt') ?? 'unknown';

      comments.push({
        line: lineRef ? parseInt(lineRef, 10) : null,
        author,
        body: text.slice(0, cfg.maxCommentBodyChars),
      });
    }
  }

  return comments;
}

/**
 * @param {string} filePath
 * @param {number} lineNumber
 */
export function scrollToDiffLine(filePath, lineNumber) {
  const cell = findLineElement(filePath, lineNumber);
  if (!cell) {
    return {
      success: false,
      message: `Linha ${lineNumber} não visível em ${filePath}. Expanda o arquivo no diff.`,
    };
  }

  ensureHighlightStyles();

  const row = cell.closest('tr.diff-line-row');
  const target = row ?? cell;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });

  target.classList.add('mobilinho-line-highlight');
  window.setTimeout(() => {
    target.classList.remove('mobilinho-line-highlight');
  }, 2800);

  return { success: true, message: `Linha ${lineNumber} destacada` };
}

function ensureHighlightStyles() {
  if (document.getElementById('mobilinho-highlight-style')) {
    return;
  }
  const style = document.createElement('style');
  style.id = 'mobilinho-highlight-style';
  style.textContent = `
    tr.mobilinho-line-highlight td,
    td.mobilinho-line-highlight {
      box-shadow: inset 0 0 0 2px #6ee7b7 !important;
      background-color: rgba(110, 231, 183, 0.12) !important;
    }
  `;
  document.head.appendChild(style);
}

export function findLineElement(filePath, lineNumber) {
  assertNonEmptyString(filePath, 'filePath');
  const root = findDiffRootForFile(filePath);
  if (!root) {
    return null;
  }

  const selector = `${GITHUB_SELECTORS.codeCell}[${GITHUB_SELECTORS.attrLineNumber}="${lineNumber}"][${GITHUB_SELECTORS.attrDiffSide}="right"]`;
  return root.querySelector(selector);
}
