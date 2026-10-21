// Acesso à tabela `routes` (regras 10–14).
//
// Uma rota pertence a UM motoboy (courier_id). Toda leitura/alteração é feita
// pelo dono. Nunca confiamos em identidade vinda do app: o id do motoboy chega
// sempre do middleware de autenticação.
//
// Consultas SEMPRE parametrizadas ($1, $2, ...) — sem concatenar valores na SQL.

import { obterPool } from '../db/pool.ts'
import type { StatusRota } from '../types/rota.ts'

export interface RotaBanco {
  id: string
  courier_id: string
  destination: string
  departure_time: string | null
  return_forecast: string | null
  distance: string | null
  accepts_fittings: boolean
  status: StatusRota
  created_at: Date
  updated_at: Date
  ended_at: Date | null
}

const COLUNAS = `id, courier_id, destination, departure_time, return_forecast,
  distance, accepts_fittings, status, created_at, updated_at, ended_at`

// Converte a linha do banco no formato usado pelo aplicativo (camelCase).
// Nunca expõe o id do motoboy para quem não é o dono (a API decide o que enviar).
// A rota NÃO tem valor de encaixe fixo: o valor nasce da negociação do pedido
// (campo do solicitante) — decisão do proprietário (regra 10).
export function rotaParaApi(r: RotaBanco) {
  return {
    id: r.id,
    destino: r.destination,
    saidaPrevista: r.departure_time,
    retornoPrevisto: r.return_forecast,
    extensao: r.distance,
    aceitaEncaixes: r.accepts_fittings,
    status: r.status,
    criadaEm: r.created_at,
    atualizadaEm: r.updated_at,
    encerradaEm: r.ended_at,
  }
}

export interface DadosRota {
  courierId: string
  destino: string
  saidaPrevista: string | null
  retornoPrevisto: string | null
  extensao: string | null
  aceitaEncaixes: boolean
}

export async function criarRota(dados: DadosRota): Promise<RotaBanco> {
  const { rows } = await obterPool().query<RotaBanco>(
    `INSERT INTO routes
       (courier_id, destination, departure_time, return_forecast,
        distance, accepts_fittings, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'publicada')
     RETURNING ${COLUNAS}`,
    [
      dados.courierId,
      dados.destino,
      dados.saidaPrevista,
      dados.retornoPrevisto,
      dados.extensao,
      dados.aceitaEncaixes,
    ],
  )
  return rows[0]
}

// Rotas do motoboy (dono). `apenasPublicadas` limita às ainda disponíveis.
export async function listarRotasDoMotoboy(
  courierId: string,
  apenasPublicadas: boolean,
): Promise<RotaBanco[]> {
  const filtroStatus = apenasPublicadas ? `AND status = 'publicada'` : ''
  const { rows } = await obterPool().query<RotaBanco>(
    `SELECT ${COLUNAS} FROM routes
      WHERE courier_id = $1 ${filtroStatus}
      ORDER BY created_at DESC, id`,
    [courierId],
  )
  return rows
}

export async function buscarRota(id: string): Promise<RotaBanco | null> {
  const { rows } = await obterPool().query<RotaBanco>(
    `SELECT ${COLUNAS} FROM routes WHERE id = $1 LIMIT 1`,
    [id],
  )
  return rows[0] ?? null
}

// Rotas publicadas que ACEITAM encaixes — visão do lojista/pessoa física
// (regras 10, 12). Não expõe dados pessoais de outros usuários: apenas o que a
// rota oferece. O solicitante escolhe manualmente a que atende à necessidade.
export async function listarRotasDisponiveis(): Promise<RotaBanco[]> {
  const { rows } = await obterPool().query<RotaBanco>(
    `SELECT ${COLUNAS} FROM routes
      WHERE status = 'publicada' AND accepts_fittings
      ORDER BY created_at DESC, id`,
    [],
  )
  return rows
}

export type FalhaRota = 'nao_encontrada' | 'nao_permitido' | 'estado_invalido'

export type ResultadoRota =
  | { ok: true; rota: RotaBanco }
  | { ok: false; motivo: FalhaRota }

export interface AtualizacaoRota {
  destino: string
  saidaPrevista: string | null
  retornoPrevisto: string | null
  extensao: string | null
  aceitaEncaixes: boolean
}

