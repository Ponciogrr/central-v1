// Confirmação de ação destrutiva (cancelar, desativar, liberar bloqueio).
//
// Um único lugar para perguntar "tem certeza?" — antes cada tela repetia o
// próprio `confirmar` (3 cópias). Na web usa a caixa do navegador; no celular
// usa o diálogo nativo.

import { Alert, Platform } from 'react-native'

interface Opcoes {
  rotuloConfirmar?: string
  rotuloCancelar?: string
  // 'perigo' deixa o botão de confirmação em destaque destrutivo.
  perigo?: boolean
}

export function confirmar(
  titulo: string,
  mensagem: string,
  opcoes: Opcoes = {},
): Promise<boolean> {
  const rotuloConfirmar = opcoes.rotuloConfirmar ?? 'Confirmar'
  const rotuloCancelar = opcoes.rotuloCancelar ?? 'Voltar'

  if (Platform.OS === 'web') {
    const ok =
      typeof window !== 'undefined'
        ? window.confirm(`${titulo}\n\n${mensagem}`)
        : false
    return Promise.resolve(ok)
  }

  return new Promise(resolve => {
    Alert.alert(titulo, mensagem, [
      { text: rotuloCancelar, style: 'cancel', onPress: () => resolve(false) },
      {
        text: rotuloConfirmar,
        style: opcoes.perigo ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ])
  })
}
