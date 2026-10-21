import test from 'node:test'
import assert from 'node:assert/strict'

import { lerValor } from '../src/valor.ts'

test('campo vazio significa valor não informado (null)', () => {
  assert.equal(lerValor(''), null)
  assert.equal(lerValor('   '), null)
})

test('texto inválido é rejeitado em vez de virar zero', () => {
  const invalidos = ['abc', 'R$', '12 reais', '-5', '+5', '12,', ',50', '1.2.3', '1,2,3', '.']
  for (const valor of invalidos) {
    assert.equal(lerValor(valor), 'invalido', valor)
  }
})

test('aceita vírgula como separador decimal', () => {
  assert.equal(lerValor('12,50'), 12.5)
  assert.equal(lerValor('R$ 12,50'), 12.5)
  assert.equal(lerValor('  12,5  '), 12.5)
})

test('aceita ponto como separador decimal', () => {
  assert.equal(lerValor('12.50'), 12.5)
  assert.equal(lerValor('R$ 12.50'), 12.5)
})

test('aceita separadores de milhar', () => {
  assert.equal(lerValor('1.234,56'), 1234.56)
  assert.equal(lerValor('1,234.56'), 1234.56)
  assert.equal(lerValor('1.234.567'), 1234567)
})

test('zero é um valor válido', () => {
  assert.equal(lerValor('0'), 0)
  assert.equal(lerValor('0,00'), 0)
})
