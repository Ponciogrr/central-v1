// Cartão de uma Rota do Dia — usado pelo motoboy, pelo solicitante e pelo
// painel administrativo. Um único componente garante a mesma leitura em toda
// a interface (status, trajeto, data e valores).

import { StyleSheet, Text, View } from 'react-native'
import type { RotaDiaApi } from '@/api/cliente'
import { formatarDiaServico, formatarMoeda, rotuloStatusRotaDia } from '@/formato'
import { NUMEROS, useTema } from '@/theme'
import Chip from './chip'

interface Props {
  rota: RotaDiaApi
  // Mostra quem publicou a rota (solicitante/admin; o motoboy vê o contato).
  mostrarPublicador?: boolean
  // Ações específicas do estado (botões).
  acoes?: React.ReactNode
}

export default function CartaoRotaDia({ rota, mostrarPublicador = true, acoes }: Props) {
  const { cores } = useTema()
  const status = rotuloStatusRotaDia(rota.status)
  const valor = rota.valorCombinado ?? rota.valor

  return (
    <View style={[styles.caixa, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
      <View style={styles.topo}>
        <Text style={[styles.titulo, { color: cores.texto }]} numberOfLines={2}>
          {rota.titulo}
        </Text>
        <Chip texto={status.texto} tom={status.tom} />
      </View>

      <View style={styles.trajeto}>
        <Text style={[styles.trajetoTexto, { color: cores.texto }]} numberOfLines={2}>
          {rota.origem}
        </Text>
        <Text style={[styles.seta, { color: cores.destaque }]}>→</Text>
        <Text style={[styles.trajetoTexto, { color: cores.texto }]} numberOfLines={2}>
          {rota.destino}
        </Text>
      </View>

      <View style={styles.detalhes}>
        <Text style={[styles.detalhe, { color: cores.textoSuave }]}>
          {formatarDiaServico(rota.data)}
          {rota.saida ? ` · saída ${rota.saida}` : ''}
        </Text>
        {rota.paradas ? (
          <Text style={[styles.detalhe, { color: cores.textoSuave }]} numberOfLines={2}>
            Paradas: {rota.paradas}
          </Text>
        ) : null}
        {mostrarPublicador && rota.publicador ? (
          <Text style={[styles.detalhe, { color: cores.textoSuave }]} numberOfLines={1}>
            Solicitante: {rota.publicador}
          </Text>
        ) : null}
        {rota.telefonePublicador ? (
          <Text style={[styles.detalhe, { color: cores.textoSuave }]}>
            Telefone: {rota.telefonePublicador}
          </Text>
        ) : null}
      </View>

      <View style={styles.rodape}>
        <Text style={[styles.valor, NUMEROS, { color: cores.texto }]}>{formatarMoeda(valor)}</Text>
        {rota.contraproposta ? (
          <Text style={[styles.contraproposta, { color: cores.textoSuave }]}>
            Contraproposta: {formatarMoeda(rota.contraproposta)}
          </Text>
        ) : null}
      </View>

      {rota.status === 'cancelada' && rota.motivoCancelamento ? (
        <Text style={[styles.motivo, { color: cores.perigo }]}>
          Cancelada: {rota.motivoCancelamento}
        </Text>
      ) : null}

      {acoes ? <View style={styles.acoes}>{acoes}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  caixa: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  titulo: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  trajeto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trajetoTexto: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  seta: {
    fontSize: 16,
    fontWeight: '700',
  },
  detalhes: {
    gap: 2,
  },
  detalhe: {
    fontSize: 13,
    lineHeight: 18,
  },
  rodape: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
  },
  valor: {
    fontSize: 18,
    fontWeight: '700',
  },
  contraproposta: {
    fontSize: 12,
  },
  motivo: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  acoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
})
