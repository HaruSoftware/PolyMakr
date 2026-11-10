# Diretrizes do projeto

## Arquitetura

- Esta é uma extensão Chrome Manifest V3 em JavaScript, sem processo de build. O `manifest.json` define permissões, pontos de entrada e ordem de carregamento.
- `background.js` lida com notificações; `popup.*` contém o popup; `scripts/content/` contém o painel e a integração com a página do Polymarket.
- Os arquivos em `scripts/content/` são scripts clássicos no mesmo contexto isolado. Os módulos de funções devem ser carregados antes de `bootstrap.js`, conforme a ordem do manifest. Evite inicialização dependente do DOM fora do bootstrap e mantenha nomes globais únicos.

## Compatibilidade e comportamento

- Preserve as chaves e o formato de dados em `chrome.storage.local`; os dados pertencem ao usuário e não devem ser descartados por mudanças internas.
- Mudanças na detecção de cotações ou na execução de ordens precisam manter as verificações de ambiguidade e os avisos existentes.
- Atualize o `README.md` quando mudar instalação, permissões, armazenamento ou comportamento visível.

## Validação

- Verifique a sintaxe dos scripts alterados com `node --check <arquivo>`.
- Confirme que cada caminho declarado no `manifest.json` existe e execute `git diff --check`.
- O projeto não possui atualmente uma suíte de testes automatizados nem comandos de build.
