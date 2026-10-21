import { useCallback, useEffect, useState } from 'react'
import type { ContaTipo, SolicitacaoReativacao, UsuarioAdmin } from '../api'
import {
  aprovarReativacao,
  criarUsuario,
  definirStatusUsuario,
  listarReativacoes,
  listarUsuarios,
  mensagemDeErro,
  recusarReativacao,
  substituirCodigo,
} from '../api'
import { formatarData } from '../geo'

interface Props {
  token: string
  usuario: { nome: string | null }
  onSair: () => void
}

type Aba = 'usuarios' | 'reativacoes'

const TIPOS: ContaTipo[] = ['motoboy', 'lojista', 'pessoa_fisica']

const LABEL_TIPO: Record<ContaTipo, string> = {
  admin: 'Administrador',
  motoboy: 'Motoboy',
  lojista: 'Lojista',
  pessoa_fisica: 'Pessoa Física',
}

// Painel administrativo conectado à API real (banco de dados compartilhado com o app).
export default function AdminPanel({ token, usuario, onSair }: Props) {
  const [aba, setAba] = useState<Aba>('usuarios')
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([])
  const [pendentes, setPendentes] = useState<SolicitacaoReativacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const [novoNome, setNovoNome] = useState('')
  const [novoTelefone, setNovoTelefone] = useState('')
  const [novoTipo, setNovoTipo] = useState<ContaTipo>('motoboy')
  const [motivos, setMotivos] = useState<Record<string, string>>({})

  const carregar = useCallback(async () => {
    setErro('')
    try {
      const [lista, solicitacoes] = await Promise.all([
        listarUsuarios(token),
        listarReativacoes(token),
      ])
      setUsuarios(lista.filter(u => u.papel !== 'admin'))
      setPendentes(solicitacoes)
    } catch (erro) {
      setErro(mensagemDeErro(erro))
    } finally {
      setCarregando(false)
    }
  }, [token])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function executar(acao: () => Promise<void>): Promise<void> {
    if (ocupado) return
    setOcupado(true)
    setErro('')
    setAviso('')
    try {
      await acao()
    } catch (erro) {
      setErro(mensagemDeErro(erro))
    } finally {
      setOcupado(false)
    }
  }

  function criar(e: React.FormEvent) {
    e.preventDefault()
    const nome = novoNome.trim()
    if (!nome) {
      setErro('Informe o nome do usuário.')
      return
    }
    void executar(async () => {
      const r = await criarUsuario(token, {
        nome,
        tipoConta: novoTipo,
        telefone: novoTelefone.trim() || undefined,
      })
      setAviso(
        `Conta criada. Código de acesso de ${r.usuario.nome}: ${r.codigo} — entregue agora, ele não será mostrado de novo.`,
      )
      setNovoNome('')
      setNovoTelefone('')
      await carregar()
    })
  }

  function trocarCodigo(u: UsuarioAdmin) {
    if (!window.confirm(`Gerar um novo código para ${u.nome}? O código atual deixa de funcionar.`)) {
      return
    }
    void executar(async () => {
      const r = await substituirCodigo(token, u.id)
      setAviso(
        `Novo código de ${r.usuario.nome}: ${r.codigo} — entregue agora, ele não será mostrado de novo.`,
      )
    })
  }

  function alternarStatus(u: UsuarioAdmin) {
    const proximo = !u.ativo
    if (!proximo && !window.confirm(`Desativar a conta de ${u.nome}? O usuário não poderá entrar.`)) {
      return
    }
    void executar(async () => {
      await definirStatusUsuario(token, u.id, proximo)
      await carregar()
    })
  }

  function decidir(s: SolicitacaoReativacao, aprovar: boolean) {
    const motivo = motivos[s.id]?.trim()
    if (!aprovar && motivo && motivo.length > 300) {
      setErro('O motivo da recusa deve ter no máximo 300 caracteres.')
      return
    }
    void executar(async () => {
      if (aprovar) await aprovarReativacao(token, s.id)
      else await recusarReativacao(token, s.id, motivo || undefined)
      setMotivos(m => {
        const copia = { ...m }
        delete copia[s.id]
        return copia
      })
      await carregar()
    })
  }

  return (
    <div className="app">
      <header className="topo">
        <div className="topo-linha">
          <h1>Painel administrativo</h1>
          <span className="papel-badge">Administrador{usuario.nome ? ` · ${usuario.nome}` : ''}</span>
          <button onClick={onSair}>Sair</button>
        </div>
        <nav className="abas">
          <button className={aba === 'usuarios' ? 'aba ativa' : 'aba'} onClick={() => setAba('usuarios')}>
            Usuários
          </button>
          <button
            className={aba === 'reativacoes' ? 'aba ativa' : 'aba'}
            onClick={() => setAba('reativacoes')}
          >
            Reativações
            {pendentes.length > 0 && <span className="alerta">{pendentes.length}</span>}
          </button>
        </nav>
      </header>

      <main>
        {carregando && <p className="dica">Carregando dados do servidor…</p>}
        {!carregando && erro && <p className="erro">{erro}</p>}

        {!carregando && aba === 'usuarios' && (
          <section>
            <h2 className="secao-titulo">Criar conta (sem cadastro público)</h2>
            <form className="linha-form" onSubmit={criar}>
              <input
                placeholder="Nome do usuário"
                value={novoNome}
                onChange={e => setNovoNome(e.target.value)}
              />
              <input
                placeholder="Telefone (opcional)"
                value={novoTelefone}
                onChange={e => setNovoTelefone(e.target.value)}
              />
              <select value={novoTipo} onChange={e => setNovoTipo(e.target.value as ContaTipo)}>
                {TIPOS.map(t => (
                  <option key={t} value={t}>
                    {LABEL_TIPO[t]}
                  </option>
                ))}
              </select>
              <button type="submit" className="primario" disabled={ocupado}>
                Criar conta
              </button>
            </form>
            {aviso && <p className="dica aviso-codigo">{aviso}</p>}

            <h2 className="secao-titulo">Usuários</h2>
            {usuarios.length === 0 && <p className="dica">Nenhuma conta criada ainda.</p>}
            {usuarios.length > 0 && (
              <ul className="lista-usuarios">
                {usuarios.map(u => (
                  <li key={u.id} className="item-usuario">
                    <span className="item-nome">{u.nome ?? '(sem nome)'}</span>
                    <span className="papel-badge pequeno">{LABEL_TIPO[u.papel]}</span>
                    {u.telefone && <span className="dica">{u.telefone}</span>}
                    <span className={u.ativo ? 'status st-entregue' : 'status st-cancelada'}>
                      {u.ativo ? 'Ativa' : 'Desativada'}
                    </span>
                    <span className="item-acoes">
                      <button onClick={() => trocarCodigo(u)} disabled={ocupado}>
                        Substituir código
                      </button>
                      <button
                        className={u.ativo ? 'perigo' : 'primario'}
                        onClick={() => alternarStatus(u)}
                        disabled={ocupado}
                      >
                        {u.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="dica">
              Contas ficam inacessíveis quando desativadas. O usuário perdeu o código? Gere um novo
              aqui (somente o administrador substitui códigos; o código é mostrado uma única vez).
            </p>
          </section>
        )}

        {!carregando && aba === 'reativacoes' && (
          <section>
            <h2 className="secao-titulo">Solicitações pendentes</h2>
            {pendentes.length === 0 && <p className="dica">Nenhuma solicitação pendente.</p>}
            {pendentes.map(s => (
              <div key={s.id} className="item-reativacao">
                <div>
                  <strong>{s.nome ?? '(sem nome)'}</strong> — {LABEL_TIPO[s.papel]} · solicitado em{' '}
                  {formatarData(s.criadoEm)}
                </div>
                <input
                  placeholder="Motivo ao recusar (opcional)"
                  value={motivos[s.id] ?? ''}
                  onChange={e => setMotivos(m => ({ ...m, [s.id]: e.target.value }))}
                />
                <span className="item-acoes">
                  <button
                    className="primario"
                    onClick={() => decidir(s, true)}
                    disabled={ocupado}
                  >
                    Aprovar reativação
                  </button>
                  <button className="perigo" onClick={() => decidir(s, false)} disabled={ocupado}>
                    Recusar solicitação
                  </button>
                </span>
              </div>
            ))}
            <p className="dica">
              Aprovar restaura o acesso na hora. Recusar mantém a conta bloqueada — o usuário pode
              solicitar de novo quando quiser.
            </p>
          </section>
        )}
      </main>

      <footer className="rodape">
        Conectado ao servidor — dados do banco de dados real (compartilhado com o aplicativo).
      </footer>
    </div>
  )
}
