// Tipos de despesa do motoboy (contabilidade pessoal).
// Os valores espelham o CHECK da coluna `courier_expenses.category` (migração 006).

export const CATEGORIAS_DESPESA = ['gasolina', 'oleo', 'manutencao', 'outros'] as const

export type CategoriaDespesa = (typeof CATEGORIAS_DESPESA)[number]

export function ehCategoriaDespesa(valor: unknown): valor is CategoriaDespesa {
  return typeof valor === 'string' && (CATEGORIAS_DESPESA as readonly string[]).includes(valor)
}
