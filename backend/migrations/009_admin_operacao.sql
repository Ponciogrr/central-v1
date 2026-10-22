-- Migração 009 — operação administrativa (regras 31, 65–69, 71–81)
-- Aditiva e NÃO destrutiva: apenas CREATE TABLE/INDEX/ALTER ADD COLUMN.
-- Nenhuma tabela existente é alterada em conteúdo e nenhum dado é apagado.
--
-- `system_settings` — chave/valor das configurações que a plataforma realmente
-- suporta. Hoje: `manutencao` (modo de manutenção das regras 71–81).
-- A chave é única; o valor é JSON para permitir evoluir sem mudar o esquema.
--
-- `admin_audit` — histórico das principais ações administrativas
-- (regra 66: "registrar no sistema o histórico das principais ações
-- administrativas"). Tabela somente de inserção (append-only).
-- Ações de LIGAR/DESLIGAR a manutenção NÃO são registradas aqui, porque a
-- regra 80 pede que o sistema não guarde histórico dessas alterações.
--
-- `login_attempts` — registro das tentativas de login (regras 65–69).
-- Uma linha por origem (IP) + usuário identificado. `attempts` acumula as
-- falhas; a partir do limite a linha fica `blocked` e o acesso é recusado
-- até o administrador liberar (regra 31). Registros com mais de 30 dias são
-- apagados automaticamente (regra 67).

-- =========================================================
-- system_settings — configurações da plataforma
-- =========================================================
CREATE TABLE IF NOT EXISTS system_settings (
  key            text        PRIMARY KEY,
  value          jsonb       NOT NULL,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by_id  uuid        REFERENCES users (id) ON DELETE SET NULL
);

-- =========================================================
-- admin_audit — histórico das ações administrativas
-- =========================================================
CREATE TABLE IF NOT EXISTS admin_audit (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid        REFERENCES users (id) ON DELETE SET NULL,
  actor_name  text,
  action      text        NOT NULL,
  entity      text        NOT NULL,
  entity_id   text,
  details     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit (created_at DESC);

-- =========================================================
-- login_attempts — tentativas de login e bloqueio por excesso de tentativas
-- =========================================================
CREATE TABLE IF NOT EXISTS login_attempts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL quando o código informado não corresponde a nenhuma conta: o
  -- bloqueio vale para a origem (IP) de onde as tentativas vieram.
  user_id     uuid        REFERENCES users (id) ON DELETE SET NULL,
  user_name   text,
  origin      text        NOT NULL,
  attempts    integer     NOT NULL DEFAULT 1,
  blocked     boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz
);

-- Uma linha por origem + usuário (o usuário nulo vira um id fixo para
-- permitir o índice único com expressão).
CREATE UNIQUE INDEX IF NOT EXISTS uq_login_attempts_origin_user
  ON login_attempts (
    origin,
    COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE INDEX IF NOT EXISTS idx_login_attempts_blocked ON login_attempts (blocked);

-- Sufixo do código de acesso (4 últimos caracteres) para o administrador
-- identificar a conta de um usuário sem expor o código completo.
-- Contas antigas ficam com NULL (mostram "—" na lista).
ALTER TABLE users ADD COLUMN IF NOT EXISTS code_suffix text;
