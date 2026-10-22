import { router } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { mensagemDeErro, type EncaixeSolicitanteApi, type RotaApi } from '@/api/cliente'
import { BarraAviso, useAviso } from '@/components/aviso'
import Botao from '@/components/botao'
import Campo from '@/components/campo'
import { confirmar as confirmarAcao } from '@/components/confirmar'
import Vazio from '@/components/vazio'
import { useRotasDisponiveis } from '@/rotas'
import { NUMEROS, useTema } from '@/theme'
import { lerValor } from '@/valor'

function formatarValor(valor: number | null): string {
  if (valor === null) return 'Valor não informado'
  return `R$ ${valor.toFixed(2).replace('.', ',')}`
}

function rotuloEncaixe(encaixe: EncaixeSolicitanteApi): string {
  switch (encaixe.status) {
    case 'pendente':
      return encaixe.valorContraproposta !== null ? 'Aguardando você' : 'Aguarda resposta'
    case 'aceito':
      return 'Aceito'
    case 'recusado':
      return 'Recusado'
    case 'cancelado':
      return 'Cancelado'
  }
}

function confirmar(titulo: string, mensagem: string): Promise<boolean> {
  return confirmarAcao(titulo, mensagem, { perigo: true })
}

// Tela compartilhada por lojista e pessoa física: lista as rotas publicadas que
// aceitam encaixes, permite pedir um encaixe e acompanhar os pedidos feitos.
export default function TelaRotasSolicitante() {
  const { cores } = useTema()
  const {
    logado,
    rotas,
    encaixes,
    carregando,
    erro,
    solicitar,
    cancelar,
    decidirContraproposta,
    recarregar,
  } = useRotasDisponiveis()
  const { aviso, mostrar, ocultar } = useAviso()

  const [rotaSelecionada, setRotaSelecionada] = useState<RotaApi | null>(null)
  const [coleta, setColeta] = useState('')
  const [destino, setDestino] = useState('')
  const [valor, setValor] = useState('')
  const [obs, setObs] = useState('')
  const [erroForm, setErroForm] = useState('')
  const [processando, setProcessando] = useState(false)
  const [processandoEncaixe, setProcessandoEncaixe] = useState<string | null>(null)

  function abrirPedido(rota: RotaApi) {
    setRotaSelecionada(rota)
    setColeta('')
    setDestino('')
    setValor('')
    setObs('')
    setErroForm('')
  }

  function fecharPedido() {
    setRotaSelecionada(null)
  }

  async function enviarPedido() {
    if (!rotaSelecionada || processando) return
    setErroForm('')
    if (!coleta.trim()) return setErroForm('Informe o endereço de coleta.')
    if (!destino.trim()) return setErroForm('Informe o endereço de entrega.')

    const numero = lerValor(valor)
    if (numero === 'invalido' || numero === null || numero <= 0) {
      return setErroForm('Informe o valor que você propõe pagar, por exemplo 25,00.')
    }

    setProcessando(true)
    try {
      await solicitar({
        rotaId: rotaSelecionada.id,
        coleta: coleta.trim(),
        destino: destino.trim(),
        valor: numero,
        observacoes: obs.trim() || null,
      })
      mostrar('Pedido de encaixe enviado. Aguardando o motoboy responder.', 'ok')
      fecharPedido()
    } catch (falha) {
      setErroForm(mensagemDeErro(falha))
    } finally {
      setProcessando(false)
    }
  }

  async function cancelarEncaixe(id: string) {
    if (!(await confirmar('Cancelar encaixe', 'Deseja cancelar este pedido de encaixe?'))) return
    try {
      await cancelar(id)
      mostrar('Pedido cancelado.', 'info')
    } catch (falha) {
      setErroForm(mensagemDeErro(falha))
    }
  }

  // Decisão do cliente sobre a contraproposta do motoboy.
  async function decidirContra(id: string, decisao: 'aceitar' | 'recusar') {
    const texto =
      decisao === 'aceitar'
        ? 'Aceitar a contraproposta encerra a negociação com o valor proposto pelo motoboy. Continuar?'
        : 'Recusar a contraproposta encerra este encaixe sem acordo. Continuar?'
    if (!(await confirmar('Contraproposta do motoboy', texto))) return
    setProcessandoEncaixe(id)
    try {
      await decidirContraproposta(id, decisao)
      mostrar(
        decisao === 'aceitar'
          ? 'Contraproposta aceita! O valor foi acordado.'
          : 'Contraproposta recusada.',
        'ok',
      )
    } catch (falha) {
      setErroForm(mensagemDeErro(falha))
    } finally {
      setProcessandoEncaixe(null)
    }
  }

  if (!logado) {
    return (
      <View style={{ flex: 1, backgroundColor: cores.fundo }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.conteudo}
          keyboardShouldPersistTaps="handled"
        >
          <Vazio
            titulo="Sessão de demonstração"
            dica="Entre com o seu código de acesso para ver as rotas disponíveis e pedir encaixes."
            icone="log-in-outline"
            acao={{ rotulo: 'Entrar com código', onPress: () => router.push('/login') }}
          />
        </ScrollView>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: cores.fundo }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.conteudo}
        keyboardShouldPersistTaps="handled"
      >
      <BarraAviso aviso={aviso} aoFechar={ocultar} />

      <Text style={[styles.intro, { color: cores.textoSuave }]}>
        Rotas publicadas por motoboys que aceitam encaixes. Escolha a que combina com o seu trajeto,
        informe coleta, entrega e o valor que você propõe pagar — o motoboy pode aceitar ou
        contrapropor.
      </Text>

      {rotaSelecionada ? (
        <View style={[styles.bloco, { backgroundColor: cores.superficie, borderColor: cores.acao }]}>
          <Text style={[styles.tituloBloco, { color: cores.texto }]}>
            Encaixe para: {rotaSelecionada.destino}
          </Text>
          <Campo
            rotulo="Endereço de coleta"
            valor={coleta}
            onChange={t => {
              setColeta(t)
              if (erroForm) setErroForm('')
            }}
            placeholder="Onde buscar"
          />
          <Campo
            rotulo="Endereço de entrega"
            valor={destino}
            onChange={t => {
              setDestino(t)
              if (erroForm) setErroForm('')
            }}
            placeholder="Para onde vai"
          />
          <Campo
            rotulo="Valor que você propõe pagar (R$)"
            valor={valor}
            onChange={t => {
              setValor(t)
              if (erroForm) setErroForm('')
            }}
            placeholder="Ex.: 25,00"
            keyboardType="decimal-pad"
          />
          <Campo
            rotulo="Observações (opcional)"
            valor={obs}
            onChange={setObs}
            placeholder="Ex.: embalagem frágil"
          />

          {erroForm ? <Text style={[styles.erro, { color: cores.perigo }]}>{erroForm}</Text> : null}

          <View style={styles.acoes}>
            <View style={styles.acaoFlex}>
              <Botao rotulo="Voltar" tipo="secundario" onPress={fecharPedido} />
            </View>
            <View style={styles.acaoFlex}>
              <Botao
                rotulo={processando ? 'Enviando…' : 'Pedir encaixe'}
                onPress={enviarPedido}
                disabled={processando}
              />
            </View>
          </View>
        </View>
      ) : null}

      <Text style={[styles.secao, { color: cores.texto }]}>Rotas disponíveis</Text>
      {carregando ? (
        <Text style={[styles.aviso, { color: cores.textoSuave }]}>Carregando…</Text>
      ) : rotas.length === 0 ? (
        <Vazio
          titulo="Nenhuma rota disponível"
          dica="Quando um motoboy publicar uma rota que aceita encaixes, ela aparece aqui."
        />
      ) : (
        rotas.map(rota => (
          <View
            key={rota.id}
            style={[styles.bloco, { backgroundColor: cores.superficie, borderColor: cores.borda }]}
          >
            <View style={styles.linhaTopo}>
              <Text style={[styles.destinoRota, { color: cores.texto }]}>{rota.destino}</Text>
              <Text style={[styles.etiquetaRota, { color: cores.acao }]}>Aceita encaixes</Text>
            </View>
            <Text style={[styles.detalhe, { color: cores.textoSuave }]}>
              Saída: {rota.saidaPrevista || 'não informada'} · Retorno:{' '}
              {rota.retornoPrevisto || 'não informado'}
              {rota.extensao ? ` · ${rota.extensao}` : ''}
            </Text>
            <Botao rotulo="Pedir encaixe" onPress={() => abrirPedido(rota)} />
          </View>
        ))
      )}

      <Text style={[styles.secao, { color: cores.texto }]}>Meus encaixes</Text>
      {encaixes.length === 0 ? (
        <Vazio
          titulo="Nenhum pedido"
          dica="Os encaixes que você pedir aparecem aqui com o estado atual."
        />
      ) : (
        encaixes.map(encaixe => (
          <View
            key={encaixe.id}
            style={[styles.bloco, { backgroundColor: cores.superficie, borderColor: cores.borda }]}
          >
            <View style={styles.linhaTopo}>
              <Text style={[styles.destinoRota, { color: cores.texto }]}>
                {encaixe.destinoRota || 'Rota'}
              </Text>
              <View
                style={[
                  styles.etiqueta,
                  {
                    borderColor:
                      encaixe.status === 'aceito'
                        ? cores.acao
                        : encaixe.status === 'pendente'
                          ? cores.destaque
                          : cores.borda,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.etiquetaTexto,
                    {
                      color:
                        encaixe.status === 'aceito'
                          ? cores.acao
                          : encaixe.status === 'pendente'
                            ? cores.destaque
                            : cores.textoSuave,
                    },
                  ]}
                >
                  {rotuloEncaixe(encaixe)}
                </Text>
              </View>
            </View>
            <Text style={[styles.detalhe, { color: cores.textoSuave }]}>
              Coleta: {encaixe.coleta}
            </Text>
            <Text style={[styles.detalhe, { color: cores.textoSuave }]}>
              Entrega: {encaixe.destino}
            </Text>
            {encaixe.observacoes ? (
              <Text style={[styles.detalhe, { color: cores.textoSuave }]}>
                Obs.: {encaixe.observacoes}
              </Text>
            ) : null}

            <View style={styles.linhaValor}>
              <Text style={[styles.rotuloValor, { color: cores.textoSuave }]}>
                Sua proposta
              </Text>
              <Text style={[styles.valor, { color: cores.texto }]}>{formatarValor(encaixe.valor)}</Text>
            </View>

            {encaixe.status === 'aceito' ? (
              <View style={styles.linhaValor}>
                <Text style={[styles.rotuloValor, { color: cores.acao }]}>Valor acordado</Text>
                <Text style={[styles.valor, { color: cores.acao }]}>
                  {formatarValor(encaixe.valorAcordado)}
                </Text>
              </View>
            ) : null}

            {encaixe.status === 'pendente' && encaixe.valorContraproposta !== null ? (
              <View
                style={[
                  styles.caixaContra,
                  { borderColor: cores.destaque, backgroundColor: cores.superficie2 },
                ]}
              >
                <Text style={[styles.detalhe, { color: cores.texto }]}>
                  O motoboy contrapropôs {formatarValor(encaixe.valorContraproposta)}.
                </Text>
                <Text style={[styles.detalhe, { color: cores.textoSuave }]}>
                  O valor acordado será o dele caso você aceite.
                </Text>
                <View style={styles.acoes}>
                  <View style={styles.acaoFlex}>
                    <Botao
                      rotulo={processandoEncaixe === encaixe.id ? 'Recusando…' : 'Recusar contra'}
                      tipo="secundario"
                      onPress={() => void decidirContra(encaixe.id, 'recusar')}
                      disabled={processandoEncaixe !== null}
                    />
                  </View>
                  <View style={styles.acaoFlex}>
                    <Botao
                      rotulo={processandoEncaixe === encaixe.id ? 'Aceitando…' : 'Aceitar contra'}
                      onPress={() => void decidirContra(encaixe.id, 'aceitar')}
                      disabled={processandoEncaixe !== null}
                    />
                  </View>
                </View>
              </View>
            ) : null}

            {encaixe.status === 'pendente' ? (
              <Botao
                rotulo="Cancelar pedido"
                tipo="secundario"
                onPress={() => cancelarEncaixe(encaixe.id)}
              />
            ) : null}
          </View>
        ))
      )}

      {erro ? <Text style={[styles.erro, { color: cores.perigo }]}>{erro}</Text> : null}

      <Botao rotulo="Atualizar" tipo="secundario" onPress={recarregar} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  conteudo: {
    padding: 24,
    gap: 16,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  intro: {
    fontSize: 12,
    lineHeight: 18,
  },
  bloco: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  tituloBloco: {
    fontSize: 14,
    fontWeight: '700',
  },
  secao: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  linhaTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  destinoRota: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  valor: {
    ...NUMEROS,
    fontSize: 14,
    fontWeight: '700',
  },
  etiquetaRota: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  rotuloValor: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  linhaValor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  caixaContra: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  etiqueta: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  etiquetaTexto: {
    fontSize: 12,
    fontWeight: '700',
  },
  detalhe: {
    fontSize: 14,
    lineHeight: 20,
  },
  acoes: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  acaoFlex: {
    flex: 1,
  },
  aviso: {
    fontSize: 14,
  },
  erro: {
    fontSize: 14,
  },
})
