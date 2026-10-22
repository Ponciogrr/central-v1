// Operação administrativa: modo de manutenção, histórico de ações, registro de
// tentativas de login e contadores do painel (regras 31, 43–45, 65–69, 71–81).
//
// Observações importantes:
//   - a LIGAR/DESLIGAR a manutenção NÃO gera histórico (regra 80);
//   - o registro de tentativas não tem filtros e sai em ordem cronológica
//     (regra 69), com expiração automática em 30 dias (regra 67);
//   - nenhuma consulta concatena valores na SQL (tudo parametrizado).

import { obterPool } from '../db/pool.ts'

// Mensagem EXATA exigida pela regra 81.
export const MENSAGEM_MANUTENCAO = 'Estamos em manutenção. Tente novamente mais tarde.'

// Quantas tentativas erradas bloqueiam o acesso (regra 31).
export const LIMITE_TENTATIVAS = 5

// Expiração automática do registro de tentativas (regra 67).
export const DIAS_EXPIRA_TENTATIVAS = 30

const CHAVE_MANUTENCAO = 'manutencao'

// ---------------------------------------------------------------------------
// Modo de manutenção (regras 71–81)
// ---------------------------------------------------------------------------

export async function manutencaoAtiva(): Promise<boolean> {
  const { rows } = await obterPool().query<{ value: { ativa?: boolean } | null }>(
    'SELECT value FROM system_settings WHERE key = $1',
    [CHAVE_MANUTENCAO],
  )
  return rows[0]?.value?.ativa === true
}

// Liga/desliga a manutenção. NÃO registra histórico (regra 80).
export async function definirManutencao(ativa: boolean, atorId: string): Promise<boolean> {
  await obterPool().query(
    `INSERT INTO system_settings (key, value, updated_at, updated_by_id)
     VALUES ($1, $2::jsonb, now(), $3)
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value,
           updated_at = now(),
           updated_by_id = EXCLUDED.updated_by_id`,
    [CHAVE_MANUTENCAO, JSON.stringify({ ativa }), atorId],
  )
  return ativa
}

// ---------------------------------------------------------------------------
// Histórico de ações administrativas (regra 66)
// ---------------------------------------------------------------------------

export interface RegistroAuditoria {
  id: string
  atorNome: string | null
  acao: string
  entidade: string
  entidadeId: string | null
  detalhes: Record<string, unknown> | null
  criadoEm: Date
}

