import type { NextFunction, Request, Response } from 'express'
import { ErroHttp } from '../erros.ts'

// Middleware para rotas inexistentes.
export function naoEncontrado(req: Request, res: Response): void {
  res.status(404).json({
    erro: 'Rota não encontrada.',
    metodo: req.method,
    caminho: req.path,
  })
}

// Erros do body-parser (JSON malformado / corpo grande demais) trazem um `type`.
function statusDoCorpo(erro: unknown): number | null {
  if (typeof erro !== 'object' || erro === null) return null
  const tipo = (erro as { type?: unknown }).type
  if (tipo === 'entity.parse.failed') return 400
  if (tipo === 'entity.too.large') return 413
  return null
}

// Erros do PostgreSQL (`pg`) e de rede carregam um campo `code` (ex.: 'ECONNREFUSED', '57P01').
function ehErroDeBanco(erro: unknown): boolean {
  return typeof erro === 'object' && erro !== null && typeof (erro as { code?: unknown }).code === 'string'
}

// Middleware de erro (precisa dos 4 parâmetros para o Express reconhecê-lo).
export function tratarErro(erro: unknown, _req: Request, res: Response, _next: NextFunction): void {
  // Erros com status próprio (ex.: 400, 404, 409, 503 da aplicação).
  if (erro instanceof ErroHttp) {
    res.status(erro.status).json({ erro: erro.message, codigo: erro.codigo })
    return
  }

  const statusCorpo = statusDoCorpo(erro)
  if (statusCorpo === 400) {
    res.status(400).json({ erro: 'Corpo da requisição inválido.', codigo: 'CORPO_INVALIDO' })
    return
  }
  if (statusCorpo === 413) {
    res.status(413).json({ erro: 'Requisição grande demais.', codigo: 'CORPO_MUITO_GRANDE' })
    return
  }

  // Banco ausente/indisponível → 503 (nunca 500).
  if (ehErroDeBanco(erro)) {
    console.error('[erro-bd]', erro instanceof Error ? erro.message : erro)
    res.status(503).json({ erro: 'Serviço temporariamente indisponível.', codigo: 'SERVICO_INDISPONIVEL' })
    return
  }

  console.error('[erro]', erro instanceof Error ? erro.message : erro)
  res.status(500).json({ erro: 'Erro interno do servidor.', codigo: 'ERRO_INTERNO' })
}
