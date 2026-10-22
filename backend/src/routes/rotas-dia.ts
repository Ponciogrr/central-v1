import { Router } from 'express'
import { ErroHttp } from '../erros.ts'
import { exigirAutenticacao, exigirPapel } from '../middleware/autenticacao.ts'
import {
  aceitarRotaDia,
  cancelarRotaDia,
  concluirRotaDia,
  criarRotaDia,
  iniciarRotaDia,
  listarRotasDiaContratadas,
  listarRotasDiaDisponiveis,
  listarRotasDiaDoPublicador,
  publicarRotaDia,
  rotaDiaParaApi,
  type FalhaRotaDia,
} from '../rotas/rotas-dia.ts'
import { ehUuid, limparTexto, validarTamanho } from '../utils/validacao.ts'

export const rotasRotasDia = Router()

// Proteção ROTA A ROTA (mesmo padrão dos demais routers): o papel vem do
// token validado no servidor, nunca do corpo da requisição.
const sessao = exigirAutenticacao

const PERFIS_SOLICITANTES = ['lojista', 'pessoa_fisica'] as const

function exigirId(valor: unknown): string {
  if (!ehUuid(valor)) throw new ErroHttp(400, 'ID_INVALIDO', 'Identificador inválido.')
  return valor
}

// Data no formato 'YYYY-MM-DD' (a API não aceita 'hoje'/'amanhã' em texto).
function dataValida(bruto: unknown): string {
  const texto = typeof bruto === 'string' ? bruto.trim() : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    throw new ErroHttp(400, 'DATA_INVALIDA', 'Informe a data do serviço no formato AAAA-MM-DD.')
  }
  const [ano, mes, dia] = texto.split('-').map(Number)
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  if (
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() !== mes - 1 ||
    data.getUTCDate() !== dia
  ) {
    throw new ErroHttp(400, 'DATA_INVALIDA', 'Data inválida.')
  }
  return texto
}

// Valor monetário OPCIONAL (mesma regra das entregas: o app só registra).
function valorOpcional(bruto: unknown): string | null {
  if (bruto === undefined || bruto === null || bruto === '') return null
  const numero =
    typeof bruto === 'number'
      ? bruto
      : typeof bruto === 'string'
        ? Number(bruto.replace(',', '.'))
        : Number.NaN
  if (!Number.isFinite(numero) || numero < 0 || numero > 99_999_999.99) {
    throw new ErroHttp(400, 'VALOR_INVALIDO', 'Informe um valor válido, por exemplo 25,00.')
  }
  return numero.toFixed(2)
}

// Traduz a falha da camada de dados em resposta HTTP coerente.
function erroDaRota(motivo: FalhaRotaDia): never {
  if (motivo === 'nao_encontrada' || motivo === 'nao_permitido') {
    throw new ErroHttp(404, 'ROTA_NAO_ENCONTRADA', 'Rota do dia não encontrada.')
  }
  if (motivo === 'ja_contratada') {
    throw new ErroHttp(409, 'ROTA_JA_CONTRATADA', 'Esta rota do dia já foi contratada.')
  }
  throw new ErroHttp(409, 'ESTADO_INVALIDO', 'Esta rota do dia não está mais disponível.')
}

// ---------------------------------------------------------------------------
// SOLICITANTE (lojista / pessoa física) — publica e acompanha
// ---------------------------------------------------------------------------

// GET /daily-routes/published — rotas publicadas por mim (qualquer estado).
rotasRotasDia.get(
  '/daily-routes/published',
  sessao,
  exigirPapel(...PERFIS_SOLICITANTES),
  async (req, res) => {
    const rotas = await listarRotasDiaDoPublicador(req.usuario!.id)
    res.json({ rotas: rotas.map(r => rotaDiaParaApi(r)) })
  },
)

// POST /daily-routes — cria uma rota do dia. `publicar: false` guarda um
// rascunho (o solicitante publica depois, quando quiser).
rotasRotasDia.post(
  '/daily-routes',
  sessao,
  exigirPapel(...PERFIS_SOLICITANTES),
  async (req, res) => {
    const corpo = (req.body ?? {}) as Record<string, unknown>

    const titulo = limparTexto(corpo.titulo)
    const origem = limparTexto(corpo.origem)
    const destino = limparTexto(corpo.destino)
    const saida = limparTexto(corpo.saida)
    const paradas = limparTexto(corpo.paradas)
    const descricao = limparTexto(corpo.descricao)

    if (!titulo) throw new ErroHttp(400, 'DADOS_INVALIDOS', 'Informe um título para a rota.')
    if (!origem) throw new ErroHttp(400, 'DADOS_INVALIDOS', 'Informe o ponto de origem.')
    if (!destino) throw new ErroHttp(400, 'DADOS_INVALIDOS', 'Informe o destino.')

    const erros: Array<string | null> = [
      validarTamanho(titulo, 120, 'título'),
      validarTamanho(origem, 200, 'origem'),
      validarTamanho(destino, 200, 'destino'),
      validarTamanho(saida, 100, 'saída'),
      validarTamanho(paradas, 500, 'paradas'),
      validarTamanho(descricao, 1000, 'descrição'),
    ]
    const erro = erros.find(Boolean)
    if (erro) throw new ErroHttp(400, 'DADOS_INVALIDOS', erro)

    const publicar = corpo.publicar !== false
    const rota = await criarRotaDia({
      publisherId: req.usuario!.id,
      titulo,
      origem,
      destino,
      data: dataValida(corpo.data),
      saida: saida || null,
      paradas: paradas || null,
      descricao: descricao || null,
      valor: valorOpcional(corpo.valor),
      publicar,
    })

    res.status(201).json({ rota: rotaDiaParaApi(rota) })
  },
)

