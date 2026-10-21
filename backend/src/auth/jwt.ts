// Emissão e verificação de JWT (HS256), usando a biblioteca `jose`.
// O token carrega apenas o identificador do usuário e o papel como referência:
// a AUTORIZAÇÃO sempre reconfere o papel no banco (ver middleware de autenticação).

import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { env } from '../config/env.ts'
import type { ContaTipo } from '../types/usuario.ts'

const ALGORITMO = 'HS256'

function chave(): Uint8Array {
  if (!env.jwtSecret) {
    throw new Error('JWT_SECRET não configurada no servidor.')
  }
  return new TextEncoder().encode(env.jwtSecret)
}

export async function assinarToken(dados: { sub: string; papel: ContaTipo }): Promise<string> {
  return await new SignJWT({ papel: dados.papel })
    .setProtectedHeader({ alg: ALGORITMO })
    .setSubject(dados.sub)
    .setIssuedAt()
    .setExpirationTime(env.jwtExpiresIn)
    .sign(chave())
}

export async function verificarToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, chave(), { algorithms: [ALGORITMO] })
  return payload
}
