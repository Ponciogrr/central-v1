import test from 'node:test'
import assert from 'node:assert/strict'

import {
  dataIsoDeTexto,
  formatarMoeda,
  hojeIso,
  rotuloStatusRotaDia,
  textoDeDataIso,
} from '../src/formato.ts'

test('moeda no padrão brasileiro', () => {
  assert.equal(formatarMoeda(25), 'R$ 25,00')
  assert.equal(formatarMoeda(25.5), 'R$ 25,50')
  assert.equal(formatarMoeda('30,75'), 'R$ 30,75')
  assert.equal(formatarMoeda(null), 'Valor não informado')
  assert.equal(formatarMoeda(''), 'Valor não informado')
})

test('data digitada vira o formato do servidor', () => {
  assert.equal(dataIsoDeTexto('21/10/2026'), '2026-10-21')
  assert.equal(dataIsoDeTexto('01/02/2026'), '2026-02-01')
})

test('data inexistente é recusada', () => {
  assert.equal(dataIsoDeTexto('31/02/2026'), null)
  assert.equal(dataIsoDeTexto('21/13/2026'), null)
  assert.equal(dataIsoDeTexto('2026-10-21'), null)
  assert.equal(dataIsoDeTexto(''), null)
})

test('data do servidor volta para a tela', () => {
  assert.equal(textoDeDataIso('2026-10-21'), '21/10/2026')
})

test('hoje no formato do servidor', () => {
  assert.match(hojeIso(), /^\d{4}-\d{2}-\d{2}$/)
})

test('estado da rota do dia tem rótulo e cor', () => {
  assert.deepEqual(rotuloStatusRotaDia('rascunho'), { texto: 'Rascunho', tom: 'neutro' })
  assert.deepEqual(rotuloStatusRotaDia('publicada'), { texto: 'Publicada', tom: 'acao' })
  assert.deepEqual(rotuloStatusRotaDia('contratada'), { texto: 'Contratada', tom: 'destaque' })
  assert.deepEqual(rotuloStatusRotaDia('em_andamento'), { texto: 'Em andamento', tom: 'destaque' })
  assert.deepEqual(rotuloStatusRotaDia('concluida'), { texto: 'Concluída', tom: 'sucesso' })
  assert.deepEqual(rotuloStatusRotaDia('cancelada'), { texto: 'Cancelada', tom: 'perigo' })
})
