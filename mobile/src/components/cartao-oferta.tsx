import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { mensagemDeErro, type OfertaApi } from '@/api/cliente'
import Botao from '@/components/botao'
import { NUMEROS, useTema } from '@/theme'

function formatarValor(valor: number | null): string {
  if (valor === null) return 'Valor não informado'
  return `R$ ${valor.toFixed(2).replace('.', ',')}`
}

function segundosRestantes(expiraEm: string): number {
  const fim = new Date(expiraEm).getTime()
  if (Number.isNaN(fim)) return 0
  return Math.max(0, Math.round((fim - Date.now()) / 1000))
}

interface Props {
  oferta: OfertaApi
  onAceitar: (id: string) => Promise<unknown>
  onRecusar: (id: string) => Promise<unknown>
}

// Oferta exclusiva de entrega: endereços, valor e os botões de aceitar/recusar.
// O prazo (30 s) é revalidado no servidor no momento do aceite.
export default function CartaoOferta({ oferta, onAceitar, onRecusar }: Props) {
  const { cores } = useTema()
  const [processando, setProcessando] = useState<'aceitar' | 'recusar' | null>(null)
  const [erro, setErro] = useState('')

  async function executar(acao: 'aceitar' | 'recusar') {
    setProcessando(acao)
    setErro('')
    try {
      await (acao === 'aceitar' ? onAceitar(oferta.id) : onRecusar(oferta.id))
    } catch (falha) {
      setErro(mensagemDeErro(falha))
      setProcessando(null)
    }
  }

  const restantes = segundosRestantes(oferta.expiraEm)

  return (
    <View style={[styles.card, { backgroundColor: cores.superficie, borderColor: cores.acao }]}>
      <View style={styles.linhaTopo}>
        <View style={[styles.etiqueta, { borderColor: cores.acao }]}>
          <Text style={[styles.etiquetaTexto, { color: cores.acao }]}>Nova oferta</Text>
        </View>
        <Text style={[styles.valor, { color: cores.texto }]}>{formatarValor(oferta.valor)}</Text>
      </View>

      <View style={styles.endereco}>
        <Text style={[styles.rotulo, { color: cores.textoSuave }]}>Coleta</Text>
        <Text style={[styles.texto, { color: cores.texto }]}>{oferta.coleta}</Text>
      </View>
      <View style={styles.endereco}>
        <Text style={[styles.rotulo, { color: cores.textoSuave }]}>Entrega</Text>
        <Text style={[styles.texto, { color: cores.texto }]}>{oferta.destino}</Text>
      </View>

      {oferta.observacoes ? (
        <Text style={[styles.texto, { color: cores.textoSuave }]}>Obs.: {oferta.observacoes}</Text>
      ) : null}

      <Text style={[styles.prazo, { color: cores.textoSuave }]}>
        {restantes > 0
          ? `Responda em até ${restantes}s (senão a oferta passa para outro motoboy).`
          : 'O prazo desta oferta está terminando.'}
      </Text>

      {erro ? <Text style={[styles.erro, { color: cores.perigo }]}>{erro}</Text> : null}

      <View style={styles.acoes}>
        <View style={styles.acaoFlex}>
          <Botao
            rotulo={processando === 'recusar' ? 'Recusando…' : 'Recusar'}
            tipo="secundario"
            onPress={() => executar('recusar')}
            disabled={processando !== null}
          />
        </View>
        <View style={styles.acaoFlex}>
          <Botao
            rotulo={processando === 'aceitar' ? 'Aceitando…' : 'Aceitar'}
            onPress={() => executar('aceitar')}
            disabled={processando !== null}
          />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  linhaTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  etiqueta: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    flexShrink: 1,
    minWidth: 0,
  },
  etiquetaTexto: {
    fontSize: 12,
    fontWeight: '700',
  },
  valor: {
    ...NUMEROS,
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 0,
    textAlign: 'right',
  },
  endereco: {
    gap: 4,
  },
  rotulo: {
    fontSize: 12,
  },
  texto: {
    fontSize: 14,
    lineHeight: 20,
  },
  prazo: {
    fontSize: 12,
  },
  erro: {
    fontSize: 12,
  },
  acoes: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  acaoFlex: {
    flex: 1,
  },
})
