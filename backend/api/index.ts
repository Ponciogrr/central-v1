// Sonda de build (temporaria): confirma em que momento a Vercel detecta as
// funções da pasta `api/` (antes ou depois do build command).
// Se a rota /api/handler responder com a API real, a detecção ocorre depois
// do build e a sonda pode ser removida.
import type { Request, Response } from 'express'

export default function sonda(_req: Request, res: Response): void {
  res.status(200).json({ alvo: 'stub-api-index' })
}
