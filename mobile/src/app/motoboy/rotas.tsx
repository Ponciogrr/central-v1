import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { mensagemDeErro, type DadosRota, type EncaixeMotoboyApi, type RotaApi } from '@/api/cliente'
import { BarraAviso, useAviso } from '@/components/aviso'
import Botao from '@/components/botao'
import Campo from '@/components/campo'
import Segmentado, { type Segmento } from '@/components/segmentado'
import TelaRotasDoDiaMotoboy from '@/components/tela-rotas-do-dia-motoboy'
import Vazio from '@/components/vazio'
import { useRotasMotoboy } from '@/rotas'
import { useTema } from '@/theme'
import { lerValor } from '@/valor'

type Aba = 'dia' | 'minhas' | 'encaixes'

const ABAS: Segmento<Aba>[] = [
  { chave: 'dia', rotulo: 'Rotas do dia' },
  { chave: 'minhas', rotulo: 'Minhas rotas' },
  { chave: 'encaixes', rotulo: 'Encaixes' },
]

const ROTULO_STATUS: Record<RotaApi['status'], string> = {
  publicada: 'Publicada',
  encerrada: 'Encerrada',
  cancelada: 'Cancelada',
}

function formatarValor(valor: number | null): string {
  if (valor === null) return 'Valor não informado'
  return `R$ ${valor.toFixed(2).replace('.', ',')}`
}

// Confirmação compatível com web e nativo (Alert só funciona bem no nativo).
function confirmar(titulo: string, mensagem: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    const ok = typeof window !== 'undefined' ? window.confirm(`${titulo}\n\n${mensagem}`) : false
    return Promise.resolve(ok)
  }
  return new Promise(resolve => {
    Alert.alert(titulo, mensagem, [
      { text: 'Voltar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Confirmar', style: 'destructive', onPress: () => resolve(true) },
    ])
  })
}

