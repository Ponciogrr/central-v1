import { router } from 'expo-router'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import Botao from '@/components/botao'
import CartaoEntrega from '@/components/cartao-entrega'
import Vazio from '@/components/vazio'
import { useMinhasEntregas } from '@/entregas'
import { useSessao } from '@/sessao'
import { useTema } from '@/theme'

const ATIVAS = ['aguardando', 'aceita', 'em_rota']
const FINALIZADAS = ['entregue', 'cancelada']

interface Props {
  situacao: 'ativas' | 'finalizadas'
}

// Lista as entregas reais do usuário (andamento ou histórico).
// É reutilizado pelas telas de Lojista e de Pessoa Física (sem duplicar lógica).
// A atualização automática (consulta periódica em foco) fica em useMinhasEntregas.
export default function PainelEntregas({ situacao }: Props) {
  const { cores } = useTema()
  const { usuario } = useSessao()
  const { entregas, carregando, erro, carregar, cancelar } = useMinhasEntregas()

  if (!usuario) {
    return (
      <Vazio
        titulo="Sessão de demonstração"
        dica="Entre com o seu código de acesso para ver as entregas reais da sua conta."
        icone="log-in-outline"
        acao={{ rotulo: 'Entrar com código', onPress: () => router.push('/login') }}
      />
    )
  }

  if (carregando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={cores.acao} />
        <Text style={[styles.texto, { color: cores.textoSuave }]}>Carregando entregas…</Text>
      </View>
    )
  }

  if (erro) {
    return (
      <View style={styles.lista}>
        <Vazio titulo="Não foi possível carregar" dica={erro} />
        <Botao rotulo="Tentar novamente" tipo="secundario" onPress={carregar} />
      </View>
    )
  }

  const filtro = situacao === 'ativas' ? ATIVAS : FINALIZADAS
  const lista = entregas.filter(e => filtro.includes(e.status))

  if (lista.length === 0) {
    return situacao === 'ativas' ? (
      <Vazio
        titulo="Nenhuma entrega em andamento."
        dica="Quando você solicitar uma entrega, o acompanhamento com o status aparecerá aqui."
      />
    ) : (
      <Vazio
        titulo="Nenhuma entrega concluída."
        dica="As entregas finalizadas ou canceladas aparecerão aqui com data e status."
      />
    )
  }

  return (
    <View style={styles.lista}>
      {lista.map(entrega => (
        <CartaoEntrega key={entrega.id} entrega={entrega} onCancelar={cancelar} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  lista: {
    gap: 12,
  },
  centro: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  texto: {
    fontSize: 14,
  },
})
