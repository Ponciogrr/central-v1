import { ScrollView, StyleSheet } from 'react-native'
import PainelEntregas from '@/components/painel-entregas'
import { useTema } from '@/theme'

export default function HistoricoLojista() {
  const { cores } = useTema()
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: cores.fundo }}
      contentContainerStyle={styles.conteudo}
    >
      <PainelEntregas situacao="finalizadas" />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  conteudo: {
    padding: 24,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
})
