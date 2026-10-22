// Acesso à tabela `daily_routes` (Rotas do Dia).
//
// Regras de ouro desta camada:
//   - a identidade do solicitante/motoboy vem SEMPRE do middleware (nunca do
//     corpo da requisição);
//   - toda consulta é parametrizada ($1, $2, ...);
//   - a transição de estados acontece dentro de transação com `FOR UPDATE`,
//     para que dois motoboys não contratem a mesma rota ao mesmo tempo.
//
// A data do serviço (`service_date`) é um `date` no banco; devolvemos como
// texto 'YYYY-MM-DD' para o app não sofrer com fuso horário.

import { obterPool } from '../db/pool.ts'
import type { StatusRotaDia } from '../types/rota-dia.ts'

export interface RotaDiaBanco {
  id: string
  publisher_id: string
  contracted_courier_id: string | null
  title: string
  origin: string
  destination: string
  service_date: string
  departure_time: string | null
  stops: string | null
  description: string | null
  offered_amount: string | null
  agreed_amount: string | null
  counter_amount: string | null
  counter_at: Date | null
  status: StatusRotaDia
  cancel_reason: string | null
  cancelled_by_id: string | null
  created_at: Date
  updated_at: Date
  published_at: Date | null
  contracted_at: Date | null
  started_at: Date | null
  completed_at: Date | null
  ended_at: Date | null
  publisher_name: string | null
  publisher_phone: string | null
}

// `service_date::text` devolve 'YYYY-MM-DD' (sem hora) — estável em qualquer fuso.
const COLUNAS = `r.id, r.publisher_id, r.contracted_courier_id, r.title, r.origin, r.destination,
  r.service_date::text AS service_date, r.departure_time, r.stops, r.description,
  r.offered_amount, r.agreed_amount, r.counter_amount, r.counter_at, r.status,
  r.cancel_reason, r.cancelled_by_id, r.created_at, r.updated_at, r.published_at,
  r.contracted_at, r.started_at, r.completed_at, r.ended_at,
  u.name AS publisher_name, u.phone AS publisher_phone`

const FROM = `FROM daily_routes r LEFT JOIN users u ON u.id = r.publisher_id`

export interface DadosRotaDia {
  publisherId: string
  titulo: string
  origem: string
  destino: string
  data: string
  saida: string | null
  paradas: string | null
  descricao: string | null
  valor: string | null
  publicar: boolean
}

// Formato do app (camelCase). A API decide o que cada perfil pode ver:
// `contatoLiberado` revela o telefone do solicitante apenas a quem pode falar
// com ele (o motoboy que contratou a rota) — o nome é sempre visível, porque
// é o que ajuda o motoboy a escolher a rota.
export function rotaDiaParaApi(
  r: RotaDiaBanco,
  opcoes: { mostrarContato?: boolean } = {},
) {
  return {
    id: r.id,
    titulo: r.title,
    origem: r.origin,
    destino: r.destination,
    data: r.service_date,
    saida: r.departure_time,
    paradas: r.stops,
    descricao: r.description,
    valor: r.offered_amount,
    valorCombinado: r.agreed_amount,
    contraproposta: r.counter_amount,
    status: r.status,
    motivoCancelamento: r.cancel_reason,
    criadoEm: r.created_at,
    publicadoEm: r.published_at,
    contratadoEm: r.contracted_at,
    iniciadoEm: r.started_at,
    concluidoEm: r.completed_at,
    encerradoEm: r.ended_at,
    publicador: r.publisher_name,
    telefonePublicador: opcoes.mostrarContato ? r.publisher_phone : null,
  }
}

export async function criarRotaDia(dados: DadosRotaDia): Promise<RotaDiaBanco> {
  const status: StatusRotaDia = dados.publicar ? 'publicada' : 'rascunho'
  const { rows } = await obterPool().query<{ id: string }>(
    `INSERT INTO daily_routes
       (publisher_id, title, origin, destination, service_date, departure_time,
        stops, description, offered_amount, status, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
             CASE WHEN $10 = 'publicada' THEN now() ELSE NULL END)
     RETURNING id`,
    [
      dados.publisherId,
      dados.titulo,
      dados.origem,
      dados.destino,
      dados.data,
      dados.saida,
      dados.paradas,
      dados.descricao,
      dados.valor,
      status,
    ],
  )
  const rota = await buscarRotaDia(rows[0].id)
  return rota!
}

export async function buscarRotaDia(id: string): Promise<RotaDiaBanco | null> {
  const { rows } = await obterPool().query<RotaDiaBanco>(
    `SELECT ${COLUNAS} ${FROM} WHERE r.id = $1 LIMIT 1`,
    [id],
  )
  return rows[0] ?? null
}

