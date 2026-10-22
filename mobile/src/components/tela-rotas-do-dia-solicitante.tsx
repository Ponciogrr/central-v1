// Tela "Rotas do dia" do solicitante (lojista e pessoa física).
//
// Publica uma rota do dia (com origem, destino, data e valor), acompanha quem
// contratou, publica rascunhos e cancela quando precisar.

import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { mensagemDeErro } from '@/api/cliente'
import { BarraAviso, useAviso } from '@/components/aviso'
import Botao from '@/components/botao'
import Campo from '@/components/campo'
import CartaoRotaDia from '@/components/cartao-rota-dia'
import { confirmar } from '@/components/confirmar'
import Vazio from '@/components/vazio'
import { dataIsoDeTexto, hojeIso, textoDeDataIso } from '@/formato'
import { useMinhasRotasDia } from '@/rotas-dia'
import { useTema } from '@/theme'
import { lerValor } from '@/valor'

export default function TelaRotasDoDiaSolicitante() {
  const { cores } = useTema()
  const { rotas, carregando, erro, criar, publicar, cancelar } = useMinhasRotasDia()
  const { aviso, mostrar, ocultar } = useAviso()

  const [formAberto, setFormAberto] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [origem, setOrigem] = useState('')
  const [destino, setDestino] = useState('')
  const [data, setData] = useState(textoDeDataIso(hojeIso()))
  const [saida, setSaida] = useState('')
  const [paradas, setParadas] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [erroForm, setErroForm] = useState('')
  const [processando, setProcessando] = useState(false)

  function limparFormulario() {
    setTitulo('')
    setOrigem('')
    setDestino('')
    setData(textoDeDataIso(hojeIso()))
    setSaida('')
    setParadas('')
    setDescricao('')
    setValor('')
    setErroForm('')
  }

  async function aoEnviar(publicarAgora: boolean) {
    if (processando) return
    setErroForm('')

    if (!titulo.trim()) return setErroForm('Informe um título para a rota.')
    if (!origem.trim()) return setErroForm('Informe o ponto de origem.')
    if (!destino.trim()) return setErroForm('Informe o destino.')

    const dataIso = dataIsoDeTexto(data)
    if (!dataIso) return setErroForm('Informe a data no formato dd/mm/aaaa.')

    let valorNumero: string | null = null
    if (valor.trim()) {
      const numero = lerValor(valor)
      if (numero === 'invalido' || numero === null || numero <= 0) {
        return setErroForm('Informe um valor válido, por exemplo 25,00.')
      }
      valorNumero = numero.toFixed(2)
    }

    setProcessando(true)
    try {
      await criar({
        titulo: titulo.trim(),
        origem: origem.trim(),
        destino: destino.trim(),
        data: dataIso,
        saida: saida.trim() || undefined,
        paradas: paradas.trim() || undefined,
        descricao: descricao.trim() || undefined,
        valor: valorNumero,
        publicar: publicarAgora,
      })
      mostrar(publicarAgora ? 'Rota do dia publicada.' : 'Rascunho salvo.', 'ok')
      limparFormulario()
      setFormAberto(false)
    } catch (falha) {
      setErroForm(mensagemDeErro(falha))
    } finally {
      setProcessando(false)
    }
  }

  async function aoPublicar(id: string) {
    if (processando) return
    setErroForm('')
    setProcessando(true)
    try {
      await publicar(id)
      mostrar('Rota publicada.', 'ok')
    } catch (falha) {
      setErroForm(mensagemDeErro(falha))
    } finally {
      setProcessando(false)
    }
  }

  async function aoCancelar(id: string, tituloRota: string) {
    if (processando) return
    setErroForm('')
    const ok = await confirmar(
      'Cancelar rota do dia',
      `Cancelar "${tituloRota}"? O motoboy que contratou será avisado.`,
      { rotuloConfirmar: 'Cancelar rota', perigo: true },
    )
    if (!ok) return
    setProcessando(true)
    try {
      await cancelar(id, 'Cancelada pelo solicitante')
      mostrar('Rota cancelada.', 'ok')
    } catch (falha) {
      setErroForm(mensagemDeErro(falha))
    } finally {
      setProcessando(false)
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: cores.fundo }}
      contentContainerStyle={styles.conteudo}
      keyboardShouldPersistTaps="handled"
    >
      <BarraAviso aviso={aviso} aoFechar={ocultar} />

      {formAberto ? (
        <View style={[styles.bloco, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
          <Text style={[styles.tituloBloco, { color: cores.texto }]}>Publicar rota do dia</Text>
          <Text style={[styles.ajuda, { color: cores.textoSuave }]}>
            Informe de onde a rota parte, para onde vai e em que dia. O motoboy aceita e o valor
            combinado aparece aqui.
          </Text>

          <Campo rotulo="Título" valor={titulo} onChange={setTitulo} placeholder="Ex.: Centro → Zona Norte" />
          <Campo rotulo="Origem" valor={origem} onChange={setOrigem} placeholder="Ex.: Centro" />
          <Campo rotulo="Destino" valor={destino} onChange={setDestino} placeholder="Ex.: Zona Norte" />
          <Campo rotulo="Data (dd/mm/aaaa)" valor={data} onChange={setData} placeholder="21/10/2026" />
          <Campo rotulo="Horário de saída (opcional)" valor={saida} onChange={setSaida} placeholder="Ex.: 14:00" />
          <Campo rotulo="Paradas (opcional)" valor={paradas} onChange={setParadas} placeholder="Ex.: mercado, farmácia" />
          <Campo rotulo="Valor (R$, opcional)" valor={valor} onChange={setValor} placeholder="Ex.: 25,00" keyboardType="decimal-pad" />
          <Campo
            rotulo="Descrição (opcional)"
            valor={descricao}
            onChange={setDescricao}
            placeholder="Detalhes do serviço"
          />

          {erroForm ? <Text style={[styles.erro, { color: cores.perigo }]}>{erroForm}</Text> : null}

          <View style={styles.acoes}>
            <Botao
              rotulo={processando ? 'Enviando…' : 'Publicar'}
              onPress={() => aoEnviar(true)}
              disabled={processando}
            />
            <Botao
              rotulo="Salvar rascunho"
              tipo="secundario"
              onPress={() => aoEnviar(false)}
              disabled={processando}
            />
            <Botao rotulo="Fechar" tipo="secundario" onPress={() => setFormAberto(false)} />
          </View>
        </View>
      ) : (
        <Botao rotulo="Publicar rota do dia" onPress={() => setFormAberto(true)} />
      )}

      {erro && !erroForm ? <Text style={[styles.erro, { color: cores.perigo }]}>{erro}</Text> : null}

      {carregando ? (
        <Text style={{ color: cores.textoSuave, fontSize: 14 }}>Carregando…</Text>
      ) : rotas.length === 0 ? (
        <Vazio
          titulo="Nenhuma rota do dia"
          dica="Publique uma rota para receber propostas de motoboys disponíveis."
        />
      ) : (
        rotas.map(rota => (
          <CartaoRotaDia
            key={rota.id}
            rota={rota}
            mostrarPublicador={false}
            acoes={
              <>
                {rota.status === 'rascunho' ? (
                  <Botao
                    rotulo={processando ? 'Publicando…' : 'Publicar'}
                    onPress={() => aoPublicar(rota.id)}
                    disabled={processando}
                  />
                ) : null}
                {rota.status === 'publicada' || rota.status === 'contratada' || rota.status === 'em_andamento' ? (
                  <Botao
                    rotulo="Cancelar rota"
                    tipo="perigo"
                    onPress={() => aoCancelar(rota.id, rota.titulo)}
                    disabled={processando}
                  />
                ) : null}
              </>
            }
          />
        ))
      )}
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
  bloco: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  tituloBloco: {
    fontSize: 16,
    fontWeight: '700',
  },
  ajuda: {
    fontSize: 12,
    lineHeight: 18,
  },
  acoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  erro: {
    fontSize: 14,
    lineHeight: 19,
  },
})
