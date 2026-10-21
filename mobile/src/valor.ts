export type ValorLido = number | null | 'invalido'

// Vazio = valor não informado. Aceita "12,50", "12.50", "R$ 12,50" e milhares
// nos dois formatos ("1.234,56" e "1,234.56"). Qualquer outro texto é inválido.
export function lerValor(texto: string): ValorLido {
  const original = texto.trim()
  if (!original) return null

  let limpo = original.replace(/^R\$\s*/i, '').replace(/\s+/g, '')
  if (!limpo) return 'invalido'

  const pontos = (limpo.match(/\./g) ?? []).length
  const virgulas = (limpo.match(/,/g) ?? []).length

  if (pontos > 0 && virgulas > 0) {
    const decimal = limpo.lastIndexOf(',') > limpo.lastIndexOf('.') ? ',' : '.'
    const milhar = decimal === ',' ? '.' : ','
    limpo = limpo.split(milhar).join('').replace(decimal, '.')
  } else if (virgulas > 0) {
    if (virgulas > 1) return 'invalido'
    limpo = limpo.replace(',', '.')
  } else if (pontos > 1) {
    if (!/^\d{1,3}(\.\d{3})+$/.test(limpo)) return 'invalido'
    limpo = limpo.split('.').join('')
  }

  if (!/^\d+(\.\d+)?$/.test(limpo)) return 'invalido'

  const numero = Number(limpo)
  if (!Number.isFinite(numero) || numero < 0) return 'invalido'
  return numero
}
