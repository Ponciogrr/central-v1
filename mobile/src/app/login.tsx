import { Stack, router, type Href } from 'expo-router'
import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ErroApi } from '@/api/cliente'
import Botao from '@/components/botao'
import Campo from '@/components/campo'
import OnzeOndas from '@/components/ondas'
import { useSessao } from '@/sessao'
import { useTela } from '@/tela'
import { useTema } from '@/theme'

const AREA_POR_PAPEL: Record<string, Href> = {
  admin: '/admin/usuarios',
  motoboy: '/motoboy',
  lojista: '/lojista',
  pessoa_fisica: '/pessoa',
}

export default function Login() {
  const { cores, esquema, alternar } = useTema()
  const { entrar } = useSessao()
  const tela = useTela()
  const [codigo, setCodigo] = useState('')
  const [visivel, setVisivel] = useState(false)
  const [erro, setErro] = useState('')
  const [processando, setProcessando] = useState(false)

  async function aoEntrar() {
    if (processando) return
    setErro('')
    const limpo = codigo.trim()
    if (!limpo) {
      setErro('Informe o código de acesso.')
      return
    }
    setProcessando(true)
    try {
      const resultado = await entrar(limpo)
      setCodigo('') // o código não é guardado no aplicativo
      const area = AREA_POR_PAPEL[resultado.usuario.papel]
      if (!area) {
        setErro('Perfil não reconhecido. Procure o administrador da Central de Motoboys.')
        return
      }
      router.replace(area)
    } catch (falha) {
      if (falha instanceof ErroApi) setErro(falha.message)
      else setErro('Não foi possível entrar. Tente novamente.')
    } finally {
      setProcessando(false)
    }
  }

  return (
    <View style={[styles.area, { backgroundColor: cores.fundo }]}>
      <OnzeOndas cor={cores.destaque} />
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.area}>
        <KeyboardAvoidingView
          style={styles.area}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={[
              styles.conteudo,
              {
                justifyContent: tela.baixa ? 'flex-start' : 'center',
                padding: tela.compacta ? 16 : 24,
              },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.marca}>
              <View style={[styles.selo, { backgroundColor: cores.acao }]}>
                <Text style={[styles.seloTexto, { color: cores.acaoTexto }]}>CM</Text>
              </View>
              <Text style={[styles.marcaNome, { color: cores.texto }]}>Central de Motoboys</Text>
            </View>

            <View
              style={[
                styles.cartao,
                { backgroundColor: cores.superficie, borderColor: cores.borda },
              ]}
            >
              <Text style={[styles.titulo, { color: cores.texto }]}>Entrar</Text>
              <Text style={[styles.sub, { color: cores.textoSuave }]}>
                Use o seu código de acesso. Não há cadastro público — quem cria o seu código é o
                administrador.
              </Text>

              <Campo
                rotulo="Código de acesso"
                valor={codigo}
                onChange={t => {
                  setCodigo(t)
                  if (erro) setErro('')
                }}
                placeholder="CMB-XXXX-XXXX-XXXX-XXXX"
                secure={!visivel}
                autoCapitalize="characters"
              />

              <Pressable
                onPress={() => setVisivel(v => !v)}
                accessibilityRole="button"
                style={styles.olho}
                hitSlop={8}
              >
                <Text style={[styles.olhoTexto, { color: cores.destaque }]}>
                  {visivel ? 'Ocultar código' : 'Mostrar código'}
                </Text>
              </Pressable>

              {erro ? <Text style={[styles.erro, { color: cores.perigo }]}>{erro}</Text> : null}

              <Botao
                rotulo={processando ? 'Entrando…' : 'Entrar'}
                onPress={aoEntrar}
                disabled={processando}
              />
            </View>

            <Text style={[styles.orientacaoTexto, { color: cores.textoSuave }]}>
              Perdeu o código? Procure o administrador da Central de Motoboys — ele pode verificar o
              seu código e gerar um novo.
            </Text>

            <Pressable
              onPress={alternar}
              accessibilityRole="button"
              accessibilityLabel={`Tema ${esquema === 'claro' ? 'claro' : 'escuro'}. Alternar tema`}
              style={styles.tema}
              hitSlop={8}
            >
              <Text style={[styles.temaTexto, { color: cores.textoSuave }]}>
                Tema: {esquema === 'claro' ? 'Claro' : 'Escuro'} — tocar para alternar
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
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
    gap: 16,
    justifyContent: 'center',
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  marca: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
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
  marcaNome: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  cartao: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    gap: 16,
  },
  titulo: {
    fontSize: 20,
    fontWeight: '700',
  },
  sub: {
    fontSize: 12,
    lineHeight: 19,
  },
  olho: {
    alignSelf: 'flex-start',
  },
  olhoTexto: {
    fontSize: 14,
    fontWeight: '700',
  },
  erro: {
    fontSize: 14,
  },
  orientacaoTexto: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
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
})
