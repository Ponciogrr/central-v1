import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { buscarVisaoGeralAdmin, mensagemDeErro, type VisaoGeralAdminApi } from '@/api/cliente'
import Cartao from '@/components/cartao'
import Metrica from '@/components/metrica'
import { useSessao } from '@/sessao'
import { useTema } from '@/theme'

interface ItemMenu {
  titulo: string
  descricao: string
  icone: keyof typeof Ionicons.glyphMap
  rota: string
  alerta?: boolean
}

export default function AdminVisaoGeral() {
  const { cores } = useTema()
  const { token } = useSessao()
  const [visao, setVisao] = useState<VisaoGeralAdminApi | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    if (!token) return
    setErro('')
    try {
      setVisao(await buscarVisaoGeralAdmin(token))
    } catch (falha) {
      setErro(mensagemDeErro(falha))
    } finally {
      setCarregando(false)
    }
  }, [token])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const contadores = visao?.contadores

  const menu: ItemMenu[] = [
    {
      titulo: 'Usuários',
      descricao: 'Criar contas, ativar ou desativar, trocar código de acesso',
      icone: 'people-outline',
      rota: '/admin/usuarios',
    },
    {
      titulo: 'Reativações',
      descricao: 'Pedidos de reativação de conta esperando decisão',
      icone: 'refresh-outline',
      rota: '/admin/reativacoes',
      alerta: (contadores?.reativacoesPendentes ?? 0) > 0,
    },
    {
      titulo: 'Rotas do dia',
      descricao: 'Acompanhar todas as rotas publicadas, contratadas e concluídas',
      icone: 'navigate-outline',
      rota: '/admin/rotas',
    },
    {
      titulo: 'Operação',
      descricao: 'Motoboys online agora e entregas em andamento',
      icone: 'pulse-outline',
      rota: '/admin/operacao',
    },
    {
      titulo: 'Acessos bloqueados',
      descricao: 'Tentativas de login com código errado',
      icone: 'lock-closed-outline',
      rota: '/admin/bloqueios',
      alerta: (contadores?.tentativasBloqueadas ?? 0) > 0,
    },
    {
      titulo: 'Auditoria',
      descricao: 'Histórico das ações administrativas',
      icone: 'list-outline',
      rota: '/admin/auditoria',
    },
    {
      titulo: 'Configurações',
      descricao: 'Modo de manutenção do sistema',
      icone: 'settings-outline',
      rota: '/admin/configuracoes',
    },
  ]

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: cores.fundo }}
      contentContainerStyle={styles.conteudo}
      keyboardShouldPersistTaps="handled"
    >
      {erro ? <Text style={[styles.mensagem, { color: cores.perigo }]}>{erro}</Text> : null}

      {visao?.manutencao ? (
        <View style={[styles.aviso, { backgroundColor: cores.perigo, borderColor: cores.perigo }]}>
          <Text style={[styles.avisoTexto, { color: '#FFFFFF' }]}>
            Sistema em manutenção. Somente o administrador consegue entrar.
          </Text>
        </View>
      ) : null}

      <Cartao titulo="Visão geral" subtitulo="Números do sistema agora">
        {carregando && !contadores ? (
          <Text style={{ color: cores.textoSuave, fontSize: 14 }}>Carregando…</Text>
        ) : (
          <View style={styles.grade}>
            <Metrica valor={contadores?.usuarios.ativos ?? 0} rotulo="Usuários ativos" />
            <Metrica valor={contadores?.usuarios.inativos ?? 0} rotulo="Usuários desativados" />
            <Metrica valor={contadores?.motoboysOnline ?? 0} rotulo="Motoboys online" />
            <Metrica valor={contadores?.entregas.aguardando ?? 0} rotulo="Entregas aguardando" />
            <Metrica valor={contadores?.rotasDoDia.publicadas ?? 0} rotulo="Rotas do dia publicadas" />
            <Metrica valor={contadores?.encaixes.pendentes ?? 0} rotulo="Encaixes pendentes" />
            <Metrica
              valor={contadores?.reativacoesPendentes ?? 0}
              rotulo="Reativações pendentes"
              alerta={(contadores?.reativacoesPendentes ?? 0) > 0}
            />
            <Metrica
              valor={contadores?.tentativasBloqueadas ?? 0}
              rotulo="Acessos bloqueados"
              alerta={(contadores?.tentativasBloqueadas ?? 0) > 0}
            />
          </View>
        )}
      </Cartao>

      <Cartao titulo="O que fazer">
        <View style={styles.menu}>
          {menu.map(item => (
            <Pressable
              key={item.rota}
              onPress={() => router.push(item.rota as never)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.item,
                { borderColor: cores.borda, backgroundColor: cores.superficie2, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Ionicons name={item.icone} size={22} color={cores.destaque} />
              <View style={styles.itemTextos}>
                <Text style={[styles.itemTitulo, { color: cores.texto }]}>
                  {item.titulo}
                  {item.alerta ? ' •' : ''}
                </Text>
                <Text style={[styles.itemDescricao, { color: cores.textoSuave }]}>
                  {item.descricao}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={cores.textoSuave} />
            </Pressable>
          ))}
        </View>
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
  menu: {
    gap: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    minHeight: 56,
  },
  itemTextos: {
    flex: 1,
    gap: 2,
  },
  itemTitulo: {
    fontSize: 15,
    fontWeight: '700',
  },
  itemDescricao: {
    fontSize: 12,
    lineHeight: 17,
  },
  mensagem: {
    fontSize: 14,
    lineHeight: 19,
  },
  aviso: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  avisoTexto: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
})
