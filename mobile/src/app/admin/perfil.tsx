import { router } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import Botao from '@/components/botao'
import { useSessao } from '@/sessao'
import { useTema } from '@/theme'

export default function PerfilAdmin() {
  const { cores } = useTema()
  const { usuario, sair } = useSessao()

  async function aoSair() {
    await sair()
    router.replace('/')
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: cores.fundo }}
      contentContainerStyle={styles.conteudo}
    >
      <View style={[styles.linha, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
        <Text style={[styles.rotulo, { color: cores.textoSuave }]}>Nome</Text>
        <Text style={[styles.valor, { color: cores.texto }]} numberOfLines={2}>
          {usuario?.nome ?? '—'}
        </Text>
      </View>
      <View style={[styles.linha, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
        <Text style={[styles.rotulo, { color: cores.textoSuave }]}>Perfil</Text>
        <Text style={[styles.valor, { color: cores.texto }]}>Administrador</Text>
      </View>
      <View style={[styles.linha, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
        <Text style={[styles.rotulo, { color: cores.textoSuave }]}>Sessão</Text>
        <Text style={[styles.valor, { color: cores.texto }]}>
          {usuario ? 'Ativa (validada pelo servidor)' : '—'}
        </Text>
      </View>

      <Botao rotulo="Sair da sessão" tipo="secundario" onPress={aoSair} />

      <Text style={[styles.dica, { color: cores.textoSuave }]}>
        O painel usa a API administrativa real. O servidor valida o seu perfil a cada operação; o
        aplicativo não guarda o código de acesso.
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  conteudo: {
    padding: 16,
    gap: 8,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  linha: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  rotulo: {
    fontSize: 14,
  },
  valor: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },
  dica: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
})
