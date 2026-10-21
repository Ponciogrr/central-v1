import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { mensagemDeErro, type EntregaApi, type StatusEntrega } from '@/api/cliente'
import Botao from '@/components/botao'
import Campo from '@/components/campo'
import { useTema } from '@/theme'

const ROTULO: Record<StatusEntrega, string> = {
  aguardando: 'Aguardando motoboy',
  aceita: 'Aceita',
  em_rota: 'Em rota',
  entregue: 'Entregue',
  cancelada: 'Cancelada',
}

function formatarValor(valor: number | null): string {
  if (valor === null) return 'Valor não informado'
  return `R$ ${valor.toFixed(2).replace('.', ',')}`
}

interface Props {
  entrega: EntregaApi
  onIniciar: (id: string) => Promise<unknown>
  onFinalizar: (id: string) => Promise<unknown>
  onCancelar: (id: string, motivo: string) => Promise<unknown>
}

// Entrega ativa do motoboy (aceita ou em rota). "Finalizar" e "Cancelar"
// (regra 4, motivo obrigatório) exigem confirmação explícita; o estado só
// muda depois que a API confirma o sucesso.
export default function CartaoAtiva({ entrega, onIniciar, onFinalizar, onCancelar }: Props) {
  const { cores } = useTema()
  const [confirmandoFinal, setConfirmandoFinal] = useState(false)
  const [confirmandoCancel, setConfirmandoCancel] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [processando, setProcessando] = useState<'iniciar' | 'finalizar' | 'cancelar' | null>(null)
  const [erro, setErro] = useState('')

  async function iniciar() {
    setProcessando('iniciar')
    setErro('')
    try {
      await onIniciar(entrega.id)
    } catch (falha) {
      setErro(mensagemDeErro(falha))
    } finally {
      setProcessando(null)
    }
  }

  async function finalizar() {
    setProcessando('finalizar')
    setErro('')
    try {
      await onFinalizar(entrega.id)
    } catch (falha) {
      setErro(mensagemDeErro(falha))
      setProcessando(null)
    }
  }

  async function cancelar() {
    const motivoLimpo = motivo.trim()
    if (!motivoLimpo) {
      setErro('Informe o motivo do cancelamento.')
      return
    }
    setProcessando('cancelar')
    setErro('')
    try {
      await onCancelar(entrega.id, motivoLimpo)
      setConfirmandoCancel(false)
      setMotivo('')
    } catch (falha) {
      setErro(mensagemDeErro(falha))
    } finally {
      setProcessando(null)
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
      <View style={styles.linha}>
        <View style={[styles.etiqueta, { borderColor: cores.destaque }]}>
          <Text style={[styles.etiquetaTexto, { color: cores.destaque }]}>
            {ROTULO[entrega.status] ?? entrega.status}
          </Text>
        </View>
        <Text style={[styles.blocoTitulo, { color: cores.texto }]}>
          {formatarValor(entrega.valor)}
        </Text>
      </View>

      <View style={styles.endereco}>
        <Text style={[styles.rotulo, { color: cores.textoSuave }]}>Coleta</Text>
        <Text style={[styles.texto, { color: cores.texto }]}>{entrega.coleta}</Text>
      </View>
      <View style={styles.endereco}>
        <Text style={[styles.rotulo, { color: cores.textoSuave }]}>Entrega</Text>
        <Text style={[styles.texto, { color: cores.texto }]}>{entrega.destino}</Text>
      </View>

      {entrega.observacoes ? (
        <Text style={[styles.texto, { color: cores.textoSuave }]}>Obs.: {entrega.observacoes}</Text>
      ) : null}

      {erro ? <Text style={[styles.erro, { color: cores.perigo }]}>{erro}</Text> : null}

      {entrega.status === 'aceita' && !confirmandoCancel ? (
        <Botao
          rotulo={processando === 'iniciar' ? 'Iniciando…' : 'Iniciar entrega'}
          onPress={iniciar}
          disabled={processando !== null}
        />
      ) : null}

      {entrega.status === 'em_rota' && !confirmandoFinal && !confirmandoCancel ? (
        <Botao
          rotulo="Finalizar entrega"
          onPress={() => {
            setErro('')
            setConfirmandoFinal(true)
          }}
          disabled={processando !== null}
        />
      ) : null}

      {entrega.status === 'em_rota' && confirmandoFinal ? (
        <View style={styles.confirmacao}>
          <Text style={[styles.texto, { color: cores.texto }]}>
            Confirmar que a entrega foi concluída? Esta ação não pode ser desfeita.
          </Text>
          <Botao
            rotulo={processando === 'finalizar' ? 'Finalizando…' : 'Confirmar conclusão'}
            onPress={finalizar}
            disabled={processando !== null}
          />
          <Botao
            rotulo="Voltar"
            tipo="secundario"
            onPress={() => setConfirmandoFinal(false)}
            disabled={processando !== null}
          />
        </View>
      ) : null}

      {(entrega.status === 'aceita' || entrega.status === 'em_rota') && !confirmandoCancel ? (
        <Botao
          rotulo="Cancelar entrega"
          tipo="perigo"
          onPress={() => {
            setErro('')
            setConfirmandoCancel(true)
          }}
          disabled={processando !== null}
        />
      ) : null}

      {(entrega.status === 'aceita' || entrega.status === 'em_rota') && confirmandoCancel ? (
        <View style={styles.confirmacao}>
          <Text style={[styles.texto, { color: cores.texto }]}>
            Cancelar esta entrega? O motivo é obrigatório. O solicitante será avisado e a
            entrega será oferecida a outro motoboy; você não receberá esta entrega de novo.
          </Text>
          <Campo
            rotulo="Motivo do cancelamento"
            valor={motivo}
            onChange={t => {
              setMotivo(t)
              if (erro) setErro('')
            }}
            placeholder="Ex.: problema com a moto"
          />
          <Botao
            rotulo={processando === 'cancelar' ? 'Cancelando…' : 'Confirmar cancelamento'}
            tipo="perigo"
            onPress={cancelar}
            disabled={processando !== null}
          />
          <Botao
            rotulo="Voltar"
            tipo="secundario"
            onPress={() => {
              setConfirmandoCancel(false)
              setMotivo('')
              setErro('')
            }}
            disabled={processando !== null}
          />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  blocoTitulo: {
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 0,
    textAlign: 'right',
  },
  etiqueta: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    flexShrink: 1,
    minWidth: 0,
  },
  etiquetaTexto: {
    fontSize: 12,
    fontWeight: '700',
  },
  endereco: {
    gap: 4,
  },
  rotulo: {
    fontSize: 12,
  },
  texto: {
    fontSize: 14,
    lineHeight: 20,
  },
  erro: {
    fontSize: 12,
  },
  confirmacao: {
    gap: 8,
    marginTop: 4,
  },
})
