// Testes de integração da API (regras novas + Rotas do Dia).
//
// Executa a API de verdade (mesmo código do servidor) contra o banco de
// desenvolvimento. Os usuários de teste são criados com nome prefixado e
// removidos no final — NENHUM dado real é apagado.
//
// Comando: npm test  (a partir de backend/)

import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { Client } from 'pg'

import { criarApp } from '../src/app.ts'

const MENSAGEM_MANUTENCAO = 'Estamos em manutenção. Tente novamente mais tarde.'
const LIMITE_TENTATIVAS = 5

// Origem (IP) usada pelos testes: faixa reservada para documentação
// (TEST-NET-3). Evita mexer no bloqueio do IP real de quem usa o app.
const IP = {
  bloqueio: '203.0.113.10',
  simples: '203.0.113.11',
  manutencao: '203.0.113.12',
  rotas: '203.0.113.13',
  permissoes: '203.0.113.14',
}

let servidor
let base
let banco

const idsCriados = []
const auditoriaParaLimpar = []

function identificador(codigo) {
  return createHmac('sha256', process.env.CODE_HMAC_KEY).update(codigo).digest('hex')
}

// Cria um usuário de teste direto no banco (código conhecido pelo teste).
async function criarUsuarioTeste(nome, papel, codigo) {
  const { rows } = await banco.query(
    `INSERT INTO users (name, phone, account_type, access_code_hash, code_suffix, is_active)
     VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
    [nome, `+551190000${String(idsCriados.length).padStart(4, '0')}`, papel, identificador(codigo), codigo.slice(-4)],
  )
  idsCriados.push(rows[0].id)
  return { id: rows[0].id, codigo }
}

async function api(metodo, caminho, { token, corpo, ip } = {}) {
  const cabecalhos = { 'Content-Type': 'application/json' }
  if (token) cabecalhos.Authorization = `Bearer ${token}`
  if (ip) cabecalhos['X-Forwarded-For'] = ip
  const resposta = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers: cabecalhos,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
  let corpoJson = null
  const texto = await resposta.text()
  if (texto) {
    try {
      corpoJson = JSON.parse(texto)
    } catch {
      corpoJson = { bruto: texto }
    }
  }
  return { status: resposta.status, corpo: corpoJson }
}

async function tokenDe(codigo, ip) {
  const resposta = await api('POST', '/auth/login', { corpo: { codigo }, ip })
  assert.equal(resposta.status, 200, `login falhou: ${JSON.stringify(resposta.corpo)}`)
  return resposta.corpo.token
}

before(async () => {
  servidor = criarApp().listen(0)
  await new Promise(resolve => servidor.once('listening', resolve))
  base = `http://127.0.0.1:${servidor.address().port}`
  banco = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL })
  await banco.connect()
})

after(async () => {
  // Limpeza: apaga SOMENTE o que este teste criou.
  if (idsCriados.length > 0) {
    await banco.query('DELETE FROM admin_audit WHERE actor_id = ANY($1::uuid[])', [idsCriados])
    await banco.query('DELETE FROM admin_audit WHERE entity_id = ANY($1::text[])', [
      idsCriados.map(id => String(id)),
    ])
    await banco.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [idsCriados])
  }
  await banco.query('DELETE FROM login_attempts WHERE origin = ANY($1::text[])', [
    Object.values(IP),
  ])
  await banco.end()
  await new Promise(resolve => servidor.close(resolve))
})

// ---------------------------------------------------------------------------
// Autenticação
// ---------------------------------------------------------------------------

test('login válido devolve token e o usuário lido do banco', async () => {
  const { codigo } = await criarUsuarioTeste('TESTE-login', 'motoboy', 'CMB-TESTE-LOGIN-0001')
  const resposta = await api('POST', '/auth/login', {
    corpo: { codigo },
    ip: IP.simples,
  })
  assert.equal(resposta.status, 200)
  assert.equal(resposta.corpo.usuario.papel, 'motoboy')
  assert.ok(resposta.corpo.token)

  const me = await api('GET', '/auth/me', { token: resposta.corpo.token })
  assert.equal(me.status, 200)
  assert.equal(me.corpo.usuario.nome, 'TESTE-login')
})

