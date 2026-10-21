# DECISÕES — Aplicativo nativo (`mobile/`)

> Registro das decisões da etapa **M1** (estrutura Expo). Manter junto com `docs/DECISIONS.md` e `docs/PROJECT_STATUS.md`.

## Decisões da M2

| # | Decisão | Motivo |
|---|---|---|
| M2-1 | Login **só por código, sem seletor de perfil** no app | O papel autorizado deve vir do servidor (M3); evita "acesso por escolher o perfil" (segurança pedida). |
| M2-2 | Login **não autentica nada** nesta etapa: valida campo vazio e avisa que a validação real vem na M3 | Não fingir autenticação; nenhuma credencial ou código é armazenado no app. |
| M2-3 | **Modo de demonstração** na tela inicial, em bloco separado e rotulado "(somente testes)" | Permite navegar nas telas sem fingir login. |
| M2-4 | Cada perfil é uma **pasta com abas** (`Tabs` do Expo Router): Início, Rotas, Histórico, Perfil | Estrutura pronta para receber funcionalidades (M4+); segue o padrão do protótipo. |
| M2-5 | ~~Abas só com texto~~ — **substituída pela M2-7** | — |
| M2-6 | Sem acesso administrativo no app | Admin continua no painel web; evita qualquer atalho administrativo no celular. |
| M2-7 | Abas com **ícones Ionicons** (`@expo/vector-icons`, oficial do Expo): casa/rota/relógio/usuário, ativa em roxo | Ícones coerentes pedidos no briefing; era a única dependência realmente faltante. |
| M2-8 | **Grupo `(tabs)` + `Stack` por perfil**: as 4 abas ficam no grupo e `solicitar` é tela empilhada **fora** delas | `solicitar` dentro da pasta de `Tabs` virava **5ª aba fantasma**; agora abre por cima, com botão voltar nativo. |
| M2-9 | Stack raiz **sem cabeçalho** para os 3 perfis; tema inicial **determinístico**; `web.output: "single"` | Evita cabeçalho duplo e o erro de *hydration* na web. |

## Decisões desta etapa (M1)

| # | Decisão | Motivo |
|---|---|---|
| M1-1 | Projeto Expo **separado em `mobile/`**, sem tocar no protótipo Vite da raiz | Preservar o protótipo; evitar duas implementações no mesmo `package.json`. |
| M1-2 | Template oficial **SDK 58** (`expo-template-default`) com **TypeScript** | Versão estável atual; TS desde o início. |
| M1-3 | Navegação com **Expo Router**, rotas em `mobile/src/app/` | Rota por arquivo, padrão oficial do template; simples de manter. |
| M1-4 | Tema próprio em `mobile/src/theme.tsx` (grafite/branco/roxo, claro/escuro) | Identidade do projeto; **não** copiar CSS web. Tokens documentados em `docs/DESIGN_SYSTEM.md`. |
| M1-5 | Remover telas/componentes de exemplo do template (boilerplate) | Estrutura limpa e compreensível; nada do protótipo foi apagado. |
| M1-6 | Navegação de entrada **temporária** (sem login) | Só para validar a estrutura; login real na M2/M3. |
| M1-7 | **Sem backend, sem banco, sem EAS Build, sem emulador** nesta etapa | Escopo da M1 e limitação de memória do computador. |
| M1-8 | Alternância claro/escuro **em memória** | Evita instalar armazenamento nesta etapa; persistência vem depois. |

## Estrutura atual

```
mobile/
├── src/
│   ├── app/
│   │   ├── _layout.tsx      (Stack + tema)
│   │   ├── index.tsx        (boas-vindas: login + modo demonstração)
│   │   ├── login.tsx        (login por código — interface; validação real na M3)
│   │   ├── motoboy/         (_layout Tabs + index, rotas, historico, perfil)
│   │   ├── lojista/         (_layout Stack + (tabs)/{4 abas} + solicitar.tsx)
│   │   └── pessoa/          (_layout Stack + (tabs)/{4 abas} + solicitar.tsx)
│   ├── components/          (botao, campo, vazio)
│   └── theme.tsx
├── app.json                 (nome "Central de Motoboys")
├── package.json
└── tsconfig.json            (alias @/ → src/)
```

## Como rodar

No computador: `cd mobile` e `npm start` (ou `npx expo start`).
No celular Android: instalar **Expo Go** (Play Store), conectar na **mesma rede Wi‑Fi** do computador e ler o **QR code** exibido no terminal com o app Expo Go.
Se o celular não enxergar o computador (rede diferente), usar `npx expo start --tunnel` (mais lento, funciona fora da rede local).
**No navegador (verificação visual):** `cd mobile` → `npm run web` → http://localhost:8081 (primeira compilação leva ~1–2 min).

## Limitações conhecidas (M1/M2)

- Sem login real e sem backend — telas navegáveis, listas vazias e formulários que não salvam.
- O login **não autentica**; a validação do código, a sessão e as permissões serão do servidor (M3).
- Tema escolhido não é salvo ao fechar o app; o toggle de disponibilidade do motoboy também não persiste.
- **APK não foi gerado** (será via EAS Build na M6; APK local exige Android Studio, inviável neste computador).
- Disco do computador ficou próximo do limite; o cache do npm foi limpo com autorização do proprietário (liberou ~5 GB).
- A pasta `mobile/node_modules` é grande (~0,4 GB) — não rodar builds do site e do app ao mesmo tempo.
