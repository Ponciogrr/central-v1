import { useState } from 'react'
import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native'
import { useTema } from '@/theme'

interface Props {
  rotulo: string
  valor: string
  onChange: (texto: string) => void
  placeholder?: string
  secure?: boolean
  keyboardType?: KeyboardTypeOptions
  autoCapitalize?: 'none' | 'sentences' | 'characters' | 'words'
}

export default function Campo({
  rotulo,
  valor,
  onChange,
  placeholder,
  secure,
  keyboardType,
  autoCapitalize,
}: Props) {
  const { cores } = useTema()
  const [focado, setFocado] = useState(false)
  return (
    <View style={styles.wrap}>
      <Text style={[styles.rotulo, { color: cores.textoSuave }]}>{rotulo}</Text>
      <TextInput
        value={valor}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={cores.textoSuave}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        onFocus={() => setFocado(true)}
        onBlur={() => setFocado(false)}
        style={[
          styles.input,
          {
            backgroundColor: cores.superficie2,
            borderColor: focado ? cores.acao : cores.borda,
            color: cores.texto,
          },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  rotulo: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
    fontSize: 16,
    width: '100%',
    minWidth: 0,
  },
})
