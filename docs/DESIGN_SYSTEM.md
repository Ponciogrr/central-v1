# DESIGN_SYSTEM — Identidade visual e padrões de interface

> Diretrizes do briefing do proprietário (out/2026) + necessidades das regras do sistema (`REGRAS_DO_SISTEMA_CENTRAL_DE_MOTOBOYS.md`). Para regras específicas, sempre prevalece o texto do arquivo oficial de regras; não inventar.

## Identidade visual (definida no briefing)
- **Cores principais:** grafite, branco e **roxo** para ações importantes.
- **Temas:** claro e escuro, ambos funcionais.
- **Tipografia:** legível, hierarquia visual clara.
- **Ícones:** consistentes.
- **Pouca decoração:** sem excesso de gradientes, sombras, bordas ou cartões.
- **Evitar** aspecto genérico de interfaces geradas por IA.
- **Não duplicar** botões nem funcionalidades.
- Evitar rolagem vertical desnecessária; listas extensas organizadas adequadamente.
- **Mobile-first**, adaptável a celulares e computadores, com aparência de aplicativo real.

## Perfis de usuário
| Perfil | Prioridade da interface |
|---|---|
| Motoboy | Ficar online, receber ofertas em **painel flutuante**, aceitar/recusar corridas |
| Lojista | Solicitar entregas com **simplicidade** |
| Pessoa Física | Solicitar e acompanhar entregas |
| Administrador | Gerenciar usuários, **códigos de acesso** e solicitações administrativas |

## Elementos de UI exigidos pelas regras (a implementar nas telas)
- **Indicador de motoboys online** (informativo, não clicável; só para lojistas e pessoas físicas) — regras 37–42.
- **Painel flutuante de ofertas** do motoboy com aceitar/recusar em até 30s (contagem) — regras 1, 21.
- **Tela de login bloqueado** com status de solicitação de reativação e botão para solicitar — regras 48, 55.
- **Painel administrativo**: lista de motoboys online (nome, código, status), reativações pendentes (aprovar/recusar), tentativas de login bloqueadas, modo de manutenção — regras 43–45, 49–50, 61–63, 65–69, 78–79.
- **Mensagem exata de manutenção** (regra 81): “Estamos em manutenção. Tente novamente mais tarde.”
- Chat privado (abre só após aceite), avaliações 1–5 estrelas, registro de valor combinado — regras 7–10, 23–26 (etapas futuras).

## Situação atual do código (referência)
- A restilização **neon/escuro** já foi superada: o app usa hoje preto/grafite/dourado com roxo discreto (DECISIONS #50) e a **escala de design** definida na seção "Escala de design" (M4.14). A tabela de tokens deste documento reflete a paleta em vigor.

## Aplicativo nativo (Expo) — base da M1

> O app Android é uma implementação **separada** (React Native); o CSS web **não** é copiado. Esta seção define os tokens usados em `mobile/src/theme.tsx`.
> **Identidade em vigor:** preto, grafite e **dourado** nas ações importantes, com **roxo discreto** como destaque secundário (DECISIONS #50). O briefing original ("roxo nas ações") foi superado por decisão do proprietário.

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `fundo` | `#F7F7F9` | `#000000` (preto) | Fundo das telas |
| `superficie` | `#FFFFFF` | `#141417` (grafite) | Blocos e botões secundários |
| `superficie2` | `#EFEFF3` | `#1F1F23` | Campos, etiquetas e realces suaves |
| `texto` | `#141417` (grafite) | `#F4F4F5` (branco) | Texto principal |
| `textoSuave` | `#5C5C66` | `#9A9AA5` | Apoio e legendas |
| `borda` | `#DDDDE3` | `#2A2A30` | Contornos discretos |
| `acao` | `#E8B400` (dourado) | `#F5C518` | **Ação principal** (botão primário, estado online) |
| `acaoTexto` | `#141417` | `#141417` | Texto sobre a cor de ação |
| `destaque` | `#6B4EFF` (roxo) | `#8B6CFF` | Destaque secundário, setas, ondas decorativas |
| `perigo` | `#C0392B` | `#E06A5A` | Cancelar/erros |

- **Tema:** inicia seguindo o sistema (claro/escuro) e tem alternância manual persistida (`localStorage` na web, `SecureStore` no app).
- **Números:** valores e métricas usam dígitos de largura fixa (`NUMEROS` em `theme.tsx`: `tabular-nums` no iOS, fonte monoespaçada na web) para alinhar em coluna.

## Escala de design (refino do app web, M4.14)

Regras aplicadas a **todo** o app a partir da skill `mobile-app-ui-design`, adaptadas à identidade acima:

- **Tipografia:** no máximo **4 tamanhos** e **2 pesos**.
  - 20 = título de tela · 16 = título de seção e botões · 14 = corpo · 12 = apoio/legenda.
  - Peso único **700** para títulos, rótulos e botões; corpo no peso normal (400).
  - Exceções: rótulo interno do gráfico financeiro (11) e **tamanho dos ícones** (não é tipografia).
- **Espaçamento:** grade de **4/8** — 4, 8, 12, 16, 24, 32. Padding de tela 24 (16 em telas compactas).
- **Cantos:** 12 (chips e botões), 16 (cartões e painéis), 999 (etiquetas/pílulas).
- **Toque:** alvo mínimo de **44×44** (botões e campos com 48 de altura).
- **Ícones:** `@expo/vector-icons` (Ionicons) — conjunto único e consistente; nenhum glifo de texto improvisado.
- **Estados vazios:** sempre com **ícone, título, orientação** e (quando cabe) **ação** — sem duplicar botões já existentes na tela.
- **Sem gradientes, sem sombras, sem glassmorphism** (decisão do proprietário: pouca decoração).

## Padrões de componentes
- Botão primário dourado com texto escuro; secundário em `superficie2` com borda; perigo em `perigo`.
- Campos: `superficie2`, borda 1px, borda dourada ao focar, altura 48.
- Cartões: `superficie`, borda 1px, raio 16; etiquetas de status com acento roxo.
- Listas em `superficie` com seta discreta; conteúdo limitado a 480 px (720 px no admin) e centralizado.
- Mapa: Leaflet + OpenStreetMap, sem chaves de API (decisão #8).
