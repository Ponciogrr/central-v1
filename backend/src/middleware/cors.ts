import type { NextFunction, Request, Response } from 'express'
import { env } from '../config/env.ts'

// CORS restrito às origens de desenvolvimento configuradas em CORS_ORIGINS
// (por padrão apenas http://localhost:8081, usado pelo Expo web).
// Requisições sem cabeçalho Origin (app nativo no celular, curl) não mudam.
export function corsDesenvolvimento(req: Request, res: Response, next: NextFunction): void {
  const origem = req.headers.origin
  if (typeof origem === 'string' && env.corsOrigins.includes(origem)) {
    res.setHeader('Access-Control-Allow-Origin', origem)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  next()
}
