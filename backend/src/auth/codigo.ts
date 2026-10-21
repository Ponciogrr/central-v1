// Código de acesso: geração forte e identificador determinístico (HMAC-SHA-256).
//
// O código é a credencial do usuário: quem souber o valor pode tentar usá-lo.
// Por isso ele é gerado com a fonte criptográfica do Node e nunca é guardado
// em texto puro — o banco guarda apenas o identificador HMAC (determinístico,
// o que permite localizar o usuário por igualdade).

import { createHmac, randomInt } from 'node:crypto'
import { env } from '../config/env.ts'

// Alfabeto sem caracteres ambíguos (sem O, I, L, 1, 0).
const ALFABETO = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'
const PREFIXO = 'CMB' // Prefixo NEUTRO: não revela o papel da conta.
const GRUPOS = 4
const TAMANHO_GRUPO = 4

// Limite defensivo para entradas absurdamente grandes.
export const TAMANHO_MAX_CODIGO = 128

function grupoAleatorio(): string {
  let saida = ''
  for (let i = 0; i < TAMANHO_GRUPO; i++) {
    saida += ALFABETO[randomInt(ALFABETO.length)]
  }
  return saida
}

// Código no formato CMB-XXXX-XXXX-XXXX-XXXX (16 caracteres do alfabeto ≈ 79 bits de entropia).
export function gerarCodigo(): string {
  const grupos = Array.from({ length: GRUPOS }, grupoAleatorio)
  return `${PREFIXO}-${grupos.join('-')}`
}

// Identificador criptográfico determinístico do código.
// A chave (CODE_HMAC_KEY) fica SÓ no servidor.
export function identificadorDoCodigo(codigo: string): string {
  if (!env.codeHmacKey) {
    throw new Error('CODE_HMAC_KEY não configurada no servidor.')
  }
  return createHmac('sha256', env.codeHmacKey).update(codigo.trim()).digest('hex')
}
