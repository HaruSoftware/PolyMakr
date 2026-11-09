# PolyMakr

Extensão MV3 para Chrome que adiciona um painel ao Polymarket, acompanha preços Up/Down visíveis e guarda regras de alerta localmente.

## Instalar para desenvolvimento

1. Abra `chrome://extensions` no Chrome e habilite **Modo do desenvolvedor**.
2. Selecione **Carregar sem compactação** e escolha a pasta deste projeto.
3. Abra ou recarregue uma página de mercado no Polymarket.
4. Use o botão flutuante **PM** à esquerda do cartão de compra/venda, alinhado ao ícone do mercado (quando detectado), ou o popup da extensão para abrir o painel. Se o cartão não for encontrado, o botão fica no canto inferior direito. Os resultados **Up** aparecem em verde e **Down** em vermelho no painel.

## Regras

Cada regra associa mercado/resultado, compra ou venda, condição e preço de disparo, preço da ordem limite, quantidade em shares e comportamento desejado. A expiração permanece em **Never**, como no formulário de referência:

- **Somente notificar**: gera uma notificação do navegador quando o preço cruza o limite.
- **Avisar e pedir confirmação**: opção disponível na configuração; a confirmação/ação ainda não está integrada.
- **Automatizar ordem limite**: opção disponível na configuração; o envio da ordem ainda não está integrado.

As opções de confirmação e automação são apresentadas como indisponíveis deliberadamente. Esta versão **não envia ordens, não conecta carteiras e não assina transações**. A captura de referência mostra o formulário de ordem, mas não permite validar os controles e estados da página autenticada; por isso, o monitor não clica em **Trade**.

O monitor reconhece botões visíveis com rótulos no formato `Up 91¢` ou `Down 10¢`. Os preços e o layout podem variar; confira a associação de mercado/resultado antes de confiar em um alerta. Se a regra for criada antes da extensão observar um preço, ela só dispara após uma mudança que cruze o limite.

## Armazenamento e permissões

As regras são salvas em `chrome.storage.local` neste navegador. A extensão tem acesso às páginas do Polymarket e usa notificações do Chrome; não há envio de dados a um servidor externo.
