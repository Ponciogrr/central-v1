import { Router } from 'express'
import {
  atualizarRota,
  criarRota,
  encerrarRota,
  listarRotasDisponiveis,
  listarRotasDoMotoboy,
  rotaParaApi,
} from '../rotas/rotas.ts'
import {
  aceitarContraproposta,
  cancelarEncaixePeloSolicitante,
  contraproporEncaixe,
  criarEncaixe,
  encaixeParaMotoboy,
  encaixeParaSolicitante,
  listarEncaixesRecebidos,
  listarEncaixesDoSolicitante,
  recusarContraproposta,
  responderEncaixe,
} from '../rotas/encaixes.ts'
import { ErroHttp } from '../erros.ts'
import { exigirAutenticacao, exigirPapel } from '../middleware/autenticacao.ts'
import { ehUuid, limparTexto, validarTamanho } from '../utils/validacao.ts'

export const rotasRotas = Router()

// A proteção é aplicada ROTA A ROTA (sem `use` global neste router): um `use`
// sem caminho rodaria para QUALQUER requisição não respondida antes no
// agrupador (mesma classe do bug corrigido no contabilidade — DECISIONS #53),
// fazendo rotas inexistentes responderem 401. Identidade/papel vêm SEMPRE do
// servidor. Este router é montado por último (após o admin) em index.ts.
const sessao = exigirAutenticacao

const PERFIS_SOLICITANTES = ['lojista', 'pessoa_fisica'] as const

function exigirId(valor: unknown): string {
  if (!ehUuid(valor)) throw new ErroHttp(400, 'ID_INVALIDO', 'Identificador inválido.')
  return valor
}

// Valor monetário OPCIONAL (mesma regra das entregas: o app só registra).
function valorMonetario(
  bruto: unknown,
): { ok: true; valor: string | null } | { ok: false } {
  if (bruto === undefined || bruto === null || bruto === '') return { ok: true, valor: null }
  const numero =
    typeof bruto === 'number'
      ? bruto
      : typeof bruto === 'string'
        ? Number(bruto.replace(',', '.'))
        : Number.NaN
  if (!Number.isFinite(numero) || numero < 0 || numero > 99_999_999.99) return { ok: false }
  return { ok: true, valor: numero.toFixed(2) }
}

// Valor de NEGOCIAÇÃO (proposta do cliente ou contraproposta do motoboy):
// obrigatório e maior que zero. Sem regra de preço mínimo por quilômetro.
function valorProposta(bruto: unknown): string {
  const resultado = valorMonetario(bruto)
  if (!resultado.ok || resultado.valor === null || Number(resultado.valor) <= 0) {
    throw new ErroHttp(
      400,
      'VALOR_INVALIDO',
      'Informe o valor da proposta, por exemplo 25,00.',
    )
  }
  return resultado.valor
}

// Lê o corpo de criação/edição de rota com validação (destino obrigatório;
// demais campos opcionais, texto livre — as regras 10–20 não fixam formato).
// A rota NÃO recebe valor de encaixe: o valor nasce do pedido do solicitante.
function lerDadosRota(bruto: Record<string, unknown>, exigirAceita: boolean) {
  const destino = limparTexto(bruto.destino)
  const saidaPrevista = limparTexto(bruto.saidaPrevista)
  const retornoPrevisto = limparTexto(bruto.retornoPrevisto)
  const extensao = limparTexto(bruto.extensao)

  if (!destino) throw new ErroHttp(400, 'DADOS_INVALIDOS', 'Informe o destino da rota.')
  const erros: Array<string | null> = [
    validarTamanho(destino, 200, 'destino'),
    validarTamanho(saidaPrevista, 100, 'saída prevista'),
    validarTamanho(retornoPrevisto, 100, 'previsão de retorno'),
    validarTamanho(extensao, 100, 'extensão'),
  ]
  const erro = erros.find(Boolean)
  if (erro) throw new ErroHttp(400, 'DADOS_INVALIDOS', erro)

  let aceitaEncaixes = true
  if (exigirAceita || bruto.aceitaEncaixes !== undefined) {
    if (typeof bruto.aceitaEncaixes !== 'boolean') {
      throw new ErroHttp(400, 'DADOS_INVALIDOS', 'Informe "aceitaEncaixes" como verdadeiro ou falso.')
    }
    aceitaEncaixes = bruto.aceitaEncaixes
  }

  return { destino, saidaPrevista, retornoPrevisto, extensao, aceitaEncaixes }
}