// Rotas abertas para motoboys: publicadas, de hoje em diante e ainda sem
// motoboy contratado. As que EU já aceitei ficam de fora.
export async function listarRotasDiaDisponiveis(courierId: string): Promise<RotaDiaBanco[]> {
  const { rows } = await obterPool().query<RotaDiaBanco>(
    `SELECT ${COLUNAS} ${FROM}
      WHERE r.status = 'publicada'
        AND r.service_date >= CURRENT_DATE
        AND r.contracted_courier_id IS NULL
        AND r.publisher_id <> $1
      ORDER BY r.service_date ASC, r.departure_time ASC NULLS LAST, r.created_at DESC`,
    [courierId],
  )
  return rows
}

// Rotas publicadas pelo próprio solicitante (qualquer estado).
export async function listarRotasDiaDoPublicador(publisherId: string): Promise<RotaDiaBanco[]> {
  const { rows } = await obterPool().query<RotaDiaBanco>(
    `SELECT ${COLUNAS} ${FROM}
      WHERE r.publisher_id = $1
      ORDER BY r.service_date DESC, r.created_at DESC
      LIMIT 100`,
    [publisherId],
  )
  return rows
}

// Rotas contratadas pelo motoboy (área de trabalho dele).
export async function listarRotasDiaContratadas(courierId: string): Promise<RotaDiaBanco[]> {
  const { rows } = await obterPool().query<RotaDiaBanco>(
    `SELECT ${COLUNAS} ${FROM}
      WHERE r.contracted_courier_id = $1
      ORDER BY r.service_date ASC, r.created_at DESC
      LIMIT 100`,
    [courierId],
  )
  return rows
}

export type FalhaRotaDia =
  | 'nao_encontrada'
  | 'nao_permitido'
  | 'estado_invalido'
  | 'ja_contratada'

export type ResultadoRotaDia =
  | { ok: true; rota: RotaDiaBanco }
  | { ok: false; motivo: FalhaRotaDia }

// Publica um rascunho do próprio solicitante.
export async function publicarRotaDia(
  id: string,
  publisherId: string,
): Promise<ResultadoRotaDia> {
  const { rows } = await obterPool().query<RotaDiaBanco>(
    `UPDATE daily_routes
        SET status = 'publicada', published_at = now(), updated_at = now()
      WHERE id = $1 AND publisher_id = $2 AND status = 'rascunho'
      RETURNING id, status, publisher_id, contracted_courier_id`,
    [id, publisherId],
  )
  if (rows[0]) {
    const rota = await buscarRotaDia(id)
    return { ok: true, rota: rota! }
  }
  const atual = await buscarRotaDia(id)
  if (!atual) return { ok: false, motivo: 'nao_encontrada' }
  if (atual.publisher_id !== publisherId) return { ok: false, motivo: 'nao_permitido' }
  return { ok: false, motivo: 'estado_invalido' }
}

// ACEITE pelo motoboy — a parte crítica (concorrência).
// Transação + FOR UPDATE: se dois motoboys clicarem "aceitar" ao mesmo tempo,
// apenas um consegue; o outro recebe "rota já contratada".
export async function aceitarRotaDia(
  id: string,
  courierId: string,
  contraproposta: string | null,
): Promise<ResultadoRotaDia> {
  const cliente = await obterPool().connect()
  try {
    await cliente.query('BEGIN')
    const { rows } = await cliente.query<{
      publisher_id: string
      contracted_courier_id: string | null
      offered_amount: string | null
      status: StatusRotaDia
      service_date: string
    }>(
      `SELECT publisher_id, contracted_courier_id, offered_amount, status,
              service_date::text AS service_date
         FROM daily_routes WHERE id = $1 FOR UPDATE`,
      [id],
    )
    const atual = rows[0]
    if (!atual) {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'nao_encontrada' }
    }
    if (atual.publisher_id === courierId) {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'nao_permitido' }
    }
    if (atual.status !== 'publicada' || atual.contracted_courier_id !== null) {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'ja_contratada' }
    }
    if (atual.service_date < hojeIso()) {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'estado_invalido' }
    }

    const valorCombinado = contraproposta ?? atual.offered_amount
    const atualizada = await cliente.query<{ id: string }>(
      `UPDATE daily_routes
          SET status = 'contratada',
              contracted_courier_id = $2,
              contracted_at = now(),
              agreed_amount = $3::numeric,
              counter_amount = $4::numeric,
              counter_at = CASE WHEN $4::numeric IS NULL THEN NULL ELSE now() END,
              updated_at = now()
        WHERE id = $1
        RETURNING id`,
      [id, courierId, valorCombinado, contraproposta],
    )
    await cliente.query('COMMIT')
    const rota = await buscarRotaDia(atualizada.rows[0].id)
    return { ok: true, rota: rota! }
  } catch (erro) {
    await cliente.query('ROLLBACK')
    throw erro
  } finally {
    cliente.release()
  }
}

