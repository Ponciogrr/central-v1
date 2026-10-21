// Acesso à tabela `route_fittings` (encaixes — regras 10–14).
//
// Negociação de valor (regra 10, decisão do proprietário — migração 007):
// o solicitante (lojista/pessoa física) informa o VALOR que propõe pagar ao
// pedir o encaixe; o motoboy dono da rota aceita, recusa ou envia uma
// CONTRAPROPOSTA (`counter_amount`); havendo contraproposta, o cliente aceita
// (→ 'aceito') ou recusa (→ 'recusado'). O valor acordado de um encaixe
// 'aceito' é `counter_amount ?? amount` (histórico completo preservado).
// NÃO existe preço mínimo por quilômetro nem cálculo automático.
// Identidades vêm SEMPRE do middleware, nunca do app.
//
// Consultas SEMPRE parametrizadas ($1, $2, ...).

import { obterPool } from '../db/pool.ts'
import type { StatusEncaixe } from '../types/rota.ts'

export interface EncaixeBanco {
  id: string
  route_id: string
  requester_id: string
  pickup_address: string
  dropoff_address: string
  amount: string | null
  counter_amount: string | null
  counter_at: Date | null
  notes: string | null
  status: StatusEncaixe
  created_at: Date
  responded_at: Date | null
  cancelled_at: Date | null
}

const COLUNAS = `id, route_id, requester_id, pickup_address, dropoff_address,
  amount, counter_amount, counter_at, notes, status, created_at, responded_at, cancelled_at`

function numeroOuNulo(valor: string | null): number | null {
  return valor === null ? null : Number(valor)
}

// Valor acordado de um encaixe aceito: a contraproposta (quando houve) ou a
// proposta original. Nulo enquanto não há acordo.
function valorAcordado(e: EncaixeBanco): number | null {
  if (e.status !== 'aceito') return null
  return numeroOuNulo(e.counter_amount ?? e.amount)
}

// Campos comuns às duas visões (solicitante e motoboy). A API decide o que
// mais expõe; nunca vazam dados de outros usuários.
function camposPublicos(e: EncaixeBanco) {
  return {
    id: e.id,
    rotaId: e.route_id,
    coleta: e.pickup_address,
    destino: e.dropoff_address,
    valor: numeroOuNulo(e.amount),
    valorContraproposta: numeroOuNulo(e.counter_amount),
    contrapropostaEm: e.counter_at,
    valorAcordado: valorAcordado(e),
    observacoes: e.notes,
    status: e.status,
    criadoEm: e.created_at,
    respondidoEm: e.responded_at,
    canceladoEm: e.cancelled_at,
  }
}

// Visão para o SOLICITANTE (regras 10, 11): não expõe dados de outros usuários,
// apenas a sua solicitação e o essencial da rota (destino).
export function encaixeParaSolicitante(
  e: EncaixeBanco,
  rota: { destination: string } | null,
) {
  return {
    ...camposPublicos(e),
    destinoRota: rota?.destination ?? null,
  }
}

// Visão para o MOTOBOY (dono da rota): inclui o essencial para decidir. Nunca
// expõe telefone/nome do solicitante — apenas origem/destino/valores/observação.
export function encaixeParaMotoboy(e: EncaixeBanco) {
  return camposPublicos(e)
}

export interface DadosEncaixe {
  routeId: string
  requesterId: string
  coleta: string
  destino: string
  valor: string
  observacoes: string | null
}

export type FalhaEncaixe =
  | 'rota_nao_encontrada'
  | 'rota_indisponivel'
  | 'ja_pendente'
  | 'nao_encontrado'
  | 'nao_permitido'
  | 'estado_invalido'

export type ResultadoEncaixeCriado =
  | { ok: true; encaixe: EncaixeBanco; destinoRota: string }
  | { ok: false; motivo: FalhaEncaixe }

// Cria o pedido de encaixe. Só rotas PUBLICADAS e que ACEITAM encaixes aceitam
// pedidos (regra 12). O VALOR vem do solicitante (proposta de negociação —
// obrigatório e positivo, validado na rota HTTP). O índice parcial
// uq_fittings_one_pending impede duplicata pendente do mesmo solicitante.
export async function criarEncaixe(dados: DadosEncaixe): Promise<ResultadoEncaixeCriado> {
  const cliente = await obterPool().connect()
  try {
    await cliente.query('BEGIN')

    const { rows: rotas } = await cliente.query<{
      status: string
      accepts_fittings: boolean
      destination: string
    }>(
      `SELECT status, accepts_fittings, destination
         FROM routes WHERE id = $1 FOR UPDATE`,
      [dados.routeId],
    )
    const rota = rotas[0]
    if (!rota) {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'rota_nao_encontrada' }
    }
    if (rota.status !== 'publicada' || !rota.accepts_fittings) {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'rota_indisponivel' }
    }

    const pendente = await cliente.query(
      `SELECT 1 FROM route_fittings
        WHERE route_id = $1 AND requester_id = $2 AND status = 'pendente' LIMIT 1`,
      [dados.routeId, dados.requesterId],
    )
    if (pendente.rows.length > 0) {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'ja_pendente' }
    }

    const { rows } = await cliente.query<EncaixeBanco>(
      `INSERT INTO route_fittings
         (route_id, requester_id, pickup_address, dropoff_address, amount, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pendente')
       RETURNING ${COLUNAS}`,
      [dados.routeId, dados.requesterId, dados.coleta, dados.destino, dados.valor, dados.observacoes],
    )

    await cliente.query('COMMIT')
    return { ok: true, encaixe: rows[0], destinoRota: rota.destination }
  } catch (erro) {
    await cliente.query('ROLLBACK')
    throw erro
  } finally {
    cliente.release()
  }
}