test('código inexistente é recusado com 401', async () => {
  const resposta = await api('POST', '/auth/login', {
    corpo: { codigo: 'CMB-XXXX-XXXX-XXXX-XXXX' },
    ip: IP.simples,
  })
  assert.equal(resposta.status, 401)
  assert.equal(resposta.corpo.codigo, 'CREDENCIAL_INVALIDA')
})

test('conta desativada recebe a orientação de procurar o administrador', async () => {
  const { id, codigo } = await criarUsuarioTeste('TESTE-inativo', 'lojista', 'CMB-TESTE-INATIVO-001')
  await banco.query('UPDATE users SET is_active = false WHERE id = $1', [id])
  const resposta = await api('POST', '/auth/login', { corpo: { codigo }, ip: IP.simples })
  assert.equal(resposta.status, 403)
  assert.equal(resposta.corpo.codigo, 'CONTA_DESATIVADA')
  assert.match(resposta.corpo.erro, /administrador/i)
})

// ---------------------------------------------------------------------------
// Regra 31 + 65–69 — bloqueio por tentativas e registro administrativo
// ---------------------------------------------------------------------------

test('tentativas erradas bloqueiam o acesso e o admin libera (regras 31, 65–69)', async () => {
  const admin = await criarUsuarioTeste('TESTE-admin-bloqueio', 'admin', 'CMB-TESTE-ADMIN-BLK-01')
  const tokenAdmin = await tokenDe(admin.codigo, IP.bloqueio)

  // 1) tentativas erradas: a última devolve bloqueio
  for (let tentativa = 1; tentativa <= LIMITE_TENTATIVAS; tentativa++) {
    const resposta = await api('POST', '/auth/login', {
      corpo: { codigo: 'CMB-ERRADO-ERRADO-ERRADO' },
      ip: IP.bloqueio,
    })
    if (tentativa < LIMITE_TENTATIVAS) {
      assert.equal(resposta.status, 401, `tentativa ${tentativa}`)
    } else {
      assert.equal(resposta.status, 403)
      assert.equal(resposta.corpo.codigo, 'ACESSO_BLOQUEADO')
    }
  }

  // 2) com o acesso bloqueado, nem um código VÁLIDO entra
  const valido = await criarUsuarioTeste('TESTE-alvo', 'motoboy', 'CMB-TESTE-ALVO-0001')
  const bloqueado = await api('POST', '/auth/login', {
    corpo: { codigo: valido.codigo },
    ip: IP.bloqueio,
  })
  assert.equal(bloqueado.status, 403)
  assert.equal(bloqueado.corpo.codigo, 'ACESSO_BLOQUEADO')

  // 3) o administrador VÊ o registro (nome, data/hora e nº de tentativas)
  const lista = await api('GET', '/admin/login-attempts', { token: tokenAdmin })
  assert.equal(lista.status, 200)
  const registro = lista.corpo.tentativas.find(t => t.origem === IP.bloqueio)
  assert.ok(registro, 'o registro das tentativas deve existir')
  assert.equal(registro.tentativas, LIMITE_TENTATIVAS)
  assert.equal(registro.bloqueado, true)
  assert.ok(registro.criadoEm, 'o registro deve ter data/hora')
  assert.equal(lista.corpo.tentativas.length >= 1, true)

  // 4) o administrador libera e o acesso volta
  const liberacao = await api('POST', `/admin/login-attempts/${registro.id}/release`, {
    token: tokenAdmin,
  })
  assert.equal(liberacao.status, 200)

  const depois = await api('POST', '/auth/login', {
    corpo: { codigo: valido.codigo },
    ip: IP.bloqueio,
  })
  assert.equal(depois.status, 200)
})

test('registros de tentativas não têm filtros e saem em ordem cronológica (regra 69)', async () => {
  const admin = await criarUsuarioTeste('TESTE-admin-lista', 'admin', 'CMB-TESTE-ADMIN-LST-01')
  const tokenAdmin = await tokenDe(admin.codigo, IP.simples)
  const resposta = await api('GET', '/admin/login-attempts', { token: tokenAdmin })
  assert.equal(resposta.status, 200)
  const datas = resposta.corpo.tentativas.map(t => new Date(t.criadoEm).getTime())
  for (let i = 1; i < datas.length; i++) {
    assert.ok(datas[i] >= datas[i - 1], 'a lista deve estar em ordem cronológica')
  }
})

// ---------------------------------------------------------------------------
// Regras 71–81 — modo de manutenção
// ---------------------------------------------------------------------------