// Atualiza uma rota publicada do próprio motoboy. Só a rota `publicada` pode ser
// editada (regra 12: a rota vale até ser encerrada/cancelada).
export async function atualizarRota(
  id: string,
  courierId: string,
  dados: AtualizacaoRota,
): Promise<ResultadoRota> {
  const cliente = await obterPool().connect()
  try {
    await cliente.query('BEGIN')
    const { rows } = await cliente.query<{ courier_id: string; status: StatusRota }>(
      'SELECT courier_id, status FROM routes WHERE id = $1 FOR UPDATE',
      [id],
    )
    const atual = rows[0]
    if (!atual) {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'nao_encontrada' }
    }
    if (atual.courier_id !== courierId) {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'nao_permitido' }
    }
    if (atual.status !== 'publicada') {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'estado_invalido' }
    }

    const atualizada = await cliente.query<RotaBanco>(
      `UPDATE routes
          SET destination = $2,
              departure_time = $3,
              return_forecast = $4,
              distance = $5,
              accepts_fittings = $6,
              updated_at = now()
        WHERE id = $1
        RETURNING ${COLUNAS}`,
      [
        id,
        dados.destino,
        dados.saidaPrevista,
        dados.retornoPrevisto,
        dados.extensao,
        dados.aceitaEncaixes,
      ],
    )
    await cliente.query('COMMIT')
    return { ok: true, rota: atualizada.rows[0] }
  } catch (erro) {
    await cliente.query('ROLLBACK')
    throw erro
  } finally {
    cliente.release()
  }
}

// Encerra (regra 13) ou cancela (regra 14) a rota do motoboy. Em ambos os casos
// os encaixes PENDENTES são cancelados na MESMA transação — o motoboy é
// perguntado antes (na interface) e os solicitantes veem o estado ao focar.
export async function encerrarRota(
  id: string,
  courierId: string,
  statusNovo: 'encerrada' | 'cancelada',
): Promise<ResultadoRota> {
  const cliente = await obterPool().connect()
  try {
    await cliente.query('BEGIN')
    const { rows } = await cliente.query<{ courier_id: string; status: StatusRota }>(
      'SELECT courier_id, status FROM routes WHERE id = $1 FOR UPDATE',
      [id],
    )
    const atual = rows[0]
    if (!atual) {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'nao_encontrada' }
    }
    if (atual.courier_id !== courierId) {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'nao_permitido' }
    }
    if (atual.status !== 'publicada') {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'estado_invalido' }
    }

    // Cancela os encaixes ainda pendentes desta rota (regras 13 e 14).
    await cliente.query(
      `UPDATE route_fittings
          SET status = 'cancelado', cancelled_at = now()
        WHERE route_id = $1 AND status = 'pendente'`,
      [id],
    )

    const atualizada = await cliente.query<RotaBanco>(
      `UPDATE routes
          SET status = $2, ended_at = now(), updated_at = now()
        WHERE id = $1
        RETURNING ${COLUNAS}`,
      [id, statusNovo],
    )
    await cliente.query('COMMIT')
    return { ok: true, rota: atualizada.rows[0] }
  } catch (erro) {
    await cliente.query('ROLLBACK')
    throw erro
  } finally {
    cliente.release()
  }
}

// Cancela as rotas publicadas do motoboy (regra 14: ao ficar offline antes de
// iniciar a rota, cancelar a rota e avisar os solicitantes). Também cancela os
// encaixes pendentes dessas rotas. Retorna os ids afetados.
export async function cancelarRotasPublicadasDoMotoboy(courierId: string): Promise<string[]> {
  const cliente = await obterPool().connect()
  try {
    await cliente.query('BEGIN')
    const { rows } = await cliente.query<{ id: string }>(
      `SELECT id FROM routes
        WHERE courier_id = $1 AND status = 'publicada'
        FOR UPDATE`,
      [courierId],
    )
    const ids = rows.map(r => r.id)
    if (ids.length > 0) {
      await cliente.query(
        `UPDATE route_fittings
            SET status = 'cancelado', cancelled_at = now()
          WHERE route_id = ANY($1::uuid[]) AND status = 'pendente'`,
        [ids],
      )
      await cliente.query(
        `UPDATE routes
            SET status = 'cancelada', ended_at = now(), updated_at = now()
          WHERE id = ANY($1::uuid[]) AND status = 'publicada'`,
        [ids],
      )
    }
    await cliente.query('COMMIT')
    return ids
  } catch (erro) {
    await cliente.query('ROLLBACK')
    throw erro
  } finally {
    cliente.release()
  }
}
