// Modo de demonstração.
//
// FICA DESLIGADO por padrão. Só liga com EXPO_PUBLIC_MODO_DEMO=1 no ambiente
// de DESENVOLVIMENTO (mobile/.env local). A versão publicada na Vercel nunca
// define essa variável — portanto o app em produção não mostra atalhos de
// perfil nem permite navegar nas áreas sem sessão.
//
// A regra do projeto: sem cadastro público. O acesso é por código de acesso
// criado pelo administrador.

export const MODO_DEMO = process.env.EXPO_PUBLIC_MODO_DEMO === '1'