// Mapeia falhas de encaixe que são "não encontrado/não permitido" (404 — sem
// vazamento de existência) versus conflito de estado (409).
function erroDeFalhaEncaixe(motivo: string): never {
  if (motivo === 'nao_encontrado' || motivo === 'nao_permitido') {
    throw new ErroHttp(404, 'ENCAIXE_NAO_ENCONTRADO', 'Encaixe não encontrado.')
  }
  throw new ErroHttp(409, 'ESTADO_INVALIDO', 'Este encaixe não está mais em negociação.')
}

// ---------------------------------------------------------------------------
// VISÃO DO SOLICITANTE (lojista / pessoa física) — rotas disponíveis e encaixes
// ---------------------------------------------------------------------------

// GET /routes/available — rotas publicadas que aceitam encaixes (regra 12).
rotasRotas.get(
  '/routes/available',
  sessao,
  exigirPapel(...PERFIS_SOLICITANTES),
  async (_req, res) => {
    const rotas = await listarRotasDisponiveis()
    res.json({ rotas: rotas.map(rotaParaApi) })
  },
)

// POST /fittings — pede um encaixe para uma rota (regra 10). O solicitante
// informa o VALOR que propõe pagar (proposta inicial da negociação).
rotasRotas.post('/fittings', sessao, exigirPapel(...PERFIS_SOLICITANTES), async (req, res) => {
  const corpo = (req.body ?? {}) as Record<string, unknown>
  const routeId = exigirId(corpo.rotaId)
  const coleta = limparTexto(corpo.coleta)
  const destino = limparTexto(corpo.destino)
  const observacoes = limparTexto(corpo.observacoes)
  const valor = valorProposta(corpo.valor)

  if (!coleta) throw new ErroHttp(400, 'DADOS_INVALIDOS', 'Informe o endereço de coleta.')
  if (!destino) throw new ErroHttp(400, 'DADOS_INVALIDOS', 'Informe o endereço de entrega.')
  const erros: Array<string | null> = [
    validarTamanho(coleta, 200, 'coleta'),
    validarTamanho(destino, 200, 'destino'),
    validarTamanho(observacoes, 500, 'observações'),
  ]
  const erro = erros.find(Boolean)
  if (erro) throw new ErroHttp(400, 'DADOS_INVALIDOS', erro)

  const resultado = await criarEncaixe({
    routeId,
    requesterId: req.usuario!.id,
    coleta,
    destino,
    valor,
    observacoes,
  })

  if (!resultado.ok) {
    switch (resultado.motivo) {
      case 'rota_nao_encontrada':
        throw new ErroHttp(404, 'ROTA_NAO_ENCONTRADA', 'Rota não encontrada.')
      case 'rota_indisponivel':
        throw new ErroHttp(409, 'ROTA_INDISPONIVEL', 'Esta rota não está mais aceitando encaixes.')
      case 'ja_pendente':
        throw new ErroHttp(409, 'ENCAIXE_JA_PENDENTE', 'Você já tem um encaixe pendente nesta rota.')
      default:
        throw new ErroHttp(409, 'ENCAIXE_INDISPONIVEL', 'Não foi possível registrar o encaixe.')
    }
  }

  res.status(201).json({
    encaixe: encaixeParaSolicitante(resultado.encaixe, { destination: resultado.destinoRota }),
  })
})

// GET /fittings/mine — encaixes do próprio solicitante (regra 11, privacidade).
rotasRotas.get(
  '/fittings/mine',
  sessao,
  exigirPapel(...PERFIS_SOLICITANTES),
  async (req, res) => {
    const itens = await listarEncaixesDoSolicitante(req.usuario!.id)
    res.json({ encaixes: itens.map(i => encaixeParaSolicitante(i.encaixe, { destination: i.destinoRota ?? '' })) })
  },
)