// Encaixes do solicitante (só os dele — privacidade). Traz o destino da rota.
export async function listarEncaixesDoSolicitante(
  requesterId: string,
): Promise<Array<{ encaixe: EncaixeBanco; destinoRota: string | null }>> {
  const { rows } = await obterPool().query<EncaixeBanco & { destination: string | null }>(
    `SELECT f.${COLUNAS.split(', ').join(', f.')}, r.destination
       FROM route_fittings f
       JOIN routes r ON r.id = f.route_id
      WHERE f.requester_id = $1
      ORDER BY f.created_at DESC, f.id`,
    [requesterId],
  )
  return rows.map(r => ({ encaixe: r, destinoRota: r.destination }))
}

// Encaixes recebidos pelo motoboy: os pedidos feitos para AS ROTAS DELE.
// Inclui o destino da rota para contexto.
export async function listarEncaixesRecebidos(
  courierId: string,
): Promise<Array<{ encaixe: EncaixeBanco; destinoRota: string | null }>> {
  const { rows } = await obterPool().query<EncaixeBanco & { destination: string | null }>(
    `SELECT f.${COLUNAS.split(', ').join(', f.')}, r.destination
       FROM route_fittings f
       JOIN routes r ON r.id = f.route_id
      WHERE r.courier_id = $1
      ORDER BY f.created_at DESC, f.id`,
    [courierId],
  )
  return rows.map(r => ({ encaixe: r, destinoRota: r.destination }))
}

type ResultadoSimples =
  | { ok: true; encaixe: EncaixeBanco }
  | { ok: false; motivo: FalhaEncaixe }

// Bloqueio interno: carrega o encaixe travado (FOR UPDATE) e valida dono +
// estado. `dono` é o id e `campoDono` a coluna de posse ('courier_id' vem de
// `routes`; 'requester_id' vem de `route_fittings`). `exigirContraproposta`
// controla se a negociação deve (ou não) estar aguardando o cliente.
async function transacaoEncaixe(
  id: string,
  dono: string,
  campoDono: 'courier_id' | 'requester_id',
  opcoes: {
    exigirPendenteSemContraproposta?: boolean
    exigirContraproposta?: boolean
  },
): Promise<
  { cliente: import('pg').PoolClient; encaixe: EncaixeBanco } | { motivo: FalhaEncaixe }
> {
  const cliente = await obterPool().connect()
  try {
    await cliente.query('BEGIN')
    const { rows } = await cliente.query<EncaixeBanco & { courier_id: string }>(
      `SELECT f.*, r.courier_id
         FROM route_fittings f
         JOIN routes r ON r.id = f.route_id
        WHERE f.id = $1
        FOR UPDATE OF f`,
      [id],
    )
    const atual = rows[0]
    if (!atual) {
      await cliente.query('ROLLBACK')
      return { motivo: 'nao_encontrado' }
    }
    const donoAtual = campoDono === 'courier_id' ? atual.courier_id : atual.requester_id
    if (donoAtual !== dono) {
      await cliente.query('ROLLBACK')
      return { motivo: 'nao_permitido' }
    }
    if (atual.status !== 'pendente') {
      await cliente.query('ROLLBACK')
      return { motivo: 'estado_invalido' }
    }
    if (opcoes.exigirPendenteSemContraproposta && atual.counter_amount !== null) {
      await cliente.query('ROLLBACK')
      return { motivo: 'estado_invalido' }
    }
    if (opcoes.exigirContraproposta && atual.counter_amount === null) {
      await cliente.query('ROLLBACK')
      return { motivo: 'estado_invalido' }
    }
    return { cliente, encaixe: atual }
  } catch (erro) {
    await cliente.query('ROLLBACK')
    throw erro
  }
}

