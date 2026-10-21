import { router } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { criarEntrega, mensagemDeErro } from '@/api/cliente'
import Botao from '@/components/botao'
import Campo from '@/components/campo'
import Vazio from '@/components/vazio'
import { useSessao } from '@/sessao'
import { useTema } from '@/theme'
import { lerValor } from '@/valor'

// Formulário compartilhado por lojista e pessoa física. O endereço textual é
// obrigatório; o deslocamento usa apenas o endereço informado (sem mapa).
export default function FormularioSolicitar() {
  const { cores } = useTema()
  const { usuario, token } = useSessao()
  const [coleta, setColeta] = useState('')
  const [destino, setDestino] = useState('')
  const [valor, setValor] = useState('')
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [processando, setProcessando] = useState(false)

  async function publicar() {
    if (processando) return
    setErro('')
    setSucesso('')

    if (!coleta.trim()) return setErro('Informe o endereço de coleta.')
    if (!destino.trim()) return setErro('Informe o endereço de entrega.')

    const numero = lerValor(valor)
    if (numero === 'invalido') {
      return setErro('Valor inválido. Use um número, por exemplo 12,50.')
    }
    if (!token) {
      return setErro('Sessão não iniciada. Entre com o seu código de acesso.')
    }

    setProcessando(true)
    try {
      // A identidade do solicitante é decidida pelo servidor a partir do token.
      await criarEntrega(token, {
        coleta: coleta.trim(),
        destino: destino.trim(),
        valor: numero,
        observacoes: obs.trim() || null,
      })
      setColeta('')
      setDestino('')
      setValor('')
      setObs('')
      setSucesso('Solicitação registrada no servidor com sucesso.')
    } catch (falha) {
      setErro(mensagemDeErro(falha))
    } finally {
      setProcessando(false)
    }
  }

  if (!usuario) {
    return (
      <View style={{ flex: 1, backgroundColor: cores.fundo }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.conteudo}
          keyboardShouldPersistTaps="handled"
        >
          <Vazio
            titulo="Sessão de demonstração"
            dica="Entre com o seu código de acesso para solicitar uma entrega de verdade."
            icone="log-in-outline"
            acao={{ rotulo: 'Entrar com código', onPress: () => router.push('/login') }}
          />
        </ScrollView>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: cores.fundo }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.conteudo}
        keyboardShouldPersistTaps="handled"
      >
      <Text style={[styles.intro, { color: cores.textoSuave }]}>
        Informe coleta, entrega, valor e observações. A solicitação é gravada no servidor.
      </Text>

      <Campo
        rotulo="Endereço de coleta"
        valor={coleta}
        onChange={t => {
          setColeta(t)
          if (erro) setErro('')
        }}
        placeholder="Onde buscar"
      />

      <Campo
        rotulo="Endereço de entrega"
        valor={destino}
        onChange={t => {
          setDestino(t)
          if (erro) setErro('')
        }}
        placeholder="Para onde vai"
      />

      <Campo rotulo="Valor combinado" valor={valor} onChange={setValor} placeholder="R$ ..." />
      <Campo
        rotulo="Observações (opcional)"
        valor={obs}
        onChange={setObs}
        placeholder="Ex.: entregar na portaria"
      />

      {erro ? <Text style={[styles.erro, { color: cores.perigo }]}>{erro}</Text> : null}

      <Botao
        rotulo={processando ? 'Enviando…' : 'Publicar solicitação'}
        onPress={publicar}
        disabled={processando}
      />

      {sucesso ? (
        <View style={[styles.aviso, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
          <Text style={[styles.avisoTexto, { color: cores.texto }]}>{sucesso}</Text>
          <Text style={[styles.avisoTexto, { color: cores.textoSuave }]}>
            Acompanhe em “Entregas em andamento”.
          </Text>
          <Botao
            rotulo="Ir para minhas entregas"
            tipo="secundario"
            onPress={() => router.back()}
          />
        </View>
      ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
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
  intro: {
    fontSize: 12,
    lineHeight: 18,
  },
  erro: {
    fontSize: 14,
  },
  aviso: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  avisoTexto: {
    fontSize: 12,
    lineHeight: 18,
  },
})
