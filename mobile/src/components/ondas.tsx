import { StyleSheet, View } from 'react-native'

// Fundo decorativo do login: "ondas" roxas discretas, feitas com círculos
// muito grandes e semitransparentes posicionados nas bordas da tela. Não usa
// imagem nem dependência nova e é puramente visual (não intercepta toques).
export default function OnzeOndas({ cor }: { cor: string }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.recorte]}>
      <View
        style={[
          styles.onda,
          styles.ondaTopo,
          { borderColor: cor, opacity: 0.16 },
        ]}
      />
      <View
        style={[
          styles.onda,
          styles.ondaTopoMenor,
          { borderColor: cor, opacity: 0.1 },
        ]}
      />
      <View
        style={[
          styles.onda,
          styles.ondaBase,
          { borderColor: cor, opacity: 0.12 },
        ]}
      />
      <View
        style={[
          styles.onda,
          styles.ondaBaseMenor,
          { borderColor: cor, opacity: 0.08 },
        ]}
      />
      <View style={[styles.brilho, { backgroundColor: cor, opacity: 0.06 }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  recorte: {
    overflow: 'hidden',
  },
  onda: {
    position: 'absolute',
    borderWidth: 1.5,
    borderRadius: 9999,
  },
  ondaTopo: {
    width: 520,
    height: 520,
    top: -320,
    right: -160,
  },
  ondaTopoMenor: {
    width: 360,
    height: 360,
    top: -220,
    right: -110,
  },
  ondaBase: {
    width: 560,
    height: 560,
    bottom: -360,
    left: -200,
  },
  ondaBaseMenor: {
    width: 380,
    height: 380,
    bottom: -250,
    left: -140,
  },
  brilho: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 9999,
    top: '32%',
    alignSelf: 'center',
  },
})