test('manutenção bloqueia usuários, mantém o admin e usa a mensagem exata (regra 81)', async () => {
  const admin = await criarUsuarioTeste('TESTE-admin-manut', 'admin', 'CMB-TESTE-ADMIN-MNT-01')
  const usuario = await criarUsuarioTeste('TESTE-usuario-manut', 'lojista', 'CMB-TESTE-USR-MNT-001')
  const tokenAdmin = await tokenDe(admin.codigo, IP.manutencao)

  const ligou = await api('POST', '/admin/settings/maintenance', {
    token: tokenAdmin,
    corpo: { ativa: true },
  })
  assert.equal(ligou.status, 200)
  assert.equal(ligou.corpo.ativa, true)

  try {
    // usuário comum é bloqueado com a mensagem EXATA da regra 81
    const bloqueado = await api('POST', '/auth/login', {
      corpo: { codigo: usuario.codigo },
      ip: IP.manutencao,
    })
    assert.equal(bloqueado.status, 503)
    assert.equal(bloqueado.corpo.erro, MENSAGEM_MANUTENCAO)

    // o administrador mantém o acesso (regra 78)
    const adminEntra = await api('POST', '/auth/login', {
      corpo: { codigo: admin.codigo },
      ip: IP.manutencao,
    })
    assert.equal(adminEntra.status, 200)

    // o status público informa a manutenção
    const status = await api('GET', '/status')
    assert.equal(status.corpo.manutencao, true)
    assert.equal(status.corpo.mensagem, MENSAGEM_MANUTENCAO)
  } finally {
    const desligou = await api('POST', '/admin/settings/maintenance', {
      token: tokenAdmin,
      corpo: { ativa: false },
    })
    assert.equal(desligou.status, 200)
  }

  // depois de desligar, o usuário entra normalmente
  const liberto = await api('POST', '/auth/login', {
    corpo: { codigo: usuario.codigo },
    ip: IP.manutencao,
  })
  assert.equal(liberto.status, 200)
})

test('ligar/desligar a manutenção não deixa histórico (regra 80)', async () => {
  const admin = await criarUsuarioTeste('TESTE-admin-historico', 'admin', 'CMB-TESTE-ADMIN-HIS-01')
  const tokenAdmin = await tokenDe(admin.codigo, IP.manutencao)
  const antes = await api('GET', '/admin/audit', { token: tokenAdmin })
  const totalAntes = antes.corpo.total

  await api('POST', '/admin/settings/maintenance', {
    token: tokenAdmin,
    corpo: { ativa: true },
  })
  await api('POST', '/admin/settings/maintenance', {
    token: tokenAdmin,
    corpo: { ativa: false },
  })

  const depois = await api('GET', '/admin/audit', { token: tokenAdmin })
  assert.equal(depois.corpo.total, totalAntes, 'a manutenção não pode gerar histórico')
})

// ---------------------------------------------------------------------------
// Regra 66 — histórico das ações administrativas
// ---------------------------------------------------------------------------

test('criar usuário gera histórico consultável (regra 66)', async () => {
  const admin = await criarUsuarioTeste('TESTE-admin-auditoria', 'admin', 'CMB-TESTE-ADMIN-AUD-01')
  const tokenAdmin = await tokenDe(admin.codigo, IP.simples)

  const criacao = await api('POST', '/admin/users', {
    token: tokenAdmin,
    corpo: { tipoConta: 'motoboy', nome: 'TESTE-criado-pelo-admin' },
  })
  assert.equal(criacao.status, 201)
  assert.ok(criacao.corpo.codigo, 'o código deve aparecer uma única vez')
  idsCriados.push(criacao.corpo.usuario.id)

  const auditoria = await api('GET', '/admin/audit', { token: tokenAdmin })
  const registro = auditoria.corpo.acoes.find(a => a.entidadeId === criacao.corpo.usuario.id)
  assert.ok(registro, 'a ação deve estar no histórico')
  assert.equal(registro.acao, 'usuario_criado')
  assert.equal(registro.atorNome, 'TESTE-admin-auditoria')
})

