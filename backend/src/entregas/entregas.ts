// Acesso à tabela `deliveries`.
//
// Toda leitura/alteração é feita pelo dono da entrega (requester_id) ou pelo
// motoboy designado (courier_id). Nunca confiamos em identidade vinda do app:
// o id do solicitante sempre chega aqui a partir do middleware de autenticação.
//
// Consultas SEMPRE parametrizadas ($1, $2, ...) — sem concatenar valores na SQL.

import { obterPool } from '../db/pool.ts'
import type { StatusEntrega } from '../types/entrega.ts'

export interface EntregaBanco {
  id: string
  requester_id: string
  courier_id: string | null
  pickup_address: string
  dropoff_address: string
  amount: string | null
  notes: string | null
  status: StatusEntrega
  cancel_reason: string | null
  cancelled_by_id: string | null
  assignment_cancelled_by_id: string | null
  assignment_cancel_reason: string | null
  assignment_cancelled_at: Date | null
  awaiting_substitute: boolean
  created_at: Date
  accepted_at: Date | null
  started_at: Date | null
  completed_at: Date | null
}

const COLUNAS = `id, requester_id, courier_id, pickup_address, dropoff_address,
  amount, notes, status, cancel_reason, cancelled_by_id,
  assignment_cancelled_by_id, assignment_cancel_reason, assignment_cancelled_at,
  awaiting_substitute,
  created_at, accepted_at, started_at, completed_at`

// Converte a linha do banco no formato usado pelo aplicativo (camelCase).
// Nunca expõe colunas internas de outras contas.
export function entregaParaApi(e: EntregaBanco) {
  return {
    id: e.id,
    status: e.status,
    coleta: e.pickup_address,
    destino: e.dropoff_address,
    valor: e.amount === null ? null : Number(e.amount),
    observacoes: e.notes,
    criadoEm: e.created_at,
    aceitaEm: e.accepted_at,
    iniciadaEm: e.started_at,
    concluidaEm: e.completed_at,
    motivoCancelamento: e.cancel_reason,
    // Cancelamento da ATRIBUIÇÃO (regra 4 — substituição): o anterior é o
    // motivo do cancelamento definitivo do solicitante (regras 5/6).
    aguardandoSubstituto: e.awaiting_substitute,
    motivoCancelamentoSubstituto: e.assignment_cancel_reason,
  }
}

export async function criarEntrega(dados: {
  solicitanteId: string
  coleta: string
  destino: string
  valor: string | null
  observacoes: string | null
}): Promise<EntregaBanco> {
  const { rows } = await obterPool().query<EntregaBanco>(
    `INSERT INTO deliveries
       (requester_id, pickup_address, dropoff_address, amount, notes, status)
     VALUES ($1, $2, $3, $4, $5, 'aguardando')
     RETURNING ${COLUNAS}`,
    [
      dados.solicitanteId,
      dados.coleta,
      dados.destino,
      dados.valor,
      dados.observacoes,
    ],
  )
  return rows[0]
}

