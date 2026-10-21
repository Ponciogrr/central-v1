import { ScrollView, StyleSheet, Text, View } from 'react-native'
import type { ResumoFinanceiroApi } from '@/api/cliente'
import { NUMEROS, useTema } from '@/theme'

// Painel de resumo financeiro do motoboy (aba Histórico).
//
// IMPORTANTE (transparência): o total NÃO é lucro líquido nem ganho confirmado
// pela plataforma — é a soma dos VALORES das entregas concluídas (o valor
// combinado registrado, regra 7). As despesas são declarações pessoais.
//
// Gráfico leve: barras proporcionais ao maior valor DIÁRIO do período, feitas
// apenas com Views (nenhuma biblioteca de gráficos).

function formatarDinheiro(valor: number): string {
  return `R$ ${valor.toFixed(2).replace('.', ',')}`
}

function formatarDiaCurto(iso: string): string {
  const [, mes, dia] = iso.split('-')
  return `${dia}/${mes}`
}

interface Props {
  resumo: ResumoFinanceiroApi
  // Quantidade de dias do período (ex.: 7), usada quando não há entregas.
  diasPeriodo: number
}

export default function ResumoFinanceiro({ resumo, diasPeriodo }: Props) {
  const { cores } = useTema()

  const temEntregas = resumo.quantidadeEntregas > 0
  const temDespesas = resumo.totalDespesas > 0
  const maiorDia = resumo.porDia.reduce((m, d) => Math.max(m, d.valor), 0)

  return (
    <View style={[styles.painel, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
      <View style={styles.cabecalho}>
        <Text style={[styles.titulo, { color: cores.texto }]}>
          Últimos {diasPeriodo} dias
        </Text>
        <Text style={[styles.subtitulo, { color: cores.textoSuave }]}>
          Valor das entregas concluídas
        </Text>
      </View>

      <View style={styles.numeros}>
        <View style={styles.numeroBloco}>
          <Text style={[styles.numero, { color: cores.acao }]}>
            {formatarDinheiro(resumo.totalEntregas)}
          </Text>
          <Text style={[styles.numeroRotulo, { color: cores.textoSuave }]}>
            {resumo.quantidadeEntregas}{' '}
            {resumo.quantidadeEntregas === 1 ? 'entrega concluída' : 'entregas concluídas'}
          </Text>
        </View>

        {temDespesas ? (
          <>
            <View style={styles.numeroBloco}>
              <Text style={[styles.numero, { color: cores.perigo }]}>
                {formatarDinheiro(resumo.totalDespesas)}
              </Text>
              <Text style={[styles.numeroRotulo, { color: cores.textoSuave }]}>
                Despesas declaradas
              </Text>
            </View>
            <View style={styles.numeroBloco}>
              <Text style={[styles.numero, { color: cores.texto }]}>
                {formatarDinheiro(resumo.saldoEstimado)}
              </Text>
              <Text style={[styles.numeroRotulo, { color: cores.textoSuave }]}>
                Saldo estimado (entregas − despesas)
              </Text>
            </View>
          </>
        ) : null}
      </View>

      {temEntregas ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rolagemGrafico}
        >
          <View style={styles.grafico}>
            {resumo.porDia.map(dia => {
              const proporcao = maiorDia > 0 ? dia.valor / maiorDia : 0
              return (
                <View key={dia.data} style={styles.coluna}>
                  <Text
                    numberOfLines={1}
                    style={[styles.barraValor, { color: cores.textoSuave }]}
                  >
                    {dia.valor > 0 ? formatarDinheiro(dia.valor) : ''}
                  </Text>
                  <View style={[styles.trilha, { backgroundColor: cores.superficie2 }]}>
                    <View
                      style={[
                        styles.barra,
                        {
                          backgroundColor: cores.acao,
                          height: `${Math.max(6, proporcao * 100)}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.barraDia, { color: cores.textoSuave }]}>
                    {formatarDiaCurto(dia.data)}
                  </Text>
                </View>
              )
            })}
          </View>
        </ScrollView>
      ) : (
        <View style={[styles.vazio, { borderColor: cores.borda }]}>
          <Text style={[styles.vazioTexto, { color: cores.textoSuave }]}>
            Nenhuma entrega concluída neste período.
          </Text>
        </View>
      )}

      {temDespesas ? (
        <Text style={[styles.nota, { color: cores.textoSuave }]}>
          O saldo estimado desconta as despesas que você declarou. Não é o valor pago a você nem
          um lucro calculado pela Central.
        </Text>
      ) : (
        <Text style={[styles.nota, { color: cores.textoSuave }]}>
          Este é o valor combinado das entregas concluídas. Não representa o lucro líquido.
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  painel: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  cabecalho: {
    gap: 4,
  },
  titulo: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitulo: {
    fontSize: 12,
  },
  numeros: {
    gap: 8,
  },
  numeroBloco: {
    gap: 4,
  },
  numero: {
    ...NUMEROS,
    fontSize: 20,
    fontWeight: '700',
  },
  numeroRotulo: {
    fontSize: 12,
  },
  rolagemGrafico: {
    marginTop: 4,
  },
  grafico: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    height: 120,
    minWidth: '100%',
  },
  coluna: {
    minWidth: 56,
    alignItems: 'center',
    gap: 4,
  },
  barraValor: {
    fontSize: 11,
  },
  trilha: {
    width: '100%',
    height: 72,
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barra: {
    width: '100%',
    borderRadius: 8,
  },
  barraDia: {
    fontSize: 12,
  },
  vazio: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  vazioTexto: {
    fontSize: 12,
  },
  nota: {
    fontSize: 12,
    lineHeight: 16,
  },
})
