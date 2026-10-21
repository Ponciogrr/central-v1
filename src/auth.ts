import type { Papel } from './types'
import { novoId } from './storage'

/**
 * PROVISÓRIO — autenticação local via localStorage, apenas para demonstração.
 * NÃO é autenticação segura e não deve ser usada em produção.
 */

export interface Usuario {
  id: string
  nome: string
  papel: Papel
  telefone: string
  codigo: string
  ativo: boolean
  online?: boolean
  criadoEm: string
}

export interface SolicitacaoReativacao {
  usuarioId: string
  usuarioNome: string
  papel: Papel
  criadoEm: string
  status: 'pendente' | 'recusada'
  motivo?: string
}

export type RetornoEntrada =
  | { ok: true; usuario: Usuario }
  | { ok: false; motivo: 'invalido' | 'perfil' | 'bloqueado'; usuario?: Usuario; solicitacao?: SolicitacaoReativacao | null }

const CHAVE_USUARIOS = 'central-motoboys:usuarios:v1'
const CHAVE_SOLICITACOES = 'central-motoboys:reativacoes:v1'

function ler<T>(chave: string, padrao: T): T {
  try {
    const bruto = localStorage.getItem(chave)
    return bruto ? (JSON.parse(bruto) as T) : padrao
  } catch {
    return padrao
  }
}

function gravar(chave: string, dados: unknown): void {
  try {
    localStorage.setItem(chave, JSON.stringify(dados))
  } catch {
    // quota cheia ou modo privado — segue em memória
  }
}

export function listarUsuarios(): Usuario[] {
  const lista = ler<Usuario[]>(CHAVE_USUARIOS, [])
  return Array.isArray(lista) ? lista : []
}

function salvarUsuarios(lista: Usuario[]): void {
  gravar(CHAVE_USUARIOS, lista)
}

function listarSolicitacoes(): SolicitacaoReativacao[] {
  const lista = ler<SolicitacaoReativacao[]>(CHAVE_SOLICITACOES, [])
  return Array.isArray(lista) ? lista : []
}

function salvarSolicitacoes(lista: SolicitacaoReativacao[]): void {
  gravar(CHAVE_SOLICITACOES, lista)
}

function codigoUnico(papel: Papel): string {
  const prefixo = papel === 'motoboy' ? 'MTB' : papel === 'lojista' ? 'LOJ' : papel === 'admin' ? 'ADM' : 'PF'
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const usados = new Set(listarUsuarios().map(u => u.codigo))
  for (;;) {
    let corpo = ''
    for (let i = 0; i < 4; i++) {
      corpo += caracteres[Math.floor(Math.random() * caracteres.length)]
    }
    const codigo = `${prefixo}-${corpo}`
    if (!usados.has(codigo)) return codigo
  }
}

export function existeAdmin(): boolean {
  return listarUsuarios().some(u => u.papel === 'admin')
}

export function criarAdmin(
  nome: string,
  codigo: string,
): { ok: true; usuario: Usuario } | { ok: false; erro: string } {
  if (existeAdmin()) return { ok: false, erro: 'Já existe um administrador.' }
  const codigoLimpo = codigo.trim().toUpperCase()
  if (listarUsuarios().some(u => u.codigo === codigoLimpo)) {
    return { ok: false, erro: 'Este código já está em uso.' }
  }
  const usuario: Usuario = {
    id: novoId(),
    nome: nome.trim(),
    papel: 'admin',
    telefone: '',
    codigo: codigoLimpo,
    ativo: true,
    criadoEm: new Date().toISOString(),
  }
  salvarUsuarios([...listarUsuarios(), usuario])
  return { ok: true, usuario }
}

export function criarUsuario(
  nome: string,
  papel: Papel,
): { ok: true; usuario: Usuario } | { ok: false; erro: string } {
  const nomeLimpo = nome.trim()
  if (!nomeLimpo) return { ok: false, erro: 'Informe o nome do usuário.' }
  if (papel === 'admin') return { ok: false, erro: 'Novos administradores não são criados por este painel.' }
  const usuario: Usuario = {
    id: novoId(),
    nome: nomeLimpo,
    papel,
    telefone: '',
    codigo: codigoUnico(papel),
    ativo: true,
    criadoEm: new Date().toISOString(),
  }
  salvarUsuarios([...listarUsuarios(), usuario])
  return { ok: true, usuario }
}

export function substituirCodigo(id: string): void {
  salvarUsuarios(
    listarUsuarios().map(u => (u.id === id ? { ...u, codigo: codigoUnico(u.papel) } : u)),
  )
}

export function definirAtivo(id: string, ativo: boolean): void {
  salvarUsuarios(listarUsuarios().map(u => (u.id === id ? { ...u, ativo } : u)))
}

export function definirOnline(id: string, online: boolean): void {
  salvarUsuarios(listarUsuarios().map(u => (u.id === id ? { ...u, online } : u)))
}

/** Somente motoboys ativos e online — sem expor dados pessoais (regras 40–42). */
export function contarMotoboysOnline(): number {
  return listarUsuarios().filter(u => u.papel === 'motoboy' && u.ativo && u.online).length
}

export function entrar(papel: Papel, codigo: string): RetornoEntrada {
  const codigoLimpo = codigo.trim().toUpperCase()
  const usuario = listarUsuarios().find(u => u.codigo === codigoLimpo)
  if (!usuario) return { ok: false, motivo: 'invalido' }
  if (usuario.papel !== papel) return { ok: false, motivo: 'perfil' }
  if (!usuario.ativo) {
    return { ok: false, motivo: 'bloqueado', usuario, solicitacao: getSolicitacao(usuario.id) }
  }
  return { ok: true, usuario }
}

export function getSolicitacao(usuarioId: string): SolicitacaoReativacao | null {
  return listarSolicitacoes().find(s => s.usuarioId === usuarioId) ?? null
}

export function solicitarReativacao(usuario: Usuario): void {
  const atual = getSolicitacao(usuario.id)
  if (atual?.status === 'pendente') return // sem duplicatas (regra 58)
  const nova: SolicitacaoReativacao = {
    usuarioId: usuario.id,
    usuarioNome: usuario.nome,
    papel: usuario.papel,
    criadoEm: new Date().toISOString(),
    status: 'pendente',
  }
  // apenas a solicitação atual é mantida, sem histórico (regra 54)
  salvarSolicitacoes([...listarSolicitacoes().filter(s => s.usuarioId !== usuario.id), nova])
}

export function pendentesOrdenadas(): SolicitacaoReativacao[] {
  return listarSolicitacoes()
    .filter(s => s.status === 'pendente')
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)) // mais antiga primeiro (regra 61)
}

export function decidirSolicitacao(usuarioId: string, aprovar: boolean, motivo?: string): void {
  if (aprovar) {
    definirAtivo(usuarioId, true)
    salvarSolicitacoes(listarSolicitacoes().filter(s => s.usuarioId !== usuarioId))
    return
  }
  salvarSolicitacoes(
    listarSolicitacoes().map(s =>
      s.usuarioId === usuarioId ? { ...s, status: 'recusada', motivo: motivo?.trim() || undefined } : s,
    ),
  )
}
