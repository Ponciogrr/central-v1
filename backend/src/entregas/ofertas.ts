// Ofertas exclusivas de entrega para motoboys (tabela `delivery_offers`).
//
// Fluxo da M4.3:
//  - ao criar uma entrega elegível, gera UMA oferta para um motoboy elegível;
//  - o motoboy tem PRAZO_OFERTA_SEGUNDOS (30 s) para aceitar ou recusar;
//  - ao recusar/expirar, marca o resultado na tabela e tenta o PRÓXIMO elegível;
//  - não reenvia a quem já recusou; nunca oferece a offline/ocupado/inativo.
//
// Não há serviço em segundo plano (sem cron). A "manutenção preguiçosa"
// (expirar ofertas vencidas e distribuir entregas que aguardam) roda sempre que
// há tráfego: criar entrega, consulta periódica do motoboy, aceitar/recusar e
// mudança de disponibilidade. Isso basta porque o app do motoboy consulta a
// cada 5 s enquanto está online.
//
// Concorrência: cada atribuição trava a linha da entrega (FOR UPDATE) e a
// gravação usa `ON CONFLICT DO NOTHING`, garantindo no máximo UMA oferta
// pendente por entrega mesmo com acessos simultâneos.

import { obterPool } from '../db/pool.ts'
import type { EntregaBanco } from './entregas.ts'

export const PRAZO_OFERTA_SEGUNDOS = 30

// Mesma janela usada pela elegibilidade (ver disponibilidade.ts).
const JANELA_ATIVIDADE_MINUTOS = 5

const COLUNAS_ENTREGA = `id, requester_id, courier_id, pickup_address, dropoff_address,
  amount, notes, status, cancel_reason, cancelled_by_id,
  assignment_cancelled_by_id, assignment_cancel_reason, assignment_cancelled_at,
  awaiting_substitute,
  created_at, accepted_at, started_at, completed_at`

export interface OfertaPendente {
  id: string
  entregaId: string
  coleta: string
  destino: string
  valor: number | null
  observacoes: string | null
  expiraEm: Date
  criadaEm: Date
}

// Expira ofertas vencidas e distribui entregas aguardando que ficaram sem
// oferta pendente. Idempotente: pode ser chamada com frequência.
export async function processarOfertas(): Promise<void> {
  const pool = obterPool()

  await pool.query(
    `UPDATE delivery_offers
        SET status = 'expirada', responded_at = now()
      WHERE status = 'pendente' AND expires_at <= now()`,
  )

  const { rows } = await pool.query<{ id: string }>(
    `SELECT d.id
       FROM deliveries d
      WHERE d.status = 'aguardando'
        AND NOT EXISTS (
          SELECT 1 FROM delivery_offers o
           WHERE o.delivery_id = d.id AND o.status = 'pendente'
        )
      ORDER BY d.created_at
      LIMIT 20`,
  )

  for (const { id } of rows) {
    await ofertarProximoElegivel(id)
  }
}