// POST /fittings/:id/cancel — cancela o encaixe ANTES do aceite (regra 11).
// Também encerra uma contraproposta em aberto do motoboy.
rotasRotas.post(
  '/fittings/:id/cancel',
  sessao,
  exigirPapel(...PERFIS_SOLICITANTES),
  async (req, res) => {
    const id = exigirId(req.params.id)
    const resultado = await cancelarEncaixePeloSolicitante(id, req.usuario!.id)
    if (!resultado.ok) {
      if (resultado.motivo === 'nao_encontrado' || resultado.motivo === 'nao_permitido') {
        throw new ErroHttp(404, 'ENCAIXE_NAO_ENCONTRADO', 'Encaixe não encontrado.')
      }
      throw new ErroHttp(409, 'ESTADO_INVALIDO', 'Este encaixe não pode mais ser cancelado.')
    }
    res.json({ encaixe: encaixeParaSolicitante(resultado.encaixe, null) })
  },
)

// POST /fittings/:id/accept-counter — o cliente ACEITA a contraproposta do
// motoboy → encaixe 'aceito' (valor acordado = contraproposta).
rotasRotas.post(
  '/fittings/:id/accept-counter',
  sessao,
  exigirPapel(...PERFIS_SOLICITANTES),
  async (req, res) => {
    const id = exigirId(req.params.id)
    const resultado = await aceitarContraproposta(id, req.usuario!.id)
    if (!resultado.ok) erroDeFalhaEncaixe(resultado.motivo)
    res.json({ encaixe: encaixeParaSolicitante(resultado.encaixe, null) })
  },
)

// POST /fittings/:id/reject-counter — o cliente RECUSA a contraproposta →
// encaixe 'recusado' (a negociação termina sem acordo).
rotasRotas.post(
  '/fittings/:id/reject-counter',
  sessao,
  exigirPapel(...PERFIS_SOLICITANTES),
  async (req, res) => {
    const id = exigirId(req.params.id)
    const resultado = await recusarContraproposta(id, req.usuario!.id)
    if (!resultado.ok) erroDeFalhaEncaixe(resultado.motivo)
    res.json({ encaixe: encaixeParaSolicitante(resultado.encaixe, null) })
  },
)

// ---------------------------------------------------------------------------
// VISÃO DO MOTOBOY — rotas próprias e encaixes recebidos
// ---------------------------------------------------------------------------

// GET /routes/mine — rotas do motoboy. `apenasPublicadas=true` filtra as ativas.
rotasRotas.get('/routes/mine', sessao, exigirPapel('motoboy'), async (req, res) => {
  const apenasPublicadas = req.query.apenasPublicadas === 'true'
  const rotas = await listarRotasDoMotoboy(req.usuario!.id, apenasPublicadas)
  res.json({ rotas: rotas.map(rotaParaApi) })
})

// POST /routes — publica uma rota (regras 10, 12). Não há valor de encaixe
// aqui: o valor é proposto pelo solicitante em cada pedido (regra 10).
rotasRotas.post('/routes', sessao, exigirPapel('motoboy'), async (req, res) => {
  const corpo = (req.body ?? {}) as Record<string, unknown>
  const dados = lerDadosRota(corpo, true)
  const rota = await criarRota({ courierId: req.usuario!.id, ...dados })
  res.status(201).json({ rota: rotaParaApi(rota) })
})

// PATCH /routes/:id — atualiza uma rota publicada do próprio motoboy.
rotasRotas.patch('/routes/:id', sessao, exigirPapel('motoboy'), async (req, res) => {
  const id = exigirId(req.params.id)
  const corpo = (req.body ?? {}) as Record<string, unknown>
  const dados = lerDadosRota(corpo, false)
  const resultado = await atualizarRota(id, req.usuario!.id, dados)
  if (!resultado.ok) {
    if (resultado.motivo === 'nao_encontrada' || resultado.motivo === 'nao_permitido') {
      throw new ErroHttp(404, 'ROTA_NAO_ENCONTRADA', 'Rota não encontrada.')
    }
    throw new ErroHttp(409, 'ESTADO_INVALIDO', 'Esta rota não pode mais ser alterada.')
  }
  res.json({ rota: rotaParaApi(resultado.rota) })
})

