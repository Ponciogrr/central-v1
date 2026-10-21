# PLANO DE BACKEND E APLICATIVO NATIVO

> Direção do proprietário (out/2026): a experiência principal passa a ser um **app Android nativo (React Native + Expo)**, com **backend e banco compartilhados** entre o app e o painel administrativo web.
> Este documento é o plano oficial da migração. O protótipo **Vite + React** continua funcionando como referência — nada dele é apagado nesta etapa.

## 1. Arquitetura pretendida

```
┌─────────────────────┐      ┌─────────────────────┐
│  App Android (Expo) │      │ Painel admin (web)  │
│  Motoboy/Lojista/PF │      │  mantido no Vite    │
└──────────┬──────────┘      └──────────┬──────────┘
           │      HTTPS + JSON + token (JWT)      │
           └───────────────┬──────────────────────┘
                           ▼
                ┌─────────────────────┐
                │   Backend (API)     │  ← autenticação real
                │  Node.js + TypeScript│    e permissões no servidor
                └──────────┬──────────┘
                           ▼
                ┌─────────────────────┐
                │  Banco de dados     │  ← dados compartilhados
                └─────────────────────┘
```

- **App:** React Native + Expo (TypeScript), perfis Motoboy, Lojista e Pessoa Física.
- **Web:** painel administrativo mantido inicialmente; futuramente consome a mesma API.
- **Backend:** API única; todo login é verificado no servidor e o token carrega o papel do usuário (permissões não se confiam no cliente).
- **APK:** gerado na nuvem (EAS Build) para instalar no celular em testes.

## 2. O que o protótipo atual oferece (reaproveitável)

| Item | Situação |
|---|---|
| `src/types.ts` (Entrega, Papel, StatusEntrega, rótulos) | **Reaproveitar** — tipos puros, mesmos no app e no backend (pasta `shared/` futura). |
| `src/geo.ts` (data formatada, interpolação de ponto) | **Reaproveitar** — funções puras. |
| Lógica de fluxo (oferta exclusiva com expiração de 30s, elegibilidade, cancelamentos regras 5–6) | **Reaproveitar a lógica** — hoje vive em `App.tsx`; será extraída para função pura compartilhada. |
| As 81 regras (`docs/REGRAS_DO_SISTEMA_CENTRAL_DE_MOTOBOYS.md`) | **Fonte oficial** — continuam valendo sem releitura. |
| UX dos painéis (telas, listas, estados vazios, navegação inferior) | **Referência de design** — recriar em React Native; **não copiar** componentes/CSS web. |
| `DESIGN_SYSTEM.md` (grafite, branco, roxo; temas claro/escuro; mobile-first) | **Especificação** — traduzir para StyleSheet do React Native. |
| `src/auth.ts` + `storage.ts` (localStorage, provisórios) | **Substituir** pela API real (JWT) — o protótipo web continua com os seus, sem alterações. |
| Leaflet/OSM, `MapView`, `DeliveryForm`, `DeliveryCard` | **Não copiar** — mapa no Expo será `react-native-maps` em etapa futura (não nesta). |
| Componentes React web, `styles.css`, `AdminPanel` | **Não migrar como estão** — o Admin será adaptado para consumir a API (etapa M5). |

**Regra anti-duplicação:** não manter duas implementações definitivas da mesma funcionalidade — o protótipo Vite fica congelado como protótipo; as funcionalidades definitivas passam a existir uma única vez (app + API).

## 3. Opções de backend (sem Supabase)

> Supabase **não é opção** — decisão anterior do proprietário.

### Opção A — recomendada: Node.js + TypeScript + Express + PostgreSQL
- **Mesma linguagem** do app Expo e do protótipo → tipos e regras compartilhados de verdade.
- Ecossistema simples, muito material de suporte; dependências poucas e leves (`express`, `jsonwebtoken`, `bcryptjs`, `pg` — `bcryptjs` evita compilação nativa, importante na máquina fraca deste computador).
- Banco: **PostgreSQL** — começar em serviço gerenciado com plano gratuito (**Neon**) e subir de nível depois se precisar.
- Hospedagem: plano grátis do **Render** ou **Railway** (API dorme por inatividade no grátis) ou servidor próprio pequeno (~US$ 4–8/mês) quando precisar de disponibilidade.

### Opção B — mais leve: PocketBase (binário único com SQLite embutido)
- Um executável só já traz API + autenticação + banco — ótimo para pouca memória e hospedagem barata.
- Contra: modelo próprio (menos controle fino das 81 regras) e menos código TypeScript compartilhado.

### Opção C — gerenciada: Firebase (Google Auth + Firestore)
- Sem servidor para manter; regras de segurança declarativas.
- Contra: lógica de negócio das 81 regras fica fora do nosso código TypeScript; dependência total do ecossistema Google.

**Recomendação:** **Opção A**, com a estrutura desde o início pensada para extrair funções puras (oferta/elegibilidade/cancelamento) para uma pasta `shared/` usada por API e app.

## 4. Dependências, serviços e custos (antes de instalar qualquer coisa)

