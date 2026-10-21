import { useState } from 'react'
import type { Entrega, Papel, Ponto } from '../types'
import { novoId } from '../storage'
import MapView from './MapView'

interface Props {
  papel: Papel
  onCriar: (entrega: Entrega) => void
}

type Alvo = 'retirada' | 'destino'

export default function DeliveryForm({ papel, onCriar }: Props) {
  const [descricao, setDescricao] = useState('')
  const [remetente, setRemetente] = useState('')
  const [contato, setContato] = useState('')
  const [retirada, setRetirada] = useState<Ponto | null>(null)
  const [destino, setDestino] = useState<Ponto | null>(null)
  const [alvo, setAlvo] = useState<Alvo>('retirada')
  const [erro, setErro] = useState('')

  const ehLojista = papel === 'lojista'

  function selecionarPonto(lat: number, lng: number) {
    const ponto: Ponto = { nome: alvo === 'retirada' ? 'Ponto de retirada' : 'Ponto de destino', lat, lng }
    if (alvo === 'retirada') {
      setRetirada(ponto)
      setAlvo('destino')
    } else {
      setDestino(ponto)
    }
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!descricao.trim() || !remetente.trim() || !retirada || !destino) {
      setErro('Preencha descrição, remetente e selecione retirada e destino no mapa.')
      return
    }
    const entrega: Entrega = {
      id: novoId(),
      descricao: descricao.trim(),
      remetente: remetente.trim(),
      contato: contato.trim(),
      retirada,
      destino,
      status: 'aguardando',
      criadoPor: papel,
      criadoEm: new Date().toISOString(),
    }
    onCriar(entrega)
    setDescricao('')
    setRemetente('')
    setContato('')
    setRetirada(null)
    setDestino(null)
    setAlvo('retirada')
    setErro('')
  }

  return (
    <form className="card form" onSubmit={enviar}>
      <h2>{ehLojista ? 'Publicar rota' : 'Cadastrar entrega'}</h2>
      <label>
        {ehLojista ? 'Descrição da rota' : 'O que será entregue?'}
        <input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex.: 3 caixas de encomendas" />
      </label>
      <label>
        Remetente
        <input value={remetente} onChange={e => setRemetente(e.target.value)} placeholder="Nome de quem solicita" />
      </label>
      <label>
        Contato
        <input value={contato} onChange={e => setContato(e.target.value)} placeholder="Telefone / WhatsApp" />
      </label>
      <p className="dica">
        Clique no mapa para marcar a <strong>retirada</strong> e depois o <strong>destino</strong>.
        Retirada: {retirada ? 'marcada ✓' : 'pendente'} · Destino: {destino ? 'marcado ✓' : 'pendente'}
      </p>
      <div className="seletor">
        <button
          type="button"
          className={alvo === 'retirada' ? 'ativo' : ''}
          onClick={() => setAlvo('retirada')}
        >
          Marcar retirada
        </button>
        <button
          type="button"
          className={alvo === 'destino' ? 'ativo' : ''}
          onClick={() => setAlvo('destino')}
        >
          Marcar destino
        </button>
      </div>
      <MapView retirada={retirada ?? undefined} destino={destino ?? undefined} onSelecionarPonto={selecionarPonto} />
      {erro && <p className="erro">{erro}</p>}
      <button type="submit" className="primario">
        {ehLojista ? 'Publicar rota' : 'Cadastrar entrega'}
      </button>
    </form>
  )
}
