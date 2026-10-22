import express from 'express'
import { corsDesenvolvimento } from './middleware/cors.ts'
import { naoEncontrado, tratarErro } from './middleware/erro.ts'
import { rotas } from './routes/index.ts'

// Monta a aplicação Express (sem iniciar o servidor — isso é feito em src/index.ts).
export function criarApp() {
  const app = express()

  // A API roda atrás de proxy (Vercel). Sem isto, `req.ip` seria o IP do
  // proxy — e o bloqueio por excesso de tentativas (regra 31) bloquearia
  // TODOS os usuários ao mesmo tempo. Com 1 salto confiamos apenas no
  // primeiro proxy (a Vercel) e o IP real vem do cabeçalho que ela define.
  app.set('trust proxy', 1)

  app.use(corsDesenvolvimento)
  app.use(express.json({ limit: '16kb' }))
  app.use(rotas)

  app.use(naoEncontrado)
  app.use(tratarErro)

  return app
}
