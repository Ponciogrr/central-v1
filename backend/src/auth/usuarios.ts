// Acesso à tabela `users`.

import { obterPool } from '../db/pool.ts'
import type { ContaTipo } from '../types/usuario.ts'

export interface UsuarioBanco {
  id: string
  name: string | null
  phone: string | null
  account_type: ContaTipo
  is_active: boolean
}

export interface UsuarioListagem {
  id: string
  name: string | null
  phone: string | null
  account_type: ContaTipo
  is_active: boolean
  code_suffix: string | null
  created_at: Date
}

const COLUNAS = 'id, name, phone, account_type, is_active'
const COLUNAS_LISTAGEM =
  'id, name, phone, account_type, is_active, code_suffix, created_at'

export async function buscarUsuarioPorCodigoHash(hash: string): Promise<UsuarioBanco | null> {
  const { rows } = await obterPool().query<UsuarioBanco>(
    `SELECT ${COLUNAS} FROM users WHERE access_code_hash = $1 LIMIT 1`,
    [hash],
  )
  return rows[0] ?? null
}

export async function buscarUsuarioPorId(id: string): Promise<UsuarioBanco | null> {
  const { rows } = await obterPool().query<UsuarioBanco>(
    `SELECT ${COLUNAS} FROM users WHERE id = $1 LIMIT 1`,
    [id],
  )
  return rows[0] ?? null
}

export async function existeAdministrador(): Promise<boolean> {
  const { rows } = await obterPool().query(
    "SELECT 1 FROM users WHERE account_type = 'admin' LIMIT 1",
  )
  return rows.length > 0
}

export async function criarUsuario(dados: {
  nome: string | null
  telefone: string | null
  papel: ContaTipo
  accessCodeHash: string
  codeSuffix?: string | null
}): Promise<{ id: string }> {
  const { rows } = await obterPool().query<{ id: string }>(
    `INSERT INTO users (name, phone, account_type, access_code_hash, code_suffix, is_active)
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING id`,
    [
      dados.nome,
      dados.telefone,
      dados.papel,
      dados.accessCodeHash,
      dados.codeSuffix ?? null,
    ],
  )
  return rows[0]
}

export interface FiltrosUsuarios {
  busca?: string | null
  papel?: string | null
  ativo?: boolean | null
}

// Listagem com busca e filtros (usada pelo painel administrativo).
export async function listarUsuarios(
  limite: number,
  deslocamento: number,
  filtros: FiltrosUsuarios = {},
): Promise<{ itens: UsuarioListagem[]; total: number }> {
  const condicoes: string[] = []
  const valores: unknown[] = []

  const busca = filtros.busca?.trim()
  if (busca) {
    valores.push(`%${busca}%`)
    condicoes.push(`(name ILIKE $${valores.length} OR phone ILIKE $${valores.length})`)
  }
  if (filtros.papel) {
    valores.push(filtros.papel)
    condicoes.push(`account_type = $${valores.length}`)
  }
  if (filtros.ativo !== undefined && filtros.ativo !== null) {
    valores.push(filtros.ativo)
    condicoes.push(`is_active = $${valores.length}`)
  }

  const onde = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : ''
  const pool = obterPool()
  const total = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM users ${onde}`,
    valores,
  )
  const itens = await pool.query<UsuarioListagem>(
    `SELECT ${COLUNAS_LISTAGEM} FROM users ${onde}
      ORDER BY created_at DESC, id LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
    [...valores, limite, deslocamento],
  )
  return { itens: itens.rows, total: Number(total.rows[0]?.total ?? 0) }
}

export async function atualizarStatusUsuario(
  id: string,
  ativo: boolean,
): Promise<UsuarioListagem | null> {
  const { rows } = await obterPool().query<UsuarioListagem>(
    `UPDATE users SET is_active = $2, updated_at = now() WHERE id = $1 RETURNING ${COLUNAS_LISTAGEM}`,
    [id, ativo],
  )
  return rows[0] ?? null
}

export async function substituirHashDeCodigo(
  id: string,
  hash: string,
  codeSuffix?: string | null,
): Promise<UsuarioListagem | null> {
  const { rows } = await obterPool().query<UsuarioListagem>(
    `UPDATE users
        SET access_code_hash = $2,
            code_suffix = COALESCE($3, code_suffix),
            updated_at = now()
      WHERE id = $1
      RETURNING ${COLUNAS_LISTAGEM}`,
    [id, hash, codeSuffix ?? null],
  )
  return rows[0] ?? null
}
