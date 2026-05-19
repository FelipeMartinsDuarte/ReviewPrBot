# MobilinhoReviewer

Extensão Chrome para code review de Pull Requests no GitHub com OpenAI.

## Instalação

1. Abra `chrome://extensions`
2. Ative **Modo do desenvolvedor**
3. **Carregar sem compactação** → selecione esta pasta

## Uso

1. Abra o PR na página **/changes** (`/pull/N/changes`, com ou sem `#diff-…` no link)
2. Clique no ícone **MobilinhoReviewer**
3. Configure API Key e escolha o modelo na lista (padrão: GPT-4o)
4. **Abrir MobilinhoReviewer** → revisar, aceitar achados, medir score
5. **Exportar análise (.txt)** — após revisar ou medir score, use o botão nos resultados
6. **Anexar contexto** — no PR do front, escolha o `.txt` exportado do back, marque *Incluir .txt anexado* e rode **Revisar PR** ou **Medir Score**

## Seletores GitHub (validados)

Baseado em `github-html-changes.txt` — UI **DiffComparisonViewer** (React):

| Elemento | Seletor |
|----------|---------|
| Container diff | `#diff-comparison-viewer-container` |
| Caminho do arquivo | `[data-file-path]` / `li[role="treeitem"][id]` |
| Linha de diff | `tr.diff-line-row` |
| Código | `code.diff-text` + `.diff-text-inner` |
| Linha adicionada | `code.diff-text.addition` |
| Linha removida | `code.diff-text.deletion` |
| Número da linha | `td[data-line-number][data-diff-side="right"]` |
| Chave da linha | `data-diff-line-key` (ex: `b:10-l:9-r:10`) |
| Comentários existentes | `[data-testid="review-thread"]` + `.markdown-body` |
| Textarea comentário | `textarea.prc-Textarea-TextArea-snlco` |

**Obsoletos** na UI atual: `.blob-code-inner`, `.add-line-comment`, `.js-inline-comment-form`

## Pipeline de análise

1. Tree Sit  
2. Validações  
3. Compilação  
4. Funcional  

Novos passos: crie `services/pipeline/steps/meu-passo.step.js` e registre em `steps/index.js`.

## Segurança e tokens

- API Key criptografada com AES-GCM (chave derivada do ID da extensão)
- Armazenamento em `chrome.storage.local` (inacessível a páginas web)
- Chamadas OpenAI apenas no **service worker**
- Resultados de review ficam em cache **por PR** (aba do GitHub); exporte em `.txt` para compartilhar com outro PR
- Contexto externo (`.txt` anexado) limitado a ~24k caracteres por requisição
- **Anti-loop**: mutex, cooldown, máx. 5 chamadas/review, 8/min global
- **Payload compacto**: merge não reenvia o diff inteiro; ver `docs/TOKEN-SAFETY.md`

## Estrutura

```
background/     Service worker + OpenAI
content/        Scraper, modal, injeção de comentários
popup/          Entrada rápida
services/       Storage, análise, pipeline
shared/         Constantes, validadores, seletores
```
