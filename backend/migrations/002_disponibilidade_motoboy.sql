-- Migração 002 — disponibilidade do motoboy (M4.3)
-- Adiciona o estado online/offline e o horário da última atividade detectada.
-- Migração incremental e NÃO destrutiva: não altera nem apaga dados existentes.
-- Motoboys já cadastrados ficam offline (is_online = false) até entrarem no app.

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- Ajuda a filtrar rapidamente os motoboys marcados como online.
CREATE INDEX IF NOT EXISTS idx_users_online
  ON users (account_type, is_online)
  WHERE is_online;
