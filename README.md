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
5. Na aba **Criar**, selecione Up/Down no painel de negociação do mercado ativo. As regras e os favoritos não ficam vinculados a esse mercado: ao abrir outro mercado com o painel de negociação disponível, o PolyMakr identifica seus preços e aplica as mesmas regras.
   Na aba **Regras**, o quadro mostra **Em Fila**, **Executar Imediato** e **Favoritos** lado a lado. Cada card mostra o preço de gatilho e oferece um botão **Remover**. Arraste regras entre as duas primeiras seções ou use o menu ⋮. Em **Em Fila**, arraste um card para cima/baixo de outro para definir a ordem de execução; a posição nas outras seções não altera o processamento. Regras em execução não podem ser movidas.
   Arrastar um favorito para uma seção de regras cria uma nova regra e mantém o modelo salvo; Favoritos não aceita cards arrastados. O menu ⋮ também permite ver detalhes, editar, carregar um modelo no formulário e renomear. Editar uma regra concluída não a reativa. A extensão não altera o cartão de negociação do Polymarket.

## Regras

Cada regra define resultado (Up/Down), compra ou venda, condição e preço de disparo, preço da ordem limite, quantidade em shares e comportamento desejado, sem salvar um mercado específico. O PolyMakr usa o mercado identificado no painel de negociação aberto; a execução e o histórico de cada regra são independentes por mercado. A expiração permanece em **Never**, como no formulário de referência:

- **Somente notificar**: gera uma notificação do navegador quando o preço cruza o limite.
- **Avisar e pedir confirmação**: gera um aviso; a confirmação manual dentro da extensão ainda não está integrada.
- **Automatizar ordem limite**: ao cruzar o gatilho, seleciona o resultado e Buy/Sell, escolhe **Limit**, preenche preço e shares e clica em **Trade**. A carteira ou o Polymarket ainda podem pedir confirmação.

Cada regra escolhe como entrar na fila:

- **Respeitar a fila** (padrão): a regra aguarda as regras anteriores em ordem de criação, mesmo que o gatilho de uma regra posterior seja atingido antes.
- **Executar ao atingir o gatilho, mesmo fora da ordem**: a regra pode passar à frente das regras em ordem que ainda estejam aguardando, assim que seu gatilho for atingido.

As regras são sempre processadas uma por vez em cada mercado; uma regra independente não interrompe uma ordem que já está sendo enviada. Regras antigas sem essa configuração continuam respeitando a fila. A extensão não cria dependências automáticas entre compras e vendas nem verifica se uma ordem foi preenchida ou se há shares disponíveis: no modo de ordem limite, ela envia o clique em **Trade**, e o Polymarket ou a carteira ainda podem pedir confirmação. Cada regra dispara uma única vez por mercado: após o aviso ou a tentativa de ordem, fica marcada como concluída (ou falha) naquele mercado e não é executada de novo, inclusive depois de recarregar a página. Regras concluídas continuam visíveis até serem removidas. Os modelos favoritos guardam também a preferência de fila e só entram nela quando você seleciona **Usar modelo** e depois salva uma regra. Se uma execução for interrompida ou incerta, confira o Polymarket antes de criar outra regra. A extensão não conecta carteiras nem assina transações. Se os controles do formulário não forem identificados sem ambiguidade, a tentativa é interrompida e uma notificação explica o motivo. Os avisos também aparecem como notificações visuais no painel e como notificações do Chrome.

O monitor reconhece botões visíveis com rótulos no formato `Up 91¢` ou `Down 10¢`. Os preços e o layout podem variar; confira a associação de mercado/resultado antes de confiar em um alerta. Se a regra for criada antes da extensão observar um preço, ela só dispara após uma mudança que cruze o limite.

## Armazenamento e permissões

As regras, os modelos favoritos e os estados de execução por mercado são salvos em `chrome.storage.local` neste navegador. Regras e favoritos existentes são migrados automaticamente para definições sem mercado; o histórico de execução é preservado para o mercado ao qual cada regra estava vinculada. A extensão tem acesso às páginas do Polymarket e usa notificações do Chrome; não há envio de dados a um servidor externo.
