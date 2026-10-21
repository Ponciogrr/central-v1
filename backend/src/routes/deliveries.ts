import { Router } from 'express'
import {
  buscarEntrega,
  cancelarEntrega,
  criarEntrega,
  entregaParaApi as paraApi,
  listarEntregas,
  type EntregaBanco,
} from '../entregas/entregas.ts'
import {
  expirarOfertasPendentesDaEntrega,
  ofertarProximoElegivel,
} from '../entregas/ofertas.ts'
import { ErroHttp } from '../erros.ts'
import { exigirAutenticacao, exigirPapel } from '../middleware/autenticacao.ts'
import type { UsuarioAutenticado } from '../types/usuario.ts'
import { ehUuid, inteiroLimitado, limparTexto, validarTamanho } from '../utils/validacao.ts'

export const rotasEntregas = Router()

// A proteção é aplicada ROTA A ROTA (sem `use` global): um `use` sem caminho
// rodaria para qualquer requisição não respondida antes no agrupador (quirk
// registrado em "Erros conhecidos" do PROJECT_STATUS). A identidade/papel vêm
// do servidor (req.usuario), NUNCA do corpo enviado pelo aplicativo.
const sessao = exigirAutenticacao

// Somente Lojista e Pessoa Física criam solicitações nesta etapa.
const PERFIS_SOLICITANTES = ['lojista', 'pessoa_fisica'] as const

// Aceita número ou texto ("12,50"); devolve o valor em decimal(10,2) ou null.
// Vazio/ausente = valor combinado não informado (regra 7: o app só registra).
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

function exigirId(valor: unknown): string {
  if (!ehUuid(valor)) throw new ErroHttp(400, 'ID_INVALIDO', 'Identificador inválido.')
  return valor
}

function podeConsultar(e: EntregaBanco, usuario: UsuarioAutenticado): boolean {
  if (usuario.papel === 'admin') return true
  return e.requester_id === usuario.id || e.courier_id === usuario.id
}

// POST /deliveries — criar solicitação (lojista/pessoa_fisica).
rotasEntregas.post('/deliveries', sessao, exigirPapel(...PERFIS_SOLICITANTES), async (req, res) => {
  const corpo = (req.body ?? {}) as Record<string, unknown>

  const coleta = limparTexto(corpo.coleta)
  const destino = limparTexto(corpo.destino)
  const observacoes = limparTexto(corpo.observacoes)

  if (!coleta) throw new ErroHttp(400, 'DADOS_INVALIDOS', 'Informe o endereço de coleta.')
  if (!destino) throw new ErroHttp(400, 'DADOS_INVALIDOS', 'Informe o endereço de entrega.')

  const erroColeta = validarTamanho(coleta, 200, 'coleta')
  if (erroColeta) throw new ErroHttp(400, 'DADOS_INVALIDOS', erroColeta)
  const erroDestino = validarTamanho(destino, 200, 'destino')
  if (erroDestino) throw new ErroHttp(400, 'DADOS_INVALIDOS', erroDestino)
  const erroObs = validarTamanho(observacoes, 500, 'observações')
  if (erroObs) throw new ErroHttp(400, 'DADOS_INVALIDOS', erroObs)

  const valor = valorMonetario(corpo.valor)
  if (!valor.ok) {
    throw new ErroHttp(400, 'DADOS_INVALIDOS', 'Valor inválido. Use um número, por exemplo 12,50.')
  }

  // O endereço textual é obrigatório; não há coordenadas no MVP.
  const criada = await criarEntrega({
    solicitanteId: req.usuario!.id,
    coleta,
    destino,
    valor: valor.valor,
    observacoes,
  })

  // M4.3: tenta oferecer a entrega a um motoboy elegível imediatamente.
  // É melhor-esforço: a entrega já está criada e nunca falha por causa disso.
  try {
    await ofertarProximoElegivel(criada.id)
  } catch (erro) {
    console.error('[oferta]', erro instanceof Error ? erro.message : erro)
  }

  res.status(201).json({ entrega: paraApi(criada) })
})

// GET /deliveries — lista somente o que o usuário pode consultar:
//  lojista/pessoa_fisica → as que solicitou; motoboy → as que aceitou; admin → todas.
rotasEntregas.get('/deliveries', sessao, async (req, res) => {
  const usuario = req.usuario!
  const limite = inteiroLimitado(req.query.limite, 20, 1, 100)
  const deslocamento = inteiroLimitado(req.query.deslocamento, 0, 0, 1_000_000)

  const filtro =
    usuario.papel === 'motoboy'
      ? { entregadorId: usuario.id, limite, deslocamento }
      : usuario.papel === 'admin'
        ? { limite, deslocamento }
        : { solicitanteId: usuario.id, limite, deslocamento }

  const { itens, total } = await listarEntregas(filtro)
  res.json({ entregas: itens.map(paraApi), total, limite, deslocamento })
})

// GET /deliveries/:id — consulta autorizada (dono, motoboy designado ou admin).
rotasEntregas.get('/deliveries/:id', sessao, async (req, res) => {
  const id = exigirId(req.params.id)
  const entrega = await buscarEntrega(id)
  if (!entrega || !podeConsultar(entrega, req.usuario!)) {
    throw new ErroHttp(404, 'ENTREGA_NAO_ENCONTRADA', 'Entrega não encontrada.')
  }
  res.json({ entrega: paraApi(entrega) })
})

// POST /deliveries/:id/cancel — cancelar solicitação (regras 5 e 6).
rotasEntregas.post(
  '/deliveries/:id/cancel',
  sessao,
  exigirPapel(...PERFIS_SOLICITANTES),
  async (req, res) => {
    const id = exigirId(req.params.id)
    const corpo = (req.body ?? {}) as Record<string, unknown>
    const motivo = limparTexto(corpo.motivo)
    const erroMotivo = validarTamanho(motivo, 300, 'motivo')
    if (erroMotivo) throw new ErroHttp(400, 'DADOS_INVALIDOS', erroMotivo)

    const resultado = await cancelarEntrega(id, req.usuario!.id, motivo)
    if (!resultado.ok) {
      if (resultado.motivo === 'nao_encontrada' || resultado.motivo === 'nao_permitido') {
        throw new ErroHttp(404, 'ENTREGA_NAO_ENCONTRADA', 'Entrega não encontrada.')
      }
      if (resultado.motivo === 'ja_cancelada') {
        throw new ErroHttp(409, 'JA_CANCELADA', 'Esta entrega já foi cancelada.')
      }
      if (resultado.motivo === 'nao_cancelavel') {
        throw new ErroHttp(409, 'NAO_CANCELAVEL', 'Entregas finalizadas não podem ser canceladas.')
      }
      throw new ErroHttp(
        400,
        'MOTIVO_OBRIGATORIO',
        'Depois da aceitação, é necessário informar o motivo do cancelamento.',
      )
    }

    // M4.3: sem oferta pendente sobrando quando a entrega é cancelada.
    try {
      await expirarOfertasPendentesDaEntrega(id)
    } catch (erro) {
      console.error('[oferta]', erro instanceof Error ? erro.message : erro)
    }

    res.json({ entrega: paraApi(resultado.entrega) })
  },
)
