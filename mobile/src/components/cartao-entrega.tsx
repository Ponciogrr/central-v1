import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { mensagemDeErro, type EntregaApi, type StatusEntrega } from '@/api/cliente'
import Botao from '@/components/botao'
import Campo from '@/components/campo'
import { NUMEROS, useTema } from '@/theme'

const ROTULO: Record<StatusEntrega, string> = {
  aguardando: 'Aguardando motoboy',
  aceita: 'Aceita',
  em_rota: 'Em rota',
  entregue: 'Entregue',
  cancelada: 'Cancelada',
}

// Cancelar depois da aceitação exige motivo (regras 5 e 6).
const EXIGE_MOTIVO: StatusEntrega[] = ['aceita', 'em_rota']

function formatarValor(valor: number | null): string {
  if (valor === null) return 'Valor não informado'
  return `R$ ${valor.toFixed(2).replace('.', ',')}`
}

function formatarData(iso: string | null): string | null {
  if (!iso) return null
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return null
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface Props {
  entrega: EntregaApi
  onCancelar: (id: string, motivo?: string) => Promise<unknown>
}

export default function CartaoEntrega({ entrega, onCancelar }: Props) {
  const { cores } = useTema()
  const [confirmando, setConfirmando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState('')

  const exigeMotivo = EXIGE_MOTIVO.includes(entrega.status)
  const podeCancelar = entrega.status !== 'entregue' && entrega.status !== 'cancelada'
  const criadaEm = formatarData(entrega.criadoEm)

  async function confirmarCancelamento() {
    if (exigeMotivo && !motivo.trim()) {
      setErro('Informe o motivo do cancelamento.')
      return
    }
    setProcessando(true)
    setErro('')
    try {
      await onCancelar(entrega.id, exigeMotivo ? motivo.trim() : undefined)
      setConfirmando(false)
      setMotivo('')
    } catch (falha) {
      setErro(mensagemDeErro(falha))
    } finally {
      setProcessando(false)
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
      <View style={styles.linhaTopo}>
        <View style={[styles.etiqueta, { borderColor: cores.destaque }]}>
          <Text style={[styles.etiquetaTexto, { color: cores.destaque }]}>{ROTULO[entrega.status]}</Text>
        </View>
        <Text style={[styles.valor, { color: cores.texto }]}>{formatarValor(entrega.valor)}</Text>
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

      {criadaEm ? (
        <Text style={[styles.data, { color: cores.textoSuave }]}>Solicitada em {criadaEm}</Text>
      ) : null}

      {entrega.status === 'cancelada' && entrega.motivoCancelamento ? (
        <Text style={[styles.texto, { color: cores.perigo }]}>
          Motivo do cancelamento: {entrega.motivoCancelamento}
        </Text>
      ) : null}

      {entrega.status === 'aguardando' && entrega.aguardandoSubstituto ? (
        <View style={[styles.substituto, { borderColor: cores.borda }]}>
          <Text style={[styles.texto, { color: cores.texto }]}>
            Buscando substituto: o motoboy anterior cancelou esta entrega.
          </Text>
          {entrega.motivoCancelamentoSubstituto ? (
            <Text style={[styles.texto, { color: cores.textoSuave }]}>
              Motivo: {entrega.motivoCancelamentoSubstituto}
            </Text>
          ) : null}
        </View>
      ) : null}

      {erro ? <Text style={[styles.erro, { color: cores.perigo }]}>{erro}</Text> : null}

      {podeCancelar && !confirmando ? (
        <Botao rotulo="Cancelar entrega" tipo="secundario" onPress={() => setConfirmando(true)} />
      ) : null}

      {podeCancelar && confirmando ? (
        <View style={styles.confirmacao}>
          <Text style={[styles.texto, { color: cores.texto }]}>
            {exigeMotivo
              ? 'A entrega já foi aceita. Confirme o cancelamento e informe o motivo — o motoboy será avisado.'
              : 'Confirmar o cancelamento desta solicitação? Ainda não há motoboy aceito, então não é preciso motivo.'}
          </Text>

          {exigeMotivo ? (
            <Campo
              rotulo="Motivo do cancelamento"
              valor={motivo}
              onChange={t => {
                setMotivo(t)
                if (erro) setErro('')
              }}
              placeholder="Ex.: pedido cancelado pelo cliente"
            />
          ) : null}

          <Botao
            rotulo={processando ? 'Cancelando…' : 'Confirmar cancelamento'}
            tipo="perigo"
            onPress={confirmarCancelamento}
            disabled={processando}
          />
          <Botao
            rotulo="Voltar"
            tipo="secundario"
            onPress={() => {
              setConfirmando(false)
              setMotivo('')
              setErro('')
            }}
            disabled={processando}
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
  linhaTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
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
  valor: {
    ...NUMEROS,
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 0,
    textAlign: 'right',
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
  data: {
    fontSize: 12,
  },
  erro: {
    fontSize: 12,
  },
  confirmacao: {
    gap: 8,
    marginTop: 4,
  },
  substituto: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
})
