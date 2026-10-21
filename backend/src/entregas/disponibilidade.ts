// Presença (online/offline) e última atividade do motoboy.
//
// Só contas do tipo motoboy entram aqui. A "janela de tolerância" de 5 minutos
// define quando um motoboy marcado como online deixa de contar como disponível:
// se ele parou de dar sinal (a consulta periódica do app) há mais de 5 minutos,
// ele é ignorado na distribuição de ofertas e no contador de online.
//
// O estado é o ÚNICO armazenado (sem histórico), conforme a regra do projeto.

import { obterPool } from '../db/pool.ts'

export const JANELA_ATIVIDADE_MINUTOS = 5

export interface Disponibilidade {
  online: boolean
  ultimaAtividade: Date | null
}

interface LinhaDisponibilidade {
  is_online: boolean
  last_seen_at: Date | null
}

function paraDisponibilidade(linha: LinhaDisponibilidade | undefined): Disponibilidade {
  return {
    online: linha?.is_online ?? false,
    ultimaAtividade: linha?.last_seen_at ?? null,
  }
}

// Liga/desliga o motoboy. Ao ficar online, registra a atividade agora.
export async function definirDisponibilidade(
  motoboyId: string,
  online: boolean,
): Promise<Disponibilidade> {
  const { rows } = await obterPool().query<LinhaDisponibilidade>(
    `UPDATE users
        SET is_online = $2,
            last_seen_at = CASE WHEN $2 THEN now() ELSE last_seen_at END,
            updated_at = now()
      WHERE id = $1 AND account_type = 'motoboy'
      RETURNING is_online, last_seen_at`,
    [motoboyId, online],
  )
  return paraDisponibilidade(rows[0])
}

// Registra atividade recente (chamada a cada consulta periódica do app).
export async function marcarAtividade(motoboyId: string): Promise<void> {
  await obterPool().query(
    `UPDATE users SET last_seen_at = now()
      WHERE id = $1 AND account_type = 'motoboy' AND is_online`,
    [motoboyId],
  )
}

export async function buscarDisponibilidade(motoboyId: string): Promise<Disponibilidade> {
  const { rows } = await obterPool().query<LinhaDisponibilidade>(
    `SELECT is_online, last_seen_at
       FROM users WHERE id = $1 AND account_type = 'motoboy' LIMIT 1`,
    [motoboyId],
  )
  return paraDisponibilidade(rows[0])
}

// Quantidade de motoboys realmente disponíveis agora (online E com atividade
// dentro da janela de tolerância). Apenas a QUANTIDADE é exposta a lojista e
// pessoa física — nunca dados pessoais (regras 40–43).
export async function contarMotoboysOnline(): Promise<number> {
  const { rows } = await obterPool().query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
       FROM users
      WHERE account_type = 'motoboy'
        AND is_active
        AND is_online
        AND last_seen_at IS NOT NULL
        AND last_seen_at >= now() - make_interval(mins => $1::int)`,
    [JANELA_ATIVIDADE_MINUTOS],
  )
  return Number(rows[0]?.total ?? 0)
}
