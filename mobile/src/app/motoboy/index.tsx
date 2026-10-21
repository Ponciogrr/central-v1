import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import AlternadorDisponibilidade from '@/components/alternador-disponibilidade'
import { BarraAviso, useAviso } from '@/components/aviso'
import CartaoAtiva from '@/components/cartao-ativa'
import CartaoOferta from '@/components/cartao-oferta'
import PainelOferta from '@/components/painel-oferta'
import Vazio from '@/components/vazio'
import { usePainelMotoboy } from '@/motoboy'
import { useTema } from '@/theme'

export default function InicioMotoboy() {
  const { cores } = useTema()
  const {
    logado,
    online,
    ofertas,
    entregaAtiva,
    carregando,
    alternando,
    erro,
    alternar,
    aceitar,
    recusar,
    iniciar,
    finalizar,
    cancelar,
    recarregar,
  } = usePainelMotoboy()
  const { aviso, mostrar, ocultar } = useAviso()

  // Painel animado de ofertas: abre quando chega uma oferta de id NOVO;
  // fecha quando o usuário dispensa (ou quando não há mais ofertas).
  const [painelAberto, setPainelAberto] = useState(false)
  const vistosRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (ofertas.length === 0) {
      if (painelAberto) setPainelAberto(false)
      return
    }
    const temNova = ofertas.some(oferta => !vistosRef.current.has(oferta.id))
    if (temNova) setPainelAberto(true)
  }, [ofertas, painelAberto])

  function fecharPainel() {
    ofertas.forEach(oferta => vistosRef.current.add(oferta.id))
    setPainelAberto(false)
  }

  async function aoAceitar(id: string) {
    await aceitar(id)
    vistosRef.current.add(id)
    mostrar('Oferta aceita! A entrega entrou em andamento.', 'ok')
  }

  async function aoRecusar(id: string) {
    await recusar(id)
    vistosRef.current.add(id)
    mostrar('Oferta recusada.', 'info')
  }

  if (!logado) {
    return (
      <ScrollView
        style={[styles.scroll, { backgroundColor: cores.fundo }]}
        contentContainerStyle={styles.conteudo}
      >
        <Vazio
          titulo="Sessão de demonstração"
          dica="Entre com o seu código de acesso para receber ofertas reais e controlar a sua disponibilidade."
        />
      </ScrollView>
    )
  }

  return (
    <View style={[styles.scroll, { backgroundColor: cores.fundo }]}>
      <ScrollView
        style={styles.scrollInterno}
        contentContainerStyle={styles.conteudo}
        keyboardShouldPersistTaps="handled"
      >
        <BarraAviso aviso={aviso} aoFechar={ocultar} />

        <View style={styles.bloco}>
          <Text style={[styles.blocoTitulo, { color: cores.texto }]}>Disponibilidade</Text>
          <AlternadorDisponibilidade
            online={online}
            alternando={alternando}
            desativado={carregando}
            onAlternar={proximo => {
              void alternar(proximo)
            }}
          />
          <Text style={[styles.dica, { color: cores.textoSuave }]}>
            {online
              ? 'Enquanto estiver online, este painel consulta o servidor a cada 5 segundos.'
              : 'Só motoboys online e livres recebem ofertas.'}
          </Text>
        </View>

        {erro ? <Text style={[styles.erro, { color: cores.perigo }]}>{erro}</Text> : null}

        <Text style={[styles.secao, { color: cores.texto }]}>Ofertas de entrega</Text>

        {!online ? (
          <Vazio
            titulo="Você está offline."
            dica="Fique online para receber ofertas. Só motoboys online e livres recebem ofertas."
          />
        ) : carregando ? (
          <View style={styles.centro}>
            <ActivityIndicator color={cores.acao} />
            <Text style={[styles.dica, { color: cores.textoSuave }]}>Buscando ofertas…</Text>
          </View>
        ) : ofertas.length === 0 ? (
          <Vazio
            titulo="Nenhuma oferta no momento."
            dica="Quando houver uma entrega disponível para você, ela aparecerá aqui com as opções de aceitar ou recusar."
          />
        ) : (
          <View style={styles.lista}>
            {ofertas.map(oferta => (
              <CartaoOferta
                key={oferta.id}
                oferta={oferta}
                onAceitar={aoAceitar}
                onRecusar={aoRecusar}
              />
            ))}
          </View>
        )}

        <Text style={[styles.secao, { color: cores.texto }]}>Entrega ativa</Text>

        {entregaAtiva ? (
          <CartaoAtiva
            entrega={entregaAtiva}
            onIniciar={iniciar}
            onFinalizar={finalizar}
            onCancelar={cancelar}
          />
        ) : (
          <Vazio
            titulo="Nenhuma entrega em andamento."
            dica="Depois de aceitar uma oferta, os detalhes da entrega aparecerão aqui."
          />
        )}

        <Text
          onPress={recarregar}
          style={[styles.atualizar, { color: cores.textoSuave }]}
        >
          Atualizar agora
        </Text>
      </ScrollView>

      <PainelOferta
        visivel={painelAberto}
        ofertas={ofertas}
        aoFechar={fecharPainel}
        onAceitar={aoAceitar}
        onRecusar={aoRecusar}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollInterno: {
    flex: 1,
  },
  conteudo: {
    padding: 24,
    gap: 12,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  bloco: {
    gap: 8,
  },
  blocoTitulo: {
    fontSize: 16,
    fontWeight: '700',
  },
  dica: {
    fontSize: 12,
    lineHeight: 18,
  },
  secao: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  lista: {
    gap: 12,
  },
  centro: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  erro: {
    fontSize: 12,
  },
  atualizar: {
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 8,
    textDecorationLine: 'underline',
  },
})
