// Formatação compartilhada do app (moeda, datas e rótulos de status).
//
// Existe para PARAR a duplicação: antes, cada tela tinha a sua própria
// `formatarValor`/`formatarData`. O formato é o mesmo em toda a interface:
// real brasileiro, com vírgula decimal e data dd/mm/aaaa.

export function formatarMoeda(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return 'Valor não informado'
  const numero = typeof valor === 'number' ? valor : Number(String(valor).replace(',', '.'))
  if (!Number.isFinite(numero)) return 'Valor não informado'
  return `R$ ${numero.toFixed(2).replace('.', ',')}`
}

// Data simples (dd/mm/aaaa) a partir de 'YYYY-MM-DD' ou de uma data ISO.
export function formatarData(valor: string | null | undefined): string {
  if (!valor) return '—'
  const data = new Date(valor.length === 10 ? `${valor}T12:00:00` : valor)
  if (Number.isNaN(data.getTime())) return '—'
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Data e hora (dd/mm/aaaa às hh:mm).
export function formatarDataHora(valor: string | null | undefined): string {
  if (!valor) return '—'
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return '—'
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// "Hoje", "Amanhã" ou a data — usado nas Rotas do Dia.
export function formatarDiaServico(data: string | null | undefined): string {
  if (!data) return '—'
  const alvo = new Date(`${data}T12:00:00`)
  if (Number.isNaN(alvo.getTime())) return formatarData(data)
  const hoje = new Date()
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const dias = Math.round((alvo.getTime() - inicio.getTime()) / 86_400_000)
  if (dias === 0) return 'Hoje'
  if (dias === 1) return 'Amanhã'
  return formatarData(data)
}

// Rótulos e "tons" (cores) dos estados das Rotas do Dia.
export type Tom = 'neutro' | 'acao' | 'destaque' | 'perigo' | 'sucesso'

export function rotuloStatusRotaDia(status: string): { texto: string; tom: Tom } {
  switch (status) {
    case 'rascunho':
      return { texto: 'Rascunho', tom: 'neutro' }
    case 'publicada':
      return { texto: 'Publicada', tom: 'acao' }
    case 'contratada':
      return { texto: 'Contratada', tom: 'destaque' }
    case 'em_andamento':
      return { texto: 'Em andamento', tom: 'destaque' }
    case 'concluida':
      return { texto: 'Concluída', tom: 'sucesso' }
    case 'cancelada':
      return { texto: 'Cancelada', tom: 'perigo' }
    default:
      return { texto: status, tom: 'neutro' }
  }
}

// Rótulo do papel do usuário (telas de perfil e painel).
export function rotuloPapel(papel: string): string {
  switch (papel) {
    case 'admin':
      return 'Administrador'
    case 'motoboy':
      return 'Motoboy'
    case 'lojista':
      return 'Lojista'
    case 'pessoa_fisica':
      return 'Pessoa física'
    default:
      return papel
  }
}

// Data de hoje no formato do servidor (YYYY-MM-DD).
export function hojeIso(): string {
  const agora = new Date()
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  return `${agora.getFullYear()}-${mes}-${dia}`
}

// Converte o que a pessoa digita (dd/mm/aaaa) para o formato do servidor.
// Devolve null quando a data não existe (ex.: 31/02).
export function dataIsoDeTexto(texto: string): string | null {
  const partes = texto.trim().split('/')
  if (partes.length !== 3) return null
  const [dia, mes, ano] = partes.map(p => Number(p.trim()))
  if (!dia || !mes || !ano) return null
  if (ano < 2000 || ano > 2100) return null
  const data = new Date(ano, mes - 1, dia)
  if (
    data.getFullYear() !== ano ||
    data.getMonth() !== mes - 1 ||
    data.getDate() !== dia
  ) {
    return null
  }
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

// Formato do servidor (YYYY-MM-DD) para o que aparece na tela (dd/mm/aaaa).
export function textoDeDataIso(iso: string): string {
  const partes = iso.split('-')
  if (partes.length !== 3) return iso
  return `${partes[2]}/${partes[1]}/${partes[0]}`
}
