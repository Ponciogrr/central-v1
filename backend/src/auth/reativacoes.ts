// Acesso à tabela `reactivation_requests`.
// Regra do projeto: guardar SOMENTE o estado atual (uma linha por usuário, sem histórico).

import { obterPool } from '../db/pool.ts'
import type { ContaTipo } from '../types/usuario.ts'

export interface SolicitacaoPendente {
  id: string
  usuarioId: string
  nome: string | null
  papel: ContaTipo
  criadoEm: Date
}

export async function listarPendentes(): Promise<SolicitacaoPendente[]> {
  const { rows } = await obterPool().query<{
    id: string
    user_id: string
    created_at: Date
    name: string | null
    account_type: ContaTipo
  }>(
    `SELECT r.id, r.user_id, r.created_at, u.name, u.account_type
       FROM reactivation_requests r
       JOIN users u ON u.id = r.user_id
      WHERE r.status = 'pendente'
      ORDER BY r.created_at ASC`,
  )
  return rows.map(linha => ({
    id: linha.id,
    usuarioId: linha.user_id,
    nome: linha.name,
    papel: linha.account_type,
    criadoEm: linha.created_at,
  }))
}

// Aprova ou recusa de forma ATÔMICA: a decisão na solicitação e a ativação do
// usuário (quando aprovada) acontecem na mesma transação.
export async function decidirSolicitacao(
  id: string,
  aprovar: boolean,
  motivo: string | null,
): Promise<{ ok: boolean }> {
  const pool = obterPool()
  const cliente = await pool.connect()
  try {
    await cliente.query('BEGIN')

    const { rows } = await cliente.query<{ user_id: string }>(
      `UPDATE reactivation_requests
          SET status = $2, rejection_reason = $3, updated_at = now()
        WHERE id = $1 AND status = 'pendente'
        RETURNING user_id`,
      [id, aprovar ? 'aprovada' : 'recusada', aprovar ? null : motivo],
    )

    if (rows.length === 0) {
      await cliente.query('ROLLBACK')
      return { ok: false }
    }

    if (aprovar) {
      await cliente.query('UPDATE users SET is_active = true, updated_at = now() WHERE id = $1', [
        rows[0].user_id,
      ])
    }

    await cliente.query('COMMIT')
    return { ok: true }
  } catch (erro) {
    await cliente.query('ROLLBACK')
    throw erro
  } finally {
    cliente.release()
  }
}

// (Uso no fluxo do usuário desativado — etapa seguinte) Abre/reabre a solicitação.
// Uma linha por usuário: se já houver solicitação PENDENTE, nada muda (impede duplicatas);
// se houver uma recusada, ela volta a ficar pendente (permite solicitar de novo após recusa).
export async function abrirSolicitacao(userId: string): Promise<void> {
  await obterPool().query(
    `INSERT INTO reactivation_requests (user_id, status, rejection_reason, created_at, updated_at)
     VALUES ($1, 'pendente', NULL, now(), now())
     ON CONFLICT (user_id) DO UPDATE
        SET status = 'pendente', rejection_reason = NULL, created_at = now(), updated_at = now()
      WHERE reactivation_requests.status <> 'pendente'`,
    [userId],
  )
}