// POST /routes/:id/close — encerra a rota (regra 13). Cancela encaixes pendentes.
rotasRotas.post('/routes/:id/close', sessao, exigirPapel('motoboy'), async (req, res) => {
  const id = exigirId(req.params.id)
  const resultado = await encerrarRota(id, req.usuario!.id, 'encerrada')
  if (!resultado.ok) {
    if (resultado.motivo === 'nao_encontrada' || resultado.motivo === 'nao_permitido') {
      throw new ErroHttp(404, 'ROTA_NAO_ENCONTRADA', 'Rota não encontrada.')
    }
    throw new ErroHttp(409, 'ESTADO_INVALIDO', 'Esta rota já foi encerrada ou cancelada.')
  }
  res.json({ rota: rotaParaApi(resultado.rota) })
})

// POST /routes/:id/cancel — cancela a rota (mesmo efeito sobre os pendentes).
rotasRotas.post('/routes/:id/cancel', sessao, exigirPapel('motoboy'), async (req, res) => {
  const id = exigirId(req.params.id)
  const resultado = await encerrarRota(id, req.usuario!.id, 'cancelada')
  if (!resultado.ok) {
    if (resultado.motivo === 'nao_encontrada' || resultado.motivo === 'nao_permitido') {
      throw new ErroHttp(404, 'ROTA_NAO_ENCONTRADA', 'Rota não encontrada.')
    }
    throw new ErroHttp(409, 'ESTADO_INVALIDO', 'Esta rota já foi encerrada ou cancelada.')
  }
  res.json({ rota: rotaParaApi(resultado.rota) })
})

// GET /fittings/received — encaixes pedidos para as rotas DESTE motoboy.
rotasRotas.get('/fittings/received', sessao, exigirPapel('motoboy'), async (req, res) => {
  const itens = await listarEncaixesRecebidos(req.usuario!.id)
  res.json({ encaixes: itens.map(i => encaixeParaMotoboy(i.encaixe)) })
})

// POST /fittings/:id/accept — aceita o encaixe (só o dono da rota, e apenas
// quando não há contraproposta dele esperando decisão do cliente).
rotasRotas.post('/fittings/:id/accept', sessao, exigirPapel('motoboy'), async (req, res) => {
  const id = exigirId(req.params.id)
  const resultado = await responderEncaixe(id, req.usuario!.id, 'aceito')
  if (!resultado.ok) erroDeFalhaEncaixe(resultado.motivo)
  res.json({ encaixe: encaixeParaMotoboy(resultado.encaixe) })
})

// POST /fittings/:id/decline — recusa o encaixe (só o dono da rota, mesma
// regra de contraproposta em aberto do accept).
rotasRotas.post('/fittings/:id/decline', sessao, exigirPapel('motoboy'), async (req, res) => {
  const id = exigirId(req.params.id)
  const resultado = await responderEncaixe(id, req.usuario!.id, 'recusado')
  if (!resultado.ok) erroDeFalhaEncaixe(resultado.motivo)
  res.json({ encaixe: encaixeParaMotoboy(resultado.encaixe) })
})

// POST /fittings/:id/counter — contraproposta do motoboy: envia outro valor e
// o pedido segue 'pendente', AGORA COM A DECISÃO DO CLIENTE (aceitar/recusar).
rotasRotas.post('/fittings/:id/counter', sessao, exigirPapel('motoboy'), async (req, res) => {
  const id = exigirId(req.params.id)
  const corpo = (req.body ?? {}) as Record<string, unknown>
  const valor = valorProposta(corpo.valor)

  const resultado = await contraproporEncaixe(id, req.usuario!.id, valor)
  if (!resultado.ok) erroDeFalhaEncaixe(resultado.motivo)
  res.json({ encaixe: encaixeParaMotoboy(resultado.encaixe) })
})
