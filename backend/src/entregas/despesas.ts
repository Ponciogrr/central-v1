// Acesso à tabela `courier_expenses` e cálculo do resumo financeiro do motoboy.
//
// Contabilidade PESSOAL e opcional: cada despesa pertence a UM motoboy e só ele
// pode ver/editar/excluir. Identidade vem SEMPRE do middleware, nunca do app.
//
// O resumo financeiro usa SOMENTE entregas `entregue` do próprio motoboy
// (courier_id). Canceladas, pendentes, recusadas e em andamento são excluídas.
// O valor (deliveries.amount) é o valor combinado registrado entre solicitante e
// motoboy (regra 7) — NÃO é lucro líquido nem ganho confirmado pela plataforma.
//
// Consultas SEMPRE parametrizadas ($1, $2, ...).

import { obterPool } from '../db/pool.ts'
import type { CategoriaDespesa } from '../types/despesa.ts'

export interface DespesaBanco {
  id: string
  courier_id: string
  category: CategoriaDespesa
  amount: string
  expense_date: Date | string
  notes: string | null
  created_at: Date
  updated_at: Date
}

const COLUNAS = `id, courier_id, category, amount, expense_date, notes, created_at, updated_at`

// Formata a data (date) como 'AAAA-MM-DD' sem sofrer com fuso horário.
// O driver devolve `date` como string 'AAAA-MM-DD' (padrão do pg para DATE).
export function despesaParaApi(d: DespesaBanco) {
  return {
    id: d.id,
    categoria: d.category,
    valor: Number(d.amount),
    data: typeof d.expense_date === 'string' ? d.expense_date : formatarData(d.expense_date),
    observacao: d.notes,
    criadaEm: d.created_at,
    atualizadaEm: d.updated_at,
  }
}

