import { Router } from 'express'
import {
  atualizarDespesa,
  calcularResumoFinanceiro,
  criarDespesa,
  despesaParaApi,
  excluirDespesa,
  listarDespesas,
} from '../entregas/despesas.ts'
import { ErroHttp } from '../erros.ts'
import { exigirAutenticacao, exigirPapel } from '../middleware/autenticacao.ts'
import { ehCategoriaDespesa, type CategoriaDespesa } from '../types/despesa.ts'
import { ehUuid, limparTexto, validarTamanho } from '../utils/validacao.ts'

export const rotasContabilidade = Router()

// Contabilidade é pessoal: só o motoboy autenticado acessa a própria.
// A identidade vem SEMPRE de req.usuario (nunca de um id enviado pelo app).
// IMPORTANTE: a proteção é aplicada ROTA A ROTA (e não com `use` global neste
// router) — um `use` global aqui bloquearia TODAS as demais rotas da API
// (/admin/*, /routes/*, ...), porque este router é montado no mesmo agrupador.
const protecaoMotoboy = [exigirAutenticacao, exigirPapel('motoboy')] as const

function exigirId(valor: unknown): string {
  if (!ehUuid(valor)) throw new ErroHttp(400, 'ID_INVALIDO', 'Identificador inválido.')
  return valor
}

// Valor obrigatório da despesa (não pode ser nulo/vazio): decimal(10,2).
function valorObrigatorio(
  bruto: unknown,
): { ok: true; valor: string } | { ok: false } {
  if (bruto === undefined || bruto === null || bruto === '') return { ok: false }
  const numero =
    typeof bruto === 'number'
      ? bruto
      : typeof bruto === 'string'
        ? Number(bruto.replace(',', '.'))
        : Number.NaN
  if (!Number.isFinite(numero) || numero < 0 || numero > 99_999_999.99) return { ok: false }
  return { ok: true, valor: numero.toFixed(2) }
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/

// Data da despesa no formato AAAA-MM-DD. Rejeita datas impossíveis (ex.: 2026-13-40).
function dataValida(valor: unknown): string | null {
  if (typeof valor !== 'string' || !DATA_ISO.test(valor)) return null
  const [ano, mes, dia] = valor.split('-').map(Number)
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  if (
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() !== mes - 1 ||
    data.getUTCDate() !== dia
  ) {
    return null
  }
  return valor
}

function exigirCategoria(valor: unknown): CategoriaDespesa {
  if (!ehCategoriaDespesa(valor)) {
    throw new ErroHttp(
      400,
      'DADOS_INVALIDOS',
      'Categoria inválida. Use gasolina, oleo, manutencao ou outros.',
    )
  }
  return valor
}

// Lê e valida o corpo de criação/edição de despesa.
function lerDadosDespesa(bruto: Record<string, unknown>) {
  const categoria = exigirCategoria(bruto.categoria)

  const valor = valorObrigatorio(bruto.valor)
  if (!valor.ok) {
    throw new ErroHttp(400, 'DADOS_INVALIDOS', 'Valor inválido. Use um número, por exemplo 50,00.')
  }

  const data = dataValida(bruto.data)
  if (!data) {
    throw new ErroHttp(400, 'DADOS_INVALIDOS', 'Data inválida. Use o formato AAAA-MM-DD.')
  }

  const observacao = limparTexto(bruto.observacao)
  const erroObs = validarTamanho(observacao, 300, 'observação')
  if (erroObs) throw new ErroHttp(400, 'DADOS_INVALIDOS', erroObs)

  return { categoria, valor: valor.valor, data, observacao }
}

// ---------------------------------------------------------------------------
// Resumo financeiro
// ---------------------------------------------------------------------------

// GET /courier/financial-summary?inicio=AAAA-MM-DD&fim=AAAA-MM-DD
// Resumo das ENTREGAS concluídas (status 'entregue') + despesas do motoboy.
// Sem período informado, o app envia os últimos 7 dias (calculado no app).
rotasContabilidade.get('/courier/financial-summary', ...protecaoMotoboy, async (req, res) => {
  const inicio = dataValida(req.query.inicio)
  const fim = dataValida(req.query.fim)
  if (!inicio || !fim) {
    throw new ErroHttp(400, 'DADOS_INVALIDOS', 'Período inválido. Use datas AAAA-MM-DD.')
  }
  if (inicio > fim) {
    throw new ErroHttp(400, 'DADOS_INVALIDOS', 'A data inicial deve ser anterior à final.')
  }

  const resumo = await calcularResumoFinanceiro(req.usuario!.id, inicio, fim)
  res.json({ resumo })
})

// ---------------------------------------------------------------------------
// Despesas (opcionais) — CRUD do próprio motoboy
// ---------------------------------------------------------------------------

// GET /courier/expenses — despesas do próprio motoboy.
rotasContabilidade.get('/courier/expenses', ...protecaoMotoboy, async (req, res) => {
  const despesas = await listarDespesas(req.usuario!.id)
  res.json({ despesas: despesas.map(despesaParaApi) })
})

// POST /courier/expenses — registra uma despesa.
rotasContabilidade.post('/courier/expenses', ...protecaoMotoboy, async (req, res) => {
  const corpo = (req.body ?? {}) as Record<string, unknown>
  const dados = lerDadosDespesa(corpo)
  const despesa = await criarDespesa({ courierId: req.usuario!.id, ...dados })
  res.status(201).json({ despesa: despesaParaApi(despesa) })
})

// PATCH /courier/expenses/:id — edita uma despesa do próprio motoboy.
rotasContabilidade.patch('/courier/expenses/:id', ...protecaoMotoboy, async (req, res) => {
  const id = exigirId(req.params.id)
  const corpo = (req.body ?? {}) as Record<string, unknown>
  const dados = lerDadosDespesa(corpo)
  const resultado = await atualizarDespesa(id, req.usuario!.id, dados)
  if (!resultado.ok) {
    throw new ErroHttp(404, 'DESPESA_NAO_ENCONTRADA', 'Despesa não encontrada.')
  }
  res.json({ despesa: despesaParaApi(resultado.despesa) })
})

// DELETE /courier/expenses/:id — exclui uma despesa do próprio motoboy.
rotasContabilidade.delete('/courier/expenses/:id', ...protecaoMotoboy, async (req, res) => {
  const id = exigirId(req.params.id)
  const resultado = await excluirDespesa(id, req.usuario!.id)
  if (!resultado.ok) {
    throw new ErroHttp(404, 'DESPESA_NAO_ENCONTRADA', 'Despesa não encontrada.')
  }
  res.json({ ok: true })
})
