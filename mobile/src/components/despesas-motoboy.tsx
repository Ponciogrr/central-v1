import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import {
  CATEGORIAS_DESPESA,
  mensagemDeErro,
  type CategoriaDespesa,
  type DadosDespesa,
  type DespesaApi,
} from '@/api/cliente'
import Botao from '@/components/botao'
import Campo from '@/components/campo'
import { confirmar as confirmarAcao } from '@/components/confirmar'
import { paraDataIso } from '@/contabilidade'
import { NUMEROS, useTema } from '@/theme'
import { lerValor } from '@/valor'

const ROTULO_CATEGORIA: Record<CategoriaDespesa, string> = {
  gasolina: 'Gasolina',
  oleo: 'Óleo',
  manutencao: 'Manutenção',
  outros: 'Outros',
}

function formatarDinheiro(valor: number): string {
  return `R$ ${valor.toFixed(2).replace('.', ',')}`
}

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

// Confirmação compatível com web e nativo.
function confirmar(titulo: string, mensagem: string): Promise<boolean> {
  return confirmarAcao(titulo, mensagem, { rotuloConfirmar: 'Excluir', perigo: true })
}

interface Props {
  despesas: DespesaApi[]
  adicionar: (dados: DadosDespesa) => Promise<void>
  editar: (id: string, dados: DadosDespesa) => Promise<void>
  remover: (id: string) => Promise<void>
}

