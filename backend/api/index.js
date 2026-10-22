// src/app.ts
import express from "express";

// src/config/env.ts
var PORTA_PADRAO = 3e3;
var TAMANHO_MINIMO_SEGREDO = 32;
var jwtSecret = (process.env.JWT_SECRET ?? "").trim();
var codeHmacKey = (process.env.CODE_HMAC_KEY ?? "").trim();
var env = {
  porta: Number(process.env.PORT ?? PORTA_PADRAO),
  ambiente: process.env.NODE_ENV ?? "development",
  // Vazio até o proprietário criar o banco no Neon e definir DATABASE_URL.
  databaseUrl: (process.env.DATABASE_URL ?? "").trim(),
  // Conexão direta (sem pooler) usada pelas migrações, quando informada.
  directUrl: (process.env.DIRECT_URL ?? "").trim(),
  // Segredos (mantidos apenas no servidor; veja .env.example).
  jwtSecret,
  codeHmacKey,
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN ?? "7d").trim(),
  // Origens permitidas para CORS (Expo web em dev + painel admin web na raiz).
  // Lista separada por vírgula; inclui localhost e 127.0.0.1.
  // Requisições sem Origin (app nativo/curl) não passam por essa checagem.
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:8081,http://127.0.0.1:8081,http://localhost:5173,http://127.0.0.1:5173").split(",").map((origem2) => origem2.trim()).filter((origem2) => origem2.length > 0),
  // A autenticação só opera com os dois segredos suficientemente fortes.
  // Caso contrário, /health continua funcionando, mas o login responde 503.
  authConfigurada: jwtSecret.length >= TAMANHO_MINIMO_SEGREDO && codeHmacKey.length >= TAMANHO_MINIMO_SEGREDO
};