// Motoboy contratado inicia o serviço.
export async function iniciarRotaDia(
  id: string,
  courierId: string,
): Promise<ResultadoRotaDia> {
  const { rows } = await obterPool().query<{ id: string }>(
    `UPDATE daily_routes
        SET status = 'em_andamento', started_at = now(), updated_at = now()
      WHERE id = $1 AND contracted_courier_id = $2 AND status = 'contratada'
      RETURNING id`,
    [id, courierId],
  )
  if (rows[0]) {
    const rota = await buscarRotaDia(id)
    return { ok: true, rota: rota! }
  }
  return classificarFalhaRotaDia(id, courierId, 'contratada')
}

// Motoboy contratado conclui o serviço (valor final pode ser ajustado).
export async function concluirRotaDia(
  id: string,
  courierId: string,
  valorFinal: string | null,
): Promise<ResultadoRotaDia> {
  const { rows } = await obterPool().query<{ id: string }>(
      `UPDATE daily_routes
        SET status = 'concluida',
            completed_at = now(),
            ended_at = now(),
            agreed_amount = COALESCE($3::numeric, agreed_amount),
            updated_at = now()
      WHERE id = $1 AND contracted_courier_id = $2 AND status = 'em_andamento'
      RETURNING id`,
    [id, courierId, valorFinal],
  )
  if (rows[0]) {
    const rota = await buscarRotaDia(id)
    return { ok: true, rota: rota! }
  }
  return classificarFalhaRotaDia(id, courierId, 'em_andamento')
}

// Solicitante cancela a rota. O motivo é SEMPRE guardado e o motoboy
// contratado enxerga o cancelamento (o histórico não é apagado).
export async function cancelarRotaDia(
  id: string,
  publisherId: string,
  motivo: string,
): Promise<ResultadoRotaDia> {
  const { rows } = await obterPool().query<{ id: string }>(
    `UPDATE daily_routes
        SET status = 'cancelada',
            cancel_reason = $3,
            cancelled_by_id = $2,
            ended_at = now(),
            updated_at = now()
      WHERE id = $1 AND publisher_id = $2
        AND status IN ('rascunho', 'publicada', 'contratada', 'em_andamento')
      RETURNING id`,
    [id, publisherId, motivo],
  )
  if (rows[0]) {
    const rota = await buscarRotaDia(id)
    return { ok: true, rota: rota! }
  }
  return classificarFalhaRotaDia(id, publisherId, null)
}

// Classifica a falha de uma transição já tentada (sem alterar nada).
async function classificarFalhaRotaDia(
  id: string,
  usuarioId: string,
  statusEsperado: StatusRotaDia | null,
): Promise<ResultadoRotaDia> {
  const atual = await buscarRotaDia(id)
  if (!atual) return { ok: false, motivo: 'nao_encontrada' }
  const dono = atual.publisher_id === usuarioId || atual.contracted_courier_id === usuarioId
  if (!dono) return { ok: false, motivo: 'nao_permitido' }
  if (statusEsperado && atual.status !== statusEsperado) {
    if (atual.status === 'contratada' || atual.status === 'em_andamento') {
      return { ok: false, motivo: 'ja_contratada' }
    }
    return { ok: false, motivo: 'estado_invalido' }
  }
  return { ok: false, motivo: 'estado_invalido' }
}

// Hoje no formato 'YYYY-MM-DD' (horário do servidor).
function hojeIso(): string {
  const agora = new Date()
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  return `${agora.getFullYear()}-${mes}-${dia}`
}

// Listagem do administrador (com filtros opcionais).
export interface FiltrosRotasDia {
  status: string | null
  data: string | null
  publicador: string | null
  motoboy: string | null
}

export async function listarRotasDiaAdmin(
  filtros: FiltrosRotasDia,
  limite: number,
  deslocamento: number,
): Promise<{ itens: RotaDiaBanco[]; total: number }> {
  const condicoes: string[] = []
  const valores: unknown[] = []

  if (filtros.status) {
    valores.push(filtros.status)
    condicoes.push(`r.status = $${valores.length}`)
  }
  if (filtros.data) {
    valores.push(filtros.data)
    condicoes.push(`r.service_date = $${valores.length}::date`)
  }
  if (filtros.publicador) {
    valores.push(filtros.publicador)
    condicoes.push(`r.publisher_id = $${valores.length}::uuid`)
  }
  if (filtros.motoboy) {
    valores.push(filtros.motoboy)
    condicoes.push(`r.contracted_courier_id = $${valores.length}::uuid`)
  }

  const onde = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : ''
  const pool = obterPool()
  const total = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM daily_routes r ${onde}`,
    valores,
  )
  const itens = await pool.query<RotaDiaBanco>(
    `SELECT ${COLUNAS} ${FROM} ${onde}
      ORDER BY r.service_date DESC, r.created_at DESC
      LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
    [...valores, limite, deslocamento],
  )
  return { itens: itens.rows, total: Number(total.rows[0]?.total ?? 0) }
}
