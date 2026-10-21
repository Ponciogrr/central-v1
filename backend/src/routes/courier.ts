import { Router } from 'express'
import {
  entregaParaApi,
  buscarEntregaAtiva,
  cancelarEntregaPeloMotoboy,
  finalizarEntrega,
  iniciarEntrega,
} from '../entregas/entregas.ts'
import {
  buscarDisponibilidade,
  contarMotoboysOnline,
  definirDisponibilidade,
  marcarAtividade,
} from '../entregas/disponibilidade.ts'
import {
  aceitarOferta,
  expirarOfertasPendentesDoMotoboy,
  listarOfertasPendentes,
  ofertarProximoElegivel,
  processarOfertas,
  recusarOferta,
} from '../entregas/ofertas.ts'
import { ErroHttp } from '../erros.ts'
import { exigirAutenticacao, exigirPapel } from '../middleware/autenticacao.ts'
import { cancelarRotasPublicadasDoMotoboy } from '../rotas/rotas.ts'
import { ehUuid, limparTexto, validarTamanho } from '../utils/validacao.ts'

export const rotasMotoboy = Router()

// A proteção é aplicada ROTA A ROTA (sem `use` global neste router): um `use`
// sem caminho rodaria para QUALQUER requisição que caísse no agrupador (mesma
// classe do bug corrigido no contabilidade — DECISIONS #53), fazendo rotas
// inexistentes responderem 401. A identidade vem SEMPRE de req.usuario (o
// servidor decide quem é o motoboy) — nunca de um ID enviado pelo app.
const sessao = exigirAutenticacao

function exigirId(valor: unknown): string {
  if (!ehUuid(valor)) throw new ErroHttp(400, 'ID_INVALIDO', 'Identificador inválido.')
  return valor
}

// GET /motoboys/online-count — quantidade de motoboys disponíveis agora.
// Somente lojista e pessoa física (regras 40–43): expõe apenas a QUANTIDADE,
// nunca dados pessoais dos motoboys.
rotasMotoboy.get(
  '/motoboys/online-count',
  sessao,
  exigirPapel('lojista', 'pessoa_fisica'),
  async (_req, res) => {
    res.json({ online: await contarMotoboysOnline() })
  },
)

// A partir daqui, somente contas de motoboy.
const somenteMotoboy = exigirPapel('motoboy')

// GET /courier/painel — estado do painel do entregador: disponibilidade,
// ofertas pendentes e a entrega ativa. Registra a atividade (sinal de "vivo")
// e faz a manutenção preguiçosa das ofertas (expira vencidas e distribui as
// entregas que aguardam).
rotasMotoboy.get('/courier/painel', sessao, somenteMotoboy, async (req, res) => {
  const motoboyId = req.usuario!.id

  await marcarAtividade(motoboyId)
  await processarOfertas()

  const { online } = await buscarDisponibilidade(motoboyId)
  const [ofertas, entregaAtiva] = await Promise.all([
    online ? listarOfertasPendentes(motoboyId) : Promise.resolve([]),
    buscarEntregaAtiva(motoboyId),
  ])

  res.json({
    online,
    ofertas,
    entregaAtiva: entregaAtiva ? entregaParaApi(entregaAtiva) : null,
  })
})

// POST /courier/availability — entra ou sai de serviço (online/offline).
// Só contas de motoboy ativas chegam aqui (o middleware recusa conta desativada).
rotasMotoboy.post('/courier/availability', sessao, somenteMotoboy, async (req, res) => {
  const corpo = (req.body ?? {}) as Record<string, unknown>
  if (typeof corpo.online !== 'boolean') {
    throw new ErroHttp(400, 'DADOS_INVALIDOS', 'Informe "online" como verdadeiro ou falso.')
  }

  const motoboyId = req.usuario!.id
  const estado = await definirDisponibilidade(motoboyId, corpo.online)

  if (corpo.online) {
    // Ao ficar online, aproveita para distribuir entregas que aguardavam.
    await processarOfertas()
  } else {
    // Ao ficar offline, libera as ofertas pendentes dele para outro motoboy.
    await expirarOfertasPendentesDoMotoboy(motoboyId)
    // Regra 14: se ficar offline antes de iniciar a rota publicada, cancelar a
    // rota e avisar os solicitantes com encaixes pendentes (eles veem ao focar).
    try {
      await cancelarRotasPublicadasDoMotoboy(motoboyId)
    } catch (erro) {
      console.error('[rotas]', erro instanceof Error ? erro.message : erro)
    }
  }

  res.json({ online: estado.online, ultimaAtividade: estado.ultimaAtividade })
})

// POST /courier/offers/:id/accept — aceita uma oferta recebida.
rotasMotoboy.post('/courier/offers/:id/accept', sessao, somenteMotoboy, async (req, res) => {
  const id = exigirId(req.params.id)
  const resultado = await aceitarOferta(id, req.usuario!.id)

  if (!resultado.ok) {
    switch (resultado.motivo) {
      case 'nao_encontrada':
        throw new ErroHttp(404, 'OFERTA_NAO_ENCONTRADA', 'Oferta não encontrada.')
      case 'expirada':
        throw new ErroHttp(409, 'OFERTA_EXPIRADA', 'Esta oferta expirou.')
      case 'ocupado':
        throw new ErroHttp(409, 'JA_OCUPADO', 'Você já tem uma entrega em andamento.')
      case 'entrega_indisponivel':
        throw new ErroHttp(409, 'ENTREGA_INDISPONIVEL', 'Esta entrega não está mais disponível.')
      default:
        throw new ErroHttp(409, 'OFERTA_INDISPONIVEL', 'Esta oferta não está mais disponível.')
    }
  }

  res.json({ entrega: entregaParaApi(resultado.entrega) })
})