// src/middleware/cors.ts
function corsDesenvolvimento(req, res, next) {
  const origem2 = req.headers.origin;
  if (typeof origem2 === "string" && env.corsOrigins.includes(origem2)) {
    res.setHeader("Access-Control-Allow-Origin", origem2);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
}

// src/erros.ts
var ErroHttp = class extends Error {
  status;
  codigo;
  constructor(status, codigo, mensagem) {
    super(mensagem);
    this.name = "ErroHttp";
    this.status = status;
    this.codigo = codigo;
  }
};
function servicoIndisponivel() {
  return new ErroHttp(503, "SERVICO_INDISPONIVEL", "Servi\xE7o temporariamente indispon\xEDvel.");
}

// src/middleware/erro.ts
function naoEncontrado(req, res) {
  res.status(404).json({
    erro: "Rota n\xE3o encontrada.",
    metodo: req.method,
    caminho: req.path
  });
}
function statusDoCorpo(erro) {
  if (typeof erro !== "object" || erro === null) return null;
  const tipo = erro.type;
  if (tipo === "entity.parse.failed") return 400;
  if (tipo === "entity.too.large") return 413;
  return null;
}
function ehErroDeBanco(erro) {
  return typeof erro === "object" && erro !== null && typeof erro.code === "string";
}
function tratarErro(erro, _req, res, _next) {
  if (erro instanceof ErroHttp) {
    res.status(erro.status).json({ erro: erro.message, codigo: erro.codigo });
    return;
  }
  const statusCorpo = statusDoCorpo(erro);
  if (statusCorpo === 400) {
    res.status(400).json({ erro: "Corpo da requisi\xE7\xE3o inv\xE1lido.", codigo: "CORPO_INVALIDO" });
    return;
  }
  if (statusCorpo === 413) {
    res.status(413).json({ erro: "Requisi\xE7\xE3o grande demais.", codigo: "CORPO_MUITO_GRANDE" });
    return;
  }
  if (ehErroDeBanco(erro)) {
    console.error("[erro-bd]", erro instanceof Error ? erro.message : erro);
    res.status(503).json({ erro: "Servi\xE7o temporariamente indispon\xEDvel.", codigo: "SERVICO_INDISPONIVEL" });
    return;
  }
  console.error("[erro]", erro instanceof Error ? erro.message : erro);
  res.status(500).json({ erro: "Erro interno do servidor.", codigo: "ERRO_INTERNO" });
}

// src/routes/index.ts
import { Router as Router9 } from "express";

// src/routes/admin.ts
import { Router } from "express";

// src/auth/codigo.ts
import { createHmac, randomInt } from "node:crypto";
var ALFABETO = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
var PREFIXO = "CMB";
var GRUPOS = 4;
var TAMANHO_GRUPO = 4;
var TAMANHO_MAX_CODIGO = 128;
function grupoAleatorio() {
  let saida = "";
  for (let i = 0; i < TAMANHO_GRUPO; i++) {
    saida += ALFABETO[randomInt(ALFABETO.length)];
  }
  return saida;
}
function gerarCodigo() {
  const grupos = Array.from({ length: GRUPOS }, grupoAleatorio);
  return `${PREFIXO}-${grupos.join("-")}`;
}
function identificadorDoCodigo(codigo) {
  if (!env.codeHmacKey) {
    throw new Error("CODE_HMAC_KEY n\xE3o configurada no servidor.");
  }
  return createHmac("sha256", env.codeHmacKey).update(codigo.trim()).digest("hex");
}

// src/db/pool.ts
import { Pool } from "pg";
var pool = null;
function temBancoConfigurado() {
  return env.databaseUrl.length > 0;
}
function obterPool() {
  if (!temBancoConfigurado()) {
    throw servicoIndisponivel();
  }
  if (!pool) {
    pool = new Pool({ connectionString: env.databaseUrl });
  }
  return pool;
}
async function testarConexao() {
  if (!temBancoConfigurado()) {
    return { ok: false, mensagem: "Banco ainda n\xE3o configurado (DATABASE_URL ausente)." };
  }
  try {
    const resultado = await obterPool().query("SELECT 1 AS ok");
    return {
      ok: resultado.rows[0]?.ok === 1,
      mensagem: "Conex\xE3o com o PostgreSQL funcionando."
    };
  } catch (erro) {
    return {
      ok: false,
      mensagem: erro instanceof Error ? erro.message : "Falha ao conectar ao banco."
    };
  }
}

// src/auth/reativacoes.ts
async function listarPendentes() {
  const { rows } = await obterPool().query(
    `SELECT r.id, r.user_id, r.created_at, u.name, u.account_type
       FROM reactivation_requests r
       JOIN users u ON u.id = r.user_id
      WHERE r.status = 'pendente'
      ORDER BY r.created_at ASC`
  );
  return rows.map((linha) => ({
    id: linha.id,
    usuarioId: linha.user_id,
    nome: linha.name,
    papel: linha.account_type,
    criadoEm: linha.created_at
  }));
}
async function decidirSolicitacao(id, aprovar, motivo) {
  const pool2 = obterPool();
  const cliente = await pool2.connect();
  try {
    await cliente.query("BEGIN");
    const { rows } = await cliente.query(
      `UPDATE reactivation_requests
          SET status = $2, rejection_reason = $3, updated_at = now()
        WHERE id = $1 AND status = 'pendente'
        RETURNING user_id`,
      [id, aprovar ? "aprovada" : "recusada", aprovar ? null : motivo]
    );
    if (rows.length === 0) {
      await cliente.query("ROLLBACK");
      return { ok: false };
    }
    if (aprovar) {
      await cliente.query("UPDATE users SET is_active = true, updated_at = now() WHERE id = $1", [
        rows[0].user_id
      ]);
    }
    await cliente.query("COMMIT");
    return { ok: true };
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
}

// src/auth/usuarios.ts
var COLUNAS = "id, name, phone, account_type, is_active";
var COLUNAS_LISTAGEM = "id, name, phone, account_type, is_active, code_suffix, created_at";
async function buscarUsuarioPorCodigoHash(hash) {
  const { rows } = await obterPool().query(
    `SELECT ${COLUNAS} FROM users WHERE access_code_hash = $1 LIMIT 1`,
    [hash]
  );
  return rows[0] ?? null;
}
async function buscarUsuarioPorId(id) {
  const { rows } = await obterPool().query(
    `SELECT ${COLUNAS} FROM users WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}
async function criarUsuario(dados) {
  const { rows } = await obterPool().query(
    `INSERT INTO users (name, phone, account_type, access_code_hash, code_suffix, is_active)
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING id`,
    [
      dados.nome,
      dados.telefone,
      dados.papel,
      dados.accessCodeHash,
      dados.codeSuffix ?? null
    ]
  );
  return rows[0];
}
async function listarUsuarios(limite, deslocamento, filtros = {}) {
  const condicoes = [];
  const valores = [];
  const busca = filtros.busca?.trim();
  if (busca) {
    valores.push(`%${busca}%`);
    condicoes.push(`(name ILIKE $${valores.length} OR phone ILIKE $${valores.length})`);
  }
  if (filtros.papel) {
    valores.push(filtros.papel);
    condicoes.push(`account_type = $${valores.length}`);
  }
  if (filtros.ativo !== void 0 && filtros.ativo !== null) {
    valores.push(filtros.ativo);
    condicoes.push(`is_active = $${valores.length}`);
  }
  const onde = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
  const pool2 = obterPool();
  const total = await pool2.query(
    `SELECT COUNT(*)::text AS total FROM users ${onde}`,
    valores
  );
  const itens = await pool2.query(
    `SELECT ${COLUNAS_LISTAGEM} FROM users ${onde}
      ORDER BY created_at DESC, id LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
    [...valores, limite, deslocamento]
  );
  return { itens: itens.rows, total: Number(total.rows[0]?.total ?? 0) };
}
async function atualizarStatusUsuario(id, ativo) {
  const { rows } = await obterPool().query(
    `UPDATE users SET is_active = $2, updated_at = now() WHERE id = $1 RETURNING ${COLUNAS_LISTAGEM}`,
    [id, ativo]
  );
  return rows[0] ?? null;
}
async function substituirHashDeCodigo(id, hash, codeSuffix) {
  const { rows } = await obterPool().query(
    `UPDATE users
        SET access_code_hash = $2,
            code_suffix = COALESCE($3, code_suffix),
            updated_at = now()
      WHERE id = $1
      RETURNING ${COLUNAS_LISTAGEM}`,
    [id, hash, codeSuffix ?? null]
  );
  return rows[0] ?? null;
}

// src/auth/jwt.ts
import { SignJWT, jwtVerify } from "jose";
var ALGORITMO = "HS256";
function chave() {
  if (!env.jwtSecret) {
    throw new Error("JWT_SECRET n\xE3o configurada no servidor.");
  }
  return new TextEncoder().encode(env.jwtSecret);
}
async function assinarToken(dados) {
  return await new SignJWT({ papel: dados.papel }).setProtectedHeader({ alg: ALGORITMO }).setSubject(dados.sub).setIssuedAt().setExpirationTime(env.jwtExpiresIn).sign(chave());
}
async function verificarToken(token) {
  const { payload } = await jwtVerify(token, chave(), { algorithms: [ALGORITMO] });
  return payload;
}

// src/middleware/autenticacao.ts
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function naoAutorizado(res, mensagem) {
  res.status(401).json({ erro: mensagem, codigo: "NAO_AUTENTICADO" });
}
async function exigirAutenticacao(req, res, next) {
  if (!env.authConfigurada) {
    res.status(503).json({ erro: "Autentica\xE7\xE3o indispon\xEDvel no servidor.", codigo: "AUTH_INDISPONIVEL" });
    return;
  }
  const cabecalho = req.headers.authorization;
  if (!cabecalho || !cabecalho.startsWith("Bearer ")) {
    naoAutorizado(res, "Sess\xE3o n\xE3o informada.");
    return;
  }
  const token = cabecalho.slice("Bearer ".length).trim();
  let id = "";
  try {
    const payload = await verificarToken(token);
    id = typeof payload.sub === "string" ? payload.sub : "";
  } catch {
    naoAutorizado(res, "Sess\xE3o inv\xE1lida ou expirada.");
    return;
  }
  if (!UUID.test(id)) {
    naoAutorizado(res, "Sess\xE3o inv\xE1lida ou expirada.");
    return;
  }
  const usuario = await buscarUsuarioPorId(id);
  if (!usuario) {
    naoAutorizado(res, "Sess\xE3o inv\xE1lida ou expirada.");
    return;
  }
  if (!usuario.is_active) {
    res.status(403).json({
      erro: "Conta desativada. Procure o administrador da Central de Motoboys.",
      codigo: "CONTA_DESATIVADA"
    });
    return;
  }
  const autenticado = {
    id: usuario.id,
    nome: usuario.name,
    papel: usuario.account_type,
    ativo: usuario.is_active
  };
  req.usuario = autenticado;
  next();
}
function exigirPapel(...papeis) {
  return (req, res, next) => {
    if (!req.usuario) {
      naoAutorizado(res, "Sess\xE3o n\xE3o informada.");
      return;
    }
    if (!papeis.includes(req.usuario.papel)) {
      res.status(403).json({ erro: "Acesso n\xE3o autorizado para este perfil.", codigo: "SEM_PERMISSAO" });
      return;
    }
    next();
  };
}

// src/rotas/admin-operacao.ts
var MENSAGEM_MANUTENCAO = "Estamos em manuten\xE7\xE3o. Tente novamente mais tarde.";
var LIMITE_TENTATIVAS = 5;
var DIAS_EXPIRA_TENTATIVAS = 30;
var CHAVE_MANUTENCAO = "manutencao";
async function manutencaoAtiva() {
  const { rows } = await obterPool().query(
    "SELECT value FROM system_settings WHERE key = $1",
    [CHAVE_MANUTENCAO]
  );
  return rows[0]?.value?.ativa === true;
}
async function definirManutencao(ativa, atorId) {
  await obterPool().query(
    `INSERT INTO system_settings (key, value, updated_at, updated_by_id)
     VALUES ($1, $2::jsonb, now(), $3)
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value,
           updated_at = now(),
           updated_by_id = EXCLUDED.updated_by_id`,
    [CHAVE_MANUTENCAO, JSON.stringify({ ativa }), atorId]
  );
  return ativa;
}
async function registrarAuditoria(dados) {
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
      dados.detalhes ? JSON.stringify(dados.detalhes) : null
    ]
  );
}
async function listarAuditoria(limite, deslocamento) {
  const pool2 = obterPool();
  const total = await pool2.query(
    "SELECT COUNT(*)::text AS total FROM admin_audit"
  );
  const itens = await pool2.query(
    `SELECT id, actor_name, action, entity, entity_id, details, created_at
       FROM admin_audit
      ORDER BY created_at DESC, id DESC
      LIMIT $1 OFFSET $2`,
    [limite, deslocamento]
  );
  return {
    itens: itens.rows.map((l) => ({
      id: l.id,
      atorNome: l.actor_name,
      acao: l.action,
      entidade: l.entity,
      entidadeId: l.entity_id,
      detalhes: l.details,
      criadoEm: l.created_at
    })),
    total: Number(total.rows[0]?.total ?? 0)
  };
}
async function registrarTentativa(dados) {
  const { rows } = await obterPool().query(
    `INSERT INTO login_attempts (user_id, user_name, origin, attempts, blocked)
     VALUES ($1, $2, $3, 1, false)
     ON CONFLICT (origin, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid))
     DO UPDATE SET
       attempts = login_attempts.attempts + 1,
       user_name = COALESCE(EXCLUDED.user_name, login_attempts.user_name),
       updated_at = now(),
       blocked = login_attempts.attempts + 1 >= $4
     RETURNING attempts, blocked`,
    [dados.userId, dados.nomeUsuario, dados.origem, LIMITE_TENTATIVAS]
  );
  const linha = rows[0];
  return { tentativas: linha?.attempts ?? 1, bloqueado: linha?.blocked === true };
}
async function origemBloqueada(origem2) {
  const { rows } = await obterPool().query(
    "SELECT blocked AS bloqueado FROM login_attempts WHERE origin = $1 AND blocked LIMIT 1",
    [origem2]
  );
  return rows[0]?.bloqueado === true;
}
async function listarTentativas() {
  const pool2 = obterPool();
  await pool2.query(
    `DELETE FROM login_attempts
      WHERE created_at < now() - ($1 || ' days')::interval`,
    [String(DIAS_EXPIRA_TENTATIVAS)]
  );
  const { rows } = await pool2.query(
    `SELECT id, user_id, user_name, origin, attempts, blocked,
            created_at, updated_at, released_at
       FROM login_attempts
      ORDER BY created_at ASC, id ASC`
  );
  return rows.map((l) => ({
    id: l.id,
    userId: l.user_id,
    nomeUsuario: l.user_name,
    origem: l.origin,
    tentativas: l.attempts,
    bloqueado: l.blocked,
    criadoEm: l.created_at,
    atualizadoEm: l.updated_at,
    liberadoEm: l.released_at
  }));
}
async function liberarTentativa(id) {
  const { rows } = await obterPool().query(
    `UPDATE login_attempts
        SET attempts = 0, blocked = false, released_at = now(), updated_at = now()
      WHERE id = $1
      RETURNING id`,
    [id]
  );
  return rows.length > 0;
}
async function limparTentativa(origem2, userId) {
  await obterPool().query(
    `DELETE FROM login_attempts
      WHERE origin = $1 AND user_id = $2`,
    [origem2, userId]
  );
}
async function contadoresPainel() {
  const pool2 = obterPool();
  const [usuarios, motoboysOnline, entregas, rotasDia, encaixes, reativacoes, bloqueadas] = await Promise.all([
    pool2.query(
      `SELECT COUNT(*)::text AS total,
                COUNT(*) FILTER (WHERE account_type = 'motoboy')::text AS motoboys,
                COUNT(*) FILTER (WHERE account_type = 'lojista')::text AS lojistas,
                COUNT(*) FILTER (WHERE account_type = 'pessoa_fisica')::text AS pessoas,
                COUNT(*) FILTER (WHERE account_type = 'admin')::text AS admins,
                COUNT(*) FILTER (WHERE is_active)::text AS ativos,
                COUNT(*) FILTER (WHERE NOT is_active)::text AS inativos
           FROM users`
    ),
    pool2.query(
      `SELECT COUNT(*)::text AS total FROM users
          WHERE account_type = 'motoboy' AND is_online`
    ),
    pool2.query(
      `SELECT COUNT(*)::text AS total,
                COUNT(*) FILTER (WHERE status = 'aguardando')::text AS aguardando,
                COUNT(*) FILTER (WHERE status IN ('aceita', 'em_rota'))::text AS ativas,
                COUNT(*) FILTER (WHERE status = 'entregue')::text AS entregues,
                COUNT(*) FILTER (WHERE status = 'cancelada')::text AS canceladas,
                COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::text AS hoje
           FROM deliveries`
    ),
    pool2.query(
      `SELECT COUNT(*)::text AS total,
                COUNT(*) FILTER (WHERE status = 'publicada')::text AS publicadas,
                COUNT(*) FILTER (WHERE status = 'contratada')::text AS contratadas,
                COUNT(*) FILTER (WHERE status = 'em_andamento')::text AS emAndamento,
                COUNT(*) FILTER (WHERE status = 'concluida')::text AS concluidas,
                COUNT(*) FILTER (WHERE status = 'cancelada')::text AS canceladas
           FROM daily_routes`
    ),
    pool2.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'pendente')::text AS pendentes,
                COUNT(*) FILTER (WHERE status = 'pendente' AND counter_amount IS NOT NULL)::text AS emNegociacao,
                COUNT(*) FILTER (WHERE status = 'aceito')::text AS aceitos,
                COUNT(*) FILTER (WHERE status = 'recusado')::text AS recusados
           FROM route_fittings`
    ),
    pool2.query(
      `SELECT COUNT(*)::text AS total FROM reactivation_requests WHERE status = 'pendente'`
    ),
    pool2.query(
      "SELECT COUNT(*)::text AS total FROM login_attempts WHERE blocked"
    )
  ]);
  const u = usuarios.rows[0];
  const e = entregas.rows[0];
  const r = rotasDia.rows[0];
  const c = encaixes.rows[0];
  return {
    usuarios: {
      total: Number(u?.total ?? 0),
      motoboys: Number(u?.motoboys ?? 0),
      lojistas: Number(u?.lojistas ?? 0),
      pessoas: Number(u?.pessoas ?? 0),
      admins: Number(u?.admins ?? 0),
      ativos: Number(u?.ativos ?? 0),
      inativos: Number(u?.inativos ?? 0)
    },
    motoboysOnline: Number(motoboysOnline.rows[0]?.total ?? 0),
    entregas: {
      total: Number(e?.total ?? 0),
      aguardando: Number(e?.aguardando ?? 0),
      ativas: Number(e?.ativas ?? 0),
      entregues: Number(e?.entregues ?? 0),
      canceladas: Number(e?.canceladas ?? 0),
      hoje: Number(e?.hoje ?? 0)
    },
    rotasDoDia: {
      total: Number(r?.total ?? 0),
      publicadas: Number(r?.publicadas ?? 0),
      contratadas: Number(r?.contratadas ?? 0),
      emAndamento: Number(r?.emAndamento ?? 0),
      concluidas: Number(r?.concluidas ?? 0),
      canceladas: Number(r?.canceladas ?? 0)
    },
    encaixes: {
      pendentes: Number(c?.pendentes ?? 0),
      emNegociacao: Number(c?.emNegociacao ?? 0),
      aceitos: Number(c?.aceitos ?? 0),
      recusados: Number(c?.recusados ?? 0)
    },
    reativacoesPendentes: Number(reativacoes.rows[0]?.total ?? 0),
    tentativasBloqueadas: Number(bloqueadas.rows[0]?.total ?? 0)
  };
}
async function listarMotoboysOnline() {
  const { rows } = await obterPool().query(
    `SELECT id, name, phone, code_suffix, is_online, last_seen_at
       FROM users
      WHERE account_type = 'motoboy'
        AND (is_online OR last_seen_at >= now() - interval '5 minutes')
      ORDER BY is_online DESC, last_seen_at DESC NULLS LAST, name ASC`
  );
  return rows.map((l) => ({
    id: l.id,
    nome: l.name,
    telefone: l.phone,
    codigo: l.code_suffix,
    online: l.is_online,
    ultimoAcesso: l.last_seen_at
  }));
}

// src/rotas/rotas-dia.ts
var COLUNAS2 = `r.id, r.publisher_id, r.contracted_courier_id, r.title, r.origin, r.destination,
  r.service_date::text AS service_date, r.departure_time, r.stops, r.description,
  r.offered_amount, r.agreed_amount, r.counter_amount, r.counter_at, r.status,
  r.cancel_reason, r.cancelled_by_id, r.created_at, r.updated_at, r.published_at,
  r.contracted_at, r.started_at, r.completed_at, r.ended_at,
  u.name AS publisher_name, u.phone AS publisher_phone`;
var FROM = `FROM daily_routes r LEFT JOIN users u ON u.id = r.publisher_id`;
function rotaDiaParaApi(r, opcoes = {}) {
  return {
    id: r.id,
    titulo: r.title,
    origem: r.origin,
    destino: r.destination,
    data: r.service_date,
    saida: r.departure_time,
    paradas: r.stops,
    descricao: r.description,
    valor: r.offered_amount,
    valorCombinado: r.agreed_amount,
    contraproposta: r.counter_amount,
    status: r.status,
    motivoCancelamento: r.cancel_reason,
    criadoEm: r.created_at,
    publicadoEm: r.published_at,
    contratadoEm: r.contracted_at,
    iniciadoEm: r.started_at,
    concluidoEm: r.completed_at,
    encerradoEm: r.ended_at,
    publicador: r.publisher_name,
    telefonePublicador: opcoes.mostrarContato ? r.publisher_phone : null
  };
}
async function criarRotaDia(dados) {
  const status = dados.publicar ? "publicada" : "rascunho";
  const { rows } = await obterPool().query(
    `INSERT INTO daily_routes
       (publisher_id, title, origin, destination, service_date, departure_time,
        stops, description, offered_amount, status, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
             CASE WHEN $10 = 'publicada' THEN now() ELSE NULL END)
     RETURNING id`,
    [
      dados.publisherId,
      dados.titulo,
      dados.origem,
      dados.destino,
      dados.data,
      dados.saida,
      dados.paradas,
      dados.descricao,
      dados.valor,
      status
    ]
  );
  const rota = await buscarRotaDia(rows[0].id);
  return rota;
}
async function buscarRotaDia(id) {
  const { rows } = await obterPool().query(
    `SELECT ${COLUNAS2} ${FROM} WHERE r.id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}
async function listarRotasDiaDisponiveis(courierId) {
  const { rows } = await obterPool().query(
    `SELECT ${COLUNAS2} ${FROM}
      WHERE r.status = 'publicada'
        AND r.service_date >= CURRENT_DATE
        AND r.contracted_courier_id IS NULL
        AND r.publisher_id <> $1
      ORDER BY r.service_date ASC, r.departure_time ASC NULLS LAST, r.created_at DESC`,
    [courierId]
  );
  return rows;
}
async function listarRotasDiaDoPublicador(publisherId) {
  const { rows } = await obterPool().query(
    `SELECT ${COLUNAS2} ${FROM}
      WHERE r.publisher_id = $1
      ORDER BY r.service_date DESC, r.created_at DESC
      LIMIT 100`,
    [publisherId]
  );
  return rows;
}
async function listarRotasDiaContratadas(courierId) {
  const { rows } = await obterPool().query(
    `SELECT ${COLUNAS2} ${FROM}
      WHERE r.contracted_courier_id = $1
      ORDER BY r.service_date ASC, r.created_at DESC
      LIMIT 100`,
    [courierId]
  );
  return rows;
}
async function publicarRotaDia(id, publisherId) {
  const { rows } = await obterPool().query(
    `UPDATE daily_routes
        SET status = 'publicada', published_at = now(), updated_at = now()
      WHERE id = $1 AND publisher_id = $2 AND status = 'rascunho'
      RETURNING id, status, publisher_id, contracted_courier_id`,
    [id, publisherId]
  );
  if (rows[0]) {
    const rota = await buscarRotaDia(id);
    return { ok: true, rota };
  }
  const atual = await buscarRotaDia(id);
  if (!atual) return { ok: false, motivo: "nao_encontrada" };
  if (atual.publisher_id !== publisherId) return { ok: false, motivo: "nao_permitido" };
  return { ok: false, motivo: "estado_invalido" };
}
async function aceitarRotaDia(id, courierId, contraproposta) {
  const cliente = await obterPool().connect();
  try {
    await cliente.query("BEGIN");
    const { rows } = await cliente.query(
      `SELECT publisher_id, contracted_courier_id, offered_amount, status,
              service_date::text AS service_date
         FROM daily_routes WHERE id = $1 FOR UPDATE`,
      [id]
    );
    const atual = rows[0];
    if (!atual) {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "nao_encontrada" };
    }
    if (atual.publisher_id === courierId) {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "nao_permitido" };
    }
    if (atual.status !== "publicada" || atual.contracted_courier_id !== null) {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "ja_contratada" };
    }
    if (atual.service_date < hojeIso()) {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "estado_invalido" };
    }
    const valorCombinado = contraproposta ?? atual.offered_amount;
    const atualizada = await cliente.query(
      `UPDATE daily_routes
          SET status = 'contratada',
              contracted_courier_id = $2,
              contracted_at = now(),
              agreed_amount = $3::numeric,
              counter_amount = $4::numeric,
              counter_at = CASE WHEN $4::numeric IS NULL THEN NULL ELSE now() END,
              updated_at = now()
        WHERE id = $1
        RETURNING id`,
      [id, courierId, valorCombinado, contraproposta]
    );
    await cliente.query("COMMIT");
    const rota = await buscarRotaDia(atualizada.rows[0].id);
    return { ok: true, rota };
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
}
async function iniciarRotaDia(id, courierId) {
  const { rows } = await obterPool().query(
    `UPDATE daily_routes
        SET status = 'em_andamento', started_at = now(), updated_at = now()
      WHERE id = $1 AND contracted_courier_id = $2 AND status = 'contratada'
      RETURNING id`,
    [id, courierId]
  );
  if (rows[0]) {
    const rota = await buscarRotaDia(id);
    return { ok: true, rota };
  }
  return classificarFalhaRotaDia(id, courierId, "contratada");
}
async function concluirRotaDia(id, courierId, valorFinal) {
  const { rows } = await obterPool().query(
    `UPDATE daily_routes
        SET status = 'concluida',
            completed_at = now(),
            ended_at = now(),
            agreed_amount = COALESCE($3::numeric, agreed_amount),
            updated_at = now()
      WHERE id = $1 AND contracted_courier_id = $2 AND status = 'em_andamento'
      RETURNING id`,
    [id, courierId, valorFinal]
  );
  if (rows[0]) {
    const rota = await buscarRotaDia(id);
    return { ok: true, rota };
  }
  return classificarFalhaRotaDia(id, courierId, "em_andamento");
}
async function cancelarRotaDia(id, publisherId, motivo) {
  const { rows } = await obterPool().query(
    `UPDATE daily_routes
        SET status = 'cancelada',
            cancel_reason = $3,
            cancelled_by_id = $2,
            ended_at = now(),
            updated_at = now()
      WHERE id = $1 AND publisher_id = $2
        AND status IN ('rascunho', 'publicada', 'contratada', 'em_andamento')
      RETURNING id`,
    [id, publisherId, motivo]
  );
  if (rows[0]) {
    const rota = await buscarRotaDia(id);
    return { ok: true, rota };
  }
  return classificarFalhaRotaDia(id, publisherId, null);
}
async function classificarFalhaRotaDia(id, usuarioId, statusEsperado) {
  const atual = await buscarRotaDia(id);
  if (!atual) return { ok: false, motivo: "nao_encontrada" };
  const dono = atual.publisher_id === usuarioId || atual.contracted_courier_id === usuarioId;
  if (!dono) return { ok: false, motivo: "nao_permitido" };
  if (statusEsperado && atual.status !== statusEsperado) {
    if (atual.status === "contratada" || atual.status === "em_andamento") {
      return { ok: false, motivo: "ja_contratada" };
    }
    return { ok: false, motivo: "estado_invalido" };
  }
  return { ok: false, motivo: "estado_invalido" };
}
function hojeIso() {
  const agora = /* @__PURE__ */ new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}
