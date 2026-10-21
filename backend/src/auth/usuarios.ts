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
  created_at: Date
}

const COLUNAS = 'id, name, phone, account_type, is_active'
const COLUNAS_LISTAGEM = 'id, name, phone, account_type, is_active, created_at'

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
}): Promise<{ id: string }> {
  const { rows } = await obterPool().query<{ id: string }>(
    `INSERT INTO users (name, phone, account_type, access_code_hash, is_active)
     VALUES ($1, $2, $3, $4, true)
     RETURNING id`,
    [dados.nome, dados.telefone, dados.papel, dados.accessCodeHash],
  )
  return rows[0]
}

export async function listarUsuarios(
  limite: number,
  deslocamento: number,
): Promise<{ itens: UsuarioListagem[]; total: number }> {
  const pool = obterPool()
  const total = await pool.query<{ total: string }>('SELECT COUNT(*)::text AS total FROM users')
  const itens = await pool.query<UsuarioListagem>(
    `SELECT ${COLUNAS_LISTAGEM} FROM users ORDER BY created_at DESC, id LIMIT $1 OFFSET $2`,
    [limite, deslocamento],
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
): Promise<UsuarioListagem | null> {
  const { rows } = await obterPool().query<UsuarioListagem>(
    `UPDATE users SET access_code_hash = $2, updated_at = now() WHERE id = $1 RETURNING ${COLUNAS_LISTAGEM}`,
    [id, hash],
  )
  return rows[0] ?? null
}