// Aceita ou recusa um encaixe. Só o MOTOBOY dono da rota responsável. Só um
// pedido `pendente` SEM contraproposta em aberto pode ser respondido por ele
// (havendo contraproposta, a decisão é do cliente — ver abaixo).
export async function responderEncaixe(
  id: string,
  courierId: string,
  novoStatus: 'aceito' | 'recusado',
): Promise<ResultadoSimples> {
  const carregado = await transacaoEncaixe(id, courierId, 'courier_id', {
    exigirPendenteSemContraproposta: true,
  })
  if ('motivo' in carregado) return { ok: false, motivo: carregado.motivo }
  const { cliente } = carregado
  try {
    const { rows: atualizado } = await cliente.query<EncaixeBanco>(
      `UPDATE route_fittings
          SET status = $2, responded_at = now()
        WHERE id = $1
        RETURNING ${COLUNAS}`,
      [id, novoStatus],
    )
    await cliente.query('COMMIT')
    return { ok: true, encaixe: atualizado[0] }
  } catch (erro) {
    await cliente.query('ROLLBACK')
    throw erro
  } finally {
    cliente.release()
  }
}

// Contraproposta do motoboy: registra um valor alternativo e mantém o pedido
// 'pendente' — agora a decisão é do cliente (aceitar ou recusar a
// contraproposta). Só existe uma contraproposta por encaixe (a última gravação
// do motoboy); depois dela ele não responde mais até o cliente decidir.
export async function contraproporEncaixe(
  id: string,
  courierId: string,
  valor: string,
): Promise<ResultadoSimples> {
  const carregado = await transacaoEncaixe(id, courierId, 'courier_id', {
    exigirPendenteSemContraproposta: true,
  })
  if ('motivo' in carregado) return { ok: false, motivo: carregado.motivo }
  const { cliente } = carregado
  try {
    const { rows: atualizado } = await cliente.query<EncaixeBanco>(
      `UPDATE route_fittings
          SET counter_amount = $2, counter_at = now()
        WHERE id = $1
        RETURNING ${COLUNAS}`,
      [id, valor],
    )
    await cliente.query('COMMIT')
    return { ok: true, encaixe: atualizado[0] }
  } catch (erro) {
    await cliente.query('ROLLBACK')
    throw erro
  } finally {
    cliente.release()
  }
}

// Cliente ACEITA a contraproposta do motoboy → encaixe 'aceito'
// (o valor acordado passa a ser counter_amount).
export async function aceitarContraproposta(
  id: string,
  requesterId: string,
): Promise<ResultadoSimples> {
  const carregado = await transacaoEncaixe(id, requesterId, 'requester_id', {
    exigirContraproposta: true,
  })
  if ('motivo' in carregado) return { ok: false, motivo: carregado.motivo }
  const { cliente } = carregado
  try {
    const { rows: atualizado } = await cliente.query<EncaixeBanco>(
      `UPDATE route_fittings
          SET status = 'aceito', responded_at = now()
        WHERE id = $1
        RETURNING ${COLUNAS}`,
      [id],
    )
    await cliente.query('COMMIT')
    return { ok: true, encaixe: atualizado[0] }
  } catch (erro) {
    await cliente.query('ROLLBACK')
    throw erro
  } finally {
    cliente.release()
  }
}

// Cliente RECUSA a contraproposta → encaixe 'recusado' (encerra a negociação).
export async function recusarContraproposta(
  id: string,
  requesterId: string,
): Promise<ResultadoSimples> {
  const carregado = await transacaoEncaixe(id, requesterId, 'requester_id', {
    exigirContraproposta: true,
  })
  if ('motivo' in carregado) return { ok: false, motivo: carregado.motivo }
  const { cliente } = carregado
  try {
    const { rows: atualizado } = await cliente.query<EncaixeBanco>(
      `UPDATE route_fittings
          SET status = 'recusado', responded_at = now()
        WHERE id = $1
        RETURNING ${COLUNAS}`,
      [id],
    )
    await cliente.query('COMMIT')
    return { ok: true, encaixe: atualizado[0] }
  } catch (erro) {
    await cliente.query('ROLLBACK')
    throw erro
  } finally {
    cliente.release()
  }
}

// Cancelamento pelo SOLICITANTE (regra 11): só ANTES do aceite (pendente).
// Vale também com contraproposta em aberto — cancelar encerra a negociação.
export async function cancelarEncaixePeloSolicitante(
  id: string,
  requesterId: string,
): Promise<ResultadoSimples> {
  const carregado = await transacaoEncaixe(id, requesterId, 'requester_id', {})
  if ('motivo' in carregado) return { ok: false, motivo: carregado.motivo }
  const { cliente } = carregado
  try {
    const { rows: atualizado } = await cliente.query<EncaixeBanco>(
      `UPDATE route_fittings
          SET status = 'cancelado', cancelled_at = now()
        WHERE id = $1
        RETURNING ${COLUNAS}`,
      [id],
    )
    await cliente.query('COMMIT')
    return { ok: true, encaixe: atualizado[0] }
  } catch (erro) {
    await cliente.query('ROLLBACK')
    throw erro
  } finally {
    cliente.release()
  }
}