// Tenta criar uma oferta para a entrega informada, escolhendo o próximo motoboy
// elegível de forma equilibrada. Sem candidato, a entrega segue aguardando —
// nunca inventamos uma aceitação.
export async function ofertarProximoElegivel(deliveryId: string): Promise<void> {
  const cliente = await obterPool().connect()
  try {
    await cliente.query('BEGIN')

    // Trava a entrega: evita duas ofertas simultâneas para a mesma entrega.
    const { rows: entregas } = await cliente.query<{ status: string }>(
      'SELECT status FROM deliveries WHERE id = $1 FOR UPDATE',
      [deliveryId],
    )
    if (entregas.length === 0 || entregas[0].status !== 'aguardando') {
      await cliente.query('ROLLBACK')
      return
    }

    const pendente = await cliente.query(
      `SELECT 1 FROM delivery_offers WHERE delivery_id = $1 AND status = 'pendente' LIMIT 1`,
      [deliveryId],
    )
    if (pendente.rows.length > 0) {
      await cliente.query('ROLLBACK')
      return
    }

    // Elegibilidade: motoboy ativo, online com atividade recente, sem entrega
    // em andamento, sem outra oferta pendente e que ainda não viu/recusou ESTA
    // entrega. Desempate equilibrado por quem teve menos oportunidades.
    const { rows: candidatos } = await cliente.query<{ id: string }>(
      `SELECT u.id
         FROM users u
         LEFT JOIN (
           SELECT courier_id, COUNT(*) AS oportunidades
             FROM delivery_offers
            GROUP BY courier_id
         ) o ON o.courier_id = u.id
        WHERE u.account_type = 'motoboy'
          AND u.is_active
          AND u.is_online
          AND u.last_seen_at IS NOT NULL
          AND u.last_seen_at >= now() - make_interval(mins => $2::int)
          AND NOT EXISTS (
            SELECT 1 FROM deliveries d
             WHERE d.courier_id = u.id AND d.status IN ('aceita', 'em_rota')
          )
          AND NOT EXISTS (
            SELECT 1 FROM delivery_offers p
             WHERE p.courier_id = u.id AND p.status = 'pendente'
          )
          AND NOT EXISTS (
            SELECT 1 FROM delivery_offers r
             WHERE r.delivery_id = $1 AND r.courier_id = u.id
               AND r.status IN ('pendente', 'recusada')
          )
        ORDER BY COALESCE(o.oportunidades, 0) ASC, random()
        LIMIT 1`,
      [deliveryId, JANELA_ATIVIDADE_MINUTOS],
    )

    if (candidatos.length === 0) {
      await cliente.query('ROLLBACK')
      return
    }

    await cliente.query(
      `INSERT INTO delivery_offers (delivery_id, courier_id, status, expires_at)
       VALUES ($1, $2, 'pendente', now() + make_interval(secs => $3::int))
       ON CONFLICT DO NOTHING`,
      [deliveryId, candidatos[0].id, PRAZO_OFERTA_SEGUNDOS],
    )

    await cliente.query('COMMIT')
  } catch (erro) {
    await cliente.query('ROLLBACK')
    throw erro
  } finally {
    cliente.release()
  }
}

// Ofertas pendentes (ainda válidas) atribuídas ao motoboy, com os dados da
// entrega necessários para exibir ao entregador.
export async function listarOfertasPendentes(motoboyId: string): Promise<OfertaPendente[]> {
  const { rows } = await obterPool().query<{
    id: string
    delivery_id: string
    pickup_address: string
    dropoff_address: string
    amount: string | null
    notes: string | null
    expires_at: Date
    created_at: Date
  }>(
    `SELECT o.id, o.delivery_id, d.pickup_address, d.dropoff_address,
            d.amount, d.notes, o.expires_at, o.created_at
       FROM delivery_offers o
       JOIN deliveries d ON d.id = o.delivery_id
      WHERE o.courier_id = $1
        AND o.status = 'pendente'
        AND o.expires_at > now()
        AND d.status = 'aguardando'
      ORDER BY o.created_at`,
    [motoboyId],
  )

  return rows.map(r => ({
    id: r.id,
    entregaId: r.delivery_id,
    coleta: r.pickup_address,
    destino: r.dropoff_address,
    valor: r.amount === null ? null : Number(r.amount),
    observacoes: r.notes,
    expiraEm: r.expires_at,
    criadaEm: r.created_at,
  }))
}

export type FalhaOferta =
  | 'nao_encontrada'
  | 'indisponivel'
  | 'expirada'
  | 'ocupado'
  | 'entrega_indisponivel'

export type ResultadoAceite =
  | { ok: true; entrega: EntregaBanco }
  | { ok: false; motivo: FalhaOferta }

