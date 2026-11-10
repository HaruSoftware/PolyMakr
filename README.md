# PolyMakr

Extensão MV3 para Chrome que adiciona um painel ao Polymarket, acompanha preços Up/Down visíveis e guarda regras de alerta ou ordem limite localmente.

## Organização

- `background.js`: notificações do Chrome.
- `popup.html`, `popup.css` e `popup.js`: popup da extensão.
- `scripts/content/rules.js`: regras, favoritos e persistência.
- `scripts/content/polymarket.js`: integração com os controles e cotações da página.
- `scripts/content/execution.js`: monitoramento de preços e execução da fila.
- `scripts/content/views.js`: renderização e edição das listas.
- `scripts/content/bootstrap.js`: cria a interface, conecta os eventos e inicia o monitoramento.

Os scripts de conteúdo são JavaScript clássico, carregados na ordem declarada no `manifest.json`; não há etapa de build. Os módulos de funções vêm antes do bootstrap porque compartilham o contexto isolado do content script. Ao adicionar um módulo, declare-o no manifest antes do bootstrap e preserve essa ordem.

## Instalar para desenvolvimento

1. Abra `chrome://extensions` no Chrome e habilite **Modo do desenvolvedor**.
2. Selecione **Carregar sem compactação** e escolha a pasta deste projeto.
3. Abra ou recarregue uma página de mercado no Polymarket.
4. Clique no ícone da extensão e selecione **Abrir painel na página** para abrir a janela centralizada.
5. Na aba **Criar**, selecione o resultado nos botões Up/Down com os preços atuais. **Salvar regra** adiciona uma regra à fila; **Favoritar** abre uma janela para nomear e salvar um modelo sem adicioná-lo à fila. Na aba **Regras** você pode acompanhar, editar e remover regras. Na aba **Favoritos** você pode reutilizar, renomear e excluir modelos sem alterar a fila. Editar uma regra concluída não a reativa. A extensão não altera o cartão de negociação do Polymarket.

## Regras

Cada regra associa mercado/resultado, compra ou venda, condição e preço de disparo, preço da ordem limite, quantidade em shares e comportamento desejado. A expiração permanece em **Never**, como no formulário de referência:

- **Somente notificar**: gera uma notificação do navegador quando o preço cruza o limite.
- **Avisar e pedir confirmação**: gera um aviso; a confirmação manual dentro da extensão ainda não está integrada.
- **Automatizar ordem limite**: ao cruzar o gatilho, seleciona o resultado e Buy/Sell, escolhe **Limit**, preenche preço e shares e clica em **Trade**. A carteira ou o Polymarket ainda podem pedir confirmação.

Cada regra escolhe como entrar na fila:

- **Respeitar a fila** (padrão): a regra aguarda as regras anteriores em ordem de criação, mesmo que o gatilho de uma regra posterior seja atingido antes.
- **Executar ao atingir o gatilho, mesmo fora da ordem**: a regra pode passar à frente das regras em ordem que ainda estejam aguardando, assim que seu gatilho for atingido.

As regras são sempre processadas uma por vez; uma regra independente não interrompe uma ordem que já está sendo enviada. Regras antigas sem essa configuração continuam respeitando a fila. A extensão não cria dependências automáticas entre compras e vendas nem verifica se uma ordem foi preenchida ou se há shares disponíveis: no modo de ordem limite, ela envia o clique em **Trade**, e o Polymarket ou a carteira ainda podem pedir confirmação. Cada regra dispara uma única vez: após o aviso ou a tentativa de ordem, fica marcada como concluída (ou falha) e não é executada de novo, inclusive depois de recarregar a página. Regras concluídas continuam visíveis até serem removidas. Os modelos favoritos guardam também a preferência de fila e só entram nela quando você seleciona **Usar modelo** e depois salva uma regra. Se uma execução for interrompida ou incerta, confira o Polymarket antes de criar outra regra. A extensão não conecta carteiras nem assina transações. Se os controles do formulário não forem identificados sem ambiguidade, a tentativa é interrompida e uma notificação explica o motivo. Os avisos também aparecem como notificações visuais no painel e como notificações do Chrome.

O monitor reconhece botões visíveis com rótulos no formato `Up 91¢` ou `Down 10¢`. Os preços e o layout podem variar; confira a associação de mercado/resultado antes de confiar em um alerta. Se a regra for criada antes da extensão observar um preço, ela só dispara após uma mudança que cruze o limite.

## Armazenamento e permissões

As regras e os modelos favoritos são salvos em chaves separadas de `chrome.storage.local` neste navegador. Favoritos legados são migrados automaticamente para modelos independentes, sem remover suas regras da fila/histórico. A extensão tem acesso às páginas do Polymarket e usa notificações do Chrome; não há envio de dados a um servidor externo.
