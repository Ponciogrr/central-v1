# SESSION_HANDOFF — Passagem de sessão

> Estado **real** do projeto no encerramento desta sessão (2026-10-20). Documento de **passagem**: registra o que foi confirmado e o que continua incerto. **Não declara o T3 concluído.**

## 1. Resumo rápido

- **T1, T1.1 e T2 — concluídos e documentados** (ver `PROJECT_STATUS.md` M4.5/M4.6/M4.7 e `DECISIONS.md` #43/#45/#46/#47).
- **T3 (mapas) — RETIRADO do escopo do MVP por decisão do usuário.** O código de mapas já foi removido cuidadosamente nesta sessão (ver seção 4) — a instrução original de "remover numa próxima tarefa" foi **antecipada e executada**; resta apenas a conferência final.
- **Migração 004 permanece aplicada.** As 4 colunas de coordenadas (`pickup_lat/lng`, `dropoff_lat/lng`) **não foram apagadas**; são opcionais e estão **sem uso**. **Não criar migração destrutiva.**
- **MVP segue por endereço textual**, com o fluxo de entregas existente intacto (lojista/pessoa solicitam; motoboy recebe oferta, aceita, inicia, finaliza; cancelamentos com as regras 4/5/6).
- **Teste integrado T3 — interrompido/encerrado.** Estado do banco **confirmado por leitura** (seção 3). Ficaram **2 entregas de teste em `cancelada`** e **1 motoboy online** (resíduos inertes, pendentes de decisão — seção 6).

## 2. Estado do código (verificado nesta sessão)

- **Código de mapas removido** (cirurgia, sem `git reset`/reversão em bloco; T1/T1.1/T2 preservados):
  - Arquivos excluídos: `mobile/src/mapa/leaflet.ts`, `mobile/src/components/mapa.tsx`, `mobile/src/components/mapa.web.tsx`, `mobile/src/components/mapa-da-entrega.tsx`, `mobile/src/components/seletor-local.tsx` (e a pasta `mobile/src/mapa/`).
  - Backend: `backend/src/entregas/entregas.ts`, `backend/src/entregas/ofertas.ts`, `backend/src/routes/deliveries.ts` — removidos `coletaCoords`/`destinoCoords`, `coordenadaOpcao` e as colunas de coords das queries/tipos.
  - App: `mobile/src/api/cliente.ts` (removidos `CoordenadaApi` e os campos de coords), `mobile/src/components/formulario-solicitar.tsx` (removidos botões "marcar no mapa" e o seletor), `mobile/src/components/cartao-entrega.tsx`, `cartao-ativa.tsx`, `cartao-oferta.tsx` (removido `MapaDaEntrega`).
  - Dependência **`react-native-webview` desinstalada** (`package.json`, `package-lock.json` e `node_modules`). Confirmado que era **apenas** peer opcional do `expo`, sem outro uso no projeto.
- **Verificação de referências:** busca em `mobile/src` e `backend/src` por `coletaCoords|destinoCoords|CoordenadaApi|react-native-webview|leaflet|Leaflet|htmlDoMapa|MapaDaEntrega|SeletorLocal` → **nenhum resultado** (apenas comentários explicativos restam).
- **Typecheck:** `npm run typecheck` (backend) **OK** e `npx tsc --noEmit` (mobile) **OK** após a remoção.
- **Validação ao vivo:** a API do projeto foi reiniciada com o código novo. `/health` → **200**; login e `GET /deliveries` → **200**; a resposta **não** contém `coletaCoords`/`destinoCoords` e mantém `coleta`, `destino`, `status` etc.

## 3. Estado do banco (confirmado por consultas SOMENTE LEITURA)

Consultas diretas ao Neon (via `obterPool()`), sem escrita:

- **Entregas com marca de teste "T3" no endereço: 2** (ambas identificáveis exclusivamente como teste):
  | id | endereço coleta | status | courier | coords |
  |---|---|---|---|---|
  | `b0923036…` | Rua T3 301131, 10 | `cancelada` | não | coords nulas |
  | `0f76e9bf…` | Rua T3 494120, 10 | `cancelada` | não | coords gravadas (resíduo do teste) |
- **Total de entregas (todas): 62.** Antes do teste havia **60**; o teste criou **exatamente 2** → nenhuma entrega preexistente foi apagada (60 + 2 = 62).
- **Entregas ativas** (`aguardando`/`aceita`/`em_rota`): **0**.
- **Usuários online: 1** — motoboy `76978c81-…` (`name = null`, `account_type = motoboy`, `last_seen_at = 2026-10-20T16:53:04Z`). **Resíduo do teste**: ficou online e não foi desligado.
- **Ofertas pendentes: 0.** Ofertas ligadas às entregas de teste: 1 `expirada`, 1 `aceita`, 1 `recusada` (histórico; as entregas já estão `cancelada`).
- **Migração 004:** registrada em `schema_migrations` (`004_coordenadas_entrega.sql`, aplicada em `2026-10-20T15:56:08Z`). Colunas confirmadas: `pickup_lat/pickup_lng/dropoff_lat/dropoff_lng`, `numeric(9,6)`, `is_nullable = YES`.

### Onde o teste parou (confirmado)

O `testar-t3-integrado.mjs` **não está em execução** (nenhum processo do teste). Conforme o log da última execução, ele **chegou a criar entregas no Neon** e, no bloco de limpeza, **cancelou** a última entrega (de `aceita` → `aguardando` via motoboy e depois `cancelada` pelo solicitante). Confirmado por leitura: as 2 entregas ficaram `cancelada`. **Nenhuma nova execução** foi feita.

## 4. Migração 004 — preservar

- **Aplicada e registrada.** As quatro colunas permanecem no banco, **opcionais e sem uso**.
- **Não** apagar as colunas, **não** criar migração destrutiva, **não** remover a 004 nem seu registro em `schema_migrations`.
- Nenhuma migração nova foi executada nesta sessão.

## 5. Estado dos processos locais (NÃO encerrar sem identificar origem)

- Vite antigo da raiz (`npm run dev`): PIDs **10296** (npm) / **1784** (vite) — 17/10/2026, preservado.
- Expo web (`expo start --web`): PIDs **10520** (npm) / **10844** (expo) — preservados.
- **API do projeto** (`npm run start` no backend): PIDs **2104** (npm) / **15716** (node) — reiniciada nesta sessão com o código sem mapas; responde em `http://127.0.0.1:3000`.
- **Nenhum** ciclo Ralph (`ralph`) em execução. Não limpar `.ralph`, logs ou históricos.

## 6. Pendências e incertezas

- **Pendências inertes no banco (precisam de decisão, não são dados reais do produto):**
  1. **2 entregas de teste T3 em `cancelada`** (não aparecem como ativas; permanecem no histórico). A instrução desta etapa foi **não apagar registros**; se o proprietário quiser, remover depois com procedimento seguro.
  2. **1 motoboy online** (`76978c81-…`, `name = null`) — resíduo do teste. Ficou online e **não** foi desligado (para não alterar estado sem autorização nesta etapa).
- **Incerteza registrada:** não foi possível confirmar, apenas por leitura, **qual conta humana** corresponde ao motoboy online `76978c81-…` (o campo `name` está nulo). O `last_seen_at` (16:53:04Z) é compatível com a janela do teste T3, mas isso é **inferência**, não prova. Recomenda-se confirmar antes de qualquer ação.
- **Contas de teste antigas** podem ainda existir ("Lojista Teste M43", "Motoboy Teste M43 A/B", etc.) — limpeza opcional, fora desta etapa.
- **Rotação de senha do Neon** (exposta em chat anteriormente) permanece pendente de segurança antes de produção.
- **Documentação:** `docs/PROJECT_STATUS.md` (M4.8 reescrita como retirada), `docs/DECISIONS.md` (#48 marcada superada; **#49** = retirada dos mapas do MVP) e `PLANO_CICLOS_AUTONOMOS.md` (T3 revertida + registro) foram atualizados.

## 7. Próxima ação sugerida (a autorizar)

- **Conferência final da remoção** (arquivos/dependência/typecheck ja feitos) e, se desejado, **limpeza opcional** dos 2 resíduos de teste + desligar o motoboy online — **somente com autorização específica**.
- **T4–T5 CONCLUÍDAS em 2026-10-21** (ver seção 10): integração do Vite da raiz à API e método seguro do 1º admin. Todas as tarefas do plano T1–T5 estão `[x]`.

## 8. O que foi confirmado × o que continua incerto

- **Confirmado:** T1/T1.1/T2 concluídos (docs); mapas removidos do código e dependência desinstalada; typecheck/tsc OK; API viva com resposta sem coords; 2 entregas de teste em `cancelada`; total 62 entregas (60 + 2); 0 ativas; 0 ofertas pendentes; migração 004 aplicada e colunas preservadas; nenhum processo de teste nem ciclo ralph em execução.
- **Incerto:** identidade da conta do motoboy online `76978c81-…` (apenas `name` nulo; associação ao teste é inferência pelo horário). Existência de contas de teste antigas não foi reconferida linha a linha nesta etapa.

## 9. Atualização desta sessão — Rotas e encaixes (regras 10–14)

- **Implementado, migração APLICADA e testado (com autorização do proprietário).** Migração aditiva **005** (`backend/migrations/005_rotas_encaixes.sql`): tabelas `routes` e `route_fittings` (+ índice único parcial `uq_fittings_one_pending`), registrada em `schema_migrations` (001–004 intactas). Backend: `backend/src/rotas/rotas.ts`, `backend/src/rotas/encaixes.ts`, HTTP em `backend/src/routes/rotas.ts` (registrado em `backend/src/routes/index.ts`) e **regra 14** ligada ao ficar offline em `backend/src/routes/courier.ts`. Mobile: tipos/funções em `mobile/src/api/cliente.ts`, hooks em `mobile/src/rotas.ts` (`useRotasMotoboy`/`useRotasDisponiveis`, polling 5 s só em foco), tela `mobile/src/app/motoboy/rotas.tsx` e `mobile/src/components/tela-rotas-solicitante.tsx` (lojista/pessoa).
- **Decisões de produto (aprovadas):** valor do encaixe **definido pelo motoboy na rota**; compatibilidade **manual**; avisos **ao focar** (sem push); estados `pendente|aceito|recusado|cancelado`; encerrar/cancelar rota cancela os pendentes.
- **Testes:** `npm run typecheck` (backend) **OK**; `npx tsc --noEmit` (mobile) **OK**; **API integrada 36/36**; **UI real (CDP/Edge no Expo web):** motoboy publica rota pela tela e ela aparece em "Minhas rotas"; lojista vê em "Rotas disponíveis" e pede encaixe (aparece em "Meus encaixes" como "Aguarda resposta"). Entregas/T1/T1.1/T2/login preservados.
- **Limpeza:** 3 contas de teste + rotas/encaixes de teste removidos; scripts temporários apagados. Docs atualizados (M4.10, DECISIONS #51, PLANO).
- **Nota:** o total de entregas no banco passou de 62 para **64** entre sessões (não geradas pelo teste de rotas, que não cria entregas). Resíduo a conferir, sem ação tomada.

## 10. Atualização desta sessão (2026-10-21) — T4 e T5 concluídas

- **T4 — painel web da raiz integrado à API (autorizada):** só **Login + AdminPanel** ligados ao backend (novos `src/api.ts`, `src/sessao.ts`, `vite-env.d.ts`; `App.tsx` valida token via `/auth/me` e só admin vê o painel; `LoginScreen` só por código; `AdminPanel` usa `/admin/*` reais). Painéis demo (`MotoboyPanel`/`LojistaPanel`/`PessoaFisicaPanel`, `auth.ts`, `storage.ts`) **preservados como arquivos**, fora da navegação. CORS do backend inclui `http://localhost:5173`; `.env`/`.env.example` na raiz (`VITE_API_URL`). **Testes no Neon:** sem auth **16/16**, UI autenticada **20/20**, regressão por papel **16/16**; build raiz + `typecheck` backend + `tsc` mobile **OK**.
- **Bug corrigido no caminho (regressão da etapa da contabilidade):** `backend/src/routes/contabilidade.ts` aplicava `use(exigirAutenticacao, exigirPapel('motoboy'))` no router, que é montado **antes** de `rotasAdmin` — dava **403 `SEM_PERMISSAO`** em `/admin/*`, `/routes/*`, `/fittings/*` para todos os papéis. Corrigido com proteção **rota a rota** (DECISIONS #53) e comprovado pelo teste 16/16.
- **Etapa não documentada registrada retroativamente:** contabilidade do motoboy (migração **006** `courier_expenses`, endpoints `/courier/expenses*` e `/courier/financial-summary`, telas `motoboy/contabilidade.ts` etc.) já estava no disco sem entrada nos docs → agora é **M4.11** no PROJECT_STATUS.
- **T5 — método seguro do 1º admin (sem código novo):** procedimento oficial documentado (`PLANO_BACKEND.md` seção 8 — CLI `npm run admin:create` como único caminho, código 1× no terminal, sem endpoint e sem "primeiro acesso" no login web). **Testes de recusa:** admin já existente/sem `DATABASE_URL`/sem `CODE_HMAC_KEY` → recusa e exit 1 sem tocar no banco; API **8/8** (tipoConta admin → 400; sem sessão → 401; `/admin/bootstrap` e `/auth/first-admin` → 404; contagem de admins inalterada).
- **Novo quirk registrado (não corrigido, sem impacto funcional):** rota inexistente sem token responde `401` em vez de `404` (`courier.ts`/`rotas.ts`/`deliveries.ts` com `use(exigirAutenticacao)` sem caminho) — ver "Erros conhecidos" do PROJECT_STATUS; correção exige autorização.
- **Limpeza:** scripts de teste temporários apagados; contas de teste da sessão **desativadas** (não apagadas); nenhum usuário/entrega/tabela real tocado; nenhum segredo gravado em arquivo/log.
- **Docs atualizados:** PROJECT_STATUS (M4.11, T4, T5, Pendências, Erros conhecidos, Próxima ação), DECISIONS (**#52**, **#53**, **#54**), PLANO_CICLOS (T4/T5 `[x]` + execuções 5–6), PLANO_BACKEND (seção 8), este handoff.
- **Próximo passo:** plano T1–T5 **integralmente concluído**. Novas etapas (ex.: correção do quirk 401, recuperação do código do admin, rotação da senha Neon) exigem **autorização** do proprietário.

## 11. Atualização desta sessão (2026-10-21, parte 2) — Ciclo Partes A–H concluído

- **Parte B — negociação de encaixes (regra 10), implementada com migração 007 APLICADA no Neon (autorizada):** `route_fittings` ganhou `counter_amount`/`counter_at`; fluxo cliente **propõe** → motoboy **aceita/recusa/contrapropõe** → cliente **decide** (`/fittings/:id/counter|accept-counter|reject-counter`); acordado = contraproposta ?? proposta; **sem R$/km**; `fitting_amount`/`valorEncaixe` saíram da API e das telas. Bug `f.courier_id` (503) corrigido. Ver DECISIONS #56 e M4.12.
- **Partes A/C/F — app:** painel deslizante de ofertas (Animated nativo, movimento reduzido respeitado), alternador Online/Offline com pulso, avisos/toasts; tokens do tema; sem `setInterval` novo; `tsc` mobile OK. DECISIONS #58.
- **Parte D:** proteção `sessao` rota a rota em `courier`/`deliveries`/`rotas`/`admin`; quirk "rota inexistente = 401" **eliminado** (agora 404) — pendência fechada. DECISIONS #57.
- **Parte E:** contabilidade verificada **sem alteração** (wiring + testes 200 ao vivo).
- **Parte G:** limpeza verificada **somente leitura** (autorizada): baseline `26/1/1/1/1/0`; resíduo mínimo (2 entregas antigas `cancelada`) **preservado** por decisão.
- **Parte H:** teste integrado **30/30** no Neon com **2 usuários temporários** (criados e **apagados** por autorização; banco exatamente no baseline; scripts `.tmp-*` removidos); `typecheck`/`tsc` OK; docs (PROJECT_STATUS M4.12, DECISIONS #56–#59, este handoff). **Limitação:** UI no navegador não testada (Playwright/Metro indisponíveis); `eslint` do mobile **não disponível** (rede) — `package.json` revertido, pastas vazias de `node_modules` removidas.
- **Processos:** API reiniciada por mim com `npm run dev` (watch, porta 3000, log em `backend/.dev-server.log`); Expo web e Vite da raiz preservados. Nenhum ciclo Ralph em execução.
- **Próximo passo (naquela sessão):** aguardar **autorização** do proprietário para novo ciclo (ex.: verificação visual das animações na web, publicação HTTPS, logo definitivo).

## 12. Atualização desta sessão (2026-10-21, parte 3) — Responsividade + acesso admin na web

- **Causa real do bloqueio admin (não era `Platform.OS === 'web'`):** guard por papel em `mobile/src/app/login.tsx` (mostrava "o painel administrativo é usado na versão web — o aplicativo ainda não tem área de administração" e **não navegava**) + `mobile/src/sessao.tsx` **descartava a sessão do admin** (não persistia o token) + **inexistência de rota admin** no Expo Router.
- **Corrigido e testado:** sessão do admin persistida; `admin` → `/admin/usuarios` em `login.tsx`/`index.tsx`; `app/_layout.tsx` registra a área; nova área `mobile/src/app/admin/` (`_layout.tsx` com guard pelo papel do servidor, `usuarios.tsx`, `reativacoes.tsx`, `perfil.tsx`) com cliente da API em `api/cliente.ts` (`listarUsuariosAdmin`, `criarUsuarioAdmin`, `statusUsuarioAdmin`, `substituirCodigoAdmin`, `listarReativacoesAdmin`, `aprovarReativacaoAdmin`, `recusarReativacaoAdmin`).
- **Responsividade (sem dependência nova):** novo `mobile/src/tela.ts` (`useTela()` + `estiloTabBar()`); `maxWidth` (480/720) + `alignSelf: 'center'` em todas as telas; `flexShrink`/`minWidth: 0`/`numberOfLines` em cartões, botões, campos e perfis; `KeyboardAvoidingView` nos formulários (solicitar, rotas do solicitante, rotas do motoboy); gráfico financeiro com rolagem horizontal; painel deslizante com altura real da tela (85%) e `maxWidth: 520`; barra de abas limitada/centralizada na web; `PainelOferta` fora do `ScrollView`; `rgba(107,78,255,0.08)` → `cores.superficie2`; entrada/login ajustam `justifyContent`/padding por tamanho de tela.
- **Testes:** API **10/10** **somente leitura** (401 sem token, 401 token inválido, 200 listagem, 200 reativações, **403 não-admin** em leitura e escrita, 409 auto-desativação, listagem sem hash/senha) — **zero escrita no Neon**; navegador (Edge headless + CDP, sem Playwright por rede): **36/36** sem rolagem horizontal/estouro em 320/360/390/430/768/1280; **18/18** sem texto cortado; **login real do admin** leva a `/admin/usuarios`; **sessão persiste após recarregar** (`localStorage`); **sessão de lojista é bloqueada** na área admin (vai para `/lojista`); `npm run typecheck` (backend) OK; `npx tsc --noEmit` (mobile) OK; teste unitário do mobile 6/6.
- **Não testado (declarado):** as **operações de escrita** do admin no banco (criar/ativar/desativar/trocar código/aprovar-recusar) — exigem autorização; conferência **visual humana** das capturas (o modelo não lê imagens; a verificação foi por medidas no DOM); `eslint` do mobile (rede).
- **Arquivos alterados nesta etapa (mobile):** `src/tela.ts` (novo), `src/sessao.tsx`, `src/app/_layout.tsx`, `src/app/index.tsx`, `src/app/login.tsx`, `src/app/admin/_layout.tsx`, `src/app/admin/usuarios.tsx`, `src/app/admin/reativacoes.tsx`, `src/app/admin/perfil.tsx`, `src/app/motoboy/_layout.tsx`, `src/app/motoboy/index.tsx`, `src/app/motoboy/rotas.tsx`, `src/app/motoboy/perfil.tsx`, `src/app/lojista/(tabs)/_layout.tsx|index.tsx|historico.tsx|perfil.tsx`, `src/app/pessoa/(tabs)/_layout.tsx|index.tsx|historico.tsx|perfil.tsx`, `src/api/cliente.ts`, `src/components/painel-deslizante.tsx`, `painel-oferta.tsx`, `cartao-oferta.tsx`, `cartao-ativa.tsx`, `cartao-entrega.tsx`, `botao.tsx`, `campo.tsx`, `formulario-solicitar.tsx`, `tela-rotas-solicitante.tsx`, `resumo-financeiro.tsx`. **Backend e banco não foram alterados.**
- **Processos:** API em `npm run dev` (porta 3000, log `backend/.dev-server.log`); Expo web em 8081; protótipo Vite da raiz preservado. Nenhum ciclo Ralph em execução.
- **Próximo passo:** conferência visual do proprietário e, se autorizado, teste das **operações de escrita** do admin no banco (e o restante das pendências já registradas no PROJECT_STATUS).

## 13. Atualização desta sessão (2026-10-21, parte 4) — Refino de design com a skill `mobile-app-ui-design`

- **Skill instalada:** `npx skills add ceorkm/mobile-app-ui-design` → `.agents/skills/mobile-app-ui-design/` (low risk, 0 alertas; guia de design, não executa scripts). **Para o agente usá-la numa sessão, reiniciar o OpenCode.**
- **Aplicado em código próprio (sem dependência nova, identidade preto/grafite/dourado + roxo preservada):** escala de **4 tamanhos** (20/16/14/12) com **peso único 700** em títulos/rótulos/botões; grade de espaçamento **4/8**; raios 12/16/999; alvos de toque **≥44/48**; **ícones Ionicons** (fim dos glifos de texto); estados vazios com ícone+orientação+ação (leva ao login); **números tabulares** (`NUMEROS`: iOS `tabular-nums`, web monoespaçada). Regras registradas em `docs/DESIGN_SYSTEM.md` (nova seção "Escala de design").
- **Arquivos tocados:** praticamente todos os `.tsx` de `mobile/src` (tipografia/espaçamento/raios), mais `theme.tsx` (`NUMEROS`), `components/vazio.tsx` (icone/ação), `botao.tsx`, `campo.tsx`, `aviso.tsx`, `painel-oferta.tsx`, `painel-entregas.tsx`, `formulario-solicitar.tsx`, `tela-rotas-solicitante.tsx`, `app/index.tsx`, os 4 `_layout.tsx` de abas (título/legenda das abas). **Backend, banco e painel Vite da raiz: intactos.**
- **Testes:** design no navegador (Edge/CDP) 6 telas → escala dentro de 12/14/16/20, peso 700, 0 ícones vazados, números tabulares no histórico; responsividade **36/36**, cortes **0**; sessão do admin persiste e barreira por papel OK; **zero mojibake** (4 arquivos corrompidos pelo PowerShell foram corrigidos); `tsc` mobile **OK**; unitário **6/6**.
- **Limitações:** gradientes/glassmorphism/Tailwind/Lucide/Recharts (sugeridos pela skill) **não adotados** de propósito; conferência visual humana pendente; escrita do admin no banco ainda não exercitada.
- **Próximo passo:** conferência visual do proprietário em http://localhost:8081 (com API em `:3000`) e decisão sobre as pendências já registradas.