function formatarData(data: Date): string {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

export interface DadosDespesa {
  courierId: string
  categoria: CategoriaDespesa
  valor: string
  data: string
  observacao: string | null
}

export async function criarDespesa(dados: DadosDespesa): Promise<DespesaBanco> {
  const { rows } = await obterPool().query<DespesaBanco>(
    `INSERT INTO courier_expenses (courier_id, category, amount, expense_date, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${COLUNAS}`,
    [dados.courierId, dados.categoria, dados.valor, dados.data, dados.observacao],
  )
  return rows[0]
}

// Despesas do próprio motoboy, da mais recente para a mais antiga.
export async function listarDespesas(courierId: string): Promise<DespesaBanco[]> {
  const { rows } = await obterPool().query<DespesaBanco>(
    `SELECT ${COLUNAS} FROM courier_expenses
      WHERE courier_id = $1
      ORDER BY expense_date DESC, created_at DESC, id`,
    [courierId],
  )
  return rows
}

export async function buscarDespesa(id: string): Promise<DespesaBanco | null> {
  const { rows } = await obterPool().query<DespesaBanco>(
    `SELECT ${COLUNAS} FROM courier_expenses WHERE id = $1 LIMIT 1`,
    [id],
  )
  return rows[0] ?? null
}

export type FalhaDespesa = 'nao_encontrada' | 'nao_permitido'

export type ResultadoDespesa =
  | { ok: true; despesa: DespesaBanco }
  | { ok: false; motivo: FalhaDespesa }

export interface AtualizacaoDespesa {
  categoria: CategoriaDespesa
  valor: string
  data: string
  observacao: string | null
}

// Atualiza uma despesa do próprio motoboy. A linha é travada (FOR UPDATE) para
// não competir com uma exclusão simultânea. Outro motoboy recebe 'nao_permitido'.
export async function atualizarDespesa(
  id: string,
  courierId: string,
  dados: AtualizacaoDespesa,
): Promise<ResultadoDespesa> {
  const cliente = await obterPool().connect()
  try {
    await cliente.query('BEGIN')
    const { rows } = await cliente.query<{ courier_id: string }>(
      'SELECT courier_id FROM courier_expenses WHERE id = $1 FOR UPDATE',
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

    const atualizada = await cliente.query<DespesaBanco>(
      `UPDATE courier_expenses
          SET category = $2, amount = $3, expense_date = $4, notes = $5, updated_at = now()
        WHERE id = $1
        RETURNING ${COLUNAS}`,
      [id, dados.categoria, dados.valor, dados.data, dados.observacao],
    )
    await cliente.query('COMMIT')
    return { ok: true, despesa: atualizada.rows[0] }
  } catch (erro) {
    await cliente.query('ROLLBACK')
    throw erro
  } finally {
    cliente.release()
  }
}

// Exclui uma despesa do próprio motoboy. Mesma disciplina de posse.
export async function excluirDespesa(
  id: string,
  courierId: string,
): Promise<{ ok: true } | { ok: false; motivo: FalhaDespesa }> {
  const cliente = await obterPool().connect()
  try {
    await cliente.query('BEGIN')
    const { rows } = await cliente.query<{ courier_id: string }>(
      'SELECT courier_id FROM courier_expenses WHERE id = $1 FOR UPDATE',
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
    await cliente.query('DELETE FROM courier_expenses WHERE id = $1', [id])
    await cliente.query('COMMIT')
    return { ok: true }
  } catch (erro) {
    await cliente.query('ROLLBACK')
    throw erro
  } finally {
    cliente.release()
  }
}

// ---------------------------------------------------------------------------
// Resumo financeiro (contabilidade das ENTREGAS concluídas + despesas)
// ---------------------------------------------------------------------------

export interface ResumoDiario {
  data: string // 'AAAA-MM-DD' (dia local de conclusão)
  valor: number
  quantidade: number
}

export interface ResumoFinanceiro {
  totalEntregas: number
  quantidadeEntregas: number
  totalDespesas: number
  quantidadeDespesas: number
  saldoEstimado: number
  porDia: ResumoDiario[]
}

function formatarDia(v: Date | string): string {
  if (typeof v === 'string') return v.slice(0, 10)
  const ano = v.getFullYear()
  const mes = String(v.getMonth() + 1).padStart(2, '0')
  const dia = String(v.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

// Cálculo feito no BANCO (fonte de verdade). `inicio`/`fim` são datas inclusivas
// 'AAAA-MM-DD'. `completed_at` é timestamp com fuso; agrupamos pelo dia LOCAL
// usando a data calculada no próprio PostgreSQL (o app passa o período local).
export async function calcularResumoFinanceiro(
  courierId: string,
  inicio: string,
  fim: string,
): Promise<ResumoFinanceiro> {
  const pool = obterPool()

  // Entregas concluídas: somente status 'entregue' e do próprio motoboy.
  const entregas = await pool.query<{ dia: string; total: string; quantidade: string }>(
    `SELECT to_char(completed_at::date, 'YYYY-MM-DD') AS dia,
            COALESCE(SUM(amount), 0)::text AS total,
            COUNT(*)::text AS quantidade
       FROM deliveries
      WHERE courier_id = $1
        AND status = 'entregue'
        AND completed_at IS NOT NULL
        AND completed_at::date BETWEEN $2::date AND $3::date
      GROUP BY completed_at::date
      ORDER BY completed_at::date`,
    [courierId, inicio, fim],
  )

  const despesas = await pool.query<{ dia: string; total: string; quantidade: string }>(
    `SELECT to_char(expense_date, 'YYYY-MM-DD') AS dia,
            COALESCE(SUM(amount), 0)::text AS total,
            COUNT(*)::text AS quantidade
       FROM courier_expenses
      WHERE courier_id = $1
        AND expense_date BETWEEN $2::date AND $3::date
      GROUP BY expense_date
      ORDER BY expense_date`,
    [courierId, inicio, fim],
  )

  const porDiaEntregas = new Map<string, ResumoDiario>()
  let totalEntregas = 0
  let quantidadeEntregas = 0
  for (const r of entregas.rows) {
    const valor = Number(r.total)
    const quantidade = Number(r.quantidade)
    totalEntregas += valor
    quantidadeEntregas += quantidade
    porDiaEntregas.set(formatarDia(r.dia), { data: formatarDia(r.dia), valor, quantidade })
  }

  let totalDespesas = 0
  let quantidadeDespesas = 0
  for (const r of despesas.rows) {
    totalDespesas += Number(r.total)
    quantidadeDespesas += Number(r.quantidade)
  }

  const porDia = [...porDiaEntregas.values()].sort((a, b) => a.data.localeCompare(b.data))

  return {
    totalEntregas: arredondar(totalEntregas),
    quantidadeEntregas,
    totalDespesas: arredondar(totalDespesas),
    quantidadeDespesas,
    saldoEstimado: arredondar(totalEntregas - totalDespesas),
    porDia,
  }
}

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100
}
