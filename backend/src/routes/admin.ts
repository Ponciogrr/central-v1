import { Router } from 'express'
import { gerarCodigo, identificadorDoCodigo } from '../auth/codigo.ts'
import { decidirSolicitacao, listarPendentes } from '../auth/reativacoes.ts'
import {
  atualizarStatusUsuario,
  criarUsuario,
  listarUsuarios,
  substituirHashDeCodigo,
  type UsuarioListagem,
} from '../auth/usuarios.ts'
import { ErroHttp } from '../erros.ts'
import { exigirAutenticacao, exigirPapel } from '../middleware/autenticacao.ts'
import {
  contadoresPainel,
  definirManutencao,
  liberarTentativa,
  listarAuditoria,
  listarMotoboysOnline,
  listarTentativas,
  manutencaoAtiva,
  registrarAuditoria,
  MENSAGEM_MANUTENCAO,
} from '../rotas/admin-operacao.ts'
import { listarRotasDiaAdmin } from '../rotas/rotas-dia.ts'
import type { ContaTipo } from '../types/usuario.ts'
import { ehUuid, inteiroLimitado, limparTexto, validarTamanho } from '../utils/validacao.ts'

export const rotasAdmin = Router()

// TODAS as rotas de administração exigem administrador autenticado.
// O papel vem do usuário atual no banco (nunca de um papel enviado pelo app).
// A proteção é aplicada ROTA A ROTA (sem `use` global): este router é montado
// por último e um `use` sem caminho responderia 401 até para caminhos
// inexistentes (quirk registrado no PROJECT_STATUS — "Erros conhecidos").
const sessao = exigirAutenticacao
const somenteAdmin = [sessao, exigirPapel('admin')] as const

// Não é possível criar administradores por aqui: o 1º admin é feito pelo comando local.
const TIPOS_CRIAVEIS: ContaTipo[] = ['motoboy', 'lojista', 'pessoa_fisica']

function usuarioParaAdmin(u: UsuarioListagem) {
  return {
    id: u.id,
    nome: u.name,
    papel: u.account_type,
    telefone: u.phone,
    ativo: u.is_active,
    // Sufixo do código (4 últimos caracteres). O código COMPLETO nunca é
    // guardado em texto puro — o admin só o vê no momento da criação.
    codigo: u.code_suffix,
    criadoEm: u.created_at,
  }
}

function exigirId(valor: unknown): string {
  if (!ehUuid(valor)) throw new ErroHttp(400, 'ID_INVALIDO', 'Identificador inválido.')
  return valor
}

// Sufixo para o administrador identificar a conta sem expor o código inteiro.
function sufixoDoCodigo(codigo: string): string {
  return codigo.slice(-4)
}

// Histórico das ações administrativas (regra 66).
async function auditar(
  req: { usuario?: { id: string; nome: string | null } },
  acao: string,
  entidade: string,
  entidadeId: string | null,
  detalhes?: Record<string, unknown>,
): Promise<void> {
  try {
    await registrarAuditoria({
      atorId: req.usuario!.id,
      atorNome: req.usuario!.nome,
      acao,
      entidade,
      entidadeId,
      detalhes: detalhes ?? null,
    })
  } catch (erro) {
    // O histórico NUNCA pode derrubar a ação que o admin acabou de fazer.
    console.error('Falha ao registrar auditoria:', erro instanceof Error ? erro.message : erro)
  }
}

// Criar usuário (motoboy, lojista ou pessoa_fisica) e devolver o código UMA vez.
rotasAdmin.post('/admin/users', ...somenteAdmin, async (req, res) => {
  const corpo = (req.body ?? {}) as Record<string, unknown>

  const tipo = limparTexto(corpo.tipoConta)
  if (!tipo || !TIPOS_CRIAVEIS.includes(tipo as ContaTipo)) {
    throw new ErroHttp(
      400,
      'TIPO_INVALIDO',
      'Informe o tipo de conta: motoboy, lojista ou pessoa_fisica.',
    )
  }

  const nome = limparTexto(corpo.nome)
  const telefone = limparTexto(corpo.telefone)

  const erroNome = validarTamanho(nome, 120, 'nome')
  if (erroNome) throw new ErroHttp(400, 'DADOS_INVALIDOS', erroNome)
  const erroTelefone = validarTamanho(telefone, 30, 'telefone')
  if (erroTelefone) throw new ErroHttp(400, 'DADOS_INVALIDOS', erroTelefone)

  const codigo = gerarCodigo()
  const criado = await criarUsuario({
    nome,
    telefone,
    papel: tipo as ContaTipo,
    accessCodeHash: identificadorDoCodigo(codigo),
    codeSuffix: sufixoDoCodigo(codigo),
  })

  await auditar(req, 'usuario_criado', 'usuario', criado.id, { papel: tipo, nome })

  res.status(201).json({
    usuario: { id: criado.id, nome, papel: tipo, telefone, ativo: true },
    codigo,
    aviso: 'Entregue este código ao usuário agora: ele não será mostrado novamente.',
  })
})

