import express from 'express'
import { corsDesenvolvimento } from './middleware/cors.ts'
import { naoEncontrado, tratarErro } from './middleware/erro.ts'
import { rotas } from './routes/index.ts'

// Monta a aplicação Express (sem iniciar o servidor — isso é feito em src/index.ts).
export function criarApp() {
  const app = express()

  app.use(corsDesenvolvimento)
  app.use(express.json({ limit: '16kb' }))
  app.use(rotas)

  app.use(naoEncontrado)
  app.use(tratarErro)

  return app
}
