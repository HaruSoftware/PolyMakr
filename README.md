# PolyMakr

Extensão MV3 para Chrome que adiciona um painel ao Polymarket, acompanha preços Up/Down visíveis e guarda regras de alerta ou ordem limite localmente.

## Instalar para desenvolvimento

1. Abra `chrome://extensions` no Chrome e habilite **Modo do desenvolvedor**.
2. Selecione **Carregar sem compactação** e escolha a pasta deste projeto.
3. Abra ou recarregue uma página de mercado no Polymarket.
4. Use o botão flutuante **PM** à esquerda do cartão de compra/venda, alinhado ao ícone do mercado (quando detectado), ou o popup da extensão para abrir o painel. Se o cartão não for encontrado, o botão fica no canto inferior direito. Os resultados **Up** aparecem em verde e **Down** em vermelho no painel.
5. No cartão de negociação, use **Auto** ao lado de **Buy** e **Sell**. A aba substitui o formulário de ordem por completo pelos preços e controles da extensão; selecionar **Buy** ou **Sell** restaura o formulário original.

## Regras

Cada regra associa mercado/resultado, compra ou venda, condição e preço de disparo, preço da ordem limite, quantidade em shares e comportamento desejado. A expiração permanece em **Never**, como no formulário de referência:

- **Somente notificar**: gera uma notificação do navegador quando o preço cruza o limite.
- **Avisar e pedir confirmação**: gera um aviso; a confirmação manual dentro da extensão ainda não está integrada.
- **Automatizar ordem limite**: ao cruzar o gatilho, seleciona o resultado e Buy/Sell, escolhe **Limit**, preenche preço e shares e clica em **Trade**. A carteira ou o Polymarket ainda podem pedir confirmação.

Cada regra automática é executada uma única vez. O estado da tentativa é salvo para impedir repetição após recarregar a página; depois de uma falha ou resultado incerto, confira o Polymarket antes de criar outra regra. A extensão não conecta carteiras nem assina transações. Se os controles do formulário não forem identificados sem ambiguidade, a tentativa é interrompida e uma notificação explica o motivo.

O monitor reconhece botões visíveis com rótulos no formato `Up 91¢` ou `Down 10¢`. Os preços e o layout podem variar; confira a associação de mercado/resultado antes de confiar em um alerta. Se a regra for criada antes da extensão observar um preço, ela só dispara após uma mudança que cruze o limite.

## Armazenamento e permissões

As regras são salvas em `chrome.storage.local` neste navegador. A extensão tem acesso às páginas do Polymarket e usa notificações do Chrome; não há envio de dados a um servidor externo.