// Aceite atômico: valida dono/prazo, confirma que a entrega ainda pode ser
// aceita e marca a oferta e a entrega na MESMA transação. Um motoboy ocupado
// não pode aceitar outra entrega.
export async function aceitarOferta(
  ofertaId: string,
  motoboyId: string,
): Promise<ResultadoAceite> {
  const cliente = await obterPool().connect()
  try {
    await cliente.query('BEGIN')

    const { rows: ofertas } = await cliente.query<{
      delivery_id: string
      courier_id: string
      status: string
      expires_at: Date
    }>(
      `SELECT delivery_id, courier_id, status, expires_at
         FROM delivery_offers WHERE id = $1 FOR UPDATE`,
      [ofertaId],
    )
    const oferta = ofertas[0]
    if (!oferta || oferta.courier_id !== motoboyId) {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'nao_encontrada' }
    }
    if (oferta.status !== 'pendente') {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'indisponivel' }
    }
    if (oferta.expires_at.getTime() <= Date.now()) {
      await cliente.query(
        `UPDATE delivery_offers SET status = 'expirada', responded_at = now() WHERE id = $1`,
        [ofertaId],
      )
      await cliente.query('COMMIT')
      return { ok: false, motivo: 'expirada' }
    }

    const ocupado = await cliente.query(
      `SELECT 1 FROM deliveries
        WHERE courier_id = $1 AND status IN ('aceita', 'em_rota') LIMIT 1`,
      [motoboyId],
    )
    if (ocupado.rows.length > 0) {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'ocupado' }
    }

    const { rows: entregas } = await cliente.query<{ status: string }>(
      'SELECT status FROM deliveries WHERE id = $1 FOR UPDATE',
      [oferta.delivery_id],
    )
    if (entregas.length === 0 || entregas[0].status !== 'aguardando') {
      await cliente.query(
        `UPDATE delivery_offers SET status = 'expirada', responded_at = now()
          WHERE id = $1 AND status = 'pendente'`,
        [ofertaId],
      )
      await cliente.query('COMMIT')
      return { ok: false, motivo: 'entrega_indisponivel' }
    }

    const { rows: atualizada } = await cliente.query<EntregaBanco>(
      `UPDATE deliveries
          SET status = 'aceita', courier_id = $2, accepted_at = now(),
              awaiting_substitute = false
        WHERE id = $1
        RETURNING ${COLUNAS_ENTREGA}`,
      [oferta.delivery_id, motoboyId],
    )

    await cliente.query(
      `UPDATE delivery_offers SET status = 'aceita', responded_at = now() WHERE id = $1`,
      [ofertaId],
    )

    // O motoboy passa a estar ocupado: libera as outras ofertas pendentes dele
    // (as entregas correspondentes voltam a ser oferecidas pela manutenção).
    await cliente.query(
      `UPDATE delivery_offers SET status = 'expirada', responded_at = now()
        WHERE courier_id = $1 AND status = 'pendente' AND id <> $2`,
      [motoboyId, ofertaId],
    )

    await cliente.query('COMMIT')
    return { ok: true, entrega: atualizada[0] }
  } catch (erro) {
    await cliente.query('ROLLBACK')
    throw erro
  } finally {
    cliente.release()
  }
}

export type ResultadoRecusa =
  | { ok: true; entregaId: string }
  | { ok: false; motivo: 'nao_encontrada' | 'indisponivel' }

// Recusa: marca a oferta como recusada (o motoboy não recebe esta entrega de
// novo — o índice uq_offers_active_or_refused garante o bloqueio).
export async function recusarOferta(
  ofertaId: string,
  motoboyId: string,
): Promise<ResultadoRecusa> {
  const cliente = await obterPool().connect()
  try {
    await cliente.query('BEGIN')

    const { rows } = await cliente.query<{
      delivery_id: string
      courier_id: string
      status: string
    }>(
      `SELECT delivery_id, courier_id, status
         FROM delivery_offers WHERE id = $1 FOR UPDATE`,
      [ofertaId],
    )
    const oferta = rows[0]
    if (!oferta || oferta.courier_id !== motoboyId) {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'nao_encontrada' }
    }
    if (oferta.status !== 'pendente') {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'indisponivel' }
    }

    await cliente.query(
      `UPDATE delivery_offers SET status = 'recusada', responded_at = now() WHERE id = $1`,
      [ofertaId],
    )
    await cliente.query('COMMIT')
    return { ok: true, entregaId: oferta.delivery_id }
  } catch (erro) {
    await cliente.query('ROLLBACK')
    throw erro
  } finally {
    cliente.release()
  }
}

// Expira ofertas pendentes de uma entrega (usada quando o solicitante cancela).
export async function expirarOfertasPendentesDaEntrega(deliveryId: string): Promise<void> {
  await obterPool().query(
    `UPDATE delivery_offers
        SET status = 'expirada', responded_at = now()
      WHERE delivery_id = $1 AND status = 'pendente'`,
    [deliveryId],
  )
}

// Expira ofertas pendentes de um motoboy (usada quando ele fica offline).
export async function expirarOfertasPendentesDoMotoboy(motoboyId: string): Promise<void> {
  await obterPool().query(
    `UPDATE delivery_offers
        SET status = 'expirada', responded_at = now()
      WHERE courier_id = $1 AND status = 'pendente'`,
    [motoboyId],
  )
}
