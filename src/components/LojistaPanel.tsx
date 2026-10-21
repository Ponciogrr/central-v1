import { useState } from 'react'
import type { Entrega } from '../types'
import { LABEL_STATUS } from '../types'
import { formatarData } from '../geo'
import { novoId } from '../storage'
import { contarMotoboysOnline, type Usuario } from '../auth'

interface Props {
  usuario: Usuario
  entregas: Entrega[]
  onCriar: (entrega: Entrega) => void
  onAtualizar: (id: string, mudanca: Partial<Entrega>) => void
  onSair: () => void
}

type Aba = 'inicio' | 'rotas' | 'historico' | 'perfil'
type Vista = 'lista' | 'form' | 'resumo'

const ICONE_CAIXA = (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
    <path d="M3 8l9 5 9-5" />
    <path d="M12 13v8" />
  </svg>
)

const CLASSE_STATUS: Record<Entrega['status'], string> = {
  aguardando: 'st-aguardando',
  aceita: 'st-aceita',
  em_rota: 'st-em-rota',
  entregue: 'st-entregue',
  cancelada: 'st-cancelada',
}

function Vazio({ titulo, dica }: { titulo: string; dica: string }) {
  return (
    <div className="vazio">
      {ICONE_CAIXA}
      <p>{titulo}</p>
      <span className="dica">{dica}</span>
    </div>
  )
}

