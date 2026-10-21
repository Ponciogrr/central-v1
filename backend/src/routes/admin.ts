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
    criadoEm: u.created_at,
  }
}

function exigirId(valor: unknown): string {
  if (!ehUuid(valor)) throw new ErroHttp(400, 'ID_INVALIDO', 'Identificador inválido.')
  return valor
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
  })

  res.status(201).json({
    usuario: { id: criado.id, nome, papel: tipo, telefone, ativo: true },
    codigo,
    aviso: 'Entregue este código ao usuário agora: ele não será mostrado novamente.',
  })
})

// Listar usuários (paginção simples). NUNCA retorna access_code_hash.
rotasAdmin.get('/admin/users', ...somenteAdmin, async (req, res) => {
  const limite = inteiroLimitado(req.query.limite, 50, 1, 200)
  const deslocamento = inteiroLimitado(req.query.deslocamento, 0, 0, 1_000_000)
  const { itens, total } = await listarUsuarios(limite, deslocamento)
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

  res.json({ usuario: usuarioParaAdmin(atualizado) })
})

// Substituir o código de acesso (novo código aparece UMA vez).
rotasAdmin.post('/admin/users/:id/replace-code', ...somenteAdmin, async (req, res) => {
  const id = exigirId(req.params.id)

  const codigo = gerarCodigo()
  const atualizado = await substituirHashDeCodigo(id, identificadorDoCodigo(codigo))
  if (!atualizado) throw new ErroHttp(404, 'USUARIO_NAO_ENCONTRADO', 'Usuário não encontrado.')

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
  res.json({ ok: true, status: 'recusada' })
})