test('a lista de usuários aceita busca e filtros', async () => {
  const admin = await criarUsuarioTeste('TESTE-admin-busca', 'admin', 'CMB-TESTE-ADMIN-BSQ-01')
  const tokenAdmin = await tokenDe(admin.codigo, IP.simples)
  const resposta = await api('GET', '/admin/users?busca=TESTE-admin-busca', { token: tokenAdmin })
  assert.equal(resposta.status, 200)
  assert.ok(resposta.corpo.usuarios.some(u => u.nome === 'TESTE-admin-busca'))
})

// ---------------------------------------------------------------------------
// Rotas do Dia
// ---------------------------------------------------------------------------

test('Rotas do Dia: publicar, aceitar, executar e concluir', async () => {
  const admin = await criarUsuarioTeste('TESTE-admin-rotas', 'admin', 'CMB-TESTE-ADMIN-RTS-01')
  const lojista = await criarUsuarioTeste('TESTE-lojista-rotas', 'lojista', 'CMB-TESTE-LOJ-RTS-001')
  const motoboy = await criarUsuarioTeste('TESTE-motoboy-rotas', 'motoboy', 'CMB-TESTE-MOT-RTS-001')
  const tokenAdmin = await tokenDe(admin.codigo, IP.rotas)
  const tokenLojista = await tokenDe(lojista.codigo, IP.rotas)
  const tokenMotoboy = await tokenDe(motoboy.codigo, IP.rotas)

  const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // 1) o solicitante publica a rota
  const criacao = await api('POST', '/daily-routes', {
    token: tokenLojista,
    corpo: {
      titulo: 'Entrega de caixas',
      origem: 'Centro de distribuição',
      destino: 'Bairro das Palmeiras',
      data: amanha,
      saida: '08:00',
      valor: '45,00',
      publicar: true,
    },
  })
  assert.equal(criacao.status, 201)
  assert.equal(criacao.corpo.rota.status, 'publicada')
  const rotaId = criacao.corpo.rota.id

  // 2) o motoboy enxerga a rota disponível
  const disponiveis = await api('GET', '/daily-routes/available', { token: tokenMotoboy })
  assert.equal(disponiveis.status, 200)
  assert.ok(disponiveis.corpo.rotas.some(r => r.id === rotaId))
  // o telefone do solicitante NÃO é liberado antes da contratação
  const vista = disponiveis.corpo.rotas.find(r => r.id === rotaId)
  assert.equal(vista.telefonePublicador, null)

  // 3) o motoboy aceita com contraproposta
  const aceite = await api('POST', `/daily-routes/${rotaId}/accept`, {
    token: tokenMotoboy,
    corpo: { valorProposto: '50,00' },
  })
  assert.equal(aceite.status, 200)
  assert.equal(aceite.corpo.rota.status, 'contratada')
  assert.equal(aceite.corpo.rota.valorCombinado, '50.00')
  assert.equal(aceite.corpo.rota.telefonePublicador !== null, true)

  // 4) o solicitante acompanha a rota contratada
  const publicadas = await api('GET', '/daily-routes/published', { token: tokenLojista })
  const minha = publicadas.corpo.rotas.find(r => r.id === rotaId)
  assert.equal(minha.status, 'contratada')

  // 5) o motoboy executa
  const inicio = await api('POST', `/daily-routes/${rotaId}/start`, { token: tokenMotoboy })
  assert.equal(inicio.corpo.rota.status, 'em_andamento')

  const fim = await api('POST', `/daily-routes/${rotaId}/complete`, {
    token: tokenMotoboy,
    corpo: { valorFinal: '50,00' },
  })
  assert.equal(fim.corpo.rota.status, 'concluida')

  // 6) a rota não aparece mais como disponível
  const depois = await api('GET', '/daily-routes/available', { token: tokenMotoboy })
  assert.equal(depois.corpo.rotas.some(r => r.id === rotaId), false)

  // 7) o administrador vê a rota na listagem
  const adminLista = await api('GET', '/admin/daily-routes', { token: tokenAdmin })
  assert.ok(adminLista.corpo.rotas.some(r => r.id === rotaId))
})

