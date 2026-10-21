import { router } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import Botao from '@/components/botao'
import { useSessao } from '@/sessao'
import { useTema } from '@/theme'

export default function PerfilMotoboy() {
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
        <Text style={[styles.valor, { color: cores.texto }]}>Motoboy</Text>
      </View>
      <View style={[styles.linha, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
        <Text style={[styles.rotulo, { color: cores.textoSuave }]}>Sessão</Text>
        <Text style={[styles.valor, { color: cores.texto }]}>
          {usuario ? 'Ativa' : 'Demonstração (sem login)'}
        </Text>
      </View>

      {usuario ? <Botao rotulo="Sair da sessão" tipo="secundario" onPress={aoSair} /> : null}

      <Text style={[styles.dica, { color: cores.textoSuave }]}>
        {usuario
          ? 'Sessão real: o nome e o perfil vêm do servidor. O código de acesso não fica guardado no aplicativo.'
          : 'Modo demonstração: entre com o seu código de acesso para ver os dados reais da sua conta.'}
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  conteudo: {
    padding: 24,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: 8,
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