// POST /courier/deliveries/:id/start — inicia a rota de uma entrega aceita.
// Somente o motoboy atribuído (courier_id) pode iniciar; identidade do token.
rotasMotoboy.post('/courier/deliveries/:id/start', sessao, somenteMotoboy, async (req, res) => {
  const id = exigirId(req.params.id)
  const resultado = await iniciarEntrega(id, req.usuario!.id)

  if (!resultado.ok) {
    if (resultado.motivo === 'nao_encontrada' || resultado.motivo === 'nao_permitido') {
      throw new ErroHttp(404, 'ENTREGA_NAO_ENCONTRADA', 'Entrega não encontrada.')
    }
    throw new ErroHttp(409, 'ESTADO_INVALIDO', 'Esta entrega não pode ser iniciada agora.')
  }

  res.json({ entrega: entregaParaApi(resultado.entrega) })
})

// POST /courier/deliveries/:id/complete — finaliza a entrega em rota.
rotasMotoboy.post('/courier/deliveries/:id/complete', sessao, somenteMotoboy, async (req, res) => {
  const id = exigirId(req.params.id)
  const resultado = await finalizarEntrega(id, req.usuario!.id)

  if (!resultado.ok) {
    if (resultado.motivo === 'nao_encontrada' || resultado.motivo === 'nao_permitido') {
      throw new ErroHttp(404, 'ENTREGA_NAO_ENCONTRADA', 'Entrega não encontrada.')
    }
    throw new ErroHttp(409, 'ESTADO_INVALIDO', 'Esta entrega não pode ser finalizada agora.')
  }

  res.json({ entrega: entregaParaApi(resultado.entrega) })
})

// POST /courier/deliveries/:id/cancel — cancela a ATRIBUIÇÃO de uma entrega
// aceita/em rota (regra 4 — substituição). Só o motoboy designado (courier_id)
// e com motivo obrigatório. A entrega NÃO vira 'cancelada': ela volta para
// 'aguardando' com a solicitação preservada e é redistribuída (o cancelante
// é bloqueado com uma oferta 'recusada'). O solicitante é "avisado" pelos
// campos aguardandoSubstituto/motivoCancelamentoSubstituto, vistos ao
// recarregar/focar (sem push, conforme escopo).
rotasMotoboy.post('/courier/deliveries/:id/cancel', sessao, somenteMotoboy, async (req, res) => {
  const id = exigirId(req.params.id)
  const corpo = (req.body ?? {}) as Record<string, unknown>
  const motivo = limparTexto(corpo.motivo)
  const erroMotivo = validarTamanho(motivo, 300, 'motivo')
  if (erroMotivo) throw new ErroHttp(400, 'DADOS_INVALIDOS', erroMotivo)

  const resultado = await cancelarEntregaPeloMotoboy(id, req.usuario!.id, motivo)

  if (!resultado.ok) {
    switch (resultado.motivo) {
      case 'nao_encontrada':
      case 'nao_permitido':
        throw new ErroHttp(404, 'ENTREGA_NAO_ENCONTRADA', 'Entrega não encontrada.')
      case 'ja_cancelada':
        throw new ErroHttp(409, 'ESTADO_INVALIDO', 'Esta entrega já foi cancelada.')
      case 'nao_cancelavel':
        throw new ErroHttp(409, 'ESTADO_INVALIDO', 'Esta entrega não pode ser cancelada agora.')
      case 'motivo_obrigatorio':
        throw new ErroHttp(400, 'MOTIVO_OBRIGATORIO', 'Informe o motivo do cancelamento.')
    }
  }

  // Melhor esforço: oferece a entrega a um substituto elegível (regra 4).
  // Sem candidato, a entrega permanece 'aguardando' e será oferecida depois
  // pela manutenção preguiçosa (processarOfertas).
  try {
    await ofertarProximoElegivel(id)
  } catch (erro) {
    console.error('[oferta]', erro instanceof Error ? erro.message : erro)
  }

  res.json({ entrega: entregaParaApi(resultado.entrega) })
})

// POST /courier/offers/:id/decline — recusa uma oferta recebida.
rotasMotoboy.post('/courier/offers/:id/decline', sessao, somenteMotoboy, async (req, res) => {
  const id = exigirId(req.params.id)
  const resultado = await recusarOferta(id, req.usuario!.id)

  if (!resultado.ok) {
    if (resultado.motivo === 'nao_encontrada') {
      throw new ErroHttp(404, 'OFERTA_NAO_ENCONTRADA', 'Oferta não encontrada.')
    }
    throw new ErroHttp(409, 'OFERTA_INDISPONIVEL', 'Esta oferta não está mais disponível.')
  }

  // Oferece a próxima chance (melhor-esforço: a recusa já foi registrada).
  try {
    await ofertarProximoElegivel(resultado.entregaId)
  } catch (erro) {
    console.error('[oferta]', erro instanceof Error ? erro.message : erro)
  }

  res.json({ ok: true })
})