test('Rotas do Dia: só um motoboy consegue aceitar a mesma rota', async () => {
  const lojista = await criarUsuarioTeste('TESTE-lojista-concorrencia', 'lojista', 'CMB-TESTE-LOJ-CON-001')
  const primeiro = await criarUsuarioTeste('TESTE-motoboy-concorrencia-1', 'motoboy', 'CMB-TESTE-MOT-CON-001')
  const segundo = await criarUsuarioTeste('TESTE-motoboy-concorrencia-2', 'motoboy', 'CMB-TESTE-MOT-CON-002')
  const tokenLojista = await tokenDe(lojista.codigo, IP.rotas)
  const tokenPrimeiro = await tokenDe(primeiro.codigo, IP.rotas)
  const tokenSegundo = await tokenDe(segundo.codigo, IP.rotas)

  const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const criacao = await api('POST', '/daily-routes', {
    token: tokenLojista,
    corpo: {
      titulo: 'Rota disputada',
      origem: 'A',
      destino: 'B',
      data: amanha,
      publicar: true,
    },
  })
  const rotaId = criacao.corpo.rota.id

  const aceite1 = await api('POST', `/daily-routes/${rotaId}/accept`, { token: tokenPrimeiro })
  assert.equal(aceite1.status, 200)

  const aceite2 = await api('POST', `/daily-routes/${rotaId}/accept`, { token: tokenSegundo })
  assert.equal(aceite2.status, 409)
  assert.equal(aceite2.corpo.codigo, 'ROTA_JA_CONTRATADA')
})

test('Rotas do Dia: rascunho, publicação e cancelamento com motivo', async () => {
  const lojista = await criarUsuarioTeste('TESTE-lojista-rascunho', 'lojista', 'CMB-TESTE-LOJ-RSC-001')
  const tokenLojista = await tokenDe(lojista.codigo, IP.rotas)
  const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const rascunho = await api('POST', '/daily-routes', {
    token: tokenLojista,
    corpo: {
      titulo: 'Rota em rascunho',
      origem: 'A',
      destino: 'B',
      data: amanha,
      publicar: false,
    },
  })
  assert.equal(rascunho.corpo.rota.status, 'rascunho')
  const rotaId = rascunho.corpo.rota.id

  const publicado = await api('POST', `/daily-routes/${rotaId}/publish`, { token: tokenLojista })
  assert.equal(publicado.corpo.rota.status, 'publicada')

  const cancelado = await api('POST', `/daily-routes/${rotaId}/cancel`, {
    token: tokenLojista,
    corpo: { motivo: 'Cliente desmarcou o serviço.' },
  })
  assert.equal(cancelado.corpo.rota.status, 'cancelada')
  assert.equal(cancelado.corpo.rota.motivoCancelamento, 'Cliente desmarcou o serviço.')
})

test('Rotas do Dia: data inválida é recusada', async () => {
  const lojista = await criarUsuarioTeste('TESTE-lojista-data', 'lojista', 'CMB-TESTE-LOJ-DAT-001')
  const tokenLojista = await tokenDe(lojista.codigo, IP.rotas)
  const resposta = await api('POST', '/daily-routes', {
    token: tokenLojista,
    corpo: { titulo: 'Sem data', origem: 'A', destino: 'B', data: 'amanhã' },
  })
  assert.equal(resposta.status, 400)
  assert.equal(resposta.corpo.codigo, 'DATA_INVALIDA')
})

// ---------------------------------------------------------------------------
// Controle de acesso
// ---------------------------------------------------------------------------

test('papéis não podem acessar o que não é deles', async () => {
  const motoboy = await criarUsuarioTeste('TESTE-motoboy-permissoes', 'motoboy', 'CMB-TESTE-MOT-PRM-001')
  const lojista = await criarUsuarioTeste('TESTE-lojista-permissoes', 'lojista', 'CMB-TESTE-LOJ-PRM-001')
  const tokenMotoboy = await tokenDe(motoboy.codigo, IP.permissoes)
  const tokenLojista = await tokenDe(lojista.codigo, IP.permissoes)

  // motoboy no painel administrativo → 403
  const adminPainel = await api('GET', '/admin/overview', { token: tokenMotoboy })
  assert.equal(adminPainel.status, 403)

  // lojista na área de trabalho do motoboy → 403
  const area = await api('GET', '/daily-routes/mine', { token: tokenLojista })
  assert.equal(area.status, 403)

  // lojista tentando aceitar rota → 403 (rota só do motoboy)
  const aceite = await api('POST', '/daily-routes/00000000-0000-0000-0000-000000000000/accept', {
    token: tokenLojista,
  })
  assert.equal(aceite.status, 403)

  // sem token → 401
  const semToken = await api('GET', '/daily-routes/available')
  assert.equal(semToken.status, 401)
})
