# PolyMakr

Extensão MV3 para Chrome que adiciona um painel ao Polymarket, acompanha preços Up/Down visíveis e guarda regras de alerta ou ordem limite localmente.

## Instalar para desenvolvimento

1. Abra `chrome://extensions` no Chrome e habilite **Modo do desenvolvedor**.
2. Selecione **Carregar sem compactação** e escolha a pasta deste projeto.
3. Abra ou recarregue uma página de mercado no Polymarket.
4. Clique no ícone da extensão e selecione **Abrir painel na página** para abrir a janela centralizada.
5. Na aba **Criar**, selecione o resultado nos botões Up/Down com os preços atuais. Use **Salvar regra** para guardar normalmente ou **Favoritar** para salvar também na aba de favoritos. As abas **Regras** e **Favoritos** permitem editar regras que não estão em execução e reutilizar modelos. Editar uma regra concluída não a reativa. A extensão não altera o cartão de negociação do Polymarket.

## Regras

Cada regra associa mercado/resultado, compra ou venda, condição e preço de disparo, preço da ordem limite, quantidade em shares e comportamento desejado. A expiração permanece em **Never**, como no formulário de referência:

- **Somente notificar**: gera uma notificação do navegador quando o preço cruza o limite.
- **Avisar e pedir confirmação**: gera um aviso; a confirmação manual dentro da extensão ainda não está integrada.
- **Automatizar ordem limite**: ao cruzar o gatilho, seleciona o resultado e Buy/Sell, escolhe **Limit**, preenche preço e shares e clica em **Trade**. A carteira ou o Polymarket ainda podem pedir confirmação.

As regras são colocadas em uma fila e executadas em sequência, na ordem em que foram criadas. Cada regra dispara uma única vez: após o aviso ou a tentativa de ordem, fica marcada como concluída (ou falha) e não é executada de novo, inclusive depois de recarregar a página. Regras concluídas continuam visíveis e podem ser removidas ou marcadas como favoritas; uma favorita pode ser carregada como modelo para criar outra regra. Se uma execução for interrompida ou incerta, confira o Polymarket antes de criar outra regra. A extensão não conecta carteiras nem assina transações. Se os controles do formulário não forem identificados sem ambiguidade, a tentativa é interrompida e uma notificação explica o motivo.

O monitor reconhece botões visíveis com rótulos no formato `Up 91¢` ou `Down 10¢`. Os preços e o layout podem variar; confira a associação de mercado/resultado antes de confiar em um alerta. Se a regra for criada antes da extensão observar um preço, ela só dispara após uma mudança que cruze o limite.

## Armazenamento e permissões

As regras são salvas em `chrome.storage.local` neste navegador. A extensão tem acesso às páginas do Polymarket e usa notificações do Chrome; não há envio de dados a um servidor externo.