| Necessidade | Serviço/conta | Custo |
|---|---|---|
| Conta de código | GitHub | Grátis (obrigatória p/ EAS) |
| Conta do Expo | expo.dev (EAS) | Grátis para começar; builds na nuvem com limite mensal; planos pagos a partir de dezenas de USD/mês se precisar de mais builds |
| Testar no celular sem compilar | App **Expo Go** (loja do celular) + QR code | Grátis |
| Gerar APK de teste | EAS Build (perfil preview) | Cabe no plano grátis (limite de builds); baixar o APK e instalar por cabo/loja de arquivos — sem custo |
| Publicar na Play Store (futuro) | Google Play Console | Taxa única de US$ 25 |
| Backend hospedado | Render/Railway (grátis, com limites) ou VPS pequeno | Grátis → ~US$ 4–8/mês se precisar |
| Banco PostgreSQL | Neon (plano gratuito) | Grátis → pago se crescer |
| **Android Studio/Gradle local** | — | **Evitar**: instalação gigantesca e compilação pesada demais para a memória deste computador |

**Dependências de código (somente quando cada etapa for autorizada):** scaffold oficial do Expo (`create-expo-app`, já traz TypeScript), navegação (expo-router, vem no scaffold moderno), e no backend apenas `express`, `jsonwebtoken`, `bcryptjs`, `pg`. Nada será instalado sem autorização.

## 5. Limitação de memória deste computador
- Build Android **local não é viável** (Gradle/Android Studio estouram memória) → **compilar na nuvem com EAS**.
- Desenvolvimento no celular via **Expo Go** (não precisa de emulador — emulador Android também é pesado).
- Manter instalações mínimas: um projeto Expo + um projeto backend, nunca os dois builds ao mesmo tempo; protótipo Vite intacto (build só quando precisar verificar).

## 6. Sequência pequena de migração (cada etapa aguarda autorização)

| Etapa | Conteúdo | Entrega |
|---|---|---|
| **M0** | Documentos (este arquivo + PROJECT_STATUS) | Plano aprovado |
| **M1** | Estrutura Expo em `app/` (scaffold TS, navegação por abas, tema grafite/branco/roxo) | Roda no Expo Go via QR code |
| **M2** | Design nativo: tela de login por código + shells dos 3 perfis (UI, ainda sem API) | Telas navegáveis no celular |
| **M3** | Backend em `backend/` (Opção A): primeiro administrador, usuários/códigos, login por código → JWT, permissões por papel | API rodando e testável |
| **M4** | Integração: app fala com a API (login real, solicitar entregas, ofertas 30s, aceitar/recusar, status, cancelamento) | Fluxo de entregas ponta a ponta no celular |
| **M5** | Painel administrativo web adaptado para consumir a mesma API | Admin e app no mesmo banco |
| **M6** | APK instalável via EAS Build (perfil preview) | APK para testar no celular |

Ordem proposital: **app antes do backend** só para a UI; os dados definitivos só entram depois da API existir (evita duplicar lógica).

## 7. Limitações conhecidas desta virada
- **Sincronização entre dispositivos** só existe a partir da M4 (antes continua local no protótipo).
- Notificações push, GPS em tempo real e chat continuam **fora** por enquanto (etapas futuras; regras 71–81 e avisos já previstos).
- Protótipo web não recebe mais funcionalidades novas (fica como referência); apenas correções se necessárias.
- Credenciais/chaves de produção: **não inventar** — cada serviço será configurado pelo proprietário na sua conta, quando a etapa chegar.

## 8. Procedimento oficial — primeiro administrador (T5, 2026-10-21)

**O único caminho para criar o 1º administrador é um comando local no computador onde o banco está configurado.** Não existe forma de criar administrador pela internet (nenhum site, app ou endpoint da API faz isso — verificado por teste: `POST /admin/users` com `tipoConta: "admin"` → **400** e não há rota de "primeiro acesso").

**Passo a passo (produção):**
1. Ter `backend/.env` preenchido (obrigatório: `DATABASE_URL`, `DIRECT_URL`, `CODE_HMAC_KEY` e `JWT_SECRET`). Nunca compartilhe esse arquivo.
2. Aplicar as migrações: `cd backend` → `npm run migrate`.
3. Criar o administrador: `npm run admin:create` (opcional: `-- --nome "Nome" --telefone "+55..."`).
4. O **código de acesso aparece só uma vez no terminal**. Copie e guarde em local seguro (gerenciador de senhas/papel). Ele **não** fica gravado em nenhum arquivo nem log — se perder, o procedimento de recuperação é intervenção manual no banco (pendência declarada abaixo).
5. Com o código, entrar pelo painel web (`npm run dev` na raiz → http://localhost:5173) ou pelo app.

**Garantias verificadas por teste (2026-10-21):**
- Se já existe administrador, o comando **recusa** e nada é gravado (exit 1).
- Sem `DATABASE_URL` ou sem `CODE_HMAC_KEY`, o comando **recusa** antes de tocar no banco (exit 1).
- Criar conta `admin` pela API → **400**; sem sessão → **401**; não existe `/admin/bootstrap` nem `/auth/first-admin` (**404**); contagem de administradores **inalterada** após as tentativas.
- O login do protótipo web **não tem mais** "Primeiro acesso" (T4); o app nativo nunca teve área de admin.

**Limitações declaradas:**
- **Perda do código do administrador** = necessária intervenção manual no banco (atualizar o `access_code_hash`) — procedimento de recuperação **ainda não documentado/testado**; fazer antes de produção.
- Quirk conhecido (sem impacto de segurança): rotas **inexistentes** sem token respondem `401` em vez de `404`, porque `courier.ts`/`rotas.ts`/`deliveries.ts` aplicam `use(exigirAutenticacao)` sem caminho no router — mesma classe do bug corrigido no `contabilidade.ts` (DECISIONS #53); candidato a correção em etapa autorizada.