// Listar usuários (paginação + busca/filtros). NUNCA retorna access_code_hash.
rotasAdmin.get('/admin/users', ...somenteAdmin, async (req, res) => {
  const limite = inteiroLimitado(req.query.limite, 50, 1, 200)
  const deslocamento = inteiroLimitado(req.query.deslocamento, 0, 0, 1_000_000)
  const busca = typeof req.query.busca === 'string' ? req.query.busca.trim() : ''
  const papel = typeof req.query.papel === 'string' ? req.query.papel.trim() : ''
  const ativo =
    req.query.ativo === 'true' ? true : req.query.ativo === 'false' ? false : null

  const { itens, total } = await listarUsuarios(limite, deslocamento, {
    busca: busca || null,
    papel: papel || null,
    ativo,
  })
  res.json({ usuarios: itens.map(usuarioParaAdmin), total, limite, deslocamento })
})

// Ativar/desativar conta.
rotasAdmin.patch('/admin/users/:id/status', ...somenteAdmin, async (req, res) => {
  const id = exigirId(req.params.id)
  const corpo = (req.body ?? {}) as Record<string, unknown>

  if (typeof corpo.ativo !== 'boolean') {
    throw new ErroHttp(400, 'DADOS_INVALIDOS', 'Informe "ativo" como verdadeiro ou falso.')
  }
  if (corpo.ativo === false && req.usuario?.id === id) {
    throw new ErroHttp(409, 'AUTO_DESATIVACAO', 'O administrador não pode desativar a própria conta.')
  }

  const atualizado = await atualizarStatusUsuario(id, corpo.ativo)
  if (!atualizado) throw new ErroHttp(404, 'USUARIO_NAO_ENCONTRADO', 'Usuário não encontrado.')

  await auditar(req, corpo.ativo ? 'usuario_ativado' : 'usuario_desativado', 'usuario', id, {
    nome: atualizado.name,
    papel: atualizado.account_type,
  })

  res.json({ usuario: usuarioParaAdmin(atualizado) })
})

// Substituir o código de acesso (novo código aparece UMA vez).
rotasAdmin.post('/admin/users/:id/replace-code', ...somenteAdmin, async (req, res) => {
  const id = exigirId(req.params.id)

  const codigo = gerarCodigo()
  const atualizado = await substituirHashDeCodigo(id, identificadorDoCodigo(codigo), sufixoDoCodigo(codigo))
  if (!atualizado) throw new ErroHttp(404, 'USUARIO_NAO_ENCONTRADO', 'Usuário não encontrado.')

  await auditar(req, 'codigo_substituido', 'usuario', id, { nome: atualizado.name })

  res.json({
    usuario: usuarioParaAdmin(atualizado),
    codigo,
    aviso:
      'Entregue este código agora: ele não será mostrado novamente. O código anterior deixa de funcionar para NOVOS logins.',
  })
})

// Solicitações de reativação pendentes (mais antiga primeiro).
rotasAdmin.get('/admin/reactivations', ...somenteAdmin, async (_req, res) => {
  const solicitacoes = await listarPendentes()
  res.json({ solicitacoes })
})

// Aprovar: ativa a conta imediatamente (decisão atômica).
rotasAdmin.post('/admin/reactivations/:id/approve', ...somenteAdmin, async (req, res) => {
  const id = exigirId(req.params.id)
  const resultado = await decidirSolicitacao(id, true, null)
  if (!resultado.ok) {
    throw new ErroHttp(404, 'SOLICITACAO_NAO_ENCONTRADA', 'Solicitação pendente não encontrada.')
  }
  await auditar(req, 'reativacao_aprovada', 'reativacao', id)
  res.json({ ok: true, status: 'aprovada' })
})

// Recusar com motivo opcional: a conta permanece desativada.
rotasAdmin.post('/admin/reactivations/:id/reject', ...somenteAdmin, async (req, res) => {
  const id = exigirId(req.params.id)
  const corpo = (req.body ?? {}) as Record<string, unknown>
  const motivo = limparTexto(corpo.motivo)
  const erroMotivo = validarTamanho(motivo, 300, 'motivo')
  if (erroMotivo) throw new ErroHttp(400, 'DADOS_INVALIDOS', erroMotivo)

  const resultado = await decidirSolicitacao(id, false, motivo)
  if (!resultado.ok) {
    throw new ErroHttp(404, 'SOLICITACAO_NAO_ENCONTRADA', 'Solicitação pendente não encontrada.')
  }
  await auditar(req, 'reativacao_recusada', 'reativacao', id, { motivo: motivo || null })
  res.json({ ok: true, status: 'recusada' })
})

