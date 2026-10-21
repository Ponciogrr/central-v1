// Executor de migrações SQL.
// Uso: `npm run migrate` (aplica os arquivos de `backend/migrations/` que ainda não rodaram).
// Cada migração roda dentro de uma transação e é registrada em `schema_migrations`.
// NUNCA roda automaticamente ao iniciar o servidor.

import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'
import { env } from '../config/env.ts'

const pastaMigracoes = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations')

async function principal(): Promise<void> {
  // Migrações preferem a conexão direta (DIRECT_URL); tráfego normal usa DATABASE_URL.
  const url = env.directUrl || env.databaseUrl

  if (!url) {
    console.error(
      'Nenhuma conexão configurada. Defina DATABASE_URL (e, se usar Neon, DIRECT_URL) no arquivo backend/.env — veja .env.example.',
    )
    console.error('Nenhuma migração foi executada.')
    process.exitCode = 1
    return
  }

  const cliente = new Client({ connectionString: url })
  await cliente.connect()

  try {
    await cliente.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id         text        PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `)

    const jaAplicadas = new Set(
      (await cliente.query<{ id: string }>('SELECT id FROM schema_migrations')).rows.map(r => r.id),
    )

    const arquivos = (await readdir(pastaMigracoes))
      .filter(nome => nome.endsWith('.sql'))
      .sort()

    const pendentes = arquivos.filter(nome => !jaAplicadas.has(nome))

    if (pendentes.length === 0) {
      console.log('Banco atualizado: nenhuma migração pendente.')
      return
    }

    for (const arquivo of pendentes) {
      const sql = await readFile(join(pastaMigracoes, arquivo), 'utf8')
      await cliente.query('BEGIN')
      try {
        await cliente.query(sql)
        await cliente.query('INSERT INTO schema_migrations (id) VALUES ($1)', [arquivo])
        await cliente.query('COMMIT')
        console.log(`Migração aplicada: ${arquivo}`)
      } catch (erro) {
        await cliente.query('ROLLBACK')
        throw erro
      }
    }

    console.log(`${pendentes.length} migração(ões) aplicada(s) com sucesso.`)
  } finally {
    await cliente.end()
  }
}

principal().catch((erro: unknown) => {
  console.error('Falha ao aplicar migrações:', erro instanceof Error ? erro.message : erro)
  process.exitCode = 1
})