async function listarRotasDiaAdmin(filtros, limite, deslocamento) {
  const condicoes = [];
  const valores = [];
  if (filtros.status) {
    valores.push(filtros.status);
    condicoes.push(`r.status = $${valores.length}`);
  }
  if (filtros.data) {
    valores.push(filtros.data);
    condicoes.push(`r.service_date = $${valores.length}::date`);
  }
  if (filtros.publicador) {
    valores.push(filtros.publicador);
    condicoes.push(`r.publisher_id = $${valores.length}::uuid`);
  }
  if (filtros.motoboy) {
    valores.push(filtros.motoboy);
    condicoes.push(`r.contracted_courier_id = $${valores.length}::uuid`);
  }
  const onde = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
  const pool2 = obterPool();
  const total = await pool2.query(
    `SELECT COUNT(*)::text AS total FROM daily_routes r ${onde}`,
    valores
  );
  const itens = await pool2.query(
    `SELECT ${COLUNAS2} ${FROM} ${onde}
      ORDER BY r.service_date DESC, r.created_at DESC
      LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
    [...valores, limite, deslocamento]
  );
  return { itens: itens.rows, total: Number(total.rows[0]?.total ?? 0) };
}

// src/utils/validacao.ts
var UUID2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function ehUuid(valor) {
  return typeof valor === "string" && UUID2.test(valor);
}
function limparTexto(valor) {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim();
  return limpo.length > 0 ? limpo : null;
}
function validarTamanho(valor, max, nome) {
  if (valor !== null && valor.length > max) {
    return `O campo "${nome}" deve ter no m\xE1ximo ${max} caracteres.`;
  }
  return null;
}
function inteiroLimitado(valor, padrao, min, max) {
  const numero = typeof valor === "string" ? Number.parseInt(valor, 10) : Number.NaN;
  if (!Number.isInteger(numero)) return padrao;
  return Math.min(Math.max(numero, min), max);
}

// src/routes/admin.ts
var rotasAdmin = Router();
var sessao = exigirAutenticacao;
var somenteAdmin = [sessao, exigirPapel("admin")];
var TIPOS_CRIAVEIS = ["motoboy", "lojista", "pessoa_fisica"];
function usuarioParaAdmin(u) {
  return {
    id: u.id,
    nome: u.name,
    papel: u.account_type,
    telefone: u.phone,
    ativo: u.is_active,
    // Sufixo do código (4 últimos caracteres). O código COMPLETO nunca é
    // guardado em texto puro — o admin só o vê no momento da criação.
    codigo: u.code_suffix,
    criadoEm: u.created_at
  };
}
function exigirId(valor) {
  if (!ehUuid(valor)) throw new ErroHttp(400, "ID_INVALIDO", "Identificador inv\xE1lido.");
  return valor;
}
function sufixoDoCodigo(codigo) {
  return codigo.slice(-4);
}
async function auditar(req, acao, entidade, entidadeId, detalhes) {
  try {
    await registrarAuditoria({
      atorId: req.usuario.id,
      atorNome: req.usuario.nome,
      acao,
      entidade,
      entidadeId,
      detalhes: detalhes ?? null
    });
  } catch (erro) {
    console.error("Falha ao registrar auditoria:", erro instanceof Error ? erro.message : erro);
  }
}
rotasAdmin.post("/admin/users", ...somenteAdmin, async (req, res) => {
  const corpo = req.body ?? {};
  const tipo = limparTexto(corpo.tipoConta);
  if (!tipo || !TIPOS_CRIAVEIS.includes(tipo)) {
    throw new ErroHttp(
      400,
      "TIPO_INVALIDO",
      "Informe o tipo de conta: motoboy, lojista ou pessoa_fisica."
    );
  }
  const nome = limparTexto(corpo.nome);
  const telefone = limparTexto(corpo.telefone);
  const erroNome = validarTamanho(nome, 120, "nome");
  if (erroNome) throw new ErroHttp(400, "DADOS_INVALIDOS", erroNome);
  const erroTelefone = validarTamanho(telefone, 30, "telefone");
  if (erroTelefone) throw new ErroHttp(400, "DADOS_INVALIDOS", erroTelefone);
  const codigo = gerarCodigo();
  const criado = await criarUsuario({
    nome,
    telefone,
    papel: tipo,
    accessCodeHash: identificadorDoCodigo(codigo),
    codeSuffix: sufixoDoCodigo(codigo)
  });
  await auditar(req, "usuario_criado", "usuario", criado.id, { papel: tipo, nome });
  res.status(201).json({
    usuario: { id: criado.id, nome, papel: tipo, telefone, ativo: true },
    codigo,
    aviso: "Entregue este c\xF3digo ao usu\xE1rio agora: ele n\xE3o ser\xE1 mostrado novamente."
  });
});
rotasAdmin.get("/admin/users", ...somenteAdmin, async (req, res) => {
  const limite = inteiroLimitado(req.query.limite, 50, 1, 200);
  const deslocamento = inteiroLimitado(req.query.deslocamento, 0, 0, 1e6);
  const busca = typeof req.query.busca === "string" ? req.query.busca.trim() : "";
  const papel = typeof req.query.papel === "string" ? req.query.papel.trim() : "";
  const ativo = req.query.ativo === "true" ? true : req.query.ativo === "false" ? false : null;
  const { itens, total } = await listarUsuarios(limite, deslocamento, {
    busca: busca || null,
    papel: papel || null,
    ativo
  });
  res.json({ usuarios: itens.map(usuarioParaAdmin), total, limite, deslocamento });
});
rotasAdmin.patch("/admin/users/:id/status", ...somenteAdmin, async (req, res) => {
  const id = exigirId(req.params.id);
  const corpo = req.body ?? {};
  if (typeof corpo.ativo !== "boolean") {
    throw new ErroHttp(400, "DADOS_INVALIDOS", 'Informe "ativo" como verdadeiro ou falso.');
  }
  if (corpo.ativo === false && req.usuario?.id === id) {
    throw new ErroHttp(409, "AUTO_DESATIVACAO", "O administrador n\xE3o pode desativar a pr\xF3pria conta.");
  }
  const atualizado = await atualizarStatusUsuario(id, corpo.ativo);
  if (!atualizado) throw new ErroHttp(404, "USUARIO_NAO_ENCONTRADO", "Usu\xE1rio n\xE3o encontrado.");
  await auditar(req, corpo.ativo ? "usuario_ativado" : "usuario_desativado", "usuario", id, {
    nome: atualizado.name,
    papel: atualizado.account_type
  });
  res.json({ usuario: usuarioParaAdmin(atualizado) });
});
rotasAdmin.post("/admin/users/:id/replace-code", ...somenteAdmin, async (req, res) => {
  const id = exigirId(req.params.id);
  const codigo = gerarCodigo();
  const atualizado = await substituirHashDeCodigo(id, identificadorDoCodigo(codigo), sufixoDoCodigo(codigo));
  if (!atualizado) throw new ErroHttp(404, "USUARIO_NAO_ENCONTRADO", "Usu\xE1rio n\xE3o encontrado.");
  await auditar(req, "codigo_substituido", "usuario", id, { nome: atualizado.name });
  res.json({
    usuario: usuarioParaAdmin(atualizado),
    codigo,
    aviso: "Entregue este c\xF3digo agora: ele n\xE3o ser\xE1 mostrado novamente. O c\xF3digo anterior deixa de funcionar para NOVOS logins."
  });
});
rotasAdmin.get("/admin/reactivations", ...somenteAdmin, async (_req, res) => {
  const solicitacoes = await listarPendentes();
  res.json({ solicitacoes });
});
rotasAdmin.post("/admin/reactivations/:id/approve", ...somenteAdmin, async (req, res) => {
  const id = exigirId(req.params.id);
  const resultado = await decidirSolicitacao(id, true, null);
  if (!resultado.ok) {
    throw new ErroHttp(404, "SOLICITACAO_NAO_ENCONTRADA", "Solicita\xE7\xE3o pendente n\xE3o encontrada.");
  }
  await auditar(req, "reativacao_aprovada", "reativacao", id);
  res.json({ ok: true, status: "aprovada" });
});
rotasAdmin.post("/admin/reactivations/:id/reject", ...somenteAdmin, async (req, res) => {
  const id = exigirId(req.params.id);
  const corpo = req.body ?? {};
  const motivo = limparTexto(corpo.motivo);
  const erroMotivo = validarTamanho(motivo, 300, "motivo");
  if (erroMotivo) throw new ErroHttp(400, "DADOS_INVALIDOS", erroMotivo);
  const resultado = await decidirSolicitacao(id, false, motivo);
  if (!resultado.ok) {
    throw new ErroHttp(404, "SOLICITACAO_NAO_ENCONTRADA", "Solicita\xE7\xE3o pendente n\xE3o encontrada.");
  }
  await auditar(req, "reativacao_recusada", "reativacao", id, { motivo: motivo || null });
  res.json({ ok: true, status: "recusada" });
});
rotasAdmin.get("/admin/overview", ...somenteAdmin, async (_req, res) => {
  const [contadores, manutencao, auditoria] = await Promise.all([
    contadoresPainel(),
    manutencaoAtiva(),
    listarAuditoria(8, 0)
  ]);
  res.json({
    contadores,
    manutencao,
    mensagemManutencao: MENSAGEM_MANUTENCAO,
    ultimasAcoes: auditoria.itens
  });
});
rotasAdmin.get("/admin/audit", ...somenteAdmin, async (req, res) => {
  const limite = inteiroLimitado(req.query.limite, 50, 1, 200);
  const deslocamento = inteiroLimitado(req.query.deslocamento, 0, 0, 1e6);
  const { itens, total } = await listarAuditoria(limite, deslocamento);
  res.json({ acoes: itens, total, limite, deslocamento });
});
rotasAdmin.get("/admin/couriers/online", ...somenteAdmin, async (_req, res) => {
  const motoboys = await listarMotoboysOnline();
  res.json({ motoboys, total: motoboys.length });
});
rotasAdmin.get("/admin/daily-routes", ...somenteAdmin, async (req, res) => {
  const limite = inteiroLimitado(req.query.limite, 50, 1, 200);
  const deslocamento = inteiroLimitado(req.query.deslocamento, 0, 0, 1e6);
  const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
  const data = typeof req.query.data === "string" ? req.query.data.trim() : "";
  const publicador = typeof req.query.publicador === "string" ? req.query.publicador.trim() : "";
  const motoboy = typeof req.query.motoboy === "string" ? req.query.motoboy.trim() : "";
  const { itens, total } = await listarRotasDiaAdmin(
    {
      status: status || null,
      data: data || null,
      publicador: publicador || null,
      motoboy: motoboy || null
    },
    limite,
    deslocamento
  );
  res.json({ rotas: itens, total, limite, deslocamento });
});
rotasAdmin.get("/admin/settings/maintenance", ...somenteAdmin, async (_req, res) => {
  const ativa = await manutencaoAtiva();
  res.json({ ativa, mensagem: MENSAGEM_MANUTENCAO });
});
rotasAdmin.post("/admin/settings/maintenance", ...somenteAdmin, async (req, res) => {
  const corpo = req.body ?? {};
  if (typeof corpo.ativa !== "boolean") {
    throw new ErroHttp(400, "DADOS_INVALIDOS", 'Informe "ativa" como verdadeiro ou falso.');
  }
  const ativa = await definirManutencao(corpo.ativa, req.usuario.id);
  res.json({ ativa, mensagem: MENSAGEM_MANUTENCAO });
});
rotasAdmin.get("/admin/login-attempts", ...somenteAdmin, async (_req, res) => {
  const tentativas = await listarTentativas();
  res.json({ tentativas, total: tentativas.length });
});
rotasAdmin.post("/admin/login-attempts/:id/release", ...somenteAdmin, async (req, res) => {
  const id = exigirId(req.params.id);
  const liberada = await liberarTentativa(id);
  if (!liberada) {
    throw new ErroHttp(404, "TENTATIVA_NAO_ENCONTRADA", "Registro de tentativas n\xE3o encontrado.");
  }
  await auditar(req, "tentativa_liberada", "tentativa_login", id);
  res.json({ ok: true, liberado: true });
});

// src/routes/auth.ts
import { Router as Router2 } from "express";

// src/middleware/limite.ts
var JANELA_MS = 15 * 60 * 1e3;
var MAXIMO_TENTATIVAS = 20;
var janelas = /* @__PURE__ */ new Map();
function chave2(req) {
  return req.ip ?? req.socket.remoteAddress ?? "desconhecido";
}
function limparExpiradas(agora) {
  if (janelas.size < 1e3) return;
  for (const [nome, janela] of janelas) {
    if (janela.expiraEm <= agora) janelas.delete(nome);
  }
}
function limitarLogin(req, res, next) {
  const agora = Date.now();
  limparExpiradas(agora);
  const nome = chave2(req);
  const janela = janelas.get(nome);
  if (!janela || janela.expiraEm <= agora) {
    janelas.set(nome, { contagem: 1, expiraEm: agora + JANELA_MS });
    next();
    return;
  }
  if (janela.contagem >= MAXIMO_TENTATIVAS) {
    const segundos = Math.ceil((janela.expiraEm - agora) / 1e3);
    res.set("Retry-After", String(segundos));
    res.status(429).json({
      erro: "Muitas tentativas de login. Aguarde alguns minutos e tente novamente.",
      codigo: "MUITAS_TENTATIVAS"
    });
    return;
  }
  janela.contagem += 1;
  next();
}
function registrarSucessoLogin(req) {
  janelas.delete(chave2(req));
}

// src/routes/auth.ts
var rotasAuth = Router2();
function paraPublico(usuario) {
  return {
    id: usuario.id,
    nome: usuario.name,
    papel: usuario.account_type,
    ativo: usuario.is_active
  };
}
function extrairCodigo(corpo) {
  if (typeof corpo !== "object" || corpo === null) return null;
  const codigo = corpo.codigo;
  if (typeof codigo !== "string") return null;
  const limpo = codigo.trim();
  return limpo.length > 0 ? limpo : null;
}
function origem(req) {
  return req.ip ?? req.socket.remoteAddress ?? "desconhecida";
}
rotasAuth.get("/status", async (_req, res) => {
  const ativa = await manutencaoAtiva();
  res.json({ manutencao: ativa, mensagem: ativa ? MENSAGEM_MANUTENCAO : null });
});
rotasAuth.post("/auth/login", limitarLogin, async (req, res) => {
  if (!env.authConfigurada) {
    res.status(503).json({ erro: "Autentica\xE7\xE3o indispon\xEDvel no servidor.", codigo: "AUTH_INDISPONIVEL" });
    return;
  }
  const codigo = extrairCodigo(req.body);
  if (!codigo) {
    res.status(400).json({ erro: "Informe o c\xF3digo de acesso.", codigo: "CODIGO_OBRIGATORIO" });
    return;
  }
  if (codigo.length > TAMANHO_MAX_CODIGO) {
    res.status(400).json({ erro: "C\xF3digo de acesso inv\xE1lido.", codigo: "CODIGO_INVALIDO" });
    return;
  }
  const de = origem(req);
  const usuario = await buscarUsuarioPorCodigoHash(identificadorDoCodigo(codigo));
  const ehAdmin = usuario?.account_type === "admin";
  if (!ehAdmin && await origemBloqueada(de)) {
    res.status(403).json({
      erro: "Acesso bloqueado por excesso de tentativas erradas. Procure o administrador da Central de Motoboys para liberar sua conta.",
      codigo: "ACESSO_BLOQUEADO"
    });
    return;
  }
  if (await manutencaoAtiva()) {
    if (!ehAdmin) {
      res.status(503).json({ erro: MENSAGEM_MANUTENCAO, codigo: "MANUTENCAO" });
      return;
    }
  }
  if (!usuario) {
    const registro = await registrarTentativa({ userId: null, nomeUsuario: null, origem: de });
    if (registro.bloqueado) {
      res.status(403).json({
        erro: "Acesso bloqueado por excesso de tentativas erradas. Procure o administrador da Central de Motoboys para liberar sua conta.",
        codigo: "ACESSO_BLOQUEADO"
      });
      return;
    }
    res.status(401).json({ erro: "C\xF3digo de acesso inv\xE1lido.", codigo: "CREDENCIAL_INVALIDA" });
    return;
  }
  if (!usuario.is_active) {
    res.status(403).json({
      erro: "Conta desativada. Procure o administrador da Central de Motoboys para solicitar a reativa\xE7\xE3o.",
      codigo: "CONTA_DESATIVADA"
    });
    return;
  }
  const token = await assinarToken({ sub: usuario.id, papel: usuario.account_type });
  registrarSucessoLogin(req);
  await limparTentativa(de, usuario.id);
  res.json({
    token,
    tipo: "Bearer",
    expiraEm: env.jwtExpiresIn,
    usuario: paraPublico(usuario)
  });
});
rotasAuth.get("/auth/me", exigirAutenticacao, (req, res) => {
  res.json({ usuario: req.usuario });
});

// src/routes/contabilidade.ts
import { Router as Router3 } from "express";

// src/entregas/despesas.ts
var COLUNAS3 = `id, courier_id, category, amount, expense_date, notes, created_at, updated_at`;
function despesaParaApi(d) {
  return {
    id: d.id,
    categoria: d.category,
    valor: Number(d.amount),
    data: typeof d.expense_date === "string" ? d.expense_date : formatarData(d.expense_date),
    observacao: d.notes,
    criadaEm: d.created_at,
    atualizadaEm: d.updated_at
  };
}
function formatarData(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}
async function criarDespesa(dados) {
  const { rows } = await obterPool().query(
    `INSERT INTO courier_expenses (courier_id, category, amount, expense_date, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${COLUNAS3}`,
    [dados.courierId, dados.categoria, dados.valor, dados.data, dados.observacao]
  );
  return rows[0];
}
async function listarDespesas(courierId) {
  const { rows } = await obterPool().query(
    `SELECT ${COLUNAS3} FROM courier_expenses
      WHERE courier_id = $1
      ORDER BY expense_date DESC, created_at DESC, id`,
    [courierId]
  );
  return rows;
}
async function atualizarDespesa(id, courierId, dados) {
  const cliente = await obterPool().connect();
  try {
    await cliente.query("BEGIN");
    const { rows } = await cliente.query(
      "SELECT courier_id FROM courier_expenses WHERE id = $1 FOR UPDATE",
      [id]
    );
    const atual = rows[0];
    if (!atual) {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "nao_encontrada" };
    }
    if (atual.courier_id !== courierId) {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "nao_permitido" };
    }
    const atualizada = await cliente.query(
      `UPDATE courier_expenses
          SET category = $2, amount = $3, expense_date = $4, notes = $5, updated_at = now()
        WHERE id = $1
        RETURNING ${COLUNAS3}`,
      [id, dados.categoria, dados.valor, dados.data, dados.observacao]
    );
    await cliente.query("COMMIT");
    return { ok: true, despesa: atualizada.rows[0] };
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
}
async function excluirDespesa(id, courierId) {
  const cliente = await obterPool().connect();
  try {
    await cliente.query("BEGIN");
    const { rows } = await cliente.query(
      "SELECT courier_id FROM courier_expenses WHERE id = $1 FOR UPDATE",
      [id]
    );
    const atual = rows[0];
    if (!atual) {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "nao_encontrada" };
    }
    if (atual.courier_id !== courierId) {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "nao_permitido" };
    }
    await cliente.query("DELETE FROM courier_expenses WHERE id = $1", [id]);
    await cliente.query("COMMIT");
    return { ok: true };
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
}
function formatarDia(v) {
  if (typeof v === "string") return v.slice(0, 10);
  const ano = v.getFullYear();
  const mes = String(v.getMonth() + 1).padStart(2, "0");
  const dia = String(v.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}
async function calcularResumoFinanceiro(courierId, inicio, fim) {
  const pool2 = obterPool();
  const entregas = await pool2.query(
    `SELECT to_char(completed_at::date, 'YYYY-MM-DD') AS dia,
            COALESCE(SUM(amount), 0)::text AS total,
            COUNT(*)::text AS quantidade
       FROM deliveries
      WHERE courier_id = $1
        AND status = 'entregue'
        AND completed_at IS NOT NULL
        AND completed_at::date BETWEEN $2::date AND $3::date
      GROUP BY completed_at::date
      ORDER BY completed_at::date`,
    [courierId, inicio, fim]
  );
  const despesas = await pool2.query(
    `SELECT to_char(expense_date, 'YYYY-MM-DD') AS dia,
            COALESCE(SUM(amount), 0)::text AS total,
            COUNT(*)::text AS quantidade
       FROM courier_expenses
      WHERE courier_id = $1
        AND expense_date BETWEEN $2::date AND $3::date
      GROUP BY expense_date
      ORDER BY expense_date`,
    [courierId, inicio, fim]
  );
  const porDiaEntregas = /* @__PURE__ */ new Map();
  let totalEntregas = 0;
  let quantidadeEntregas = 0;
  for (const r of entregas.rows) {
    const valor = Number(r.total);
    const quantidade = Number(r.quantidade);
    totalEntregas += valor;
    quantidadeEntregas += quantidade;
    porDiaEntregas.set(formatarDia(r.dia), { data: formatarDia(r.dia), valor, quantidade });
  }
  let totalDespesas = 0;
  let quantidadeDespesas = 0;
  for (const r of despesas.rows) {
    totalDespesas += Number(r.total);
    quantidadeDespesas += Number(r.quantidade);
  }
  const porDia = [...porDiaEntregas.values()].sort((a, b) => a.data.localeCompare(b.data));
  return {
    totalEntregas: arredondar(totalEntregas),
    quantidadeEntregas,
    totalDespesas: arredondar(totalDespesas),
    quantidadeDespesas,
    saldoEstimado: arredondar(totalEntregas - totalDespesas),
    porDia
  };
}
function arredondar(valor) {
  return Math.round(valor * 100) / 100;
}

// src/types/despesa.ts
var CATEGORIAS_DESPESA = ["gasolina", "oleo", "manutencao", "outros"];
function ehCategoriaDespesa(valor) {
  return typeof valor === "string" && CATEGORIAS_DESPESA.includes(valor);
}

// src/routes/contabilidade.ts
var rotasContabilidade = Router3();
var protecaoMotoboy = [exigirAutenticacao, exigirPapel("motoboy")];
function exigirId2(valor) {
  if (!ehUuid(valor)) throw new ErroHttp(400, "ID_INVALIDO", "Identificador inv\xE1lido.");
  return valor;
}
function valorObrigatorio(bruto) {
  if (bruto === void 0 || bruto === null || bruto === "") return { ok: false };
  const numero = typeof bruto === "number" ? bruto : typeof bruto === "string" ? Number(bruto.replace(",", ".")) : Number.NaN;
  if (!Number.isFinite(numero) || numero < 0 || numero > 9999999999e-2) return { ok: false };
  return { ok: true, valor: numero.toFixed(2) };
}
var DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
function dataValida(valor) {
  if (typeof valor !== "string" || !DATA_ISO.test(valor)) return null;
  const [ano, mes, dia] = valor.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) {
    return null;
  }
  return valor;
}
function exigirCategoria(valor) {
  if (!ehCategoriaDespesa(valor)) {
    throw new ErroHttp(
      400,
      "DADOS_INVALIDOS",
      "Categoria inv\xE1lida. Use gasolina, oleo, manutencao ou outros."
    );
  }
  return valor;
}
function lerDadosDespesa(bruto) {
  const categoria = exigirCategoria(bruto.categoria);
  const valor = valorObrigatorio(bruto.valor);
  if (!valor.ok) {
    throw new ErroHttp(400, "DADOS_INVALIDOS", "Valor inv\xE1lido. Use um n\xFAmero, por exemplo 50,00.");
  }
  const data = dataValida(bruto.data);
  if (!data) {
    throw new ErroHttp(400, "DADOS_INVALIDOS", "Data inv\xE1lida. Use o formato AAAA-MM-DD.");
  }
  const observacao = limparTexto(bruto.observacao);
  const erroObs = validarTamanho(observacao, 300, "observa\xE7\xE3o");
  if (erroObs) throw new ErroHttp(400, "DADOS_INVALIDOS", erroObs);
  return { categoria, valor: valor.valor, data, observacao };
}
rotasContabilidade.get("/courier/financial-summary", ...protecaoMotoboy, async (req, res) => {
  const inicio = dataValida(req.query.inicio);
  const fim = dataValida(req.query.fim);
  if (!inicio || !fim) {
    throw new ErroHttp(400, "DADOS_INVALIDOS", "Per\xEDodo inv\xE1lido. Use datas AAAA-MM-DD.");
  }
  if (inicio > fim) {
    throw new ErroHttp(400, "DADOS_INVALIDOS", "A data inicial deve ser anterior \xE0 final.");
  }
  const resumo = await calcularResumoFinanceiro(req.usuario.id, inicio, fim);
  res.json({ resumo });
});
rotasContabilidade.get("/courier/expenses", ...protecaoMotoboy, async (req, res) => {
  const despesas = await listarDespesas(req.usuario.id);
  res.json({ despesas: despesas.map(despesaParaApi) });
});
rotasContabilidade.post("/courier/expenses", ...protecaoMotoboy, async (req, res) => {
  const corpo = req.body ?? {};
  const dados = lerDadosDespesa(corpo);
  const despesa = await criarDespesa({ courierId: req.usuario.id, ...dados });
  res.status(201).json({ despesa: despesaParaApi(despesa) });
});
rotasContabilidade.patch("/courier/expenses/:id", ...protecaoMotoboy, async (req, res) => {
  const id = exigirId2(req.params.id);
  const corpo = req.body ?? {};
  const dados = lerDadosDespesa(corpo);
  const resultado = await atualizarDespesa(id, req.usuario.id, dados);
  if (!resultado.ok) {
    throw new ErroHttp(404, "DESPESA_NAO_ENCONTRADA", "Despesa n\xE3o encontrada.");
  }
  res.json({ despesa: despesaParaApi(resultado.despesa) });
});
rotasContabilidade.delete("/courier/expenses/:id", ...protecaoMotoboy, async (req, res) => {
  const id = exigirId2(req.params.id);
  const resultado = await excluirDespesa(id, req.usuario.id);
  if (!resultado.ok) {
    throw new ErroHttp(404, "DESPESA_NAO_ENCONTRADA", "Despesa n\xE3o encontrada.");
  }
  res.json({ ok: true });
});

// src/routes/courier.ts
import { Router as Router4 } from "express";

// src/entregas/entregas.ts
var COLUNAS4 = `id, requester_id, courier_id, pickup_address, dropoff_address,
  amount, notes, status, cancel_reason, cancelled_by_id,
  assignment_cancelled_by_id, assignment_cancel_reason, assignment_cancelled_at,
  awaiting_substitute,
  created_at, accepted_at, started_at, completed_at`;
function entregaParaApi(e) {
  return {
    id: e.id,
    status: e.status,
    coleta: e.pickup_address,
    destino: e.dropoff_address,
    valor: e.amount === null ? null : Number(e.amount),
    observacoes: e.notes,
    criadoEm: e.created_at,
    aceitaEm: e.accepted_at,
    iniciadaEm: e.started_at,
    concluidaEm: e.completed_at,
    motivoCancelamento: e.cancel_reason,
    // Cancelamento da ATRIBUIÇÃO (regra 4 — substituição): o anterior é o
    // motivo do cancelamento definitivo do solicitante (regras 5/6).
    aguardandoSubstituto: e.awaiting_substitute,
    motivoCancelamentoSubstituto: e.assignment_cancel_reason
  };
}
async function criarEntrega(dados) {
  const { rows } = await obterPool().query(
    `INSERT INTO deliveries
       (requester_id, pickup_address, dropoff_address, amount, notes, status)
     VALUES ($1, $2, $3, $4, $5, 'aguardando')
     RETURNING ${COLUNAS4}`,
    [
      dados.solicitanteId,
      dados.coleta,
      dados.destino,
      dados.valor,
      dados.observacoes
    ]
  );
  return rows[0];
}
async function listarEntregas(filtro) {
  const pool2 = obterPool();
  const condicoes = [];
  const valores = [];
  if (filtro.solicitanteId) {
    valores.push(filtro.solicitanteId);
    condicoes.push(`requester_id = $${valores.length}`);
  } else if (filtro.entregadorId) {
    valores.push(filtro.entregadorId);
    condicoes.push(`courier_id = $${valores.length}`);
  }
  const onde = condicoes.length > 0 ? `WHERE ${condicoes.join(" AND ")}` : "";
  const total = await pool2.query(
    `SELECT COUNT(*)::text AS total FROM deliveries ${onde}`,
    valores
  );
  const limiteIdx = valores.length + 1;
  const deslocIdx = valores.length + 2;
  const itens = await pool2.query(
    `SELECT ${COLUNAS4} FROM deliveries ${onde}
      ORDER BY created_at DESC, id
      LIMIT $${limiteIdx} OFFSET $${deslocIdx}`,
    [...valores, filtro.limite, filtro.deslocamento]
  );
  return { itens: itens.rows, total: Number(total.rows[0]?.total ?? 0) };
}
async function buscarEntrega(id) {
  const { rows } = await obterPool().query(
    `SELECT ${COLUNAS4} FROM deliveries WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}
async function buscarEntregaAtiva(entregadorId) {
  const { rows } = await obterPool().query(
    `SELECT ${COLUNAS4} FROM deliveries
      WHERE courier_id = $1 AND status IN ('aceita', 'em_rota')
      ORDER BY accepted_at DESC, id
      LIMIT 1`,
    [entregadorId]
  );
  return rows[0] ?? null;
}
async function transicionarComoMotoboy(id, motoboyId, statusEsperado, colunaTempo, statusNovo) {
  const cliente = await obterPool().connect();
  try {
    await cliente.query("BEGIN");
    const { rows } = await cliente.query("SELECT courier_id, status FROM deliveries WHERE id = $1 FOR UPDATE", [id]);
    if (rows.length === 0) {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "nao_encontrada" };
    }
    const atual = rows[0];
    if (atual.courier_id !== motoboyId) {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "nao_permitido" };
    }
    if (atual.status !== statusEsperado) {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "estado_invalido" };
    }
    const atualizada = await cliente.query(
      `UPDATE deliveries
          SET status = $2,
              ${colunaTempo} = now()
        WHERE id = $1
        RETURNING ${COLUNAS4}`,
      [id, statusNovo]
    );
    await cliente.query("COMMIT");
    return { ok: true, entrega: atualizada.rows[0] };
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
}
function iniciarEntrega(id, motoboyId) {
  return transicionarComoMotoboy(id, motoboyId, "aceita", "started_at", "em_rota");
}
function finalizarEntrega(id, motoboyId) {
  return transicionarComoMotoboy(id, motoboyId, "em_rota", "completed_at", "entregue");
}
async function cancelarEntrega(id, solicitanteId, motivo) {
  const pool2 = obterPool();
  const cliente = await pool2.connect();
  try {
    await cliente.query("BEGIN");
    const { rows } = await cliente.query("SELECT requester_id, status FROM deliveries WHERE id = $1 FOR UPDATE", [id]);
    if (rows.length === 0) {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "nao_encontrada" };
    }
    const atual = rows[0];
    if (atual.requester_id !== solicitanteId) {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "nao_permitido" };
    }
    if (atual.status === "cancelada") {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "ja_cancelada" };
    }
    if (atual.status === "entregue") {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "nao_cancelavel" };
    }
    const exigeMotivo = atual.status === "aceita" || atual.status === "em_rota";
    if (exigeMotivo && !motivo) {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "motivo_obrigatorio" };
    }
    const atualizada = await cliente.query(
      `UPDATE deliveries
          SET status = 'cancelada',
              cancel_reason = $2,
              cancelled_by_id = $3,
              awaiting_substitute = false
        WHERE id = $1
        RETURNING ${COLUNAS4}`,
      [id, exigeMotivo ? motivo : null, solicitanteId]
    );
    await cliente.query("COMMIT");
    return { ok: true, entrega: atualizada.rows[0] };
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
}
async function cancelarEntregaPeloMotoboy(id, motoboyId, motivo) {
  const cliente = await obterPool().connect();
  try {
    await cliente.query("BEGIN");
    const { rows } = await cliente.query("SELECT courier_id, status FROM deliveries WHERE id = $1 FOR UPDATE", [id]);
    if (rows.length === 0) {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "nao_encontrada" };
    }
    const atual = rows[0];
    if (atual.courier_id !== motoboyId) {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "nao_permitido" };
    }
    if (atual.status === "cancelada") {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "ja_cancelada" };
    }
    if (atual.status !== "aceita" && atual.status !== "em_rota") {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "nao_cancelavel" };
    }
    if (!motivo) {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "motivo_obrigatorio" };
    }
    await cliente.query(
      `INSERT INTO delivery_offers (delivery_id, courier_id, status, expires_at, responded_at)
       VALUES ($1, $2, 'recusada', now(), now())
       ON CONFLICT DO NOTHING`,
      [id, motoboyId]
    );
    const atualizada = await cliente.query(
      `UPDATE deliveries
          SET status = 'aguardando',
              courier_id = NULL,
              accepted_at = NULL,
              started_at = NULL,
              assignment_cancelled_by_id = $2,
              assignment_cancel_reason = $3,
              assignment_cancelled_at = now(),
              awaiting_substitute = true
        WHERE id = $1
        RETURNING ${COLUNAS4}`,
      [id, motoboyId, motivo]
    );
    await cliente.query("COMMIT");
    return { ok: true, entrega: atualizada.rows[0] };
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
}