export default function LojistaPanel({ usuario, entregas, onCriar, onAtualizar, onSair }: Props) {
  const [aba, setAba] = useState<Aba>('inicio')
  const [vista, setVista] = useState<Vista>('lista')

  const [coleta, setColeta] = useState('')
  const [entregaEnd, setEntregaEnd] = useState('')
  const [valor, setValor] = useState('')
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState('')

  const [cancelandoId, setCancelandoId] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')

  const meu = (e: Entrega) =>
    e.criadoPorId ? e.criadoPorId === usuario.id : e.criadoPor === 'lojista'
  const andamento = entregas.filter(
    e => meu(e) && (e.status === 'aguardando' || e.status === 'aceita' || e.status === 'em_rota'),
  )
  const historico = entregas.filter(
    e => meu(e) && (e.status === 'entregue' || e.status === 'cancelada'),
  )

  const online = contarMotoboysOnline()

  function revisar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!coleta.trim()) return setErro('Informe o endereço de coleta.')
    if (!entregaEnd.trim()) return setErro('Informe o endereço de entrega.')
    if (!valor.trim()) return setErro('Informe o valor combinado.')
    setVista('resumo')
  }

  function confirmarSolicitacao() {
    const nova: Entrega = {
      id: novoId(),
      descricao: obs.trim() || 'Entrega solicitada',
      remetente: usuario.nome,
      contato: usuario.telefone || '',
      retirada: { nome: coleta.trim() },
      destino: { nome: entregaEnd.trim() },
      status: 'aguardando',
      criadoPor: 'lojista',
      criadoPorId: usuario.id,
      criadoEm: new Date().toISOString(),
      valor: valor.trim(),
      observacoes: obs.trim() || undefined,
    }
    onCriar(nova)
    setColeta('')
    setEntregaEnd('')
    setValor('')
    setObs('')
    setErro('')
    setVista('lista')
  }

  function cancelar(e: Entrega) {
    if (e.status === 'aguardando') {
      onAtualizar(e.id, { status: 'cancelada', atualizadoEm: new Date().toISOString() })
      return
    }
    setCancelandoId(e.id)
    setMotivo('')
  }

  function confirmarCancelamento(e: Entrega) {
    if (!motivo.trim()) {
      setErro('Informe o motivo do cancelamento.')
      return
    }
    onAtualizar(e.id, {
      status: 'cancelada',
      motivoCancelamento: motivo.trim(),
      atualizadoEm: new Date().toISOString(),
    })
    setCancelandoId(null)
    setMotivo('')
    setErro('')
  }

  function linhas(lista: Entrega[], comAcoes: boolean) {
    return (
      <ul className="lista-ofertas">
        {lista.map(e => (
          <li key={e.id} className="item-oferta">
            <span className={`status ${CLASSE_STATUS[e.status]}`}>
              {LABEL_STATUS[e.status]}
            </span>
            <strong>{e.descricao}</strong>
            <span className="detalhes">
              {e.retirada.nome} → {e.destino.nome}
            </span>
            {e.valor && <span className="detalhes">Valor: {e.valor}</span>}
            {e.motivoCancelamento && (
              <span className="detalhes">Cancelada — motivo: {e.motivoCancelamento}</span>
            )}
            <span className="data">{formatarData(e.atualizadoEm ?? e.criadoEm)}</span>
            {(e.status === 'aceita' || e.status === 'em_rota') && (
              <span className="dica chat-gate">Chat privado: funcionalidade ainda não implementada.</span>
            )}
            {e.status === 'aguardando' && (
              <span className="dica chat-gate">Chat será liberado após a aceitação.</span>
            )}
            {comAcoes && (e.status === 'aguardando' || e.status === 'aceita' || e.status === 'em_rota') && (
              <span className="item-acoes">
                <button className="perigo" onClick={() => cancelar(e)}>
                  Cancelar
                </button>
              </span>
            )}
            {cancelandoId === e.id && (
              <span className="form-cancelamento">
                <span className="dica">
                  Após a aceitação, o cancelamento exige confirmação e motivo (o motoboy deve ser
                  avisado — aviso automático não disponível nesta versão local).
                </span>
                <input
                  placeholder="Motivo do cancelamento"
                  value={motivo}
                  onChange={ev => setMotivo(ev.target.value)}
                />
                <span className="item-acoes">
                  <button className="primario" onClick={() => confirmarCancelamento(e)}>
                    Confirmar cancelamento
                  </button>
                  <button
                    onClick={() => {
                      setCancelandoId(null)
                      setErro('')
                    }}
                  >
                    Voltar
                  </button>
                </span>
              </span>
            )}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="app painel-motoboy">
      <header className="topo">
        <div className="topo-linha">
          <h1>Central de Motoboys</h1>
          <span className="papel-badge">Lojista</span>
          <span className="indicador-online" title="Somente quantidade, sem dados pessoais">
            Motoboys online: {online}
          </span>
          <button onClick={onSair}>Sair</button>
        </div>
        <p className="dica">{usuario.nome} · estabelecimento</p>
      </header>

      <main className="painel-main">
        {aba === 'inicio' && (
          <section>
            {erro && <p className="erro">{erro}</p>}

            {vista === 'lista' && (
              <>
                <button
                  className="primario btn-solicitar"
                  onClick={() => {
                    setErro('')
                    setVista('form')
                  }}
                >
                  Solicitar entrega
                </button>

                <h2 className="secao-titulo">Entregas em andamento</h2>
                {andamento.length === 0 ? (
                  <Vazio
                    titulo="Nenhuma entrega em andamento."
                    dica="Toque em “Solicitar entrega” para publicar a primeira. Pagamentos são feitos direto com o motoboy — o app não processa pagamentos."
                  />
                ) : (
                  linhas(andamento, true)
                )}
              </>
            )}

            {vista === 'form' && (
              <form className="card form" onSubmit={revisar}>
                <h2>Solicitar entrega</h2>
                <label>
                  Endereço de coleta
                  <input value={coleta} onChange={e => setColeta(e.target.value)} placeholder="Onde buscar" />
                </label>
                <label>
                  Endereço de entrega
                  <input value={entregaEnd} onChange={e => setEntregaEnd(e.target.value)} placeholder="Para onde vai" />
                </label>
                <label>
                  Valor combinado ou ofertado
                  <input value={valor} onChange={e => setValor(e.target.value)} placeholder="R$ ..." />
                </label>
                <label>
                  Observações (opcional)
                  <input value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex.: ligar antes de chegar" />
                </label>
                <button type="submit" className="primario">
                  Revisar solicitação
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVista('lista')
                    setErro('')
                  }}
                >
                  Voltar
                </button>
              </form>
            )}

            {vista === 'resumo' && (
              <div className="card form">
                <h2>Revisar e confirmar</h2>
                <p className="detalhes">Coleta: {coleta.trim()}</p>
                <p className="detalhes">Entrega: {entregaEnd.trim()}</p>
                <p className="detalhes">Valor: {valor.trim()}</p>
                {obs.trim() && <p className="detalhes">Obs.: {obs.trim()}</p>}
                <p className="aviso">
                  Pagamento feito diretamente entre você e o motoboy — o aplicativo apenas registra
                  o valor combinado e não processa pagamentos.
                </p>
                <div className="acoes">
                  <button className="primario" onClick={confirmarSolicitacao}>
                    Confirmar solicitação
                  </button>
                  <button
                    onClick={() => {
                      setVista('form')
                      setErro('')
                    }}
                  >
                    Voltar e editar
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {aba === 'rotas' && (
          <section>
            <h2 className="secao-titulo">Rotas e encaixes</h2>
            <Vazio
              titulo="Nenhuma rota cadastrada."
              dica="Esta área será exibida quando as rotas e encaixes forem implementados — ainda é apenas interface."
            />
          </section>
        )}

        {aba === 'historico' && (
          <section>
            <h2 className="secao-titulo">Histórico de entregas</h2>
            {historico.length === 0 ? (
              <Vazio
                titulo="Nenhuma entrega concluída."
                dica="Entregas finalizadas ou canceladas aparecerão aqui."
              />
            ) : (
              linhas(historico, false)
            )}
          </section>
        )}

        {aba === 'perfil' && (
          <section>
            <h2 className="secao-titulo">Perfil do estabelecimento</h2>
            <ul className="lista-perfil">
              <li>
                <span>Nome</span> <strong>{usuario.nome}</strong>
              </li>
              <li>
                <span>Perfil</span> <strong>Lojista</strong>
              </li>
              <li>
                <span>Código de acesso</span> <code className="codigo">{usuario.codigo}</code>
              </li>
              <li>
                <span>Telefone</span> <strong>{usuario.telefone || 'não informado'}</strong>
              </li>
              <li>
                <span>Conta</span> <strong>{usuario.ativo ? 'Ativa' : 'Desativada'}</strong>
              </li>
            </ul>
            <p className="dica">
              Edição dos próprios dados fica disponível em etapa futura (regras 34–35). Dados salvos
              apenas neste navegador — não há sincronização entre dispositivos.
            </p>
          </section>
        )}
      </main>

      <nav className="nav-inferior" aria-label="Navegação do lojista">
        <button className={aba === 'inicio' ? 'nav-item ativa' : 'nav-item'} onClick={() => { setAba('inicio'); setVista('lista') }}>
          Início
        </button>
        <button className={aba === 'rotas' ? 'nav-item ativa' : 'nav-item'} onClick={() => setAba('rotas')}>
          Rotas
        </button>
        <button className={aba === 'historico' ? 'nav-item ativa' : 'nav-item'} onClick={() => setAba('historico')}>
          Histórico
        </button>
        <button className={aba === 'perfil' ? 'nav-item ativa' : 'nav-item'} onClick={() => setAba('perfil')}>
          Perfil
        </button>
      </nav>
    </div>
  )
}