export async function registrarAuditoria(dados: {
  atorId: string
  atorNome: string | null
  acao: string
  entidade: string
  entidadeId?: string | null
  detalhes?: Record<string, unknown> | null
}): Promise<void> {
  await obterPool().query(
    `INSERT INTO admin_audit
       (actor_id, actor_name, action, entity, entity_id, details)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      dados.atorId,
      dados.atorNome,
      dados.acao,
      dados.entidade,
      dados.entidadeId ?? null,
      dados.detalhes ? JSON.stringify(dados.detalhes) : null,
    ],
  )
}

export async function listarAuditoria(
  limite: number,
  deslocamento: number,
): Promise<{ itens: RegistroAuditoria[]; total: number }> {
  const pool = obterPool()
  const total = await pool.query<{ total: string }>(
    'SELECT COUNT(*)::text AS total FROM admin_audit',
  )
  const itens = await pool.query<{
    id: string
    actor_name: string | null
    action: string
    entity: string
    entity_id: string | null
    details: Record<string, unknown> | null
    created_at: Date
  }>(
    `SELECT id, actor_name, action, entity, entity_id, details, created_at
       FROM admin_audit
      ORDER BY created_at DESC, id DESC
      LIMIT $1 OFFSET $2`,
    [limite, deslocamento],
  )
  return {
    itens: itens.rows.map(l => ({
      id: l.id,
      atorNome: l.actor_name,
      acao: l.action,
      entidade: l.entity,
      entidadeId: l.entity_id,
      detalhes: l.details,
      criadoEm: l.created_at,
    })),
    total: Number(total.rows[0]?.total ?? 0),
  }
}

// ---------------------------------------------------------------------------
// Tentativas de login (regras 31, 65–69)
// ---------------------------------------------------------------------------

export interface RegistroTentativa {
  id: string
  userId: string | null
  nomeUsuario: string | null
  origem: string
  tentativas: number
  bloqueado: boolean
  criadoEm: Date
  atualizadoEm: Date
  liberadoEm: Date | null
}

// Registra a falha e devolve o novo estado da linha (bloqueia a partir do
// limite). Não emite alerta (regra 68): apenas registra.
export async function registrarTentativa(dados: {
  userId: string | null
  nomeUsuario: string | null
  origem: string
}): Promise<{ tentativas: number; bloqueado: boolean }> {
  const { rows } = await obterPool().query<{ attempts: number; blocked: boolean }>(
    `INSERT INTO login_attempts (user_id, user_name, origin, attempts, blocked)
     VALUES ($1, $2, $3, 1, false)
     ON CONFLICT (origin, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid))
     DO UPDATE SET
       attempts = login_attempts.attempts + 1,
       user_name = COALESCE(EXCLUDED.user_name, login_attempts.user_name),
       updated_at = now(),
       blocked = login_attempts.attempts + 1 >= $4
     RETURNING attempts, blocked`,
    [dados.userId, dados.nomeUsuario, dados.origem, LIMITE_TENTATIVAS],
  )
  const linha = rows[0]
  return { tentativas: linha?.attempts ?? 1, bloqueado: linha?.blocked === true }
}

// A origem está bloqueada por excesso de tentativas?
export async function origemBloqueada(origem: string): Promise<boolean> {
  const { rows } = await obterPool().query<{ bloqueado: boolean }>(
    'SELECT blocked AS bloqueado FROM login_attempts WHERE origin = $1 AND blocked LIMIT 1',
    [origem],
  )
  return rows[0]?.bloqueado === true
}

// Lista COMPLETA, em ordem cronológica, SEM filtros (regra 69).
// Antes de listar, apaga os registros com mais de 30 dias (regra 67).
export async function listarTentativas(): Promise<RegistroTentativa[]> {
  const pool = obterPool()
  await pool.query(
    `DELETE FROM login_attempts
      WHERE created_at < now() - ($1 || ' days')::interval`,
    [String(DIAS_EXPIRA_TENTATIVAS)],
  )
  const { rows } = await pool.query<{
    id: string
    user_id: string | null
    user_name: string | null
    origin: string
    attempts: number
    blocked: boolean
    created_at: Date
    updated_at: Date
    released_at: Date | null
  }>(
    `SELECT id, user_id, user_name, origin, attempts, blocked,
            created_at, updated_at, released_at
       FROM login_attempts
      ORDER BY created_at ASC, id ASC`,
  )
  return rows.map(l => ({
    id: l.id,
    userId: l.user_id,
    nomeUsuario: l.user_name,
    origem: l.origin,
    tentativas: l.attempts,
    bloqueado: l.blocked,
    criadoEm: l.created_at,
    atualizadoEm: l.updated_at,
    liberadoEm: l.released_at,
  }))
}

// Libera o acesso bloqueado (regra 31: o administrador libera a conta).
export async function liberarTentativa(id: string): Promise<boolean> {
  const { rows } = await obterPool().query<{ id: string }>(
    `UPDATE login_attempts
        SET attempts = 0, blocked = false, released_at = now(), updated_at = now()
      WHERE id = $1
      RETURNING id`,
    [id],
  )
  return rows.length > 0
}

// Login bem-sucedido: zera a contagem de falhas da origem para aquele usuário.
export async function limparTentativa(origem: string, userId: string): Promise<void> {
  await obterPool().query(
    `DELETE FROM login_attempts
      WHERE origin = $1 AND user_id = $2`,
    [origem, userId],
  )
}

// ---------------------------------------------------------------------------
// Contadores do painel administrativo
// ---------------------------------------------------------------------------

export async function contadoresPainel(): Promise<{
  usuarios: {
    total: number
    motoboys: number
    lojistas: number
    pessoas: number
    admins: number
    ativos: number
    inativos: number
  }
  motoboysOnline: number
  entregas: {
    total: number
    aguardando: number
    ativas: number
    entregues: number
    canceladas: number
    hoje: number
  }
  rotasDoDia: {
    total: number
    publicadas: number
    contratadas: number
    emAndamento: number
    concluidas: number
    canceladas: number
  }
  encaixes: {
    pendentes: number
    emNegociacao: number
    aceitos: number
    recusados: number
  }
  reativacoesPendentes: number
  tentativasBloqueadas: number
}> {
  const pool = obterPool()

  const [usuarios, motoboysOnline, entregas, rotasDia, encaixes, reativacoes, bloqueadas] =
    await Promise.all([
      pool.query<{
        total: string
        motoboys: string
        lojistas: string
        pessoas: string
        admins: string
        ativos: string
        inativos: string
      }>(
        `SELECT COUNT(*)::text AS total,
                COUNT(*) FILTER (WHERE account_type = 'motoboy')::text AS motoboys,
                COUNT(*) FILTER (WHERE account_type = 'lojista')::text AS lojistas,
                COUNT(*) FILTER (WHERE account_type = 'pessoa_fisica')::text AS pessoas,
                COUNT(*) FILTER (WHERE account_type = 'admin')::text AS admins,
                COUNT(*) FILTER (WHERE is_active)::text AS ativos,
                COUNT(*) FILTER (WHERE NOT is_active)::text AS inativos
           FROM users`,
      ),
      pool.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total FROM users
          WHERE account_type = 'motoboy' AND is_online`,
      ),
      pool.query<{
        total: string
        aguardando: string
        ativas: string
        entregues: string
        canceladas: string
        hoje: string
      }>(
        `SELECT COUNT(*)::text AS total,
                COUNT(*) FILTER (WHERE status = 'aguardando')::text AS aguardando,
                COUNT(*) FILTER (WHERE status IN ('aceita', 'em_rota'))::text AS ativas,
                COUNT(*) FILTER (WHERE status = 'entregue')::text AS entregues,
                COUNT(*) FILTER (WHERE status = 'cancelada')::text AS canceladas,
                COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::text AS hoje
           FROM deliveries`,
      ),
      pool.query<{
        total: string
        publicadas: string
        contratadas: string
        emAndamento: string
        concluidas: string
        canceladas: string
      }>(
        `SELECT COUNT(*)::text AS total,
                COUNT(*) FILTER (WHERE status = 'publicada')::text AS publicadas,
                COUNT(*) FILTER (WHERE status = 'contratada')::text AS contratadas,
                COUNT(*) FILTER (WHERE status = 'em_andamento')::text AS emAndamento,
                COUNT(*) FILTER (WHERE status = 'concluida')::text AS concluidas,
                COUNT(*) FILTER (WHERE status = 'cancelada')::text AS canceladas
           FROM daily_routes`,
      ),
      pool.query<{
        pendentes: string
        emNegociacao: string
        aceitos: string
        recusados: string
      }>(
        `SELECT COUNT(*) FILTER (WHERE status = 'pendente')::text AS pendentes,
                COUNT(*) FILTER (WHERE status = 'pendente' AND counter_amount IS NOT NULL)::text AS emNegociacao,
                COUNT(*) FILTER (WHERE status = 'aceito')::text AS aceitos,
                COUNT(*) FILTER (WHERE status = 'recusado')::text AS recusados
           FROM route_fittings`,
      ),
      pool.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total FROM reactivation_requests WHERE status = 'pendente'`,
      ),
      pool.query<{ total: string }>(
        'SELECT COUNT(*)::text AS total FROM login_attempts WHERE blocked',
      ),
    ])

  const u = usuarios.rows[0]
  const e = entregas.rows[0]
  const r = rotasDia.rows[0]
  const c = encaixes.rows[0]

  return {
    usuarios: {
      total: Number(u?.total ?? 0),
      motoboys: Number(u?.motoboys ?? 0),
      lojistas: Number(u?.lojistas ?? 0),
      pessoas: Number(u?.pessoas ?? 0),
      admins: Number(u?.admins ?? 0),
      ativos: Number(u?.ativos ?? 0),
      inativos: Number(u?.inativos ?? 0),
    },
    motoboysOnline: Number(motoboysOnline.rows[0]?.total ?? 0),
    entregas: {
      total: Number(e?.total ?? 0),
      aguardando: Number(e?.aguardando ?? 0),
      ativas: Number(e?.ativas ?? 0),
      entregues: Number(e?.entregues ?? 0),
      canceladas: Number(e?.canceladas ?? 0),
      hoje: Number(e?.hoje ?? 0),
    },
    rotasDoDia: {
      total: Number(r?.total ?? 0),
      publicadas: Number(r?.publicadas ?? 0),
      contratadas: Number(r?.contratadas ?? 0),
      emAndamento: Number(r?.emAndamento ?? 0),
      concluidas: Number(r?.concluidas ?? 0),
      canceladas: Number(r?.canceladas ?? 0),
    },
    encaixes: {
      pendentes: Number(c?.pendentes ?? 0),
      emNegociacao: Number(c?.emNegociacao ?? 0),
      aceitos: Number(c?.aceitos ?? 0),
      recusados: Number(c?.recusados ?? 0),
    },
    reativacoesPendentes: Number(reativacoes.rows[0]?.total ?? 0),
    tentativasBloqueadas: Number(bloqueadas.rows[0]?.total ?? 0),
  }
}

// Motoboys online (regras 43–45): nome, código (sufixo) e status.
export async function listarMotoboysOnline(): Promise<
  Array<{
    id: string
    nome: string | null
    telefone: string | null
    codigo: string | null
    online: boolean
    ultimoAcesso: Date | null
  }>
> {
  const { rows } = await obterPool().query<{
    id: string
    name: string | null
    phone: string | null
    code_suffix: string | null
    is_online: boolean
    last_seen_at: Date | null
  }>(
    `SELECT id, name, phone, code_suffix, is_online, last_seen_at
       FROM users
      WHERE account_type = 'motoboy'
        AND (is_online OR last_seen_at >= now() - interval '5 minutes')
      ORDER BY is_online DESC, last_seen_at DESC NULLS LAST, name ASC`,
  )
  return rows.map(l => ({
    id: l.id,
    nome: l.name,
    telefone: l.phone,
    codigo: l.code_suffix,
    online: l.is_online,
    ultimoAcesso: l.last_seen_at,
  }))
}
