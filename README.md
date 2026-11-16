# Groceries

A lista da casa, os preços e as compras em um só lugar.

## Desenvolvimento

Use Node.js 24. Execute `npm ci`, `npm test` e `npm run dev`. Para verificar a versão de produção e o service worker, execute `npm run build` e `npm exec vite -- preview`. Abra a URL exibida com o caminho `/groceries/`.

## Supabase

O frontend usa a URL e a chave pública do projeto Groceries. Aplique as migrações de `supabase/migrations` em um projeto vazio ou compatível. O teste SQL em `supabase/tests/isolation.sql` cria duas contas sintéticas dentro de uma transação revertida e verifica isolamento, controle de versão, atomicidade e repetição segura.

Em Authentication → URL Configuration, defina a URL do site como `https://rodrigo-yuji.github.io/groceries/` e cadastre o mesmo endereço como redirecionamento permitido. Para testes locais de login, cadastre a URL de desenvolvimento correspondente. Habilite o provedor de e-mail e configure o serviço de envio conforme o ambiente. O acesso pelo app usa link por e-mail.

Convites são códigos aleatórios de 7 dias. Gerar um novo código invalida o anterior. O responsável pode revogar o código e remover participantes pelo menu Casas.

A lista funciona em modo local e em casas compartilhadas. A fila persistente é separada por conta. Um lote enviado ao Supabase tem ID estável e verifica a versão dos registros. Se uma versão divergir, o usuário pode descartar o lote ou reaplicar suas alterações. A atualização usa Realtime com consulta periódica como alternativa. Dispositivos offline podem exibir os dados que já estavam salvos antes de uma revogação.

## Cupons

O XML NF-e/NFC-e traz itens, quantidades, descontos e total fiscal. A foto roda OCR em português no navegador, com download inicial dos dados do Tesseract. Revise sempre as linhas extraídas e o total. O QR por imagem tenta importar diretamente dos portais HTTPS que permitem leitura pelo navegador e retornam XML ou HTML compatível. Para bloqueios por CORS, redirecionamento, captcha ou layout, abra o portal oficial e importe o XML ou uma página HTML salva compatível. A foto e a entrada manual também ficam disponíveis. O processamento não usa proxy e o app não envia a foto ao banco. A compatibilidade varia por portal e ainda não foi validada em cupons reais.

## Instalação e publicação

No Android, procure a opção de instalar no menu do navegador. No iPhone, abra no Safari e use Compartilhar → Adicionar à Tela de Início. Após a primeira visita online, o service worker guarda somente os arquivos públicos da compilação. As respostas de autenticação e API ficam fora desse cache. O backup JSON pode ser restaurado na lista atual e ignora identificadores e produtos duplicados.

Em Settings → Pages, selecione GitHub Actions como origem. O workflow roda testes, compila e publica o diretório `dist` para cada alteração na branch `main`.
