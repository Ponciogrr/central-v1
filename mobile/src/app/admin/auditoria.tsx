import { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { listarAuditoriaAdmin, mensagemDeErro, type AcaoAuditoriaApi } from '@/api/cliente'
import Cartao from '@/components/cartao'
import { formatarDataHora } from '@/formato'
import { useSessao } from '@/sessao'
import { useTema } from '@/theme'

const ROTULO_ACAO: Record<string, string> = {
  usuario_criado: 'Usuário criado',
  usuario_ativado: 'Usuário ativado',
  usuario_desativado: 'Usuário desativado',
  codigo_substituido: 'Código de acesso trocado',
  reativacao_aprovada: 'Reativação aprovada',
  reativacao_recusada: 'Reativação recusada',
  tentativa_liberada: 'Acesso bloqueado liberado',
}

function rotuloAcao(acao: string): string {
  return ROTULO_ACAO[acao] ?? acao
}

export default function AdminAuditoria() {
  const { cores } = useTema()
  const { token } = useSessao()
  const [acoes, setAcoes] = useState<AcaoAuditoriaApi[]>([])
  const [total, setTotal] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    if (!token) return
    setErro('')
    try {
      const resposta = await listarAuditoriaAdmin(token, { limite: 50 })
      setAcoes(resposta.acoes)
      setTotal(resposta.total)
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

      <Cartao
        titulo="Histórico das ações"
        subtitulo={`Mais recente primeiro · ${total} registro(s)`}
      >
        {carregando ? (
          <Text style={{ color: cores.textoSuave, fontSize: 14 }}>Carregando…</Text>
        ) : acoes.length === 0 ? (
          <Text style={{ color: cores.textoSuave, fontSize: 14 }}>
            Nenhuma ação administrativa registrada ainda.
          </Text>
        ) : (
          <View style={styles.lista}>
            {acoes.map(acao => (
              <View key={acao.id} style={[styles.item, { borderColor: cores.borda }]}>
                <Text style={[styles.acao, { color: cores.texto }]}>{rotuloAcao(acao.acao)}</Text>
                <Text style={[styles.detalhe, { color: cores.textoSuave }]}>
                  Por {acao.atorNome ?? 'administrador'} · {formatarDataHora(acao.criadoEm)}
                </Text>
                {acao.entidade ? (
                  <Text style={[styles.detalhe, { color: cores.textoSuave }]}>
                    Registro: {acao.entidade}
                  </Text>
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
    gap: 2,
  },
  acao: {
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