// src/entregas/disponibilidade.ts
var JANELA_ATIVIDADE_MINUTOS = 5;
function paraDisponibilidade(linha) {
  return {
    online: linha?.is_online ?? false,
    ultimaAtividade: linha?.last_seen_at ?? null
  };
}
async function definirDisponibilidade(motoboyId, online) {
  const { rows } = await obterPool().query(
    `UPDATE users
        SET is_online = $2,
            last_seen_at = CASE WHEN $2 THEN now() ELSE last_seen_at END,
            updated_at = now()
      WHERE id = $1 AND account_type = 'motoboy'
      RETURNING is_online, last_seen_at`,
    [motoboyId, online]
  );
  return paraDisponibilidade(rows[0]);
}
async function marcarAtividade(motoboyId) {
  await obterPool().query(
    `UPDATE users SET last_seen_at = now()
      WHERE id = $1 AND account_type = 'motoboy' AND is_online`,
    [motoboyId]
  );
}
async function buscarDisponibilidade(motoboyId) {
  const { rows } = await obterPool().query(
    `SELECT is_online, last_seen_at
       FROM users WHERE id = $1 AND account_type = 'motoboy' LIMIT 1`,
    [motoboyId]
  );
  return paraDisponibilidade(rows[0]);
}
async function contarMotoboysOnline() {
  const { rows } = await obterPool().query(
    `SELECT COUNT(*)::text AS total
       FROM users
      WHERE account_type = 'motoboy'
        AND is_active
        AND is_online
        AND last_seen_at IS NOT NULL
        AND last_seen_at >= now() - make_interval(mins => $1::int)`,
    [JANELA_ATIVIDADE_MINUTOS]
  );
  return Number(rows[0]?.total ?? 0);
}

