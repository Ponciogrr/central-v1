// Sessão do painel administrativo web.
// Guarda apenas o token de acesso; o papel NUNCA é salvo — sempre vem do servidor.

const CHAVE_TOKEN = 'central-motoboys:token'

export function lerToken(): string | null {
  try {
    return localStorage.getItem(CHAVE_TOKEN)
  } catch {
    return null
  }
}

export function gravarToken(token: string): void {
  try {
    localStorage.setItem(CHAVE_TOKEN, token)
  } catch {
    // modo privado/quota — a sessão vale só em memória
  }
}

export function limparToken(): void {
  try {
    localStorage.removeItem(CHAVE_TOKEN)
  } catch {
    // ignora
  }
}
