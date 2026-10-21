// Pequenos utilitários de validação de entrada.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function ehUuid(valor: unknown): valor is string {
  return typeof valor === 'string' && UUID.test(valor)
}

// Texto opcional: retorna o valor sem espaços nas pontas, ou null se ausente/vazio/não-texto.
export function limparTexto(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const limpo = valor.trim()
  return limpo.length > 0 ? limpo : null
}

// Valida o tamanho máximo de um texto opcional. Retorna a mensagem de erro ou null.
export function validarTamanho(valor: string | null, max: number, nome: string): string | null {
  if (valor !== null && valor.length > max) {
    return `O campo "${nome}" deve ter no máximo ${max} caracteres.`
  }
  return null
}

// Converte um parâmetro de paginação; usa o padrão se ausente/ inválido e limita ao intervalo.
export function inteiroLimitado(valor: unknown, padrao: number, min: number, max: number): number {
  const numero = typeof valor === 'string' ? Number.parseInt(valor, 10) : Number.NaN
  if (!Number.isInteger(numero)) return padrao
  return Math.min(Math.max(numero, min), max)
}