export default function DespesasMotoboy({ despesas, adicionar, editar, remover }: Props) {
  const { cores } = useTema()
  const [formAberto, setFormAberto] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [categoria, setCategoria] = useState<CategoriaDespesa>('gasolina')
  const [valorTexto, setValorTexto] = useState('')
  const [data, setData] = useState(paraDataIso(new Date()))
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState('')
  const [processando, setProcessando] = useState(false)

  function limparFormulario() {
    setEditandoId(null)
    setCategoria('gasolina')
    setValorTexto('')
    setData(paraDataIso(new Date()))
    setObservacao('')
    setErro('')
  }

  function abrirNovo() {
    limparFormulario()
    setFormAberto(true)
  }

  function abrirEdicao(d: DespesaApi) {
    setEditandoId(d.id)
    setCategoria(d.categoria)
    setValorTexto(d.valor.toFixed(2).replace('.', ','))
    setData(d.data)
    setObservacao(d.observacao ?? '')
    setErro('')
    setFormAberto(true)
  }

  async function salvar() {
    if (processando) return
    setErro('')

    const numero = lerValor(valorTexto)
    if (numero === 'invalido' || numero === null || numero <= 0) {
      return setErro('Informe um valor válido maior que zero, por exemplo 50,00.')
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return setErro('Informe a data no formato AAAA-MM-DD.')
    }

    const dados: DadosDespesa = {
      categoria,
      valor: numero,
      data,
      observacao: observacao.trim() || null,
    }

    setProcessando(true)
    try {
      if (editandoId) await editar(editandoId, dados)
      else await adicionar(dados)
      setFormAberto(false)
      limparFormulario()
    } catch (falha) {
      setErro(mensagemDeErro(falha))
    } finally {
      setProcessando(false)
    }
  }

  async function excluir(d: DespesaApi) {
    const ok = await confirmar(
      'Excluir despesa',
      `Excluir a despesa de ${formatarDinheiro(d.valor)} (${ROTULO_CATEGORIA[d.categoria]})?`,
    )
    if (!ok) return
    try {
      await remover(d.id)
    } catch (falha) {
      setErro(mensagemDeErro(falha))
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.linhaTitulo}>
        <Text style={[styles.titulo, { color: cores.texto }]}>Despesas (opcional)</Text>
        <Botao
          rotulo={formAberto ? 'Fechar' : '+'}
          tipo="secundario"
          style={styles.botaoMais}
          onPress={() => {
            if (formAberto) {
              setFormAberto(false)
              limparFormulario()
            } else {
              abrirNovo()
            }
          }}
        />
      </View>

      {formAberto ? (
        <View style={[styles.bloco, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
          <Text style={[styles.rotulo, { color: cores.textoSuave }]}>Categoria</Text>
          <View style={styles.opcoes}>
            {CATEGORIAS_DESPESA.map(cat => (
              <Botao
                key={cat}
                rotulo={ROTULO_CATEGORIA[cat]}
                tipo={categoria === cat ? 'primario' : 'secundario'}
                style={styles.opcao}
                onPress={() => setCategoria(cat)}
              />
            ))}
          </View>

          <Campo
            rotulo="Valor"
            valor={valorTexto}
            onChange={t => {
              setValorTexto(t)
              if (erro) setErro('')
            }}
            placeholder="R$ ..."
            keyboardType="decimal-pad"
          />
          <Campo
            rotulo="Data (AAAA-MM-DD)"
            valor={data}
            onChange={setData}
            placeholder="Ex.: 2026-10-20"
          />
          <Campo
            rotulo="Observação (opcional)"
            valor={observacao}
            onChange={setObservacao}
            placeholder="Ex.: posto do centro"
          />

          {erro ? <Text style={[styles.erro, { color: cores.perigo }]}>{erro}</Text> : null}

          <View style={styles.acoes}>
            <View style={styles.acaoFlex}>
              <Botao
                rotulo="Cancelar"
                tipo="secundario"
                onPress={() => {
                  setFormAberto(false)
                  limparFormulario()
                }}
                disabled={processando}
              />
            </View>
            <View style={styles.acaoFlex}>
              <Botao
                rotulo={processando ? 'Salvando…' : editandoId ? 'Salvar' : 'Adicionar'}
                onPress={salvar}
                disabled={processando}
              />
            </View>
          </View>
        </View>
      ) : null}

      {despesas.length === 0 ? (
        <Text style={[styles.aviso, { color: cores.textoSuave }]}>
          Nenhuma despesa registrada. Adicionar é opcional.
        </Text>
      ) : (
        despesas.map(d => (
          <View
            key={d.id}
            style={[styles.item, { backgroundColor: cores.superficie, borderColor: cores.borda }]}
          >
            <View style={styles.itemTopo}>
              <Text style={[styles.itemCategoria, { color: cores.texto }]}>
                {ROTULO_CATEGORIA[d.categoria]}
              </Text>
              <Text style={[styles.itemValor, { color: cores.texto }]}>
                {formatarDinheiro(d.valor)}
              </Text>
            </View>
            <Text style={[styles.itemData, { color: cores.textoSuave }]}>{formatarData(d.data)}</Text>
            {d.observacao ? (
              <Text style={[styles.itemData, { color: cores.textoSuave }]}>{d.observacao}</Text>
            ) : null}
            <View style={styles.acoes}>
              <View style={styles.acaoFlex}>
                <Botao rotulo="Editar" tipo="secundario" onPress={() => abrirEdicao(d)} />
              </View>
              <View style={styles.acaoFlex}>
                <Botao rotulo="Excluir" tipo="perigo" onPress={() => excluir(d)} />
              </View>
            </View>
          </View>
        ))
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  linhaTitulo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titulo: {
    fontSize: 16,
    fontWeight: '700',
  },
  botaoMais: {
    minWidth: 48,
    paddingVertical: 8,
  },
  bloco: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  rotulo: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  opcoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  opcao: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  acoes: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  acaoFlex: {
    flex: 1,
  },
  item: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  itemTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemCategoria: {
    fontSize: 14,
    fontWeight: '700',
  },
  itemValor: {
    ...NUMEROS,
    fontSize: 14,
    fontWeight: '700',
  },
  itemData: {
    fontSize: 12,
  },
  aviso: {
    fontSize: 12,
  },
  erro: {
    fontSize: 12,
  },
})