// POST /daily-routes/:id/publish — publica um rascunho.
rotasRotasDia.post(
  '/daily-routes/:id/publish',
  sessao,
  exigirPapel(...PERFIS_SOLICITANTES),
  async (req, res) => {
    const id = exigirId(req.params.id)
    const resultado = await publicarRotaDia(id, req.usuario!.id)
    if (!resultado.ok) erroDaRota(resultado.motivo)
    res.json({ rota: rotaDiaParaApi(resultado.rota) })
  },
)

// POST /daily-routes/:id/cancel — cancela a rota (motivo obrigatório para
// guardar o histórico). Rota já contratada é cancelada também, e o motoboy
// vê o cancelamento.
rotasRotasDia.post(
  '/daily-routes/:id/cancel',
  sessao,
  exigirPapel(...PERFIS_SOLICITANTES),
  async (req, res) => {
    const id = exigirId(req.params.id)
    const corpo = (req.body ?? {}) as Record<string, unknown>
    const motivo = limparTexto(corpo.motivo)
    if (!motivo) {
      throw new ErroHttp(400, 'DADOS_INVALIDOS', 'Informe o motivo do cancelamento.')
    }
    const erroMotivo = validarTamanho(motivo, 300, 'motivo')
    if (erroMotivo) throw new ErroHttp(400, 'DADOS_INVALIDOS', erroMotivo)

    const resultado = await cancelarRotaDia(id, req.usuario!.id, motivo)
    if (!resultado.ok) erroDaRota(resultado.motivo)
    res.json({ rota: rotaDiaParaApi(resultado.rota) })
  },
)

// ---------------------------------------------------------------------------
// MOTOBOY — descobre, aceita e executa
// ---------------------------------------------------------------------------

// GET /daily-routes/available — rotas abertas (publicadas, de hoje em diante).
rotasRotasDia.get(
  '/daily-routes/available',
  sessao,
  exigirPapel('motoboy'),
  async (req, res) => {
    const rotas = await listarRotasDiaDisponiveis(req.usuario!.id)
    res.json({ rotas: rotas.map(r => rotaDiaParaApi(r)) })
  },
)

// GET /daily-routes/mine — as rotas que EU contratei (área de trabalho).
rotasRotasDia.get(
  '/daily-routes/mine',
  sessao,
  exigirPapel('motoboy'),
  async (req, res) => {
    const rotas = await listarRotasDiaContratadas(req.usuario!.id)
    res.json({
      rotas: rotas.map(r => rotaDiaParaApi(r, { mostrarContato: r.status !== 'cancelada' })),
    })
  },
)

// POST /daily-routes/:id/accept — aceita a rota. `valorProposto` permite
// fechar em outro valor (contraproposta) — o valor acordado passa a ser este.
rotasRotasDia.post(
  '/daily-routes/:id/accept',
  sessao,
  exigirPapel('motoboy'),
  async (req, res) => {
    const id = exigirId(req.params.id)
    const corpo = (req.body ?? {}) as Record<string, unknown>
    const valorProposto = valorOpcional(corpo.valorProposto)

    const resultado = await aceitarRotaDia(id, req.usuario!.id, valorProposto)
    if (!resultado.ok) erroDaRota(resultado.motivo)
    res.json({ rota: rotaDiaParaApi(resultado.rota, { mostrarContato: true }) })
  },
)

// POST /daily-routes/:id/start — inicia o serviço.
rotasRotasDia.post(
  '/daily-routes/:id/start',
  sessao,
  exigirPapel('motoboy'),
  async (req, res) => {
    const id = exigirId(req.params.id)
    const resultado = await iniciarRotaDia(id, req.usuario!.id)
    if (!resultado.ok) erroDaRota(resultado.motivo)
    res.json({ rota: rotaDiaParaApi(resultado.rota, { mostrarContato: true }) })
  },
)

// POST /daily-routes/:id/complete — conclui o serviço (valor final opcional).
rotasRotasDia.post(
  '/daily-routes/:id/complete',
  sessao,
  exigirPapel('motoboy'),
  async (req, res) => {
    const id = exigirId(req.params.id)
    const corpo = (req.body ?? {}) as Record<string, unknown>
    const valorFinal = valorOpcional(corpo.valorFinal)

    const resultado = await concluirRotaDia(id, req.usuario!.id, valorFinal)
    if (!resultado.ok) erroDaRota(resultado.motivo)
    res.json({ rota: rotaDiaParaApi(resultado.rota, { mostrarContato: true }) })
  },
)