// Lista as entregas visíveis para o usuário. O filtro é exclusivo:
// `solicitanteId` (lojista/pessoa vê o que pediu) OU `entregadorId`
// (motoboy vê o que aceitou). Sem filtro = administrador (vê tudo).
export async function listarEntregas(filtro: {
  solicitanteId?: string
  entregadorId?: string
  limite: number
  deslocamento: number
}): Promise<{ itens: EntregaBanco[]; total: number }> {
  const pool = obterPool()
  const condicoes: string[] = []
  const valores: unknown[] = []

  if (filtro.solicitanteId) {
    valores.push(filtro.solicitanteId)
    condicoes.push(`requester_id = $${valores.length}`)
  } else if (filtro.entregadorId) {
    valores.push(filtro.entregadorId)
    condicoes.push(`courier_id = $${valores.length}`)
  }

  const onde = condicoes.length > 0 ? `WHERE ${condicoes.join(' AND ')}` : ''

  const total = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM deliveries ${onde}`,
    valores,
  )

  const limiteIdx = valores.length + 1
  const deslocIdx = valores.length + 2
  const itens = await pool.query<EntregaBanco>(
    `SELECT ${COLUNAS} FROM deliveries ${onde}
      ORDER BY created_at DESC, id
      LIMIT $${limiteIdx} OFFSET $${deslocIdx}`,
    [...valores, filtro.limite, filtro.deslocamento],
  )

  return { itens: itens.rows, total: Number(total.rows[0]?.total ?? 0) }
}

export async function buscarEntrega(id: string): Promise<EntregaBanco | null> {
  const { rows } = await obterPool().query<EntregaBanco>(
    `SELECT ${COLUNAS} FROM deliveries WHERE id = $1 LIMIT 1`,
    [id],
  )
  return rows[0] ?? null
}

// Entrega em andamento de um motoboy (aceita ou em rota), se houver.
// Usada pelo painel do entregador na M4.3.
export async function buscarEntregaAtiva(entregadorId: string): Promise<EntregaBanco | null> {
  const { rows } = await obterPool().query<EntregaBanco>(
    `SELECT ${COLUNAS} FROM deliveries
      WHERE courier_id = $1 AND status IN ('aceita', 'em_rota')
      ORDER BY accepted_at DESC, id
      LIMIT 1`,
    [entregadorId],
  )
  return rows[0] ?? null
}

// Transições do motoboy designado (M4.4):
//  - iniciar: 'aceita' → 'em_rota' (grava started_at);
//  - finalizar: 'em_rota' → 'entregue' (grava completed_at).
// Ambas rodam em transação com FOR UPDATE, de modo que só o motoboy atribuído
// (courier_id) e no estado correto consegue mudar — nunca inventamos sucesso.

export type FalhaTransicao =
  | 'nao_encontrada'
  | 'nao_permitido'
  | 'estado_invalido'

export type ResultadoTransicao =
  | { ok: true; entrega: EntregaBanco }
  | { ok: false; motivo: FalhaTransicao }

// Núcleo compartilhado: trava a linha, confere o dono (courier_id) e o status
// esperado, e atualiza para o novo status na MESMA transação.
async function transicionarComoMotoboy(
  id: string,
  motoboyId: string,
  statusEsperado: StatusEntrega,
  colunaTempo: 'started_at' | 'completed_at',
  statusNovo: StatusEntrega,
): Promise<ResultadoTransicao> {
  const cliente = await obterPool().connect()
  try {
    await cliente.query('BEGIN')

    const { rows } = await cliente.query<{
      courier_id: string | null
      status: StatusEntrega
    }>('SELECT courier_id, status FROM deliveries WHERE id = $1 FOR UPDATE', [id])

    if (rows.length === 0) {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'nao_encontrada' }
    }

    const atual = rows[0]
    // Não revela a entrega para quem não é o motoboy designado.
    if (atual.courier_id !== motoboyId) {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'nao_permitido' }
    }
    // Cancelada, concluída, ainda não aceita, etc. → transição inválida.
    if (atual.status !== statusEsperado) {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'estado_invalido' }
    }

    const atualizada = await cliente.query<EntregaBanco>(
      `UPDATE deliveries
          SET status = $2,
              ${colunaTempo} = now()
        WHERE id = $1
        RETURNING ${COLUNAS}`,
      [id, statusNovo],
    )

    await cliente.query('COMMIT')
    return { ok: true, entrega: atualizada.rows[0] }
  } catch (erro) {
    await cliente.query('ROLLBACK')
    throw erro
  } finally {
    cliente.release()
  }
}

// Inicia a entrega (aceita → em_rota).
export function iniciarEntrega(
  id: string,
  motoboyId: string,
): Promise<ResultadoTransicao> {
  return transicionarComoMotoboy(id, motoboyId, 'aceita', 'started_at', 'em_rota')
}

// Finaliza a entrega (em_rota → entregue).
export function finalizarEntrega(
  id: string,
  motoboyId: string,
): Promise<ResultadoTransicao> {
  return transicionarComoMotoboy(id, motoboyId, 'em_rota', 'completed_at', 'entregue')
}

export type FalhaCancelamento =
  | 'nao_encontrada'
  | 'nao_permitido'
  | 'ja_cancelada'
  | 'nao_cancelavel'
  | 'motivo_obrigatorio'

export type ResultadoCancelamento =
  | { ok: true; entrega: EntregaBanco }
  | { ok: false; motivo: FalhaCancelamento }

// Cancelamento pelo SOLICITANTE (regras 5 e 6):
//  - antes da aceitação: sem motivo;
//  - depois da aceitação (aceita/em_rota): exige motivo válido;
//  - entregue: não pode; cancelada: não repete.
// A linha é travada (FOR UPDATE) dentro de uma transação para não competir
// com a aceitação que será implementada na M4.3.
export async function cancelarEntrega(
  id: string,
  solicitanteId: string,
  motivo: string | null,
): Promise<ResultadoCancelamento> {
  const pool = obterPool()
  const cliente = await pool.connect()
  try {
    await cliente.query('BEGIN')

    const { rows } = await cliente.query<{
      requester_id: string
      status: StatusEntrega
    }>('SELECT requester_id, status FROM deliveries WHERE id = $1 FOR UPDATE', [id])

    if (rows.length === 0) {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'nao_encontrada' }
    }

    const atual = rows[0]
    if (atual.requester_id !== solicitanteId) {
      // Não revela que a entrega existe para quem não é o dono.
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'nao_permitido' }
    }
    if (atual.status === 'cancelada') {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'ja_cancelada' }
    }
    if (atual.status === 'entregue') {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'nao_cancelavel' }
    }

    const exigeMotivo = atual.status === 'aceita' || atual.status === 'em_rota'
    if (exigeMotivo && !motivo) {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'motivo_obrigatorio' }
    }

    const atualizada = await cliente.query<EntregaBanco>(
      `UPDATE deliveries
          SET status = 'cancelada',
              cancel_reason = $2,
              cancelled_by_id = $3,
              awaiting_substitute = false
        WHERE id = $1
        RETURNING ${COLUNAS}`,
      [id, exigeMotivo ? motivo : null, solicitanteId],
    )

    await cliente.query('COMMIT')
    return { ok: true, entrega: atualizada.rows[0] }
  } catch (erro) {
    await cliente.query('ROLLBACK')
    throw erro
  } finally {
    cliente.release()
  }
}

// Cancelamento da ATRIBUIÇÃO pelo MOTBOY designado (regra 4 — substituição):
//  - só o motoboy designado (courier_id) cancela — outro recebe "não encontrada";
//  - só entregas `aceita` ou `em_rota`;
//  - motivo é sempre obrigatório.
// A solicitação do cliente é PRESERVADA: a entrega volta para 'aguardando'
// (courier_id/accepted_at/started_at limpos, awaiting_substitute = true) e a
// lógica de ofertas a redistribui para um substituto elegível. O cancelante
// é bloqueado com uma oferta 'recusada' (índice uq_offers_active_or_refused),
// que o exclui automaticamente da elegibilidade; a oferta 'aceita' anterior
// permanece como histórico. Os campos cancel_reason/cancelled_by_id e o
// status 'cancelada' continuam exclusivos do cancelamento definitivo do
// solicitante (regras 5 e 6).
export async function cancelarEntregaPeloMotoboy(
  id: string,
  motoboyId: string,
  motivo: string | null,
): Promise<ResultadoCancelamento> {
  const cliente = await obterPool().connect()
  try {
    await cliente.query('BEGIN')

    const { rows } = await cliente.query<{
      courier_id: string | null
      status: StatusEntrega
    }>('SELECT courier_id, status FROM deliveries WHERE id = $1 FOR UPDATE', [id])

    if (rows.length === 0) {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'nao_encontrada' }
    }

    const atual = rows[0]
    // Não revela a entrega para quem não é o motoboy designado.
    if (atual.courier_id !== motoboyId) {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'nao_permitido' }
    }
    if (atual.status === 'cancelada') {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'ja_cancelada' }
    }
    if (atual.status !== 'aceita' && atual.status !== 'em_rota') {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'nao_cancelavel' }
    }
    if (!motivo) {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'motivo_obrigatorio' }
    }

    // Bloqueia o cancelante: nova oferta 'recusada' para o par (entrega,
    // motoboy). A oferta 'aceita' anterior não é coberta pelo índice parcial
    // uq_offers_active_or_refused, então a inserção não conflita; se já
    // existir uma linha para o par, nada é duplicado (ON CONFLICT DO NOTHING).
    await cliente.query(
      `INSERT INTO delivery_offers (delivery_id, courier_id, status, expires_at, responded_at)
       VALUES ($1, $2, 'recusada', now(), now())
       ON CONFLICT DO NOTHING`,
      [id, motoboyId],
    )

    // A entrega volta a 'aguardando' com a solicitação preservada (migração 003).
    const atualizada = await cliente.query<EntregaBanco>(
      `UPDATE deliveries
          SET status = 'aguardando',
              courier_id = NULL,
              accepted_at = NULL,
              started_at = NULL,
              assignment_cancelled_by_id = $2,
              assignment_cancel_reason = $3,
              assignment_cancelled_at = now(),
              awaiting_substitute = true
        WHERE id = $1
        RETURNING ${COLUNAS}`,
      [id, motoboyId, motivo],
    )

    await cliente.query('COMMIT')
    return { ok: true, entrega: atualizada.rows[0] }
  } catch (erro) {
    await cliente.query('ROLLBACK')
    throw erro
  } finally {
    cliente.release()
  }
}
