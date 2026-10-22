import { Ionicons } from '@expo/vector-icons'
import { Stack, router, type Href } from 'expo-router'
import { useEffect } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Botao from '@/components/botao'
import OnzeOndas from '@/components/ondas'
import { MODO_DEMO } from '@/demo'
import { useSessao } from '@/sessao'
import { useTela } from '@/tela'
import { useTema } from '@/theme'

// O papel vem do servidor (sessão). Admin entra pelo painel /admin (web e app).
const AREA_POR_PAPEL: Record<string, Href> = {
  admin: '/admin',
  motoboy: '/motoboy',
  lojista: '/lojista',
  pessoa_fisica: '/pessoa',
}

export default function Entrada() {
  const { cores, esquema, alternar } = useTema()
  const { usuario } = useSessao()
  const tela = useTela()

  // Se já existe uma sessão válida (confirmada por GET /auth/me), vai direto à área.
  useEffect(() => {
    if (usuario) {
      const area = AREA_POR_PAPEL[usuario.papel]
      if (area) router.replace(area)
    }
  }, [usuario])

  const destinos = [
    { rota: '/motoboy', rotulo: 'Motoboy' },
    { rota: '/lojista', rotulo: 'Lojista' },
    { rota: '/pessoa', rotulo: 'Pessoa Física' },
  ] as const

  return (
    <View style={[styles.area, { backgroundColor: cores.fundo }]}>
      <OnzeOndas cor={cores.destaque} />
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.area}>
        <ScrollView
          contentContainerStyle={[
            styles.conteudo,
            {
              justifyContent: tela.baixa ? 'flex-start' : 'center',
              padding: tela.compacta ? 16 : 24,
            },
          ]}
        >
          <View style={styles.marca}>
            <View style={[styles.selo, { backgroundColor: cores.acao }]}>
              <Text style={[styles.seloTexto, { color: cores.acaoTexto }]}>CM</Text>
            </View>
            <Text style={[styles.titulo, { color: cores.texto }]}>Central de Motoboys</Text>
            <Text style={[styles.sub, { color: cores.textoSuave }]}>
              Entregas entre motoboys, lojistas e pessoas físicas.
            </Text>
          </View>

          <Botao rotulo="Entrar com código de acesso" onPress={() => router.push('/login')} />

          {MODO_DEMO ? (
            <View style={[styles.demo, { borderColor: cores.borda, backgroundColor: cores.superficie }]}>
              <Text style={[styles.demoTitulo, { color: cores.textoSuave }]}>
                Modo de demonstração (somente testes)
              </Text>
              {destinos.map(d => (
                <Pressable
                  key={d.rota}
                  onPress={() => router.push(d.rota)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.botaoPerfil,
                    {
                      backgroundColor: cores.superficie2,
                      borderColor: cores.borda,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.rotuloPerfil, { color: cores.texto }]}>{d.rotulo}</Text>
                  <Ionicons name="chevron-forward" size={20} color={cores.destaque} />
                </Pressable>
              ))}
            </View>
          ) : null}

          <Text style={[styles.rodape, { color: cores.textoSuave }]}>
            O acesso é por código criado pelo administrador da Central de Motoboys. Não existe
            cadastro público.
          </Text>

          <Pressable
            onPress={alternar}
            accessibilityRole="button"
            accessibilityLabel={`Tema ${esquema === 'claro' ? 'claro' : 'escuro'}. Alternar tema`}
            style={({ pressed }) => [styles.tema, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.temaTexto, { color: cores.textoSuave }]}>
              Tema: {esquema === 'claro' ? 'Claro' : 'Escuro'} — tocar para alternar
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  area: {
    flex: 1,
  },
  conteudo: {
    flexGrow: 1,
    padding: 24,
    gap: 24,
    justifyContent: 'center',
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  marca: {
    alignItems: 'center',
    gap: 8,
  },
  selo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seloTexto: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  titulo: {
    fontSize: 20,
    fontWeight: '700',
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  demo: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  demoTitulo: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  botaoPerfil: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 52,
  },
  rotuloPerfil: {
    fontSize: 14,
    fontWeight: '700',
  },
  tema: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: 8,
  },
  temaTexto: {
    fontSize: 12,
  },
  rodape: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
})
