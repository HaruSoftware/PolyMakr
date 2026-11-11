# PolyMakr

Extensão MV3 para Chrome que adiciona um painel ao Polymarket, acompanha preços Up/Down visíveis e guarda regras de alerta ou ordem limite localmente.

## Organização

- `background.js`: notificações do Chrome e acompanhamento periódico de fills.
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
5. Na aba **Criar**, escolha explicitamente o resultado **Up** ou **Down** e o lado da ordem (**Comprar** ou **Vender**), depois informe o preço de gatilho e o preço limite. A automação embutida no Polymarket também permite escolher Up/Down e Comprar/Vender, sem depender dos controles nativos. Nenhuma opção é selecionada automaticamente, e os preços Up/Down não preenchem os campos de preço. Cada regra fica vinculada ao mercado ativo identificado nesta página; ao abrir outro mercado, a lista mostra somente as regras daquele mercado. Favoritos são modelos reutilizáveis e, ao ativá-los, criam uma regra para o mercado da página atual.
   Na aba **Regras**, o quadro mostra **Em Fila**, **Executar Imediato** e **Favoritos** lado a lado. Cada card mostra o preço de gatilho. Arraste regras entre as duas primeiras seções ou use o menu ⋮. Em **Em Fila**, arraste um card para cima/baixo de outro para definir a ordem de execução; a posição nas outras seções não altera o processamento. Regras em execução não podem ser movidas.
   A aba **Registro** conserva regras disparadas e removidas da fila em cards somente de texto. Regras automatizadas saem da fila quando o envio é tentado; o registro mostra aguardando, preenchimento parcial ou preenchida. Remover uma regra ainda não disparada também a arquiva, sem apagar seu histórico. É possível selecionar registros individuais ou todos para apagar; cada exclusão, inclusive **Limpar tudo**, exige confirmação em um popup. Para acompanhar fills automaticamente, informe nessa aba o endereço público/proxy wallet exibido na conta Polymarket. Favoritos permanecem reutilizáveis e não são arquivados até virarem regra.
   Arrastar um favorito para uma seção de regras cria uma nova regra e mantém o modelo salvo; Favoritos não aceita cards arrastados. O menu ⋮ também permite ver detalhes, editar, carregar um modelo no formulário e renomear. Editar uma regra concluída não a reativa. A extensão não altera o cartão de negociação do Polymarket.

## Regras

Cada regra define mercado (obtido da página em que foi criada), resultado (Up/Down), compra ou venda, condição e preço de disparo, preço da ordem limite, quantidade em shares (número inteiro, mínimo de 1) e comportamento desejado. O preço de gatilho é sempre informado pelo usuário; a cotação atual não preenche nem substitui esse valor. A execução e o histórico são isolados pelo mercado identificado no painel de negociação da página. A expiração permanece em **Never**, como no formulário de referência:

- **Somente notificar**: gera uma notificação do navegador quando o preço cruza o limite.
- **Avisar e pedir confirmação**: gera um aviso; a confirmação manual dentro da extensão ainda não está integrada.
- **Automatizar ordem limite**: não é necessário deixar o formulário de negociação aberto. Enquanto a página do mercado estiver aberta no Chrome, ao cruzar o gatilho a extensão seleciona o resultado para abrir/atualizar o formulário, escolhe Buy/Sell e **Limit**, preenche preço e shares e clica em **Trade**. A carteira ou o Polymarket ainda podem pedir confirmação; a extensão interrompe a tentativa se não conseguir identificar o mercado, o formulário ou os valores sem ambiguidade.

Cada regra escolhe como entrar na fila:

- **Respeitar a fila** (padrão): a regra aguarda as regras anteriores em ordem de criação, mesmo que o gatilho de uma regra posterior seja atingido antes.
- **Executar ao atingir o gatilho, mesmo fora da ordem**: a regra pode passar à frente das regras em ordem que ainda estejam aguardando, assim que seu gatilho for atingido.

As regras são sempre processadas uma por vez em cada mercado; uma regra independente não interrompe uma ordem que já está sendo enviada. Regras antigas sem essa configuração continuam respeitando a fila. No modo de ordem limite, a extensão envia o clique em **Trade** e consulta trades públicos da carteira, identificando fills compatíveis por mercado, resultado, lado, preço e horário. Fills parciais e integrais são mostrados no Registro, inclusive após fechar a página, enquanto a extensão estiver instalada e ativa. A API pública não fornece o ID da ordem: se houver ordens simultâneas com os mesmos critérios, o registro sinaliza que não conseguiu atribuir o fill com segurança. Se nenhum fill aparecer, a extensão não consegue distinguir uma ordem ainda aberta de uma ordem cancelada/rejeitada sem autenticação; confira o status diretamente no Polymarket. A extensão não recebe nem armazena chaves privadas ou credenciais de API.

Cada regra dispara uma única vez no mercado ao qual está vinculada e não é executada de novo, inclusive depois de recarregar a página. Regras de outros mercados não aparecem na fila nem podem ser executadas pela página atual. Favoritos guardam também a preferência de fila e só entram nela quando você seleciona **Usar modelo** e depois salva uma regra. Se uma execução for interrompida ou incerta, confira o Polymarket antes de criar outra regra. Se os controles do formulário não forem identificados sem ambiguidade, a tentativa é interrompida e uma notificação explica o motivo. Os avisos também aparecem como notificações visuais no painel e como notificações do Chrome.

O monitor lê os preços dos botões visíveis `Up` e `Down` para detectar o cruzamento do gatilho, mas não os mostra como opções nem os usa para preencher o gatilho ou o preço limite. Os preços e o layout podem variar; confira a associação de mercado/resultado antes de confiar em um alerta. Se a regra for criada antes da extensão observar um preço, ela só dispara após uma mudança que cruze o limite.

## Armazenamento e permissões

As regras na fila, o Registro, o endereço público da carteira, os modelos favoritos e os estados de execução são salvos em `chrome.storage.local` neste navegador. Regras antigas com mercado identificável preservam esse vínculo e seu histórico. Regras antigas sem mercado identificável permanecem preservadas no armazenamento, mas não são exibidas nem executadas; recrie-as no mercado desejado. A extensão tem acesso às páginas do Polymarket e consulta a API pública do Polymarket para encontrar trades da carteira; não envia dados a um servidor próprio ou de terceiros.
