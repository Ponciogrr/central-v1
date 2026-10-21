# AGENTS.md — Instruções permanentes do projeto

> **Memória persistente entre sessões.** Atualize este arquivo e os arquivos em `docs/` ao final de cada etapa.

## Idioma
- Desenvolver e documentar em **português brasileiro**.

## Código
- Código **simples, organizado e fácil de manutar**.
- **Dependências mínimas**; priorizar execução local sem complexidade.
- **Economia de tokens**: não imprimir arquivos grandes no terminal, não repetir conteúdo já salvo em disco.

## Regras de trabalho
- **Ler o estado do projeto antes de qualquer trabalho novo**: consultar `docs/PROJECT_STATUS.md`, `docs/DECISIONS.md` e listar os arquivos existentes.
- **Não reescrever arquivos** que não precisam ser modificados.
- **Preservar todos os arquivos existentes** (inclusive `Central de Motoboys_ Painel UX Neon.png`).
- **Testar as alterações** e corrigir erros antes de concluir cada etapa.
- Atualizar `docs/PROJECT_STATUS.md` e `docs/DECISIONS.md` ao final de cada etapa concluída.
- Trabalhar em **etapas pequenas**; **aguardar autorização** do proprietário antes de implementar telas/funcionalidades novas.
- **Não inventar funcionalidades** fora do escopo aprovado; **não declarar pronta** uma funcionalidade apenas visual.
- Explicar problemas e comandos em **linguagem simples** (proprietário é iniciante).
- **Inspecionar apenas os arquivos necessários** para cada tarefa; evitar varreduras amplas e releituras do projeto.
- **Não reler as 81 regras completas** em cada etapa — consultar só as partes pertinentes.
- **Separar claramente o que funciona do que é apenas visual** (demonstração) nos relatórios.

## Regras de design (briefing do proprietário)
- Identidade: **grafite, branco e roxo** (ações importantes); temas **claro e escuro**; mobile-first; pouca decoração; ícones consistentes; sem aspecto genérico de IA. Detalhes: `docs/DESIGN_SYSTEM.md`.
- Perfis: Motoboy, Lojista, Pessoa Física e **Administrador**.
- **Sem cadastro público**: admin cria usuários e códigos de acesso. Sem backend/pagamentos/GPS real nesta fase.
- **As 81 regras de negócio estão em `docs/REGRAS_DO_SISTEMA_CENTRAL_DE_MOTOBOYS.md`** — é a fonte oficial de regras; não inventar regras além dela (a regra 82 não existe).

## Skills instaladas (em `.agents/skills/`)
| Skill | Origem | Usar em |
|---|---|---|
| `find-skills` | vercel-labs/skills | Descobrir novas skills quando necessário |
| `vercel-react-best-practices` | vercel-labs/agent-skills | Arquitetura React, performance, componentes |
| `webapp-testing` | anthropics/skills | Testes no navegador (Playwright), depuração de UI |
| `frontend-design` | anthropics/skills | Direção visual, tipografia e estética da UI |
| `expo-router` | expo/skills | Navegação/rotas do app nativo (Expo Router) |
| `expo-native-ui` | expo/skills | Telas nativas, cores semânticas, controles do Expo |
| `expo-design-system` | expo/skills | Tokens/tema e componentes reutilizáveis do app |

- **Mapas/geolocalização: NÃO há skill adequada** → implementar com **Leaflet + OpenStreetMap** (grátis, sem chave de API).
- Não instalar skills desnecessárias nem coleções completas; instalar só as necessárias.
- **Skills novas exigem reiniciar a sessão do OpenCode** para ficarem ativas.

## Skill do projeto (contexto permanente)
- `.opencode/skills/central-motoboys/SKILL.md` — orienta o agente a ler o estado em `docs/`, respeitar limites de segurança e seguir em autonomia por etapas pequenas. Curta por decisão: a fonte da verdade são os arquivos do projeto.

## Ciclos autônomos (Open Ralph Wiggum)
- Ferramenta instalada: **Bun 1.4.3** (`~/.bun/bin`) + `@th0rgal/ralph-wiggum` (npm global); comando `ralph` (`%APPDATA%\npm\ralph.cmd`).
- Plano e instruções: **`PLANO_CICLOS_AUTONOMOS.md`** (tarefas reais, critérios, limite de 5 iterações, regras de segurança).
- **Windows — sempre definir antes de rodar** (o Bun recusa o prompt com `#`/`<`/`>` passado ao wrapper `.cmd`):
  `$env:RALPH_OPENCODE_BINARY = "$env:APPDATA\npm\node_modules\opencode-ai\bin\opencode.exe"` e pôr `~/.bun/bin` no PATH.
- Iniciar ciclo: `ralph --prompt-file PLANO_CICLOS_AUTONOMOS.md --max-iterations 5`; acompanhar: `ralph --status`; interromper: `Ctrl+C`.
- Smoke test já validado (criou arquivo local e respeitou `<promise>COMPLETE</promise>`) sem tocar no Neon.
