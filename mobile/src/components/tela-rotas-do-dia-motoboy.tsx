// Tela "Rotas do dia" do motoboy.
//
// Dois segmentos: as rotas ABERTAS (para aceitar) e as rotas que ele já
// CONTRATOU (para iniciar e concluir o serviço).

import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import type { RotaDiaApi } from '@/api/cliente'
import { mensagemDeErro } from '@/api/cliente'
import Botao from '@/components/botao'
import Campo from '@/components/campo'
import CartaoRotaDia from '@/components/cartao-rota-dia'
import Segmentado, { type Segmento } from '@/components/segmentado'
import Vazio from '@/components/vazio'
import { useRotasDiaMotoboy } from '@/rotas-dia'
import { useTema } from '@/theme'
import { lerValor } from '@/valor'

type Aba = 'disponiveis' | 'minhas'

const ABAS: Segmento<Aba>[] = [
  { chave: 'disponiveis', rotulo: 'Disponíveis' },
  { chave: 'minhas', rotulo: 'Minhas' },
]

export default function TelaRotasDoDiaMotoboy() {
  const { cores } = useTema()
  const { disponiveis, contratadas, carregando, erro, aceitar, iniciar, concluir } =
    useRotasDiaMotoboy()

  const [aba, setAba] = useState<Aba>('disponiveis')
  const [valorContra, setValorContra] = useState<Record<string, string>>({})
  const [abertoContra, setAbertoContra] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erroAcao, setErroAcao] = useState('')

  async function aoAceitar(rota: RotaDiaApi) {
    if (ocupado) return
    const digitado = abertoContra === rota.id ? (valorContra[rota.id] ?? '') : ''
    let proposta: string | null = null
    if (digitado.trim()) {
      const numero = lerValor(digitado)
      if (numero === 'invalido' || numero === null || numero <= 0) {
        setErroAcao('Informe um valor válido para a contraproposta, por exemplo 30,00.')
        return
      }
      proposta = numero.toFixed(2)
    }
    setErroAcao('')
    setOcupado(rota.id)
    try {
      await aceitar(rota.id, proposta)
      setAbertoContra(null)
    } catch (falha) {
      setErroAcao(mensagemDeErro(falha))
    } finally {
      setOcupado(null)
    }
  }

  async function aoIniciar(rota: RotaDiaApi) {
    if (ocupado) return
    setErroAcao('')
    setOcupado(rota.id)
    try {
      await iniciar(rota.id)
    } catch (falha) {
      setErroAcao(mensagemDeErro(falha))
    } finally {
      setOcupado(null)
    }
  }

  async function aoConcluir(rota: RotaDiaApi) {
    if (ocupado) return
    const digitado = valorContra[rota.id] ?? ''
    let final: string | null = null
    if (digitado.trim()) {
      const numero = lerValor(digitado)
      if (numero === 'invalido' || numero === null || numero < 0) {
        setErroAcao('Informe um valor final válido, por exemplo 35,00.')
        return
      }
      final = numero.toFixed(2)
    }
    setErroAcao('')
    setOcupado(rota.id)
    try {
      await concluir(rota.id, final)
      setValorContra(anterior => ({ ...anterior, [rota.id]: '' }))
    } catch (falha) {
      setErroAcao(mensagemDeErro(falha))
    } finally {
      setOcupado(null)
    }
  }

  const lista = aba === 'disponiveis' ? disponiveis : contratadas

  return (
    <View style={styles.area}>
      <Segmentado segmentos={ABAS} valor={aba} onChange={setAba} />

      {erroAcao ? <Text style={[styles.mensagem, { color: cores.perigo }]}>{erroAcao}</Text> : null}
      {erro ? <Text style={[styles.mensagem, { color: cores.perigo }]}>{erro}</Text> : null}

      <ScrollView
        style={styles.lista}
        contentContainerStyle={styles.conteudo}
        keyboardShouldPersistTaps="handled"
      >
        {carregando ? (
          <Text style={{ color: cores.textoSuave, fontSize: 14 }}>Carregando…</Text>
        ) : lista.length === 0 ? (
          <Vazio
            titulo={aba === 'disponiveis' ? 'Nenhuma rota aberta' : 'Nenhuma rota contratada'}
            dica={
              aba === 'disponiveis'
                ? 'Quando lojistas ou pessoas físicas publicarem rotas do dia, elas aparecem aqui.'
                : 'Aceite uma rota disponível para ela aparecer aqui.'
            }
          />
        ) : (
          lista.map(rota =>
            aba === 'disponiveis' ? (
              <CartaoRotaDia
                key={rota.id}
                rota={rota}
                mostrarPublicador={false}
                acoes={
                  <>
                    <Botao
                      rotulo={ocupado === rota.id ? 'Aceitando…' : 'Aceitar rota'}
                      onPress={() => aoAceitar(rota)}
                      disabled={ocupado !== null}
                    />
                    <Botao
                      rotulo={abertoContra === rota.id ? 'Fechar' : 'Contrapor'}
                      tipo="secundario"
                      onPress={() =>
                        setAbertoContra(abertoContra === rota.id ? null : rota.id)
                      }
                      disabled={ocupado !== null}
                    />
                    {abertoContra === rota.id ? (
                      <View style={styles.campoValor}>
                        <Campo
                          rotulo="Seu valor (opcional)"
                          valor={valorContra[rota.id] ?? ''}
                          onChange={texto =>
                            setValorContra(anterior => ({ ...anterior, [rota.id]: texto }))
                          }
                          placeholder="Ex.: 30,00"
                          keyboardType="decimal-pad"
                        />
                      </View>
                    ) : null}
                  </>
                }
              />
            ) : (
              <CartaoRotaDia
                key={rota.id}
                rota={rota}
                mostrarPublicador
                acoes={
                  <>
                    {rota.status === 'contratada' ? (
                      <Botao
                        rotulo={ocupado === rota.id ? 'Iniciando…' : 'Iniciar serviço'}
                        onPress={() => aoIniciar(rota)}
                        disabled={ocupado !== null}
                      />
                    ) : null}
                    {rota.status === 'em_andamento' ? (
                      <>
                        <Botao
                          rotulo={ocupado === rota.id ? 'Concluindo…' : 'Concluir'}
                          onPress={() => aoConcluir(rota)}
                          disabled={ocupado !== null}
                        />
                        <View style={styles.campoValor}>
                          <Campo
                            rotulo="Valor final (opcional)"
                            valor={valorContra[rota.id] ?? ''}
                            onChange={texto =>
                              setValorContra(anterior => ({ ...anterior, [rota.id]: texto }))
                            }
                            placeholder="Ex.: 35,00"
                            keyboardType="decimal-pad"
                          />
                        </View>
                      </>
                    ) : null}
                  </>
                }
              />
            ),
          )
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  area: {
    gap: 12,
    padding: 16,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  lista: {
    flexGrow: 0,
  },
  conteudo: {
    gap: 12,
    paddingBottom: 24,
  },
  campoValor: {
    flexBasis: 220,
    flexGrow: 1,
  },
  mensagem: {
    fontSize: 14,
    lineHeight: 19,
  },
})
