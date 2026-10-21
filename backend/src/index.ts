import { criarApp } from './app.ts'
import { env } from './config/env.ts'

const app = criarApp()

app.listen(env.porta, () => {
  console.log(`API da Central de Motoboys em http://localhost:${env.porta}`)
  console.log(`Teste de saúde: http://localhost:${env.porta}/health`)
  if (!env.databaseUrl) {
    console.log('Banco não configurado (DATABASE_URL ausente) — normal antes da M3.2.')
  }
})
