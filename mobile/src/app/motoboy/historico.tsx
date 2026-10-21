import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import Botao from '@/components/botao'
import CartaoEntrega from '@/components/cartao-entrega'
import DespesasMotoboy from '@/components/despesas-motoboy'
import ResumoFinanceiro from '@/components/resumo-financeiro'
import Vazio from '@/components/vazio'
import { useContabilidadeMotoboy } from '@/contabilidade'
import { useHistoricoMotoboy } from '@/motoboy'
import { useTema } from '@/theme'

// Histórico real do motoboy: as entregas que ele concluiu ou que foram
// canceladas. O servidor filtra por courier_id (identidade do token), então
// nunca aparecem entregas de outros motoboys. Aqui não há cancelamento (a ação
// é do solicitante), apenas a leitura do resultado.
//
// No topo, a contabilidade do período (padrão: últimos 7 dias): resumo dos
// valores das entregas CONCLUÍDAS + despesas pessoais opcionais. Os cálculos
// vêm sempre do servidor (fonte de verdade).
export default function HistoricoMotoboy() {
  const { cores } = useTema()
  const { entregas, carregando, erro, carregar } = useHistoricoMotoboy()
  const contab = useContabilidadeMotoboy()

  const finalizadas = entregas.filter(e => e.status === 'entregue' || e.status === 'cancelada')

  const [anoInicio, mesInicio, diaInicio] = contab.periodo.inicio.split('-').map(Number)
  const [anoFim, mesFim, diaFim] = contab.periodo.fim.split('-').map(Number)
  const diasPeriodo =
    Math.round(
      (Date.UTC(anoFim, mesFim - 1, diaFim) - Date.UTC(anoInicio, mesInicio - 1, diaInicio)) /
        86_400_000,
    ) + 1

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: cores.fundo }}
      contentContainerStyle={styles.conteudo}
      keyboardShouldPersistTaps="handled"
    >
      {contab.carregando ? (
        <View style={styles.centro}>
          <ActivityIndicator color={cores.acao} />
        </View>
      ) : contab.erro ? (
        <View style={styles.lista}>
          <Vazio titulo="Não foi possível carregar o resumo" dica={contab.erro} />
          <Botao rotulo="Tentar novamente" tipo="secundario" onPress={contab.recarregar} />
        </View>
      ) : contab.resumo ? (
        <View style={styles.lista}>
          <ResumoFinanceiro resumo={contab.resumo} diasPeriodo={diasPeriodo} />
          <DespesasMotoboy
            despesas={contab.despesas}
            adicionar={contab.adicionar}
            editar={contab.editar}
            remover={contab.remover}
          />
        </View>
      ) : null}

      <Text style={[styles.secao, { color: cores.texto }]}>Entregas</Text>

      {carregando ? (
        <View style={styles.centro}>
          <ActivityIndicator color={cores.acao} />
          <Text style={[styles.texto, { color: cores.textoSuave }]}>Carregando histórico…</Text>
        </View>
      ) : erro ? (
        <View style={styles.lista}>
          <Vazio titulo="Não foi possível carregar" dica={erro} />
          <Botao rotulo="Tentar novamente" tipo="secundario" onPress={carregar} />
        </View>
      ) : finalizadas.length === 0 ? (
        <Vazio
          titulo="Nenhuma entrega concluída."
          dica="As entregas finalizadas ou canceladas aparecerão aqui com data e status."
        />
      ) : (
        <View style={styles.lista}>
          {finalizadas.map(entrega => (
            <CartaoEntrega
              key={entrega.id}
              entrega={entrega}
              onCancelar={async () => {
                throw new Error('Esta ação é do solicitante.')
              }}
            />
          ))}
        </View>
      )}
    </ScrollView>
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
  secao: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  lista: {
    gap: 12,
  },
  centro: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  texto: {
    fontSize: 14,
  },
})
