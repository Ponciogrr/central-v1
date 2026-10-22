import { router } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import Botao from '@/components/botao'
import PainelEntregas from '@/components/painel-entregas'
import { useMotoboysOnline } from '@/motoboy'
import { useTema } from '@/theme'

export default function InicioLojista() {
  const { cores } = useTema()
  const online = useMotoboysOnline()
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: cores.fundo }}
      contentContainerStyle={styles.conteudo}
    >
      <View style={[styles.indicador, { borderColor: cores.borda }]}>
        <Text style={[styles.indicadorTexto, { color: cores.textoSuave }]}>
          {online === null ? 'Motoboys online: —' : `Motoboys online: ${online}`}
        </Text>
      </View>

      <Botao rotulo="Solicitar entrega" onPress={() => router.push('/lojista/solicitar')} />
      <Botao
        rotulo="Rotas do dia"
        tipo="secundario"
        onPress={() => router.push('/lojista/rotas-do-dia')}
      />

      <Text style={[styles.secao, { color: cores.texto }]}>Entregas em andamento</Text>
      <PainelEntregas situacao="ativas" />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  conteudo: {
    padding: 24,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: 12,
  },
  indicador: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  indicadorTexto: {
    fontSize: 12,
  },
  secao: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
})
