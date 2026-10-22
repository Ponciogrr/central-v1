import { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import {
  liberarTentativaLoginAdmin,
  listarTentativasLoginAdmin,
  mensagemDeErro,
  type TentativaLoginApi,
} from '@/api/cliente'
import Botao from '@/components/botao'
import Cartao from '@/components/cartao'
import Chip from '@/components/chip'
import { confirmar } from '@/components/confirmar'
import { formatarDataHora } from '@/formato'
import { useSessao } from '@/sessao'
import { useTema } from '@/theme'

export default function AdminBloqueios() {
  const { cores } = useTema()
  const { token } = useSessao()
  const [tentativas, setTentativas] = useState<TentativaLoginApi[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!token) return
    setErro('')
    try {
      setTentativas(await listarTentativasLoginAdmin(token))
    } catch (falha) {
      setErro(mensagemDeErro(falha))
    } finally {
      setCarregando(false)
    }
  }, [token])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function aoLiberar(registro: TentativaLoginApi) {
    if (!token || ocupado) return
    const ok = await confirmar(
      'Liberar acesso',
      `Libera o acesso de ${registro.nomeUsuario ?? registro.origem}? A pessoa poderá tentar entrar de novo.`,
      { rotuloConfirmar: 'Liberar' },
    )
    if (!ok) return
    setErro('')
    setAviso('')
    setOcupado(registro.id)
    try {
      await liberarTentativaLoginAdmin(token, registro.id)
      setAviso('Acesso liberado.')
      await carregar()
    } catch (falha) {
      setErro(mensagemDeErro(falha))
    } finally {
      setOcupado(null)
    }
  }

  const bloqueados = tentativas.filter(t => t.bloqueado).length

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: cores.fundo }}
      contentContainerStyle={styles.conteudo}
    >
      {erro ? <Text style={[styles.mensagem, { color: cores.perigo }]}>{erro}</Text> : null}
      {aviso ? <Text style={[styles.mensagem, { color: cores.textoSuave }]}>{aviso}</Text> : null}

      <Cartao
        titulo="Tentativas de login"
        subtitulo={`Lista completa em ordem cronológica · ${bloqueados} acesso(s) bloqueado(s)`}
      >
        {carregando ? (
          <Text style={{ color: cores.textoSuave, fontSize: 14 }}>Carregando…</Text>
        ) : tentativas.length === 0 ? (
          <Text style={{ color: cores.textoSuave, fontSize: 14 }}>
            Nenhuma tentativa registrada.
          </Text>
        ) : (
          <View style={styles.lista}>
            {tentativas.map(registro => (
              <View key={registro.id} style={[styles.item, { borderColor: cores.borda }]}>
                <View style={styles.itemTopo}>
                  <Text style={[styles.nome, { color: cores.texto }]} numberOfLines={1}>
                    {registro.nomeUsuario ?? 'Origem não identificada'}
                  </Text>
                  <Chip
                    texto={registro.bloqueado ? 'Bloqueado' : 'Liberado'}
                    tom={registro.bloqueado ? 'perigo' : 'neutro'}
                  />
                </View>
                <Text style={[styles.detalhe, { color: cores.textoSuave }]}>
                  {registro.tentativas} tentativa(s) · origem {registro.origem}
                </Text>
                <Text style={[styles.detalhe, { color: cores.textoSuave }]}>
                  Primeiro registro: {formatarDataHora(registro.criadoEm)}
                </Text>
                {registro.liberadoEm ? (
                  <Text style={[styles.detalhe, { color: cores.textoSuave }]}>
                    Liberado em: {formatarDataHora(registro.liberadoEm)}
                  </Text>
                ) : null}
                {registro.bloqueado ? (
                  <Botao
                    rotulo={ocupado === registro.id ? 'Liberando…' : 'Liberar acesso'}
                    tipo="secundario"
                    onPress={() => aoLiberar(registro)}
                    disabled={ocupado !== null}
                  />
                ) : null}
              </View>
            ))}
          </View>
        )}
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
  lista: {
    gap: 4,
  },
  item: {
    borderTopWidth: 1,
    paddingVertical: 10,
    gap: 4,
  },
  itemTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  nome: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  detalhe: {
    fontSize: 12,
    lineHeight: 17,
  },
  mensagem: {
    fontSize: 14,
    lineHeight: 19,
  },
})
