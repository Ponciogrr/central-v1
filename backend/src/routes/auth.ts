import { Router } from 'express'
import { identificadorDoCodigo, TAMANHO_MAX_CODIGO } from '../auth/codigo.ts'
import { assinarToken } from '../auth/jwt.ts'
import { buscarUsuarioPorCodigoHash, type UsuarioBanco } from '../auth/usuarios.ts'
import { env } from '../config/env.ts'
import { exigirAutenticacao } from '../middleware/autenticacao.ts'
import { limitarLogin, registrarSucessoLogin } from '../middleware/limite.ts'
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

  const usuario = await buscarUsuarioPorCodigoHash(identificadorDoCodigo(codigo))
  if (!usuario) {
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