// src/entregas/ofertas.ts
var PRAZO_OFERTA_SEGUNDOS = 30;
var JANELA_ATIVIDADE_MINUTOS2 = 5;
var COLUNAS_ENTREGA = `id, requester_id, courier_id, pickup_address, dropoff_address,
  amount, notes, status, cancel_reason, cancelled_by_id,
  assignment_cancelled_by_id, assignment_cancel_reason, assignment_cancelled_at,
  awaiting_substitute,
  created_at, accepted_at, started_at, completed_at`;
async function processarOfertas() {
  const pool2 = obterPool();
  await pool2.query(
    `UPDATE delivery_offers
        SET status = 'expirada', responded_at = now()
      WHERE status = 'pendente' AND expires_at <= now()`
  );
  const { rows } = await pool2.query(
    `SELECT d.id
       FROM deliveries d
      WHERE d.status = 'aguardando'
        AND NOT EXISTS (
          SELECT 1 FROM delivery_offers o
           WHERE o.delivery_id = d.id AND o.status = 'pendente'
        )
      ORDER BY d.created_at
      LIMIT 20`
  );
  for (const { id } of rows) {
    await ofertarProximoElegivel(id);
  }
}
async function ofertarProximoElegivel(deliveryId) {
  const cliente = await obterPool().connect();
  try {
    await cliente.query("BEGIN");
    const { rows: entregas } = await cliente.query(
      "SELECT status FROM deliveries WHERE id = $1 FOR UPDATE",
      [deliveryId]
    );
    if (entregas.length === 0 || entregas[0].status !== "aguardando") {
      await cliente.query("ROLLBACK");
      return;
    }
    const pendente = await cliente.query(
      `SELECT 1 FROM delivery_offers WHERE delivery_id = $1 AND status = 'pendente' LIMIT 1`,
      [deliveryId]
    );
    if (pendente.rows.length > 0) {
      await cliente.query("ROLLBACK");
      return;
    }
    const { rows: candidatos } = await cliente.query(
      `SELECT u.id
         FROM users u
         LEFT JOIN (
           SELECT courier_id, COUNT(*) AS oportunidades
             FROM delivery_offers
            GROUP BY courier_id
         ) o ON o.courier_id = u.id
        WHERE u.account_type = 'motoboy'
          AND u.is_active
          AND u.is_online
          AND u.last_seen_at IS NOT NULL
          AND u.last_seen_at >= now() - make_interval(mins => $2::int)
          AND NOT EXISTS (
            SELECT 1 FROM deliveries d
             WHERE d.courier_id = u.id AND d.status IN ('aceita', 'em_rota')
          )
          AND NOT EXISTS (
            SELECT 1 FROM delivery_offers p
             WHERE p.courier_id = u.id AND p.status = 'pendente'
          )
          AND NOT EXISTS (
            SELECT 1 FROM delivery_offers r
             WHERE r.delivery_id = $1 AND r.courier_id = u.id
               AND r.status IN ('pendente', 'recusada')
          )
        ORDER BY COALESCE(o.oportunidades, 0) ASC, random()
        LIMIT 1`,
      [deliveryId, JANELA_ATIVIDADE_MINUTOS2]
    );
    if (candidatos.length === 0) {
      await cliente.query("ROLLBACK");
      return;
    }
    await cliente.query(
      `INSERT INTO delivery_offers (delivery_id, courier_id, status, expires_at)
       VALUES ($1, $2, 'pendente', now() + make_interval(secs => $3::int))
       ON CONFLICT DO NOTHING`,
      [deliveryId, candidatos[0].id, PRAZO_OFERTA_SEGUNDOS]
    );
    await cliente.query("COMMIT");
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
}
async function listarOfertasPendentes(motoboyId) {
  const { rows } = await obterPool().query(
    `SELECT o.id, o.delivery_id, d.pickup_address, d.dropoff_address,
            d.amount, d.notes, o.expires_at, o.created_at
       FROM delivery_offers o
       JOIN deliveries d ON d.id = o.delivery_id
      WHERE o.courier_id = $1
        AND o.status = 'pendente'
        AND o.expires_at > now()
        AND d.status = 'aguardando'
      ORDER BY o.created_at`,
    [motoboyId]
  );
  return rows.map((r) => ({
    id: r.id,
    entregaId: r.delivery_id,
    coleta: r.pickup_address,
    destino: r.dropoff_address,
    valor: r.amount === null ? null : Number(r.amount),
    observacoes: r.notes,
    expiraEm: r.expires_at,
    criadaEm: r.created_at
  }));
}
async function aceitarOferta(ofertaId, motoboyId) {
  const cliente = await obterPool().connect();
  try {
    await cliente.query("BEGIN");
    const { rows: ofertas } = await cliente.query(
      `SELECT delivery_id, courier_id, status, expires_at
         FROM delivery_offers WHERE id = $1 FOR UPDATE`,
      [ofertaId]
    );
    const oferta = ofertas[0];
    if (!oferta || oferta.courier_id !== motoboyId) {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "nao_encontrada" };
    }
    if (oferta.status !== "pendente") {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "indisponivel" };
    }
    if (oferta.expires_at.getTime() <= Date.now()) {
      await cliente.query(
        `UPDATE delivery_offers SET status = 'expirada', responded_at = now() WHERE id = $1`,
        [ofertaId]
      );
      await cliente.query("COMMIT");
      return { ok: false, motivo: "expirada" };
    }
    const ocupado = await cliente.query(
      `SELECT 1 FROM deliveries
        WHERE courier_id = $1 AND status IN ('aceita', 'em_rota') LIMIT 1`,
      [motoboyId]
    );
    if (ocupado.rows.length > 0) {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "ocupado" };
    }
    const { rows: entregas } = await cliente.query(
      "SELECT status FROM deliveries WHERE id = $1 FOR UPDATE",
      [oferta.delivery_id]
    );
    if (entregas.length === 0 || entregas[0].status !== "aguardando") {
      await cliente.query(
        `UPDATE delivery_offers SET status = 'expirada', responded_at = now()
          WHERE id = $1 AND status = 'pendente'`,
        [ofertaId]
      );
      await cliente.query("COMMIT");
      return { ok: false, motivo: "entrega_indisponivel" };
    }
    const { rows: atualizada } = await cliente.query(
      `UPDATE deliveries
          SET status = 'aceita', courier_id = $2, accepted_at = now(),
              awaiting_substitute = false
        WHERE id = $1
        RETURNING ${COLUNAS_ENTREGA}`,
      [oferta.delivery_id, motoboyId]
    );
    await cliente.query(
      `UPDATE delivery_offers SET status = 'aceita', responded_at = now() WHERE id = $1`,
      [ofertaId]
    );
    await cliente.query(
      `UPDATE delivery_offers SET status = 'expirada', responded_at = now()
        WHERE courier_id = $1 AND status = 'pendente' AND id <> $2`,
      [motoboyId, ofertaId]
    );
    await cliente.query("COMMIT");
    return { ok: true, entrega: atualizada[0] };
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
}
async function recusarOferta(ofertaId, motoboyId) {
  const cliente = await obterPool().connect();
  try {
    await cliente.query("BEGIN");
    const { rows } = await cliente.query(
      `SELECT delivery_id, courier_id, status
         FROM delivery_offers WHERE id = $1 FOR UPDATE`,
      [ofertaId]
    );
    const oferta = rows[0];
    if (!oferta || oferta.courier_id !== motoboyId) {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "nao_encontrada" };
    }
    if (oferta.status !== "pendente") {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "indisponivel" };
    }
    await cliente.query(
      `UPDATE delivery_offers SET status = 'recusada', responded_at = now() WHERE id = $1`,
      [ofertaId]
    );
    await cliente.query("COMMIT");
    return { ok: true, entregaId: oferta.delivery_id };
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
}
async function expirarOfertasPendentesDaEntrega(deliveryId) {
  await obterPool().query(
    `UPDATE delivery_offers
        SET status = 'expirada', responded_at = now()
      WHERE delivery_id = $1 AND status = 'pendente'`,
    [deliveryId]
  );
}
async function expirarOfertasPendentesDoMotoboy(motoboyId) {
  await obterPool().query(
    `UPDATE delivery_offers
        SET status = 'expirada', responded_at = now()
      WHERE courier_id = $1 AND status = 'pendente'`,
    [motoboyId]
  );
}

// src/rotas/rotas.ts
var COLUNAS5 = `id, courier_id, destination, departure_time, return_forecast,
  distance, accepts_fittings, status, created_at, updated_at, ended_at`;
