import { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import {
  buscarManutencaoAdmin,
  definirManutencaoAdmin,
  mensagemDeErro,
} from '@/api/cliente'
import Botao from '@/components/botao'
import Cartao from '@/components/cartao'
import Chip from '@/components/chip'
import { confirmar } from '@/components/confirmar'
import { useSessao } from '@/sessao'
import { useTema } from '@/theme'

export default function AdminConfiguracoes() {
  const { cores } = useTema()
  const { token } = useSessao()
  const [ativa, setAtiva] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    if (!token) return
    setErro('')
    try {
      const resposta = await buscarManutencaoAdmin(token)
      setAtiva(resposta.ativa)
      setMensagem(resposta.mensagem)
    } catch (falha) {
      setErro(mensagemDeErro(falha))
    } finally {
      setCarregando(false)
    }
  }, [token])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function aoAlternar() {
    if (!token || salvando) return
    const ligando = !ativa
    const ok = await confirmar(
      ligando ? 'Ligar manutenção' : 'Desligar manutenção',
      ligando
        ? 'Enquanto a manutenção estiver ligada, quem não for administrador recebe a mensagem "Estamos em manutenção. Tente novamente mais tarde." ao tentar entrar.'
        : 'O sistema volta a aceitar o login de motoboys, lojistas e pessoas físicas.',
      { rotuloConfirmar: ligando ? 'Ligar' : 'Desligar', perigo: ligando },
    )
    if (!ok) return
    setErro('')
    setSalvando(true)
    try {
      const resposta = await definirManutencaoAdmin(token, ligando)
      setAtiva(resposta.ativa)
      setMensagem(resposta.mensagem)
    } catch (falha) {
      setErro(mensagemDeErro(falha))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: cores.fundo }}
      contentContainerStyle={styles.conteudo}
    >
      {erro ? <Text style={[styles.mensagem, { color: cores.perigo }]}>{erro}</Text> : null}

      <Cartao
        titulo="Modo de manutenção"
        subtitulo="Serve para uma pausa rápida do sistema, sem derrubar nada"
      >
        <View style={styles.linha}>
          <Text style={[styles.estado, { color: cores.texto }]}>Estado atual</Text>
          <Chip texto={ativa ? 'Manutenção ligada' : 'Sistema normal'} tom={ativa ? 'perigo' : 'sucesso'} />
        </View>

        {carregando ? (
          <Text style={{ color: cores.textoSuave, fontSize: 14 }}>Carregando…</Text>
        ) : (
          <Text style={[styles.explicacao, { color: cores.textoSuave }]}>
            Com a manutenção ligada, quem não for administrador vê esta mensagem ao entrar:{' '}
            <Text style={{ color: cores.texto, fontWeight: '700' }}>
              “{mensagem || 'Estamos em manutenção. Tente novamente mais tarde.'}”
            </Text>
          </Text>
        )}

        <Botao
          rotulo={
            salvando
              ? 'Salvando…'
              : ativa
                ? 'Desligar manutenção'
                : 'Ligar manutenção'
          }
          tipo={ativa ? 'secundario' : 'primario'}
          onPress={aoAlternar}
          disabled={carregando || salvando}
        />

        <Text style={[styles.nota, { color: cores.textoSuave }]}>
          O administrador continua entrando normalmente. Esta configuração não entra no histórico de
          auditoria.
        </Text>
      </Cartao>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  conteudo: {
    padding: 16,
    gap: 12,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  estado: {
    fontSize: 14,
    fontWeight: '700',
  },
  explicacao: {
    fontSize: 13,
    lineHeight: 19,
  },
  nota: {
    fontSize: 12,
    lineHeight: 17,
  },
  mensagem: {
    fontSize: 14,
    lineHeight: 19,
  },
})
