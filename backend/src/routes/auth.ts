import { Router } from 'express'
import { identificadorDoCodigo, TAMANHO_MAX_CODIGO } from '../auth/codigo.ts'
import { assinarToken } from '../auth/jwt.ts'
import { buscarUsuarioPorCodigoHash, type UsuarioBanco } from '../auth/usuarios.ts'
import { env } from '../config/env.ts'
import { exigirAutenticacao } from '../middleware/autenticacao.ts'
import { limitarLogin, registrarSucessoLogin } from '../middleware/limite.ts'
import {
  MENSAGEM_MANUTENCAO,
  limparTentativa,
  manutencaoAtiva,
  origemBloqueada,
  registrarTentativa,
} from '../rotas/admin-operacao.ts'
import type { UsuarioPublico } from '../types/usuario.ts'

export const rotasAuth = Router()

function paraPublico(usuario: UsuarioBanco): UsuarioPublico {
  return {
    id: usuario.id,
    nome: usuario.name,
    papel: usuario.account_type,
    ativo: usuario.is_active,
  }
}

// O corpo deve conter SOMENTE o código. O papel NUNCA é lido do cliente.
function extrairCodigo(corpo: unknown): string | null {
  if (typeof corpo !== 'object' || corpo === null) return null
  const codigo = (corpo as { codigo?: unknown }).codigo
  if (typeof codigo !== 'string') return null
  const limpo = codigo.trim()
  return limpo.length > 0 ? limpo : null
}

// Origem do acesso (IP real). É o que identifica a origem das tentativas.
function origem(req: { ip?: string; socket: { remoteAddress?: string } }): string {
  return req.ip ?? req.socket.remoteAddress ?? 'desconhecida'
}

// GET /status — informação pública e honesta para o app (modo de manutenção).
// Não revela nada além do estado da manutenção.
rotasAuth.get('/status', async (_req, res) => {
  const ativa = await manutencaoAtiva()
  res.json({ manutencao: ativa, mensagem: ativa ? MENSAGEM_MANUTENCAO : null })
})

rotasAuth.post('/auth/login', limitarLogin, async (req, res) => {
  if (!env.authConfigurada) {
    res
      .status(503)
      .json({ erro: 'Autenticação indisponível no servidor.', codigo: 'AUTH_INDISPONIVEL' })
    return
  }

  const codigo = extrairCodigo(req.body)
  if (!codigo) {
    res.status(400).json({ erro: 'Informe o código de acesso.', codigo: 'CODIGO_OBRIGATORIO' })
    return
  }
  if (codigo.length > TAMANHO_MAX_CODIGO) {
    res.status(400).json({ erro: 'Código de acesso inválido.', codigo: 'CODIGO_INVALIDO' })
    return
  }

  const de = origem(req)

  const usuario = await buscarUsuarioPorCodigoHash(identificadorDoCodigo(codigo))
  const ehAdmin = usuario?.account_type === 'admin'

  // Regra 31: origem bloqueada por tentativas erradas — só o administrador
  // libera (a mensagem orienta o usuário a procurar o administrador).
  // O administrador NUNCA fica trancado fora: sem isso ninguém conseguiria
  // liberar o acesso bloqueado.
  if (!ehAdmin && (await origemBloqueada(de))) {
    res.status(403).json({
      erro: 'Acesso bloqueado por excesso de tentativas erradas. Procure o administrador da Central de Motoboys para liberar sua conta.',
      codigo: 'ACESSO_BLOQUEADO',
    })
    return
  }

  // Regras 71–81: durante a manutenção o acesso dos usuários fica bloqueado
  // e a mensagem exibida é EXATAMENTE a da regra 81. O administrador mantém
  // o acesso (regra 78).
  if (await manutencaoAtiva()) {
    if (!ehAdmin) {
      res.status(503).json({ erro: MENSAGEM_MANUTENCAO, codigo: 'MANUTENCAO' })
      return
    }
  }

  if (!usuario) {
    const registro = await registrarTentativa({ userId: null, nomeUsuario: null, origem: de })
    if (registro.bloqueado) {
      res.status(403).json({
        erro: 'Acesso bloqueado por excesso de tentativas erradas. Procure o administrador da Central de Motoboys para liberar sua conta.',
        codigo: 'ACESSO_BLOQUEADO',
      })
      return
    }
    res.status(401).json({ erro: 'Código de acesso inválido.', codigo: 'CREDENCIAL_INVALIDA' })
    return
  }
  if (!usuario.is_active) {
    res.status(403).json({
      erro: 'Conta desativada. Procure o administrador da Central de Motoboys para solicitar a reativação.',
      codigo: 'CONTA_DESATIVADA',
    })
    return
  }

  const token = await assinarToken({ sub: usuario.id, papel: usuario.account_type })
  registrarSucessoLogin(req)
  // Login bem-sucedido zera a contagem de tentativas daquela origem.
  await limparTentativa(de, usuario.id)
  res.json({
    token,
    tipo: 'Bearer',
    expiraEm: env.jwtExpiresIn,
    usuario: paraPublico(usuario),
  })
})

rotasAuth.get('/auth/me', exigirAutenticacao, (req, res) => {
  res.json({ usuario: req.usuario })
})
