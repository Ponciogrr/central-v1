// Tipos de conta e dados públicos do usuário.
// NUNCA inclua hash de código ou segredos nos tipos "públicos".

export type ContaTipo = 'admin' | 'motoboy' | 'lojista' | 'pessoa_fisica'

export interface UsuarioPublico {
  id: string
  nome: string | null
  papel: ContaTipo
  ativo: boolean
}

export type UsuarioAutenticado = UsuarioPublico