// ---------------------------------------------------------------------------
// PAINEL — visão geral, operação e histórico
// ---------------------------------------------------------------------------

// GET /admin/overview — números reais do painel (sem dados de exemplo).
rotasAdmin.get('/admin/overview', ...somenteAdmin, async (_req, res) => {
  const [contadores, manutencao, auditoria] = await Promise.all([
    contadoresPainel(),
    manutencaoAtiva(),
    listarAuditoria(8, 0),
  ])
  res.json({
    contadores,
    manutencao,
    mensagemManutencao: MENSAGEM_MANUTENCAO,
    ultimasAcoes: auditoria.itens,
  })
})

// GET /admin/audit — histórico das ações administrativas (mais recente primeiro).
rotasAdmin.get('/admin/audit', ...somenteAdmin, async (req, res) => {
  const limite = inteiroLimitado(req.query.limite, 50, 1, 200)
  const deslocamento = inteiroLimitado(req.query.deslocamento, 0, 0, 1_000_000)
  const { itens, total } = await listarAuditoria(limite, deslocamento)
  res.json({ acoes: itens, total, limite, deslocamento })
})

// GET /admin/couriers/online — motoboys online (regras 43–45).
rotasAdmin.get('/admin/couriers/online', ...somenteAdmin, async (_req, res) => {
  const motoboys = await listarMotoboysOnline()
  res.json({ motoboys, total: motoboys.length })
})

// GET /admin/daily-routes — Rotas do Dia com filtros.
rotasAdmin.get('/admin/daily-routes', ...somenteAdmin, async (req, res) => {
  const limite = inteiroLimitado(req.query.limite, 50, 1, 200)
  const deslocamento = inteiroLimitado(req.query.deslocamento, 0, 0, 1_000_000)
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : ''
  const data = typeof req.query.data === 'string' ? req.query.data.trim() : ''
  const publicador = typeof req.query.publicador === 'string' ? req.query.publicador.trim() : ''
  const motoboy = typeof req.query.motoboy === 'string' ? req.query.motoboy.trim() : ''

  const { itens, total } = await listarRotasDiaAdmin(
    {
      status: status || null,
      data: data || null,
      publicador: publicador || null,
      motoboy: motoboy || null,
    },
    limite,
    deslocamento,
  )
  res.json({ rotas: itens, total, limite, deslocamento })
})

// ---------------------------------------------------------------------------
// MODO DE MANUTENÇÃO (regras 71–81)
// ---------------------------------------------------------------------------

// GET /admin/settings/maintenance — estado atual.
rotasAdmin.get('/admin/settings/maintenance', ...somenteAdmin, async (_req, res) => {
  const ativa = await manutencaoAtiva()
  res.json({ ativa, mensagem: MENSAGEM_MANUTENCAO })
})

// POST /admin/settings/maintenance — liga/desliga. SOMENTE o admin (regra 79).
// NÃO registra histórico (regra 80).
rotasAdmin.post('/admin/settings/maintenance', ...somenteAdmin, async (req, res) => {
  const corpo = (req.body ?? {}) as Record<string, unknown>
  if (typeof corpo.ativa !== 'boolean') {
    throw new ErroHttp(400, 'DADOS_INVALIDOS', 'Informe "ativa" como verdadeiro ou falso.')
  }
  const ativa = await definirManutencao(corpo.ativa, req.usuario!.id)
  res.json({ ativa, mensagem: MENSAGEM_MANUTENCAO })
})

// ---------------------------------------------------------------------------
// TENTATIVAS DE LOGIN BLOQUEADAS (regras 65–69)
// ---------------------------------------------------------------------------

// GET /admin/login-attempts — lista COMPLETA, ordem cronológica, SEM filtros.
rotasAdmin.get('/admin/login-attempts', ...somenteAdmin, async (_req, res) => {
  const tentativas = await listarTentativas()
  res.json({ tentativas, total: tentativas.length })
})

// POST /admin/login-attempts/:id/release — libera o acesso (regra 31).
rotasAdmin.post('/admin/login-attempts/:id/release', ...somenteAdmin, async (req, res) => {
  const id = exigirId(req.params.id)
  const liberada = await liberarTentativa(id)
  if (!liberada) {
    throw new ErroHttp(404, 'TENTATIVA_NAO_ENCONTRADA', 'Registro de tentativas não encontrado.')
  }
  await auditar(req, 'tentativa_liberada', 'tentativa_login', id)
  res.json({ ok: true, liberado: true })
})
