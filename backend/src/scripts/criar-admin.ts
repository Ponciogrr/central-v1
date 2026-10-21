// Comando local para criar o PRIMEIRO administrador.
// Uso: `npm run admin:create -- --nome "Fulano" --telefone "+55..."` (dados opcionais).
// O código gerado aparece UMA única vez no terminal e não é gravado em lugar nenhum.

import { gerarCodigo, identificadorDoCodigo } from '../auth/codigo.ts'
import { criarUsuario, existeAdministrador } from '../auth/usuarios.ts'
import { env } from '../config/env.ts'
import { obterPool } from '../db/pool.ts'

function argumento(nome: string): string | null {
  const indice = process.argv.indexOf(`--${nome}`)
  if (indice === -1) return null
  const valor = process.argv[indice + 1]
  return valor && !valor.startsWith('--') ? valor : null
}

async function principal(): Promise<void> {
  if (!env.databaseUrl && !env.directUrl) {
    console.error(
      'Nenhuma conexão configurada. Defina DATABASE_URL no arquivo backend/.env antes de criar o administrador.',
    )
    process.exitCode = 1
    return
  }
  if (!env.codeHmacKey) {
    console.error(
      'CODE_HMAC_KEY não configurada no backend/.env — necessária para gerar o identificador do código.',
    )
    process.exitCode = 1
    return
  }

  const nome = argumento('nome')
  const telefone = argumento('telefone')

  const pool = obterPool()
  try {
    let jaExiste: boolean
    try {
      jaExiste = await existeAdministrador()
    } catch {
      console.error(
        'Não foi possível consultar o banco. Confirme que o banco está acessível e que as migrações foram aplicadas (`npm run migrate`). Nada foi gravado.',
      )
      process.exitCode = 1
      return
    }

    if (jaExiste) {
      console.error('Já existe um administrador. Este comando cria apenas o PRIMEIRO administrador. Nada foi gravado.')
      process.exitCode = 1
      return
    }

    const codigo = gerarCodigo()
    const criado = await criarUsuario({
      nome,
      telefone,
      papel: 'admin',
      accessCodeHash: identificadorDoCodigo(codigo),
    })

    console.log('Administrador criado com sucesso.')
    console.log(`ID: ${criado.id}`)
    console.log('')
    console.log('CÓDIGO DE ACESSO (aparece UMA única vez — guarde em local seguro):')
    console.log('')
    console.log(`    ${codigo}`)
    console.log('')
    console.log(
      'Quem tiver este código poderá entrar como administrador. Não o compartilhe nem o registre em arquivos/logs.',
    )
  } finally {
    await pool.end()
  }
}

principal().catch((erro: unknown) => {
  console.error('Falha ao criar o administrador:', erro instanceof Error ? erro.message : erro)
  process.exitCode = 1
})
