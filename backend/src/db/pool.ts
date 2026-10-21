import { Pool } from 'pg'
import { env } from '../config/env.ts'
import { servicoIndisponivel } from '../erros.ts'

// Pool de conexões do PostgreSQL.
// A conexão só é criada quando DATABASE_URL estiver configurada —
// ou seja, depois que o proprietário criar o banco no Neon (M3.2).

let pool: Pool | null = null

export function temBancoConfigurado(): boolean {
  return env.databaseUrl.length > 0
}

export function obterPool(): Pool {
  if (!temBancoConfigurado()) {
    // Sem banco configurado a API responde 503 (e não 500) — ver middleware/erro.ts.
    throw servicoIndisponivel()
  }
  if (!pool) {
    pool = new Pool({ connectionString: env.databaseUrl })
  }
  return pool
}

export async function testarConexao(): Promise<{ ok: boolean; mensagem: string }> {
  if (!temBancoConfigurado()) {
    return { ok: false, mensagem: 'Banco ainda não configurado (DATABASE_URL ausente).' }
  }
  try {
    const resultado = await obterPool().query('SELECT 1 AS ok')
    return {
      ok: resultado.rows[0]?.ok === 1,
      mensagem: 'Conexão com o PostgreSQL funcionando.',
    }
  } catch (erro) {
    return {
      ok: false,
      mensagem: erro instanceof Error ? erro.message : 'Falha ao conectar ao banco.',
    }
  }
}