function rotaParaApi(r) {
  return {
    id: r.id,
    destino: r.destination,
    saidaPrevista: r.departure_time,
    retornoPrevisto: r.return_forecast,
    extensao: r.distance,
    aceitaEncaixes: r.accepts_fittings,
    status: r.status,
    criadaEm: r.created_at,
    atualizadaEm: r.updated_at,
    encerradaEm: r.ended_at
  };
}
async function criarRota(dados) {
  const { rows } = await obterPool().query(
    `INSERT INTO routes
       (courier_id, destination, departure_time, return_forecast,
        distance, accepts_fittings, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'publicada')
     RETURNING ${COLUNAS5}`,
    [
      dados.courierId,
      dados.destino,
      dados.saidaPrevista,
      dados.retornoPrevisto,
      dados.extensao,
      dados.aceitaEncaixes
    ]
  );
  return rows[0];
}
async function listarRotasDoMotoboy(courierId, apenasPublicadas) {
  const filtroStatus = apenasPublicadas ? `AND status = 'publicada'` : "";
  const { rows } = await obterPool().query(
    `SELECT ${COLUNAS5} FROM routes
      WHERE courier_id = $1 ${filtroStatus}
      ORDER BY created_at DESC, id`,
    [courierId]
  );
  return rows;
}
async function listarRotasDisponiveis() {
  const { rows } = await obterPool().query(
    `SELECT ${COLUNAS5} FROM routes
      WHERE status = 'publicada' AND accepts_fittings
      ORDER BY created_at DESC, id`,
    []
  );
  return rows;
}
async function atualizarRota(id, courierId, dados) {
  const cliente = await obterPool().connect();
  try {
    await cliente.query("BEGIN");
    const { rows } = await cliente.query(
      "SELECT courier_id, status FROM routes WHERE id = $1 FOR UPDATE",
      [id]
    );
    const atual = rows[0];
    if (!atual) {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "nao_encontrada" };
    }
    if (atual.courier_id !== courierId) {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "nao_permitido" };
    }
    if (atual.status !== "publicada") {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "estado_invalido" };
    }
    const atualizada = await cliente.query(
      `UPDATE routes
          SET destination = $2,
              departure_time = $3,
              return_forecast = $4,
              distance = $5,
              accepts_fittings = $6,
              updated_at = now()
        WHERE id = $1
        RETURNING ${COLUNAS5}`,
      [
        id,
        dados.destino,
        dados.saidaPrevista,
        dados.retornoPrevisto,
        dados.extensao,
        dados.aceitaEncaixes
      ]
    );
    await cliente.query("COMMIT");
    return { ok: true, rota: atualizada.rows[0] };
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
}
async function encerrarRota(id, courierId, statusNovo) {
  const cliente = await obterPool().connect();
  try {
    await cliente.query("BEGIN");
    const { rows } = await cliente.query(
      "SELECT courier_id, status FROM routes WHERE id = $1 FOR UPDATE",
      [id]
    );
    const atual = rows[0];
    if (!atual) {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "nao_encontrada" };
    }
    if (atual.courier_id !== courierId) {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "nao_permitido" };
    }
    if (atual.status !== "publicada") {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "estado_invalido" };
    }
    await cliente.query(
      `UPDATE route_fittings
          SET status = 'cancelado', cancelled_at = now()
        WHERE route_id = $1 AND status = 'pendente'`,
      [id]
    );
    const atualizada = await cliente.query(
      `UPDATE routes
          SET status = $2, ended_at = now(), updated_at = now()
        WHERE id = $1
        RETURNING ${COLUNAS5}`,
      [id, statusNovo]
    );
    await cliente.query("COMMIT");
    return { ok: true, rota: atualizada.rows[0] };
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
}
async function cancelarRotasPublicadasDoMotoboy(courierId) {
  const cliente = await obterPool().connect();
  try {
    await cliente.query("BEGIN");
    const { rows } = await cliente.query(
      `SELECT id FROM routes
        WHERE courier_id = $1 AND status = 'publicada'
        FOR UPDATE`,
      [courierId]
    );
    const ids = rows.map((r) => r.id);
    if (ids.length > 0) {
      await cliente.query(
        `UPDATE route_fittings
            SET status = 'cancelado', cancelled_at = now()
          WHERE route_id = ANY($1::uuid[]) AND status = 'pendente'`,
        [ids]
      );
      await cliente.query(
        `UPDATE routes
            SET status = 'cancelada', ended_at = now(), updated_at = now()
          WHERE id = ANY($1::uuid[]) AND status = 'publicada'`,
        [ids]
      );
    }
    await cliente.query("COMMIT");
    return ids;
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
}

// src/routes/courier.ts
var rotasMotoboy = Router4();
var sessao2 = exigirAutenticacao;
function exigirId3(valor) {
  if (!ehUuid(valor)) throw new ErroHttp(400, "ID_INVALIDO", "Identificador inv\xE1lido.");
  return valor;
}
rotasMotoboy.get(
  "/motoboys/online-count",
  sessao2,
  exigirPapel("lojista", "pessoa_fisica"),
  async (_req, res) => {
    res.json({ online: await contarMotoboysOnline() });
  }
);
var somenteMotoboy = exigirPapel("motoboy");
rotasMotoboy.get("/courier/painel", sessao2, somenteMotoboy, async (req, res) => {
  const motoboyId = req.usuario.id;
  await marcarAtividade(motoboyId);
  await processarOfertas();
  const { online } = await buscarDisponibilidade(motoboyId);
  const [ofertas, entregaAtiva] = await Promise.all([
    online ? listarOfertasPendentes(motoboyId) : Promise.resolve([]),
    buscarEntregaAtiva(motoboyId)
  ]);
  res.json({
    online,
    ofertas,
    entregaAtiva: entregaAtiva ? entregaParaApi(entregaAtiva) : null
  });
});
rotasMotoboy.post("/courier/availability", sessao2, somenteMotoboy, async (req, res) => {
  const corpo = req.body ?? {};
  if (typeof corpo.online !== "boolean") {
    throw new ErroHttp(400, "DADOS_INVALIDOS", 'Informe "online" como verdadeiro ou falso.');
  }
  const motoboyId = req.usuario.id;
  const estado = await definirDisponibilidade(motoboyId, corpo.online);
  if (corpo.online) {
    await processarOfertas();
  } else {
    await expirarOfertasPendentesDoMotoboy(motoboyId);
    try {
      await cancelarRotasPublicadasDoMotoboy(motoboyId);
    } catch (erro) {
      console.error("[rotas]", erro instanceof Error ? erro.message : erro);
    }
  }
  res.json({ online: estado.online, ultimaAtividade: estado.ultimaAtividade });
});
rotasMotoboy.post("/courier/offers/:id/accept", sessao2, somenteMotoboy, async (req, res) => {
  const id = exigirId3(req.params.id);
  const resultado = await aceitarOferta(id, req.usuario.id);
  if (!resultado.ok) {
    switch (resultado.motivo) {
      case "nao_encontrada":
        throw new ErroHttp(404, "OFERTA_NAO_ENCONTRADA", "Oferta n\xE3o encontrada.");
      case "expirada":
        throw new ErroHttp(409, "OFERTA_EXPIRADA", "Esta oferta expirou.");
      case "ocupado":
        throw new ErroHttp(409, "JA_OCUPADO", "Voc\xEA j\xE1 tem uma entrega em andamento.");
      case "entrega_indisponivel":
        throw new ErroHttp(409, "ENTREGA_INDISPONIVEL", "Esta entrega n\xE3o est\xE1 mais dispon\xEDvel.");
      default:
        throw new ErroHttp(409, "OFERTA_INDISPONIVEL", "Esta oferta n\xE3o est\xE1 mais dispon\xEDvel.");
    }
  }
  res.json({ entrega: entregaParaApi(resultado.entrega) });
});
rotasMotoboy.post("/courier/deliveries/:id/start", sessao2, somenteMotoboy, async (req, res) => {
  const id = exigirId3(req.params.id);
  const resultado = await iniciarEntrega(id, req.usuario.id);
  if (!resultado.ok) {
    if (resultado.motivo === "nao_encontrada" || resultado.motivo === "nao_permitido") {
      throw new ErroHttp(404, "ENTREGA_NAO_ENCONTRADA", "Entrega n\xE3o encontrada.");
    }
    throw new ErroHttp(409, "ESTADO_INVALIDO", "Esta entrega n\xE3o pode ser iniciada agora.");
  }
  res.json({ entrega: entregaParaApi(resultado.entrega) });
});
rotasMotoboy.post("/courier/deliveries/:id/complete", sessao2, somenteMotoboy, async (req, res) => {
  const id = exigirId3(req.params.id);
  const resultado = await finalizarEntrega(id, req.usuario.id);
  if (!resultado.ok) {
    if (resultado.motivo === "nao_encontrada" || resultado.motivo === "nao_permitido") {
      throw new ErroHttp(404, "ENTREGA_NAO_ENCONTRADA", "Entrega n\xE3o encontrada.");
    }
    throw new ErroHttp(409, "ESTADO_INVALIDO", "Esta entrega n\xE3o pode ser finalizada agora.");
  }
  res.json({ entrega: entregaParaApi(resultado.entrega) });
});
rotasMotoboy.post("/courier/deliveries/:id/cancel", sessao2, somenteMotoboy, async (req, res) => {
  const id = exigirId3(req.params.id);
  const corpo = req.body ?? {};
  const motivo = limparTexto(corpo.motivo);
  const erroMotivo = validarTamanho(motivo, 300, "motivo");
  if (erroMotivo) throw new ErroHttp(400, "DADOS_INVALIDOS", erroMotivo);
  const resultado = await cancelarEntregaPeloMotoboy(id, req.usuario.id, motivo);
  if (!resultado.ok) {
    switch (resultado.motivo) {
      case "nao_encontrada":
      case "nao_permitido":
        throw new ErroHttp(404, "ENTREGA_NAO_ENCONTRADA", "Entrega n\xE3o encontrada.");
      case "ja_cancelada":
        throw new ErroHttp(409, "ESTADO_INVALIDO", "Esta entrega j\xE1 foi cancelada.");
      case "nao_cancelavel":
        throw new ErroHttp(409, "ESTADO_INVALIDO", "Esta entrega n\xE3o pode ser cancelada agora.");
      case "motivo_obrigatorio":
        throw new ErroHttp(400, "MOTIVO_OBRIGATORIO", "Informe o motivo do cancelamento.");
    }
  }
  try {
    await ofertarProximoElegivel(id);
  } catch (erro) {
    console.error("[oferta]", erro instanceof Error ? erro.message : erro);
  }
  res.json({ entrega: entregaParaApi(resultado.entrega) });
});
rotasMotoboy.post("/courier/offers/:id/decline", sessao2, somenteMotoboy, async (req, res) => {
  const id = exigirId3(req.params.id);
  const resultado = await recusarOferta(id, req.usuario.id);
  if (!resultado.ok) {
    if (resultado.motivo === "nao_encontrada") {
      throw new ErroHttp(404, "OFERTA_NAO_ENCONTRADA", "Oferta n\xE3o encontrada.");
    }
    throw new ErroHttp(409, "OFERTA_INDISPONIVEL", "Esta oferta n\xE3o est\xE1 mais dispon\xEDvel.");
  }
  try {
    await ofertarProximoElegivel(resultado.entregaId);
  } catch (erro) {
    console.error("[oferta]", erro instanceof Error ? erro.message : erro);
  }
  res.json({ ok: true });
});

// src/routes/deliveries.ts
import { Router as Router5 } from "express";
var rotasEntregas = Router5();
var sessao3 = exigirAutenticacao;
var PERFIS_SOLICITANTES = ["lojista", "pessoa_fisica"];
function valorMonetario(bruto) {
  if (bruto === void 0 || bruto === null || bruto === "") return { ok: true, valor: null };
  const numero = typeof bruto === "number" ? bruto : typeof bruto === "string" ? Number(bruto.replace(",", ".")) : Number.NaN;
  if (!Number.isFinite(numero) || numero < 0 || numero > 9999999999e-2) return { ok: false };
  return { ok: true, valor: numero.toFixed(2) };
}
function exigirId4(valor) {
  if (!ehUuid(valor)) throw new ErroHttp(400, "ID_INVALIDO", "Identificador inv\xE1lido.");
  return valor;
}
function podeConsultar(e, usuario) {
  if (usuario.papel === "admin") return true;
  return e.requester_id === usuario.id || e.courier_id === usuario.id;
}
rotasEntregas.post("/deliveries", sessao3, exigirPapel(...PERFIS_SOLICITANTES), async (req, res) => {
  const corpo = req.body ?? {};
  const coleta = limparTexto(corpo.coleta);
  const destino = limparTexto(corpo.destino);
  const observacoes = limparTexto(corpo.observacoes);
  if (!coleta) throw new ErroHttp(400, "DADOS_INVALIDOS", "Informe o endere\xE7o de coleta.");
  if (!destino) throw new ErroHttp(400, "DADOS_INVALIDOS", "Informe o endere\xE7o de entrega.");
  const erroColeta = validarTamanho(coleta, 200, "coleta");
  if (erroColeta) throw new ErroHttp(400, "DADOS_INVALIDOS", erroColeta);
  const erroDestino = validarTamanho(destino, 200, "destino");
  if (erroDestino) throw new ErroHttp(400, "DADOS_INVALIDOS", erroDestino);
  const erroObs = validarTamanho(observacoes, 500, "observa\xE7\xF5es");
  if (erroObs) throw new ErroHttp(400, "DADOS_INVALIDOS", erroObs);
  const valor = valorMonetario(corpo.valor);
  if (!valor.ok) {
    throw new ErroHttp(400, "DADOS_INVALIDOS", "Valor inv\xE1lido. Use um n\xFAmero, por exemplo 12,50.");
  }
  const criada = await criarEntrega({
    solicitanteId: req.usuario.id,
    coleta,
    destino,
    valor: valor.valor,
    observacoes
  });
  try {
    await ofertarProximoElegivel(criada.id);
  } catch (erro) {
    console.error("[oferta]", erro instanceof Error ? erro.message : erro);
  }
  res.status(201).json({ entrega: entregaParaApi(criada) });
});
rotasEntregas.get("/deliveries", sessao3, async (req, res) => {
  const usuario = req.usuario;
  const limite = inteiroLimitado(req.query.limite, 20, 1, 100);
  const deslocamento = inteiroLimitado(req.query.deslocamento, 0, 0, 1e6);
  const filtro = usuario.papel === "motoboy" ? { entregadorId: usuario.id, limite, deslocamento } : usuario.papel === "admin" ? { limite, deslocamento } : { solicitanteId: usuario.id, limite, deslocamento };
  const { itens, total } = await listarEntregas(filtro);
  res.json({ entregas: itens.map(entregaParaApi), total, limite, deslocamento });
});
rotasEntregas.get("/deliveries/:id", sessao3, async (req, res) => {
  const id = exigirId4(req.params.id);
  const entrega = await buscarEntrega(id);
  if (!entrega || !podeConsultar(entrega, req.usuario)) {
    throw new ErroHttp(404, "ENTREGA_NAO_ENCONTRADA", "Entrega n\xE3o encontrada.");
  }
  res.json({ entrega: entregaParaApi(entrega) });
});
rotasEntregas.post(
  "/deliveries/:id/cancel",
  sessao3,
  exigirPapel(...PERFIS_SOLICITANTES),
  async (req, res) => {
    const id = exigirId4(req.params.id);
    const corpo = req.body ?? {};
    const motivo = limparTexto(corpo.motivo);
    const erroMotivo = validarTamanho(motivo, 300, "motivo");
    if (erroMotivo) throw new ErroHttp(400, "DADOS_INVALIDOS", erroMotivo);
    const resultado = await cancelarEntrega(id, req.usuario.id, motivo);
    if (!resultado.ok) {
      if (resultado.motivo === "nao_encontrada" || resultado.motivo === "nao_permitido") {
        throw new ErroHttp(404, "ENTREGA_NAO_ENCONTRADA", "Entrega n\xE3o encontrada.");
      }
      if (resultado.motivo === "ja_cancelada") {
        throw new ErroHttp(409, "JA_CANCELADA", "Esta entrega j\xE1 foi cancelada.");
      }
      if (resultado.motivo === "nao_cancelavel") {
        throw new ErroHttp(409, "NAO_CANCELAVEL", "Entregas finalizadas n\xE3o podem ser canceladas.");
      }
      throw new ErroHttp(
        400,
        "MOTIVO_OBRIGATORIO",
        "Depois da aceita\xE7\xE3o, \xE9 necess\xE1rio informar o motivo do cancelamento."
      );
    }
    try {
      await expirarOfertasPendentesDaEntrega(id);
    } catch (erro) {
      console.error("[oferta]", erro instanceof Error ? erro.message : erro);
    }
    res.json({ entrega: entregaParaApi(resultado.entrega) });
  }
);

// src/routes/health.ts
import { Router as Router6 } from "express";
var rotasSaude = Router6();
rotasSaude.get("/health", async (_req, res) => {
  const banco = temBancoConfigurado() ? await testarConexao() : { ok: false, mensagem: "Banco n\xE3o configurado (esperado antes da M3.2)." };
  res.json({
    estado: "ok",
    servico: "central-de-motoboys-api",
    versao: "0.1.0",
    ambiente: process.env.NODE_ENV ?? "development",
    horario: (/* @__PURE__ */ new Date()).toISOString(),
    banco,
    auth: { configurada: env.authConfigurada }
  });
});

// src/routes/rotas.ts
import { Router as Router7 } from "express";

// src/rotas/encaixes.ts
var COLUNAS6 = `id, route_id, requester_id, pickup_address, dropoff_address,
  amount, counter_amount, counter_at, notes, status, created_at, responded_at, cancelled_at`;
function numeroOuNulo(valor) {
  return valor === null ? null : Number(valor);
}
function valorAcordado(e) {
  if (e.status !== "aceito") return null;
  return numeroOuNulo(e.counter_amount ?? e.amount);
}
function camposPublicos(e) {
  return {
    id: e.id,
    rotaId: e.route_id,
    coleta: e.pickup_address,
    destino: e.dropoff_address,
    valor: numeroOuNulo(e.amount),
    valorContraproposta: numeroOuNulo(e.counter_amount),
    contrapropostaEm: e.counter_at,
    valorAcordado: valorAcordado(e),
    observacoes: e.notes,
    status: e.status,
    criadoEm: e.created_at,
    respondidoEm: e.responded_at,
    canceladoEm: e.cancelled_at
  };
}
function encaixeParaSolicitante(e, rota) {
  return {
    ...camposPublicos(e),
    destinoRota: rota?.destination ?? null
  };
}
function encaixeParaMotoboy(e) {
  return camposPublicos(e);
}
async function criarEncaixe(dados) {
  const cliente = await obterPool().connect();
  try {
    await cliente.query("BEGIN");
    const { rows: rotas2 } = await cliente.query(
      `SELECT status, accepts_fittings, destination
         FROM routes WHERE id = $1 FOR UPDATE`,
      [dados.routeId]
    );
    const rota = rotas2[0];
    if (!rota) {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "rota_nao_encontrada" };
    }
    if (rota.status !== "publicada" || !rota.accepts_fittings) {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "rota_indisponivel" };
    }
    const pendente = await cliente.query(
      `SELECT 1 FROM route_fittings
        WHERE route_id = $1 AND requester_id = $2 AND status = 'pendente' LIMIT 1`,
      [dados.routeId, dados.requesterId]
    );
    if (pendente.rows.length > 0) {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "ja_pendente" };
    }
    const { rows } = await cliente.query(
      `INSERT INTO route_fittings
         (route_id, requester_id, pickup_address, dropoff_address, amount, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pendente')
       RETURNING ${COLUNAS6}`,
      [dados.routeId, dados.requesterId, dados.coleta, dados.destino, dados.valor, dados.observacoes]
    );
    await cliente.query("COMMIT");
    return { ok: true, encaixe: rows[0], destinoRota: rota.destination };
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
}
async function listarEncaixesDoSolicitante(requesterId) {
  const { rows } = await obterPool().query(
    `SELECT f.${COLUNAS6.split(", ").join(", f.")}, r.destination
       FROM route_fittings f
       JOIN routes r ON r.id = f.route_id
      WHERE f.requester_id = $1
      ORDER BY f.created_at DESC, f.id`,
    [requesterId]
  );
  return rows.map((r) => ({ encaixe: r, destinoRota: r.destination }));
}
async function listarEncaixesRecebidos(courierId) {
  const { rows } = await obterPool().query(
    `SELECT f.${COLUNAS6.split(", ").join(", f.")}, r.destination
       FROM route_fittings f
       JOIN routes r ON r.id = f.route_id
      WHERE r.courier_id = $1
      ORDER BY f.created_at DESC, f.id`,
    [courierId]
  );
  return rows.map((r) => ({ encaixe: r, destinoRota: r.destination }));
}
async function transacaoEncaixe(id, dono, campoDono, opcoes) {
  const cliente = await obterPool().connect();
  try {
    await cliente.query("BEGIN");
    const { rows } = await cliente.query(
      `SELECT f.*, r.courier_id
         FROM route_fittings f
         JOIN routes r ON r.id = f.route_id
        WHERE f.id = $1
        FOR UPDATE OF f`,
      [id]
    );
    const atual = rows[0];
    if (!atual) {
      await cliente.query("ROLLBACK");
      return { motivo: "nao_encontrado" };
    }
    const donoAtual = campoDono === "courier_id" ? atual.courier_id : atual.requester_id;
    if (donoAtual !== dono) {
      await cliente.query("ROLLBACK");
      return { motivo: "nao_permitido" };
    }
    if (atual.status !== "pendente") {
      await cliente.query("ROLLBACK");
      return { motivo: "estado_invalido" };
    }
    if (opcoes.exigirPendenteSemContraproposta && atual.counter_amount !== null) {
      await cliente.query("ROLLBACK");
      return { motivo: "estado_invalido" };
    }
    if (opcoes.exigirContraproposta && atual.counter_amount === null) {
      await cliente.query("ROLLBACK");
      return { motivo: "estado_invalido" };
    }
    return { cliente, encaixe: atual };
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  }
}
async function responderEncaixe(id, courierId, novoStatus) {
  const carregado = await transacaoEncaixe(id, courierId, "courier_id", {
    exigirPendenteSemContraproposta: true
  });
  if ("motivo" in carregado) return { ok: false, motivo: carregado.motivo };
  const { cliente } = carregado;
  try {
    const { rows: atualizado } = await cliente.query(
      `UPDATE route_fittings
          SET status = $2, responded_at = now()
        WHERE id = $1
        RETURNING ${COLUNAS6}`,
      [id, novoStatus]
    );
    await cliente.query("COMMIT");
    return { ok: true, encaixe: atualizado[0] };
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
}
async function contraproporEncaixe(id, courierId, valor) {
  const carregado = await transacaoEncaixe(id, courierId, "courier_id", {
    exigirPendenteSemContraproposta: true
  });
  if ("motivo" in carregado) return { ok: false, motivo: carregado.motivo };
  const { cliente } = carregado;
  try {
    const { rows: atualizado } = await cliente.query(
      `UPDATE route_fittings
          SET counter_amount = $2, counter_at = now()
        WHERE id = $1
        RETURNING ${COLUNAS6}`,
      [id, valor]
    );
    await cliente.query("COMMIT");
    return { ok: true, encaixe: atualizado[0] };
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
}
async function aceitarContraproposta(id, requesterId) {
  const carregado = await transacaoEncaixe(id, requesterId, "requester_id", {
    exigirContraproposta: true
  });
  if ("motivo" in carregado) return { ok: false, motivo: carregado.motivo };
  const { cliente } = carregado;
  try {
    const { rows: atualizado } = await cliente.query(
      `UPDATE route_fittings
          SET status = 'aceito', responded_at = now()
        WHERE id = $1
        RETURNING ${COLUNAS6}`,
      [id]
    );
    await cliente.query("COMMIT");
    return { ok: true, encaixe: atualizado[0] };
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
}
async function recusarContraproposta(id, requesterId) {
  const carregado = await transacaoEncaixe(id, requesterId, "requester_id", {
    exigirContraproposta: true
  });
  if ("motivo" in carregado) return { ok: false, motivo: carregado.motivo };
  const { cliente } = carregado;
  try {
    const { rows: atualizado } = await cliente.query(
      `UPDATE route_fittings
          SET status = 'recusado', responded_at = now()
        WHERE id = $1
        RETURNING ${COLUNAS6}`,
      [id]
    );
    await cliente.query("COMMIT");
    return { ok: true, encaixe: atualizado[0] };
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
}
async function cancelarEncaixePeloSolicitante(id, requesterId) {
  const carregado = await transacaoEncaixe(id, requesterId, "requester_id", {});
  if ("motivo" in carregado) return { ok: false, motivo: carregado.motivo };
  const { cliente } = carregado;
  try {
    const { rows: atualizado } = await cliente.query(
      `UPDATE route_fittings
          SET status = 'cancelado', cancelled_at = now()
        WHERE id = $1
        RETURNING ${COLUNAS6}`,
      [id]
    );
    await cliente.query("COMMIT");
    return { ok: true, encaixe: atualizado[0] };
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
}

// src/routes/rotas.ts
var rotasRotas = Router7();
var sessao4 = exigirAutenticacao;
var PERFIS_SOLICITANTES2 = ["lojista", "pessoa_fisica"];
function exigirId5(valor) {
  if (!ehUuid(valor)) throw new ErroHttp(400, "ID_INVALIDO", "Identificador inv\xE1lido.");
  return valor;
}
function valorMonetario2(bruto) {
  if (bruto === void 0 || bruto === null || bruto === "") return { ok: true, valor: null };
  const numero = typeof bruto === "number" ? bruto : typeof bruto === "string" ? Number(bruto.replace(",", ".")) : Number.NaN;
  if (!Number.isFinite(numero) || numero < 0 || numero > 9999999999e-2) return { ok: false };
  return { ok: true, valor: numero.toFixed(2) };
}
function valorProposta(bruto) {
  const resultado = valorMonetario2(bruto);
  if (!resultado.ok || resultado.valor === null || Number(resultado.valor) <= 0) {
    throw new ErroHttp(
      400,
      "VALOR_INVALIDO",
      "Informe o valor da proposta, por exemplo 25,00."
    );
  }
  return resultado.valor;
}
function lerDadosRota(bruto, exigirAceita) {
  const destino = limparTexto(bruto.destino);
  const saidaPrevista = limparTexto(bruto.saidaPrevista);
  const retornoPrevisto = limparTexto(bruto.retornoPrevisto);
  const extensao = limparTexto(bruto.extensao);
  if (!destino) throw new ErroHttp(400, "DADOS_INVALIDOS", "Informe o destino da rota.");
  const erros = [
    validarTamanho(destino, 200, "destino"),
    validarTamanho(saidaPrevista, 100, "sa\xEDda prevista"),
    validarTamanho(retornoPrevisto, 100, "previs\xE3o de retorno"),
    validarTamanho(extensao, 100, "extens\xE3o")
  ];
  const erro = erros.find(Boolean);
  if (erro) throw new ErroHttp(400, "DADOS_INVALIDOS", erro);
  let aceitaEncaixes = true;
  if (exigirAceita || bruto.aceitaEncaixes !== void 0) {
    if (typeof bruto.aceitaEncaixes !== "boolean") {
      throw new ErroHttp(400, "DADOS_INVALIDOS", 'Informe "aceitaEncaixes" como verdadeiro ou falso.');
    }
    aceitaEncaixes = bruto.aceitaEncaixes;
  }
  return { destino, saidaPrevista, retornoPrevisto, extensao, aceitaEncaixes };
}
function erroDeFalhaEncaixe(motivo) {
  if (motivo === "nao_encontrado" || motivo === "nao_permitido") {
    throw new ErroHttp(404, "ENCAIXE_NAO_ENCONTRADO", "Encaixe n\xE3o encontrado.");
  }
  throw new ErroHttp(409, "ESTADO_INVALIDO", "Este encaixe n\xE3o est\xE1 mais em negocia\xE7\xE3o.");
}
rotasRotas.get(
  "/routes/available",
  sessao4,
  exigirPapel(...PERFIS_SOLICITANTES2),
  async (_req, res) => {
    const rotas2 = await listarRotasDisponiveis();
    res.json({ rotas: rotas2.map(rotaParaApi) });
  }
);
rotasRotas.post("/fittings", sessao4, exigirPapel(...PERFIS_SOLICITANTES2), async (req, res) => {
  const corpo = req.body ?? {};
  const routeId = exigirId5(corpo.rotaId);
  const coleta = limparTexto(corpo.coleta);
  const destino = limparTexto(corpo.destino);
  const observacoes = limparTexto(corpo.observacoes);
  const valor = valorProposta(corpo.valor);
  if (!coleta) throw new ErroHttp(400, "DADOS_INVALIDOS", "Informe o endere\xE7o de coleta.");
  if (!destino) throw new ErroHttp(400, "DADOS_INVALIDOS", "Informe o endere\xE7o de entrega.");
  const erros = [
    validarTamanho(coleta, 200, "coleta"),
    validarTamanho(destino, 200, "destino"),
    validarTamanho(observacoes, 500, "observa\xE7\xF5es")
  ];
  const erro = erros.find(Boolean);
  if (erro) throw new ErroHttp(400, "DADOS_INVALIDOS", erro);
  const resultado = await criarEncaixe({
    routeId,
    requesterId: req.usuario.id,
    coleta,
    destino,
    valor,
    observacoes
  });
  if (!resultado.ok) {
    switch (resultado.motivo) {
      case "rota_nao_encontrada":
        throw new ErroHttp(404, "ROTA_NAO_ENCONTRADA", "Rota n\xE3o encontrada.");
      case "rota_indisponivel":
        throw new ErroHttp(409, "ROTA_INDISPONIVEL", "Esta rota n\xE3o est\xE1 mais aceitando encaixes.");
      case "ja_pendente":
        throw new ErroHttp(409, "ENCAIXE_JA_PENDENTE", "Voc\xEA j\xE1 tem um encaixe pendente nesta rota.");
      default:
        throw new ErroHttp(409, "ENCAIXE_INDISPONIVEL", "N\xE3o foi poss\xEDvel registrar o encaixe.");
    }
  }
  res.status(201).json({
    encaixe: encaixeParaSolicitante(resultado.encaixe, { destination: resultado.destinoRota })
  });
});
rotasRotas.get(
  "/fittings/mine",
  sessao4,
  exigirPapel(...PERFIS_SOLICITANTES2),
  async (req, res) => {
    const itens = await listarEncaixesDoSolicitante(req.usuario.id);
    res.json({ encaixes: itens.map((i) => encaixeParaSolicitante(i.encaixe, { destination: i.destinoRota ?? "" })) });
  }
);
rotasRotas.post(
  "/fittings/:id/cancel",
  sessao4,
  exigirPapel(...PERFIS_SOLICITANTES2),
  async (req, res) => {
    const id = exigirId5(req.params.id);
    const resultado = await cancelarEncaixePeloSolicitante(id, req.usuario.id);
    if (!resultado.ok) {
      if (resultado.motivo === "nao_encontrado" || resultado.motivo === "nao_permitido") {
        throw new ErroHttp(404, "ENCAIXE_NAO_ENCONTRADO", "Encaixe n\xE3o encontrado.");
      }
      throw new ErroHttp(409, "ESTADO_INVALIDO", "Este encaixe n\xE3o pode mais ser cancelado.");
    }
    res.json({ encaixe: encaixeParaSolicitante(resultado.encaixe, null) });
  }
);
rotasRotas.post(
  "/fittings/:id/accept-counter",
  sessao4,
  exigirPapel(...PERFIS_SOLICITANTES2),
  async (req, res) => {
    const id = exigirId5(req.params.id);
    const resultado = await aceitarContraproposta(id, req.usuario.id);
    if (!resultado.ok) erroDeFalhaEncaixe(resultado.motivo);
    res.json({ encaixe: encaixeParaSolicitante(resultado.encaixe, null) });
  }
);
rotasRotas.post(
  "/fittings/:id/reject-counter",
  sessao4,
  exigirPapel(...PERFIS_SOLICITANTES2),
  async (req, res) => {
    const id = exigirId5(req.params.id);
    const resultado = await recusarContraproposta(id, req.usuario.id);
    if (!resultado.ok) erroDeFalhaEncaixe(resultado.motivo);
    res.json({ encaixe: encaixeParaSolicitante(resultado.encaixe, null) });
  }
);
rotasRotas.get("/routes/mine", sessao4, exigirPapel("motoboy"), async (req, res) => {
  const apenasPublicadas = req.query.apenasPublicadas === "true";
  const rotas2 = await listarRotasDoMotoboy(req.usuario.id, apenasPublicadas);
  res.json({ rotas: rotas2.map(rotaParaApi) });
});
rotasRotas.post("/routes", sessao4, exigirPapel("motoboy"), async (req, res) => {
  const corpo = req.body ?? {};
  const dados = lerDadosRota(corpo, true);
  const rota = await criarRota({ courierId: req.usuario.id, ...dados });
  res.status(201).json({ rota: rotaParaApi(rota) });
});
rotasRotas.patch("/routes/:id", sessao4, exigirPapel("motoboy"), async (req, res) => {
  const id = exigirId5(req.params.id);
  const corpo = req.body ?? {};
  const dados = lerDadosRota(corpo, false);
  const resultado = await atualizarRota(id, req.usuario.id, dados);
  if (!resultado.ok) {
    if (resultado.motivo === "nao_encontrada" || resultado.motivo === "nao_permitido") {
      throw new ErroHttp(404, "ROTA_NAO_ENCONTRADA", "Rota n\xE3o encontrada.");
    }
    throw new ErroHttp(409, "ESTADO_INVALIDO", "Esta rota n\xE3o pode mais ser alterada.");
  }
  res.json({ rota: rotaParaApi(resultado.rota) });
});
rotasRotas.post("/routes/:id/close", sessao4, exigirPapel("motoboy"), async (req, res) => {
  const id = exigirId5(req.params.id);
  const resultado = await encerrarRota(id, req.usuario.id, "encerrada");
  if (!resultado.ok) {
    if (resultado.motivo === "nao_encontrada" || resultado.motivo === "nao_permitido") {
      throw new ErroHttp(404, "ROTA_NAO_ENCONTRADA", "Rota n\xE3o encontrada.");
    }
    throw new ErroHttp(409, "ESTADO_INVALIDO", "Esta rota j\xE1 foi encerrada ou cancelada.");
  }
  res.json({ rota: rotaParaApi(resultado.rota) });
});
rotasRotas.post("/routes/:id/cancel", sessao4, exigirPapel("motoboy"), async (req, res) => {
  const id = exigirId5(req.params.id);
  const resultado = await encerrarRota(id, req.usuario.id, "cancelada");
  if (!resultado.ok) {
    if (resultado.motivo === "nao_encontrada" || resultado.motivo === "nao_permitido") {
      throw new ErroHttp(404, "ROTA_NAO_ENCONTRADA", "Rota n\xE3o encontrada.");
    }
    throw new ErroHttp(409, "ESTADO_INVALIDO", "Esta rota j\xE1 foi encerrada ou cancelada.");
  }
  res.json({ rota: rotaParaApi(resultado.rota) });
});
rotasRotas.get("/fittings/received", sessao4, exigirPapel("motoboy"), async (req, res) => {
  const itens = await listarEncaixesRecebidos(req.usuario.id);
  res.json({ encaixes: itens.map((i) => encaixeParaMotoboy(i.encaixe)) });
});
rotasRotas.post("/fittings/:id/accept", sessao4, exigirPapel("motoboy"), async (req, res) => {
  const id = exigirId5(req.params.id);
  const resultado = await responderEncaixe(id, req.usuario.id, "aceito");
  if (!resultado.ok) erroDeFalhaEncaixe(resultado.motivo);
  res.json({ encaixe: encaixeParaMotoboy(resultado.encaixe) });
});
rotasRotas.post("/fittings/:id/decline", sessao4, exigirPapel("motoboy"), async (req, res) => {
  const id = exigirId5(req.params.id);
  const resultado = await responderEncaixe(id, req.usuario.id, "recusado");
  if (!resultado.ok) erroDeFalhaEncaixe(resultado.motivo);
  res.json({ encaixe: encaixeParaMotoboy(resultado.encaixe) });
});
rotasRotas.post("/fittings/:id/counter", sessao4, exigirPapel("motoboy"), async (req, res) => {
  const id = exigirId5(req.params.id);
  const corpo = req.body ?? {};
  const valor = valorProposta(corpo.valor);
  const resultado = await contraproporEncaixe(id, req.usuario.id, valor);
  if (!resultado.ok) erroDeFalhaEncaixe(resultado.motivo);
  res.json({ encaixe: encaixeParaMotoboy(resultado.encaixe) });
});

// src/routes/rotas-dia.ts
import { Router as Router8 } from "express";
var rotasRotasDia = Router8();
var sessao5 = exigirAutenticacao;
var PERFIS_SOLICITANTES3 = ["lojista", "pessoa_fisica"];
function exigirId6(valor) {
  if (!ehUuid(valor)) throw new ErroHttp(400, "ID_INVALIDO", "Identificador inv\xE1lido.");
  return valor;
}
function dataValida2(bruto) {
  const texto = typeof bruto === "string" ? bruto.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    throw new ErroHttp(400, "DATA_INVALIDA", "Informe a data do servi\xE7o no formato AAAA-MM-DD.");
  }
  const [ano, mes, dia] = texto.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) {
    throw new ErroHttp(400, "DATA_INVALIDA", "Data inv\xE1lida.");
  }
  return texto;
}
function valorOpcional(bruto) {
  if (bruto === void 0 || bruto === null || bruto === "") return null;
  const numero = typeof bruto === "number" ? bruto : typeof bruto === "string" ? Number(bruto.replace(",", ".")) : Number.NaN;
  if (!Number.isFinite(numero) || numero < 0 || numero > 9999999999e-2) {
    throw new ErroHttp(400, "VALOR_INVALIDO", "Informe um valor v\xE1lido, por exemplo 25,00.");
  }
  return numero.toFixed(2);
}
function erroDaRota(motivo) {
  if (motivo === "nao_encontrada" || motivo === "nao_permitido") {
    throw new ErroHttp(404, "ROTA_NAO_ENCONTRADA", "Rota do dia n\xE3o encontrada.");
  }
  if (motivo === "ja_contratada") {
    throw new ErroHttp(409, "ROTA_JA_CONTRATADA", "Esta rota do dia j\xE1 foi contratada.");
  }
  throw new ErroHttp(409, "ESTADO_INVALIDO", "Esta rota do dia n\xE3o est\xE1 mais dispon\xEDvel.");
}
rotasRotasDia.get(
  "/daily-routes/published",
  sessao5,
  exigirPapel(...PERFIS_SOLICITANTES3),
  async (req, res) => {
    const rotas2 = await listarRotasDiaDoPublicador(req.usuario.id);
    res.json({ rotas: rotas2.map((r) => rotaDiaParaApi(r)) });
  }
);
rotasRotasDia.post(
  "/daily-routes",
  sessao5,
  exigirPapel(...PERFIS_SOLICITANTES3),
  async (req, res) => {
    const corpo = req.body ?? {};
    const titulo = limparTexto(corpo.titulo);
    const origem2 = limparTexto(corpo.origem);
    const destino = limparTexto(corpo.destino);
    const saida = limparTexto(corpo.saida);
    const paradas = limparTexto(corpo.paradas);
    const descricao = limparTexto(corpo.descricao);
    if (!titulo) throw new ErroHttp(400, "DADOS_INVALIDOS", "Informe um t\xEDtulo para a rota.");
    if (!origem2) throw new ErroHttp(400, "DADOS_INVALIDOS", "Informe o ponto de origem.");
    if (!destino) throw new ErroHttp(400, "DADOS_INVALIDOS", "Informe o destino.");
    const erros = [
      validarTamanho(titulo, 120, "t\xEDtulo"),
      validarTamanho(origem2, 200, "origem"),
      validarTamanho(destino, 200, "destino"),
      validarTamanho(saida, 100, "sa\xEDda"),
      validarTamanho(paradas, 500, "paradas"),
      validarTamanho(descricao, 1e3, "descri\xE7\xE3o")
    ];
    const erro = erros.find(Boolean);
    if (erro) throw new ErroHttp(400, "DADOS_INVALIDOS", erro);
    const publicar = corpo.publicar !== false;
    const rota = await criarRotaDia({
      publisherId: req.usuario.id,
      titulo,
      origem: origem2,
      destino,
      data: dataValida2(corpo.data),
      saida: saida || null,
      paradas: paradas || null,
      descricao: descricao || null,
      valor: valorOpcional(corpo.valor),
      publicar
    });
    res.status(201).json({ rota: rotaDiaParaApi(rota) });
  }
);
rotasRotasDia.post(
  "/daily-routes/:id/publish",
  sessao5,
  exigirPapel(...PERFIS_SOLICITANTES3),
  async (req, res) => {
    const id = exigirId6(req.params.id);
    const resultado = await publicarRotaDia(id, req.usuario.id);
    if (!resultado.ok) erroDaRota(resultado.motivo);
    res.json({ rota: rotaDiaParaApi(resultado.rota) });
  }
);
rotasRotasDia.post(
  "/daily-routes/:id/cancel",
  sessao5,
  exigirPapel(...PERFIS_SOLICITANTES3),
  async (req, res) => {
    const id = exigirId6(req.params.id);
    const corpo = req.body ?? {};
    const motivo = limparTexto(corpo.motivo);
    if (!motivo) {
      throw new ErroHttp(400, "DADOS_INVALIDOS", "Informe o motivo do cancelamento.");
    }
    const erroMotivo = validarTamanho(motivo, 300, "motivo");
    if (erroMotivo) throw new ErroHttp(400, "DADOS_INVALIDOS", erroMotivo);
    const resultado = await cancelarRotaDia(id, req.usuario.id, motivo);
    if (!resultado.ok) erroDaRota(resultado.motivo);
    res.json({ rota: rotaDiaParaApi(resultado.rota) });
  }
);
rotasRotasDia.get(
  "/daily-routes/available",
  sessao5,
  exigirPapel("motoboy"),
  async (req, res) => {
    const rotas2 = await listarRotasDiaDisponiveis(req.usuario.id);
    res.json({ rotas: rotas2.map((r) => rotaDiaParaApi(r)) });
  }
);
rotasRotasDia.get(
  "/daily-routes/mine",
  sessao5,
  exigirPapel("motoboy"),
  async (req, res) => {
    const rotas2 = await listarRotasDiaContratadas(req.usuario.id);
    res.json({
      rotas: rotas2.map((r) => rotaDiaParaApi(r, { mostrarContato: r.status !== "cancelada" }))
    });
  }
);
rotasRotasDia.post(
  "/daily-routes/:id/accept",
  sessao5,
  exigirPapel("motoboy"),
  async (req, res) => {
    const id = exigirId6(req.params.id);
    const corpo = req.body ?? {};
    const valorProposto = valorOpcional(corpo.valorProposto);
    const resultado = await aceitarRotaDia(id, req.usuario.id, valorProposto);
    if (!resultado.ok) erroDaRota(resultado.motivo);
    res.json({ rota: rotaDiaParaApi(resultado.rota, { mostrarContato: true }) });
  }
);
rotasRotasDia.post(
  "/daily-routes/:id/start",
  sessao5,
  exigirPapel("motoboy"),
  async (req, res) => {
    const id = exigirId6(req.params.id);
    const resultado = await iniciarRotaDia(id, req.usuario.id);
    if (!resultado.ok) erroDaRota(resultado.motivo);
    res.json({ rota: rotaDiaParaApi(resultado.rota, { mostrarContato: true }) });
  }
);
rotasRotasDia.post(
  "/daily-routes/:id/complete",
  sessao5,
  exigirPapel("motoboy"),
  async (req, res) => {
    const id = exigirId6(req.params.id);
    const corpo = req.body ?? {};
    const valorFinal = valorOpcional(corpo.valorFinal);
    const resultado = await concluirRotaDia(id, req.usuario.id, valorFinal);
    if (!resultado.ok) erroDaRota(resultado.motivo);
    res.json({ rota: rotaDiaParaApi(resultado.rota, { mostrarContato: true }) });
  }
);

// src/routes/index.ts
var rotas = Router9();
rotas.use(rotasSaude);
rotas.use(rotasAuth);
rotas.use(rotasEntregas);
rotas.use(rotasMotoboy);
rotas.use(rotasContabilidade);
rotas.use(rotasRotas);
rotas.use(rotasRotasDia);
rotas.use(rotasAdmin);

// src/app.ts
function criarApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(corsDesenvolvimento);
  app.use(express.json({ limit: "16kb" }));
  app.use(rotas);
  app.use(naoEncontrado);
  app.use(tratarErro);
  return app;
}

// src/_entrada.ts
var entrada_default = criarApp();
export {
  entrada_default as default
};
