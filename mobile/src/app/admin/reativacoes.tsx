import { router } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import {
  aprovarReativacaoAdmin,
  listarReativacoesAdmin,
  mensagemDeErro,
  recusarReativacaoAdmin,
  type SolicitacaoReativacaoApi,
} from '@/api/cliente'
import Botao from '@/components/botao'
import Campo from '@/components/campo'
import { useSessao } from '@/sessao'
import { useTema } from '@/theme'

const ROTULO_PAPEL: Record<string, string> = {
  admin: 'Administrador',
  motoboy: 'Motoboy',
  lojista: 'Lojista',
  pessoa_fisica: 'Pessoa física',
}

export default function AdminReativacoes() {
  const { cores } = useTema()
  const { token } = useSessao()

  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoReativacaoApi[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [acaoId, setAcaoId] = useState<string | null>(null)
  const [motivoId, setMotivoId] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')

  const carregar = useCallback(async () => {
    if (!token) return
    setErro('')
    try {
      setSolicitacoes(await listarReativacoesAdmin(token))
    } catch (falha) {
      setErro(mensagemDeErro(falha))
    } finally {
      setCarregando(false)
    }
  }, [token])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function aoAprovar(s: SolicitacaoReativacaoApi) {
    if (!token || acaoId) return
    setErro('')
    setAviso('')
    setAcaoId(s.id)
    try {
      await aprovarReativacaoAdmin(token, s.id)
      setAviso(`Conta de ${s.nome ?? 'usuário'} reativada.`)
      await carregar()
    } catch (falha) {
      setErro(mensagemDeErro(falha))
    } finally {
      setAcaoId(null)
    }
  }

  async function aoRecusar(s: SolicitacaoReativacaoApi) {
    if (!token || acaoId) return
    setErro('')
    setAviso('')
    setAcaoId(s.id)
    try {
      await recusarReativacaoAdmin(token, s.id, motivo.trim() || undefined)
      setAviso(`Solicitação de ${s.nome ?? 'usuário'} recusada. A conta continua desativada.`)
      setMotivoId(null)
      setMotivo('')
      await carregar()
    } catch (falha) {
      setErro(mensagemDeErro(falha))
    } finally {
      setAcaoId(null)
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: cores.fundo }}
      contentContainerStyle={styles.conteudo}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.intro, { color: cores.textoSuave }]}>
        Solicitações de reativação de contas desativadas. Aprovar ativa a conta na hora; recusar
        mantém a conta desativada.
      </Text>

      {erro ? <Text style={[styles.mensagem, { color: cores.perigo }]}>{erro}</Text> : null}
      {aviso ? <Text style={[styles.mensagem, { color: cores.textoSuave }]}>{aviso}</Text> : null}

      <View style={[styles.bloco, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
        <Text style={[styles.blocoTitulo, { color: cores.texto }]}>
          Pendentes {solicitacoes.length > 0 ? `(${solicitacoes.length})` : ''}
        </Text>

        {carregando ? (
          <Text style={[styles.vazioTexto, { color: cores.textoSuave }]}>Carregando…</Text>
        ) : solicitacoes.length === 0 ? (
          <Text style={[styles.vazioTexto, { color: cores.textoSuave }]}>
            Nenhuma solicitação pendente.
          </Text>
        ) : (
          solicitacoes.map(s => (
            <View key={s.id} style={[styles.item, { borderColor: cores.borda }]}>
              <Text style={[styles.itemNome, { color: cores.texto }]} numberOfLines={2}>
                {s.nome ?? '(sem nome)'}
              </Text>
              <Text style={[styles.itemDetalhe, { color: cores.textoSuave }]}>
                {ROTULO_PAPEL[s.papel] ?? s.papel} · pediu em{' '}
                {new Date(s.criadoEm).toLocaleDateString('pt-BR')}
              </Text>

              <View style={styles.acoes}>
                <Botao
                  rotulo={acaoId === s.id ? '…' : 'Aprovar e ativar'}
                  onPress={() => aoAprovar(s)}
                  disabled={acaoId !== null}
                />
                <Botao
                  rotulo="Recusar"
                  tipo="perigo"
                  onPress={() => {
                    setMotivoId(motivoId === s.id ? null : s.id)
                    setMotivo('')
                  }}
                  disabled={acaoId !== null}
                />
              </View>

              {motivoId === s.id ? (
                <View style={styles.blocoMotivo}>
                  <Campo
                    rotulo="Motivo (opcional)"
                    valor={motivo}
                    onChange={setMotivo}
                    placeholder="Ex.: documentação pendente"
                  />
                  <Botao
                    rotulo="Confirmar recusa"
                    tipo="perigo"
                    onPress={() => aoRecusar(s)}
                    disabled={acaoId !== null}
                  />
                </View>
              ) : null}
            </View>
          ))
        )}
      </View>
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
  intro: {
    fontSize: 12,
    lineHeight: 18,
  },
  mensagem: {
    fontSize: 14,
    lineHeight: 19,
  },
  bloco: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  blocoTitulo: {
    fontSize: 16,
    fontWeight: '700',
  },
  item: {
    borderTopWidth: 1,
    paddingVertical: 12,
    gap: 8,
  },
  itemNome: {
    fontSize: 14,
    fontWeight: '700',
  },
  itemDetalhe: {
    fontSize: 12,
  },
  acoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  blocoMotivo: {
    gap: 8,
  },
  vazioTexto: {
    fontSize: 14,
    paddingVertical: 8,
  },
})
