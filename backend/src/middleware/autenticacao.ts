import type { NextFunction, Request, Response } from 'express'
import { verificarToken } from '../auth/jwt.ts'
import { buscarUsuarioPorId } from '../auth/usuarios.ts'
import { env } from '../config/env.ts'
import type { ContaTipo, UsuarioAutenticado } from '../types/usuario.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function naoAutorizado(res: Response, mensagem: string): void {
  res.status(401).json({ erro: mensagem, codigo: 'NAO_AUTENTICADO' })
}

// Valida o token, busca o usuário ATUAL no banco e recusa contas desativadas.
// O papel é sempre lido do banco — um papel antigo ou adulterado no token não vale.
export async function exigirAutenticacao(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!env.authConfigurada) {
    res
      .status(503)
      .json({ erro: 'Autenticação indisponível no servidor.', codigo: 'AUTH_INDISPONIVEL' })
    return
  }

  const cabecalho = req.headers.authorization
  if (!cabecalho || !cabecalho.startsWith('Bearer ')) {
    naoAutorizado(res, 'Sessão não informada.')
    return
  }

  const token = cabecalho.slice('Bearer '.length).trim()

  let id = ''
  try {
    const payload = await verificarToken(token)
    id = typeof payload.sub === 'string' ? payload.sub : ''
  } catch {
    naoAutorizado(res, 'Sessão inválida ou expirada.')
    return
  }

  if (!UUID.test(id)) {
    naoAutorizado(res, 'Sessão inválida ou expirada.')
    return
  }

  const usuario = await buscarUsuarioPorId(id)
  if (!usuario) {
    naoAutorizado(res, 'Sessão inválida ou expirada.')
    return
  }
  if (!usuario.is_active) {
    res.status(403).json({
      erro: 'Conta desativada. Procure o administrador da Central de Motoboys.',
      codigo: 'CONTA_DESATIVADA',
    })
    return
  }

  const autenticado: UsuarioAutenticado = {
    id: usuario.id,
    nome: usuario.name,
    papel: usuario.account_type,
    ativo: usuario.is_active,
  }
  req.usuario = autenticado
  next()
}

// Autorização por papel. Uso previsto na M3.4 (ex.: exigirPapel('admin')).
export function exigirPapel(...papeis: ContaTipo[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.usuario) {
      naoAutorizado(res, 'Sessão não informada.')
      return
    }
    if (!papeis.includes(req.usuario.papel)) {
      res
        .status(403)
        .json({ erro: 'Acesso não autorizado para este perfil.', codigo: 'SEM_PERMISSAO' })
      return
    }
    next()
  }
}
