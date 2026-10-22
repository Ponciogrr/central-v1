import { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import {
  buscarVisaoGeralAdmin,
  listarMotoboysOnlineAdmin,
  mensagemDeErro,
  type MotoboyOnlineApi,
} from '@/api/cliente'
import Cartao from '@/components/cartao'
import Chip from '@/components/chip'
import Metrica from '@/components/metrica'
import { formatarDataHora } from '@/formato'
import { useSessao } from '@/sessao'
import { useTema } from '@/theme'

export default function AdminOperacao() {
  const { cores } = useTema()
  const { token } = useSessao()
  const [motoboys, setMotoboys] = useState<MotoboyOnlineApi[]>([])
  const [ativas, setAtivas] = useState(0)
  const [aguardando, setAguardando] = useState(0)
  const [emRota, setEmRota] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    if (!token) return
    setErro('')
    try {
      const [lista, visao] = await Promise.all([
        listarMotoboysOnlineAdmin(token),
        buscarVisaoGeralAdmin(token),
      ])
      setMotoboys(lista)
      setAtivas(visao.contadores?.entregas?.ativas ?? 0)
      setAguardando(visao.contadores?.entregas?.aguardando ?? 0)
      setEmRota(visao.contadores?.rotasDoDia?.emAndamento ?? 0)
    } catch (falha) {
      setErro(mensagemDeErro(falha))
    } finally {
      setCarregando(false)
    }
  }, [token])

  useEffect(() => {
    void carregar()
  }, [carregar])

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: cores.fundo }}
      contentContainerStyle={styles.conteudo}
    >
      {erro ? <Text style={[styles.mensagem, { color: cores.perigo }]}>{erro}</Text> : null}

      <Cartao titulo="Agora">
        <View style={styles.grade}>
          <Metrica valor={motoboys.length} rotulo="Motoboys online" />
          <Metrica valor={aguardando} rotulo="Entregas aguardando" />
          <Metrica valor={ativas} rotulo="Entregas em andamento" />
          <Metrica valor={emRota} rotulo="Rotas do dia em curso" />
        </View>
      </Cartao>

      <Cartao
        titulo="Motoboys online"
        subtitulo="Quem está disponível para receber trabalho agora"
      >
        {carregando ? (
          <Text style={{ color: cores.textoSuave, fontSize: 14 }}>Carregando…</Text>
        ) : motoboys.length === 0 ? (
          <Text style={{ color: cores.textoSuave, fontSize: 14 }}>
            Nenhum motoboy online no momento.
          </Text>
        ) : (
          <View style={styles.lista}>
            {motoboys.map(motoboy => (
              <View key={motoboy.id} style={[styles.item, { borderColor: cores.borda }]}>
                <View style={styles.itemTopo}>
                  <Text style={[styles.nome, { color: cores.texto }]} numberOfLines={1}>
                    {motoboy.nome ?? '(sem nome)'}
                  </Text>
                  <Chip texto={motoboy.online ? 'Online' : 'Visto há pouco'} tom={motoboy.online ? 'sucesso' : 'neutro'} />
                </View>
                <Text style={[styles.detalhe, { color: cores.textoSuave }]}>
                  {motoboy.telefone ? `Tel. ${motoboy.telefone}` : 'Telefone não informado'}
                  {motoboy.codigo ? ` · código …${motoboy.codigo}` : ''}
                </Text>
                <Text style={[styles.detalhe, { color: cores.textoSuave }]}>
                  Último acesso: {formatarDataHora(motoboy.ultimoAcesso)}
                </Text>
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
  grade: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  lista: {
    gap: 4,
  },
  item: {
    borderTopWidth: 1,
    paddingVertical: 10,
    gap: 2,
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
