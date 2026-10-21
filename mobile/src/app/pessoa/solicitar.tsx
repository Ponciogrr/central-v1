import { Stack } from 'expo-router'
import FormularioSolicitar from '@/components/formulario-solicitar'

export default function SolicitarPessoa() {
  return (
    <>
      <Stack.Screen options={{ title: 'Solicitar entrega' }} />
      <FormularioSolicitar />
    </>
  )
}
