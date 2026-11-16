# Compra em Dia — retomada

Implementação PARCIAL, ainda NÃO executável e NÃO publicada. Não tratar como versão pronta.

## Arquivos iniciados
- Vite + JavaScript, base `/groceries/`; dependências fixadas e package-lock.
- `src/domain.js`: normalização, sugestão de setor, compra parcial, finalização, preços base e interpretação conservadora de texto de cupom.
- `src/store.js`: cliente Supabase, persistência local, fila offline, sincronização otimista por versão, conexão com casas. Exige revisão de concorrência: uma edição durante requisição de sincronização pode ser sobrescrita; clonar operações e preservar revisões locais novas. Inicialização/auth e isolamento entre contas também precisam ser revisados.
- `src/main.js`: interface parcial e formulários de itens, produtos, setores, compra e histórico. IMPORTA `style.css` ainda inexistente. Faltam definições de receiptDialog, accountDialog, houseDialog, install, exportBackup, restoreBackup, conflictDialog e inicialização final (`onChange`, `initialize`, `app`). Código ainda não foi compilado/testado.
- `src/receipt.js`: OCR Tesseract em português no navegador, importação de XML fiscal e leitura de QR em imagem com jsQR. Não existe integração automática com portais fiscais.
- `public/`: ícone SVG e manifest. Faltam service worker, ícones PNG para compatibilidade e registro/install.
- `supabase/` e `.github/workflows/`: diretórios vazios, SQL e deploy ainda não implementados.

## Ambiente e acesso
Repositório era vazio: https://github.com/Rodrigo-Yuji/groceries . Branch de entrega parcial: `wip/compra-em-dia`.
Projeto Supabase: `vdlmvlycofddjmdzffyd`, URL https://vdlmvlycofddjmdzffyd.supabase.co . A chave publishable está no cliente e foi fornecida pelo usuário. Nunca solicitar ou publicar service_role.
Conexão Supabase na sessão cloud não tinha permissão neste projeto. Nenhuma tabela, função ou política foi criada. Nenhum dado de outros projetos foi alterado.
Comando solicitado pelo usuário não pôde gravar em ~/.codex (somente leitura). Configurar MCP no Codex LOCAL e autenticar. URL completa deve estar entre aspas por conter &.
GitHub Pages foi explicitamente autorizado, mas NÃO foi configurado/publicado. Destino esperado: https://rodrigo-yuji.github.io/groceries/ . Confirmar após deployment.

## Modelo que o store espera (ainda precisa desenhar/revisar/criar)
- grocery_households: id, name e demais campos de dono/convite.
- grocery_records: id uuid, household_id uuid, kind text, data jsonb, deleted boolean, version integer.
- RPC grocery_create_house(house_name) e grocery_join_house(invite_code), retornando id da casa.
Criar membresia e convites seguros, RLS em todas as tabelas expostas, grants mínimos, políticas SELECT/INSERT/UPDATE/DELETE conforme participação. Não permitir alteração de owner/membership indevida. Evitar recursão RLS. Implementar e testar operações atômicas quando necessário; o código parcial faz finalização por múltiplas gravações e precisa avaliar consistência. Testar isolamento com duas contas e conflitos offline.

## Escopo acordado
PWA em português, mobile/desktop, chamado Compra em Dia, complementar ao Casa em dia (tarefas domésticas) e ControlAI (finanças), porém independente nesta versão.
- Moradores adicionam produtos, inclusive novos, à lista compartilhada; uma pessoa costuma realizar as compras.
- Catálogo reutilizável com sugestões ao digitar, normalização de maiúsculas/acentos e aviso de duplicados. Não fundir variantes diferentes, como leite integral e sem lactose. Ajustar quantidade de item já pendente com confirmação/comportamento claro.
- Quantidade, unidade, observação e solicitante; alternativas/marca opcionais.
- No mercado, marcar comprado, informar preço opcional, compra parcial; permitir desfazer toque.
- Não comprados permanecem pendentes automaticamente; desistências são removidas.
- Finalizar compra: registrar estabelecimento, data, produtos e preços; manter apenas saldos pendentes; histórico permite selecionar produtos para nova lista.
- Setores sugeridos por dicionário local, correção memorizada, criar/renomear/remover/reordenar setores. Reconhecido ou não, nunca impedir inclusão.
- Destacar pedidos adicionados enquanto comprador está no mercado.
- Preços estimados e reais, histórico por produto/mercado, marca/apresentação e embalagem para comparação R$/kg, R$/L, R$/un. Descontos considerados; sem preço deve aparecer como incompleto, nunca como produto grátis.
- Leitura de cupom por foto/OCR e QR, revisão editável antes de confirmar, importação XML como alternativa. Conciliar cupom com lista e itens já marcados, prevenir importação duplicada e guardar associações de nomes abreviados. Não exigir cadastrar novamente tudo após a compra.
- QR depende dos portais estaduais, CORS/captcha/layout; não prometer leitura automática universal. Se backend de consulta necessário, validar hosts/redirects e evitar SSRF; implementar suporte real e fallback honesto. OCR pode errar; permitir edição, inclusão e remoção de linhas e conferência de total/descontos.
- Offline, autenticação, casas/participantes por convite e sincronização Supabase. Conflitos explícitos; não sobrescrever silenciosamente. Exportação/restauração segura de backup.

## Próximos passos
1. Ler instruções locais e revisar o código parcial antes de completar.
2. Concluir funções ausentes e CSS responsivo/acessível. Direção visual iniciada: verde escuro/jade, fundo claro, detalhes lima, sidebar desktop, navegação inferior mobile. Sem necessidade de landing page.
3. Projetar/criar SQL versionado e aplicar no projeto correto usando MCP autorizado. Verificar docs atuais, RLS e isolamento.
4. Implementar fluxo de cupom completo com conciliação, preços, descontos e revisão; testar com fixtures e cupons reais quando disponíveis. Sem inventar validação em cupons reais não fornecidos.
5. Revisar persistência, sincronização, concorrência e isolamento de contas; finalizar PWA e offline. Nunca cachear respostas de Auth/API no service worker.
6. Rodar testes de regras relevantes, build e testes de interface em celular/desktop. `npm test` está definido mas testes ainda não existem.
7. Publicar código completo na main, configurar Pages (preferencialmente Actions), acompanhar execução e verificar URL publicada. Atualizar README com setup/limitações reais. Usuário já autorizou a publicação.
