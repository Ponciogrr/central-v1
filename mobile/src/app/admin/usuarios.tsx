import { router } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import {
  ErroApi,
  criarUsuarioAdmin,
  listarUsuariosAdmin,
  mensagemDeErro,
  statusUsuarioAdmin,
  substituirCodigoAdmin,
  type Papel,
  type ResultadoCodigoAdmin,
  type TipoContaCriavel,
  type UsuarioAdminApi,
} from '@/api/cliente'
import Botao from '@/components/botao'
import Campo from '@/components/campo'
import { useSessao } from '@/sessao'
import { useTema } from '@/theme'

const ROTULO_PAPEL: Record<Papel, string> = {
  admin: 'Administrador',
  motoboy: 'Motoboy',
  lojista: 'Lojista',
  pessoa_fisica: 'Pessoa física',
}

const TIPOS: { valor: TipoContaCriavel; rotulo: string }[] = [
  { valor: 'motoboy', rotulo: 'Motoboy' },
  { valor: 'lojista', rotulo: 'Lojista' },
  { valor: 'pessoa_fisica', rotulo: 'Pessoa física' },
]

const LIMITE = 50

export default function AdminUsuarios() {
  const { cores } = useTema()
  const { token, usuario } = useSessao()

  const [usuarios, setUsuarios] = useState<UsuarioAdminApi[]>([])
  const [total, setTotal] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [codigoPendente, setCodigoPendente] = useState<ResultadoCodigoAdmin | null>(null)
  const [acaoId, setAcaoId] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [tipoConta, setTipoConta] = useState<TipoContaCriavel>('motoboy')
  const [criando, setCriando] = useState(false)

  const carregar = useCallback(
    async (deslocamento: number) => {
      if (!token) return
      setErro('')
      try {
        const resposta = await listarUsuariosAdmin(token, { limite: LIMITE, deslocamento })
        setTotal(resposta.total)
        setUsuarios(atuais => (deslocamento === 0 ? resposta.usuarios : [...atuais, ...resposta.usuarios]))
      } catch (falha) {
        setErro(mensagemDeErro(falha))
      } finally {
        setCarregando(false)
      }
    },
    [token],
  )

  useEffect(() => {
    carregar(0)
  }, [carregar])

  async function aoCriar() {
    if (!token || criando) return
    setErro('')
    setAviso('')
    if (!nome.trim() || !telefone.trim()) {
      setErro('Informe nome e telefone do usuário.')
      return
    }
    setCriando(true)
    try {
      const resultado = await criarUsuarioAdmin(token, {
        nome: nome.trim(),
        telefone: telefone.trim(),
        tipoConta,
      })
      setCodigoPendente(resultado)
      setNome('')
      setTelefone('')
      await carregar(0)
    } catch (falha) {
      setErro(mensagemDeErro(falha))
    } finally {
      setCriando(false)
    }
  }

  async function aoAlternarStatus(alvo: UsuarioAdminApi) {
    if (!token || acaoId) return
    setErro('')
    setAviso('')
    setAcaoId(alvo.id)
    try {
      await statusUsuarioAdmin(token, alvo.id, !alvo.ativo)
      setUsuarios(atuais => atuais.map(u => (u.id === alvo.id ? { ...u, ativo: !alvo.ativo } : u)))
      setAviso(
        alvo.ativo
          ? `Conta de ${alvo.nome ?? 'usuário'} desativada.`
          : `Conta de ${alvo.nome ?? 'usuário'} ativada.`,
      )
    } catch (falha) {
      setErro(mensagemDeErro(falha))
    } finally {
      setAcaoId(null)
    }
  }

  async function aoSubstituirCodigo(alvo: UsuarioAdminApi) {
    if (!token || acaoId) return
    setErro('')
    setAviso('')
    setAcaoId(alvo.id)
    try {
      const resultado = await substituirCodigoAdmin(token, alvo.id)
      setCodigoPendente(resultado)
    } catch (falha) {
      setErro(mensagemDeErro(falha))
    } finally {
      setAcaoId(null)
    }
  }

  const jaMostrouTudo = usuarios.length >= total

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: cores.fundo }}
      contentContainerStyle={styles.conteudo}
      keyboardShouldPersistTaps="handled"
    >
      {codigoPendente ? (
        <View
          style={[
            styles.cartaoCodigo,
            { backgroundColor: cores.superficie, borderColor: cores.acao },
          ]}
        >
          <Text style={[styles.cartaoCodigoTitulo, { color: cores.texto }]}>
            {codigoPendente.usuario.nome ?? 'Usuário'} — novo código de acesso
          </Text>
          <Text selectable style={[styles.codigo, { color: cores.acao }]}>
            {codigoPendente.codigo}
          </Text>
          <Text style={[styles.cartaoCodigoTexto, { color: cores.textoSuave }]}>
            {codigoPendente.aviso} Copie agora e guarde em local seguro.
          </Text>
          <Botao rotulo="Entendi (fechar)" tipo="secundario" onPress={() => setCodigoPendente(null)} />
        </View>
      ) : null}

      <View style={[styles.bloco, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
        <Text style={[styles.blocoTitulo, { color: cores.texto }]}>Criar usuário</Text>
        <Text style={[styles.blocoSub, { color: cores.textoSuave }]}>
          Não existe cadastro público: o administrador cria a conta e entrega o código (mostrado
          uma única vez).
        </Text>

        <Campo rotulo="Nome" valor={nome} onChange={setNome} placeholder="Nome completo" />
        <Campo
          rotulo="Telefone"
          valor={telefone}
          onChange={setTelefone}
          placeholder="(00) 00000-0000"
          autoCapitalize="none"
        />

        <Text style={[styles.rotuloGrupo, { color: cores.textoSuave }]}>Tipo de conta</Text>
        <View style={styles.tipoLinha}>
          {TIPOS.map(t => {
            const selecionado = tipoConta === t.valor
            return (
              <Pressable
                key={t.valor}
                onPress={() => setTipoConta(t.valor)}
                accessibilityRole="button"
                style={[
                  styles.tipoOpcao,
                  {
                    backgroundColor: selecionado ? cores.acao : cores.superficie2,
                    borderColor: selecionado ? cores.acao : cores.borda,
                  },
                ]}
              >
                <Text
                  style={[styles.tipoOpcaoTexto, { color: selecionado ? cores.acaoTexto : cores.texto }]}
                >
                  {t.rotulo}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <Botao
          rotulo={criando ? 'Criando…' : 'Criar usuário'}
          onPress={aoCriar}
          disabled={criando}
        />
      </View>

      {erro ? <Text style={[styles.mensagem, { color: cores.perigo }]}>{erro}</Text> : null}
      {aviso ? <Text style={[styles.mensagem, { color: cores.textoSuave }]}>{aviso}</Text> : null}

      <View style={[styles.bloco, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
        <Text style={[styles.blocoTitulo, { color: cores.texto }]}>
          Usuários {total > 0 ? `(${total})` : ''}
        </Text>

        {carregando ? (
          <Text style={[styles.vazioTexto, { color: cores.textoSuave }]}>Carregando…</Text>
        ) : usuarios.length === 0 ? (
          <Text style={[styles.vazioTexto, { color: cores.textoSuave }]}>Nenhum usuário.</Text>
        ) : (
          usuarios.map(u => (
            <View
              key={u.id}
              style={[styles.item, { borderColor: cores.borda }]}
            >
              <View style={styles.itemTopo}>
                <Text style={[styles.itemNome, { color: cores.texto }]} numberOfLines={2}>
                  {u.nome ?? '(sem nome)'}
                </Text>
                <View
                  style={[
                    styles.selo,
                    {
                      backgroundColor: u.ativo ? cores.superficie2 : cores.perigo,
                      borderColor: u.ativo ? cores.borda : cores.perigo,
                    },
                  ]}
                >
                  <Text
                    style={[styles.seloTexto, { color: u.ativo ? cores.textoSuave : cores.acaoTexto }]}
                  >
                    {u.ativo ? 'Ativa' : 'Desativada'}
                  </Text>
                </View>
              </View>
              <Text style={[styles.itemDetalhe, { color: cores.textoSuave }]}>
                {ROTULO_PAPEL[u.papel]}
                {u.telefone ? ` · ${u.telefone}` : ''}
                {u.id === usuario?.id ? ' · você' : ''}
              </Text>
              <View style={styles.itemAcoes}>
                <Botao
                  rotulo={acaoId === u.id ? '…' : u.ativo ? 'Desativar' : 'Ativar'}
                  tipo={u.ativo ? 'perigo' : 'secundario'}
                  onPress={() => aoAlternarStatus(u)}
                  disabled={acaoId !== null || u.id === usuario?.id}
                />
                <Botao
                  rotulo="Novo código"
                  tipo="secundario"
                  onPress={() => aoSubstituirCodigo(u)}
                  disabled={acaoId !== null}
                />
              </View>
            </View>
          ))
        )}

        {!jaMostrouTudo && !carregando && usuarios.length > 0 ? (
          <Botao
            rotulo="Carregar mais"
            tipo="secundario"
            onPress={() => carregar(usuarios.length)}
          />
        ) : null}
      </View>
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
    gap: 12,
  },
  blocoTitulo: {
    fontSize: 16,
    fontWeight: '700',
  },
  blocoSub: {
    fontSize: 12,
    lineHeight: 18,
  },
  rotuloGrupo: {
    fontSize: 12,
    fontWeight: '700',
  },
  tipoLinha: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tipoOpcao: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  tipoOpcaoTexto: {
    fontSize: 14,
    fontWeight: '700',
  },
  mensagem: {
    fontSize: 14,
    lineHeight: 19,
  },
  item: {
    borderTopWidth: 1,
    paddingVertical: 12,
    gap: 8,
  },
  itemTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemNome: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  selo: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  seloTexto: {
    fontSize: 12,
    fontWeight: '700',
  },
  itemDetalhe: {
    fontSize: 12,
  },
  itemAcoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vazioTexto: {
    fontSize: 14,
    paddingVertical: 8,
  },
  cartaoCodigo: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  cartaoCodigoTitulo: {
    fontSize: 14,
    fontWeight: '700',
  },
  codigo: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
  },
  cartaoCodigoTexto: {
    fontSize: 12,
    lineHeight: 18,
  },
})
