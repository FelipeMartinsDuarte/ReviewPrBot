# Validação de seletores — github-html-changes.txt

Arquivo analisado: PR `mobilemed-org/mm-finance-contract-frontend#102` (aba Files changed).

## UI detectada

GitHub **DiffComparisonViewer** (React). Container: `#diff-comparison-viewer-container`.

## Seletores confirmados (presentes no HTML)

| Uso | Seletor / atributo | Ocorrências |
|-----|-------------------|-------------|
| Container | `#diff-comparison-viewer-container` | ✓ |
| Bloco arquivo | `id="diff-{sha256}"` | ✓ |
| Caminho | `data-file-path="src/app/..."` | 3 arquivos amostrados |
| Árvore | `li[role="treeitem"][id="src/app/..."]` | ✓ |
| Linha | `tr.diff-line-row` | ✓ |
| Número | `td.new-diff-line-number[data-line-number]` | ✓ |
| Código | `code.diff-text` + `.diff-text-inner` | ✓ |
| Adição | `code.diff-text.addition` | ✓ |
| Remoção | `code.diff-text.deletion` | ✓ |
| Chave linha | `data-diff-line-key="b:10-l:9-r:10"` | 2634+ |
| Âncora | `data-line-anchor="diff-...R10"` | ✓ |
| Thread comentário | `[data-testid="review-thread"]` | ✓ |
| Corpo comentário | `.markdown-body` | ✓ |
| Editor novo | `[data-marker-navigation-new-thread="true"]` | ✓ |
| Textarea | `textarea.prc-Textarea-TextArea-snlco` | ✓ |

## Seletores obsoletos (ausentes no HTML)

- `.blob-code-inner`
- `.add-line-comment`
- `.js-inline-comment-form-container`
- `.js-file-content`
- `table.diff-table`

## Formato data-diff-line-key

```
b:{base}-l:{left}-r:{right}
```

- `null` indica lado inexistente (ex: linha só adicionada).
- Para comentários inline, usar linha **right** (`R{n}` no heading "Comment on line R9").

## Notas para injeção de comentários

### Linha sem comentário
1. Disparar `mouseenter` na célula do número da linha (`td.new-diff-line-number`).
2. Clicar botão `+` em `.InlineMarkers-module__markersWrapper`.
3. Preencher `textarea` dentro de `[data-marker-navigation-new-thread]` — **não** clicar em "Comment" / "Start a review".

### Linha que já tem comentário (prioridade: reply)
1. Localizar heading `Comment on line R{n}` / `[class*="inlineReviewThreadHeading"]`.
2. Clicar **Write a reply** (`[data-marker-navigation-thread-reply="true"]` ou `CompactCommentButton-module__...`).
3. Preencher `textarea` da resposta — não enviar.

### Fallback
Se reply falhar, tenta comentário novo na **primeira linha abaixo** sem thread.

## Review final do PR (Finish your review)

Validado em `github-selector-rejectaceept.txt` (toolbar da aba /changes).

| Uso | Seletor |
|-----|---------|
| Abrir diálogo | `button[class*="ReviewMenuButton-module__ReviewMenuButton"]` (texto "Submit review") |
| Título | `#anchored-review-title` → "Finish your review" |
| Corpo | `[class*="ReviewMenuButton-module__AnchoredReviewBody"]` |
| Approve | `input[name="reviewEvent"][value="approve"]` |
| Request changes | `input[name="reviewEvent"][value="request changes"]` |
| Comentário geral | `textarea[placeholder="Leave a comment"]` dentro do corpo do diálogo |

**MobilinhoReviewer:** preenche radio + comentário; **não** clica em Submit review (mesmo padrão dos comentários inline).
