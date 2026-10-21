import { Router } from 'express'
import { env } from '../config/env.ts'
import { temBancoConfigurado, testarConexao } from '../db/pool.ts'

export const rotasSaude = Router()

// GET /health — confirma que a API está no ar e informa o estado do banco.
// Não exige banco configurado: sem DATABASE_URL, "banco.ok" é false e a API segue respondendo.
rotasSaude.get('/health', async (_req, res) => {
  const banco = temBancoConfigurado()
    ? await testarConexao()
    : { ok: false, mensagem: 'Banco não configurado (esperado antes da M3.2).' }

  res.json({
    estado: 'ok',
    servico: 'central-de-motoboys-api',
    versao: '0.1.0',
    ambiente: process.env.NODE_ENV ?? 'development',
    horario: new Date().toISOString(),
    banco,
    auth: { configurada: env.authConfigurada },
  })
})