export default function RotasMotoboy() {
  const { cores } = useTema()
  const {
    logado,
    rotas,
    encaixes,
    carregando,
    erro,
    publicar,
    editar,
    encerrar,
    responder,
    contrapropor,
    recarregar,
  } = useRotasMotoboy()
  const { aviso, mostrar, ocultar } = useAviso()

  const [destino, setDestino] = useState('')
  const [saida, setSaida] = useState('')
  const [retorno, setRetorno] = useState('')
  const [extensao, setExtensao] = useState('')
  const [aceita, setAceita] = useState(true)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [erroForm, setErroForm] = useState('')
  const [processando, setProcessando] = useState(false)
  const [aba, setAba] = useState<Aba>('dia')

  // Valor de cada contraproposta em digitação (por id de encaixe).
  const [contras, setContras] = useState<Record<string, string>>({})
  const [processandoEncaixe, setProcessandoEncaixe] = useState<string | null>(null)

  function limparFormulario() {
    setDestino('')
    setSaida('')
    setRetorno('')
    setExtensao('')
    setAceita(true)
    setEditandoId(null)
  }

  function iniciarEdicao(rota: RotaApi) {
    setEditandoId(rota.id)
    setDestino(rota.destino)
    setSaida(rota.saidaPrevista ?? '')
    setRetorno(rota.retornoPrevisto ?? '')
    setExtensao(rota.extensao ?? '')
    setAceita(rota.aceitaEncaixes)
    setErroForm('')
  }

  async function salvar() {
    if (processando) return
    setErroForm('')

    if (!destino.trim()) return setErroForm('Informe o destino da rota.')

    const dados: DadosRota = {
      destino: destino.trim(),
      saidaPrevista: saida.trim() || null,
      retornoPrevisto: retorno.trim() || null,
      extensao: extensao.trim() || null,
      aceitaEncaixes: aceita,
    }

    setProcessando(true)
    try {
      if (editandoId) {
        await editar(editandoId, dados)
      } else {
        await publicar(dados)
      }
      mostrar(editandoId ? 'Rota atualizada.' : 'Rota publicada.', 'ok')
      limparFormulario()
    } catch (falha) {
      setErroForm(mensagemDeErro(falha))
    } finally {
      setProcessando(false)
    }
  }

  async function fechar(rota: RotaApi, acao: 'close' | 'cancel') {
    const motivo =
      acao === 'close'
        ? 'Ao encerrar, os encaixes ainda pendentes serão cancelados. Deseja continuar?'
        : 'Ao cancelar, os encaixes ainda pendentes serão cancelados. Deseja continuar?'
    if (!(await confirmar(acao === 'close' ? 'Encerrar rota' : 'Cancelar rota', motivo))) return
    try {
      await encerrar(rota.id, acao)
    } catch (falha) {
      setErroForm(mensagemDeErro(falha))
    }
  }

  async function responderEncaixe(id: string, acao: 'accept' | 'decline') {
    setProcessandoEncaixe(id)
    try {
      await responder(id, acao)
      mostrar(acao === 'accept' ? 'Encaixe aceito.' : 'Encaixe recusado.', 'ok')
    } catch (falha) {
      setErroForm(mensagemDeErro(falha))
    } finally {
      setProcessandoEncaixe(null)
    }
  }

  // Contraproposta: o motoboy sugere outro valor e o cliente decide.
  async function enviarContraproposta(id: string) {
    const numero = lerValor(contras[id] ?? '')
    if (numero === 'invalido' || numero === null || numero <= 0) {
      setErroForm('Informe um valor válido para a contraproposta, por exemplo 30,00.')
      return
    }
    setErroForm('')
    setProcessandoEncaixe(id)
    try {
      await contrapropor(id, numero)
      setContras(anterior => {
        const copia = { ...anterior }
        delete copia[id]
        return copia
      })
      mostrar('Contraproposta enviada. Aguardando o cliente decidir.', 'info')
    } catch (falha) {
      setErroForm(mensagemDeErro(falha))
    } finally {
      setProcessandoEncaixe(null)
    }
  }

  if (!logado) {
    return (
      <View style={{ flex: 1, backgroundColor: cores.fundo }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteudo}>
          <Vazio
            titulo="Sessão de demonstração"
            dica="Entre com o seu código de acesso para publicar rotas e receber encaixes de verdade."
          />
        </ScrollView>
      </View>
    )
  }

  const pendentes = encaixes.filter(e => e.status === 'pendente')

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

      <Segmentado segmentos={ABAS} valor={aba} onChange={setAba} />

      {aba === 'dia' ? <TelaRotasDoDiaMotoboy /> : null}

      {aba === 'minhas' ? (
        <>
      <Text style={[styles.intro, { color: cores.textoSuave }]}>
        Publique uma rota com destino e horários. Enquanto estiver publicada, lojistas e pessoas
        físicas podem pedir encaixes no seu caminho — com o valor proposto por eles, negociado
        aqui mesmo.
      </Text>

      <View style={[styles.bloco, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
        <Text style={[styles.tituloBloco, { color: cores.texto }]}>
          {editandoId ? 'Editar rota' : 'Nova rota'}
        </Text>

        <Campo
          rotulo="Destino / localidade"
          valor={destino}
          onChange={t => {
            setDestino(t)
            if (erroForm) setErroForm('')
          }}
          placeholder="Ex.: Centro"
        />
        <Campo rotulo="Horário de saída" valor={saida} onChange={setSaida} placeholder="Ex.: 14:00" />
        <Campo
          rotulo="Previsão de retorno"
          valor={retorno}
          onChange={setRetorno}
          placeholder="Ex.: 18:00"
        />
        <Campo
          rotulo="Extensão (opcional)"
          valor={extensao}
          onChange={setExtensao}
          placeholder="Ex.: cerca de 20 km"
        />

        <View style={styles.linhaAceita}>
          <Text style={[styles.rotulo, { color: cores.textoSuave }]}>Aceita encaixes?</Text>
          <View style={styles.opcoesAceita}>
            <Botao
              rotulo="Sim"
              tipo={aceita ? 'primario' : 'secundario'}
              style={styles.botaoAceita}
              onPress={() => setAceita(true)}
            />
            <Botao
              rotulo="Não"
              tipo={aceita ? 'secundario' : 'primario'}
              style={styles.botaoAceita}
              onPress={() => setAceita(false)}
            />
          </View>
        </View>

        {erroForm ? <Text style={[styles.erro, { color: cores.perigo }]}>{erroForm}</Text> : null}

        <View style={styles.acoesForm}>
          {editandoId ? (
            <View style={styles.acaoFlex}>
              <Botao rotulo="Cancelar edição" tipo="secundario" onPress={limparFormulario} />
            </View>
          ) : null}
          <View style={styles.acaoFlex}>
            <Botao
              rotulo={processando ? 'Salvando…' : editandoId ? 'Salvar rota' : 'Publicar rota'}
              onPress={salvar}
              disabled={processando}
            />
          </View>
        </View>
      </View>

      <Text style={[styles.secao, { color: cores.texto }]}>Minhas rotas</Text>
      {carregando ? (
        <Text style={[styles.aviso, { color: cores.textoSuave }]}>Carregando…</Text>
      ) : rotas.length === 0 ? (
        <Vazio titulo="Nenhuma rota" dica="Publique uma rota acima para começar a receber encaixes." />
      ) : (
        rotas.map(rota => (
          <View
            key={rota.id}
            style={[styles.bloco, { backgroundColor: cores.superficie, borderColor: cores.borda }]}
          >
            <View style={styles.linhaTopo}>
              <Text style={[styles.destinoRota, { color: cores.texto }]}>{rota.destino}</Text>
              <View
                style={[
                  styles.etiqueta,
                  {
                    borderColor: rota.status === 'publicada' ? cores.acao : cores.destaque,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.etiquetaTexto,
                    { color: rota.status === 'publicada' ? cores.acao : cores.destaque },
                  ]}
                >
                  {ROTULO_STATUS[rota.status]}
                </Text>
              </View>
            </View>

            <Text style={[styles.detalhe, { color: cores.textoSuave }]}>
              Saída: {rota.saidaPrevista || 'não informada'} · Retorno:{' '}
              {rota.retornoPrevisto || 'não informado'}
              {rota.extensao ? ` · ${rota.extensao}` : ''}
            </Text>
            <Text style={[styles.detalhe, { color: cores.textoSuave }]}>
              {rota.aceitaEncaixes
                ? 'Aceita encaixes — o valor é negociado em cada pedido'
                : 'Não aceita encaixes'}
            </Text>

            {rota.status === 'publicada' ? (
              <View style={styles.acoesRota}>
                <View style={styles.acaoFlex}>
                  <Botao rotulo="Editar" tipo="secundario" onPress={() => iniciarEdicao(rota)} />
                </View>
                <View style={styles.acaoFlex}>
                  <Botao rotulo="Encerrar" tipo="secundario" onPress={() => fechar(rota, 'close')} />
                </View>
                <View style={styles.acaoFlex}>
                  <Botao rotulo="Cancelar" tipo="perigo" onPress={() => fechar(rota, 'cancel')} />
                </View>
              </View>
            ) : null}
          </View>
        ))
      )}
        </>
      ) : null}

      {aba === 'encaixes' ? (
        <>
      <Text style={[styles.secao, { color: cores.texto }]}>Encaixes recebidos</Text>
      {pendentes.length === 0 && encaixes.length === 0 ? (
        <Vazio
          titulo="Nenhum encaixe"
          dica="Quando alguém pedir um encaixe em uma rota sua, o pedido aparece aqui."
        />
      ) : (
        encaixes.map(encaixe => (
          <View
            key={encaixe.id}
            style={[styles.bloco, { backgroundColor: cores.superficie, borderColor: cores.borda }]}
          >
            <View style={styles.rotuloLinha}>
              <Text style={[styles.rotulo, { color: cores.textoSuave }]}>Coleta</Text>
              <Text style={[styles.detalhe, { color: cores.textoSuave }]}>
                {rotuloEncaixe(encaixe)}
              </Text>
            </View>
            <Text style={[styles.detalhe, { color: cores.texto }]}>{encaixe.coleta}</Text>
            <Text style={[styles.rotulo, { color: cores.textoSuave }]}>Entrega</Text>
            <Text style={[styles.detalhe, { color: cores.texto }]}>{encaixe.destino}</Text>
            {encaixe.observacoes ? (
              <Text style={[styles.detalhe, { color: cores.textoSuave }]}>
                Obs.: {encaixe.observacoes}
              </Text>
            ) : null}

            <View style={styles.linhaValores}>
              <Text style={[styles.rotulo, { color: cores.textoSuave }]}>Proposta do cliente</Text>
              <Text style={[styles.detalhe, { color: cores.texto }]}>{formatarValor(encaixe.valor)}</Text>
            </View>

            {encaixe.status === 'aceito' ? (
              <View style={styles.linhaValores}>
                <Text style={[styles.rotulo, { color: cores.acao }]}>Valor acordado</Text>
                <Text style={[styles.valorAcordado, { color: cores.acao }]}>
                  {formatarValor(encaixe.valorAcordado)}
                </Text>
              </View>
            ) : null}

            {encaixe.status === 'pendente' ? (
              encaixe.valorContraproposta !== null ? (
                <View
                  style={[
                    styles.caixaContra,
                    { borderColor: cores.destaque, backgroundColor: cores.superficie2 },
                  ]}
                >
                  <Text style={[styles.detalhe, { color: cores.texto }]}>
                    Sua contraproposta: {formatarValor(encaixe.valorContraproposta)}
                  </Text>
                  <Text style={[styles.detalhe, { color: cores.textoSuave }]}>
                    Aguardando o cliente decidir (aceitar ou recusar).
                  </Text>
                </View>
              ) : (
                <View style={styles.negociacao}>
                  <View style={styles.acoesRota}>
                    <View style={styles.acaoFlex}>
                      <Botao
                        rotulo={processandoEncaixe === encaixe.id ? 'Salvando…' : 'Recusar'}
                        tipo="secundario"
                        onPress={() => responderEncaixe(encaixe.id, 'decline')}
                        disabled={processandoEncaixe !== null}
                      />
                    </View>
                    <View style={styles.acaoFlex}>
                      <Botao
                        rotulo="Aceitar proposta"
                        onPress={() => responderEncaixe(encaixe.id, 'accept')}
                        disabled={processandoEncaixe !== null}
                      />
                    </View>
                  </View>

                  <Text style={[styles.rotulo, { color: cores.textoSuave }]}>
                    Ou contrapropõe outro valor
                  </Text>
                  <View style={styles.linhaContra}>
                    <View style={styles.campoContra}>
                      <Campo
                        rotulo="Valor (R$)"
                        valor={contras[encaixe.id] ?? ''}
                        onChange={texto =>
                          setContras(anterior => ({ ...anterior, [encaixe.id]: texto }))
                        }
                        placeholder="Ex.: 30,00"
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={styles.botaoContra}>
                      <Botao
                        rotulo="Contrapropor"
                        tipo="secundario"
                        onPress={() => void enviarContraproposta(encaixe.id)}
                        disabled={processandoEncaixe !== null}
                      />
                    </View>
                  </View>
                </View>
              )
            ) : null}
          </View>
        ))
      )}
        </>
      ) : null}

      {erro ? <Text style={[styles.erro, { color: cores.perigo }]}>{erro}</Text> : null}

      <Botao rotulo="Atualizar" tipo="secundario" onPress={recarregar} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// Rótulos do estado do encaixe, já considerando a negociação em aberto.
function rotuloEncaixe(encaixe: EncaixeMotoboyApi): string {
  switch (encaixe.status) {
    case 'pendente':
      return encaixe.valorContraproposta !== null
        ? 'Aguardando cliente'
        : 'Aguardando você'
    case 'aceito':
      return 'Aceito'
    case 'recusado':
      return 'Recusado'
    case 'cancelado':
      return 'Cancelado'
    default:
      return encaixe.status
  }
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
  rotulo: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  rotuloLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linhaAceita: {
    gap: 8,
  },
  opcoesAceita: {
    flexDirection: 'row',
    gap: 8,
  },
  botaoAceita: {
    minWidth: 90,
  },
  acoesForm: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  acoesRota: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  acaoFlex: {
    flex: 1,
  },
  linhaValores: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  valorAcordado: {
    fontSize: 16,
    fontWeight: '700',
  },
  caixaContra: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  negociacao: {
    gap: 8,
    marginTop: 4,
  },
  linhaContra: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  campoContra: {
    flex: 1,
  },
  botaoContra: {
    marginBottom: 6,
  },
  aviso: {
    fontSize: 14,
  },
  erro: {
    fontSize: 14,
  },
})
