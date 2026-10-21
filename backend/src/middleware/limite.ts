// Limitação simples de tentativas de login (janela fixa, em memória).
// LIMITAÇÕES CONHECIDAS: vale por processo; reinicia quando o servidor reinicia
// e não é compartilhada entre várias instâncias. Suficiente nesta fase.

import type { NextFunction, Request, Response } from 'express'

const JANELA_MS = 15 * 60 * 1000
const MAXIMO_TENTATIVAS = 20

interface Janela {
  contagem: number
  expiraEm: number
}

const janelas = new Map<string, Janela>()

function chave(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'desconhecido'
}

function limparExpiradas(agora: number): void {
  if (janelas.size < 1000) return
  for (const [nome, janela] of janelas) {
    if (janela.expiraEm <= agora) janelas.delete(nome)
  }
}

export function limitarLogin(req: Request, res: Response, next: NextFunction): void {
  const agora = Date.now()
  limparExpiradas(agora)

  const nome = chave(req)
  const janela = janelas.get(nome)

  if (!janela || janela.expiraEm <= agora) {
    janelas.set(nome, { contagem: 1, expiraEm: agora + JANELA_MS })
    next()
    return
  }

  if (janela.contagem >= MAXIMO_TENTATIVAS) {
    const segundos = Math.ceil((janela.expiraEm - agora) / 1000)
    res.set('Retry-After', String(segundos))
    res.status(429).json({
      erro: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.',
      codigo: 'MUITAS_TENTATIVAS',
    })
    return
  }

  janela.contagem += 1
  next()
}

// Zera o contador após um login bem-sucedido.
export function registrarSucessoLogin(req: Request): void {
  janelas.delete(chave(req))
}
