# Validação Bitrix24 — grupo [Portal web] SO`s

Arquivo analisado: `bitrix-selector.txt` (Messenger em `/online/`).

## Fluxo FelipeDosReview

1. Checkbox **Enviar no Grupo de SO (Bitrix)** na tela de score
2. **Aprovar PR** ou **Solicitar alterações** no GitHub
3. Abre `https://mobilemed.bitrix24.com.br/online/`
4. Pesquisa e abre o bate-papo **Portal web SO**
5. Localiza mensagem com link `github.com/.../pull/N`
6. Menu da mensagem → **Responder**
7. Preenche texto legível, ex.:
   ```
   Aprovado — mm-finance-contract-frontend #102
   https://github.com/mobilemed-org/mm-finance-contract-frontend/pull/102
   ```
8. Busca a mensagem do PR na tela visível; se não achar, **rola para cima** até 12 vezes (~700px por passo) e para no topo
9. Clica em **Enviar** se o botão estiver habilitado

## Seletores confirmados

| Uso | Seletor |
|-----|---------|
| Busca de bate-papo | `.bx-im-search-input__element` |
| Resultado da busca | `.bx-im-search-item__container` + `.bx-im-chat-title__text` |
| Lista recente | `.bx-im-list-recent-item__wrap` |
| Mensagem | `.bx-im-message-base__wrap` |
| Menu da mensagem | `.bx-im-message-context-menu__button` |
| Resposta (menu) | Texto **Responder** (`IM_DIALOG_CHAT_MENU_REPLY`) |
| Textarea | `textarea.bx-im-textarea__element` |
| Enviar | `.bx-im-elements-send-button` |

## Radio / review GitHub (outro arquivo)

Ver `github-selector-rejectaceept.txt` e `docs/SELECTORS-VALIDATION.md`.
