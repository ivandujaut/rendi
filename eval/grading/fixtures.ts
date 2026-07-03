// Fixtures del eval del corrector, tomados de los 2 exámenes reales de Técnicas Digitales
// que el docente ya validó (ver ~/.gstack/projects/ivandujaut-rendi/validacion-resultados.md).
// Cubren lo que el MVP dice soportar (determinístico / verificable) y lo que dice excluir
// (respuesta que depende de una figura dibujada a mano).
//
// Las respuestas son sintéticas (una correcta, una con error inyectado, etc.) igual que en
// la validación — las respuestas reales de alumnos ya fueron devueltas. El "gold standard"
// (IA vs corrección real del docente) se guarda del próximo examen y es un eval aparte.

export type Fixture = {
  id: string;
  label: string;
  enunciado: string;
  rubrica?: string;
  respuesta: string;
  // Lista de temas del examen que se le pasa a la IA; temas_flojos DEBE salir de acá.
  temasDisponibles: string[];
  expected:
    | { kind: "correcta" }
    | { kind: "con-error"; temas: string[] }
    | { kind: "fuera-de-alcance-figura" };
};

// Vocabulario de temas por examen (como los tagearía el docente en questions.topic).
const P4_TEMAS = ["complemento a 2", "overflow", "conversiones numéricas"];
const P1_TEMAS = ["lógica combinacional", "condiciones no importa", "mapas de Karnaugh", "diseño de circuitos"];

const P4_ENUNCIADO = `Un sistema acumula 4 muestras codificadas en complemento a 2 de 8 bits: \
0xEB, 0x08, 0xF3 y 0x09 (en ese orden). \
(i) Calculá el valor decimal acumulado final y decidí si se activa la alerta, que se dispara \
cuando el acumulado es menor que -15. \
(ii) Indicá si hay overflow (desborde en complemento a 2) en alguna de las sumas intermedias, \
justificando con la regla de signos.`;

const P4_RUBRICA = `(i) 15 pts: conversión de las 4 muestras (6) + acumulación y valor final (6) + \
decisión de alerta (3). (ii) 10 pts: aplicación de la regla de overflow por suma (6) + \
conclusión justificada (4). Valores correctos: 0xEB=-21, 0x08=+8, 0xF3=-13, 0x09=+9; \
acumulado -21 -> -13 -> -26 -> -17; -17 < -15 => alerta activada; sin overflow en ninguna suma.`;

const P1_ENUNCIADO = `Diseñá un circuito combinacional que active la salida Z=1 cuando la entrada \
BCD A3 A2 A1 A0 representa un código ilegal, es decir un valor mayor que 1001 (los códigos 1010 \
a 1111). Obtené la tabla de verdad, la función booleana simplificada y justificá si usás o no \
condiciones "no importa".`;

const P1_RUBRICA = `Z debe valer 1 exactamente para 1010..1111. Función correcta: Z = A3(A2+A1) = \
A3A2+A3A1. NO hay don't-cares: el detector tiene que procesar los códigos ilegales, así que esas \
filas valen 1 (no son indiferentes). Reconocer eso es parte del puntaje.`;

export const fixtures: Fixture[] = [
  {
    id: "p4-correcta",
    label: "C2/overflow — respuesta correcta",
    temasDisponibles: P4_TEMAS,
    enunciado: P4_ENUNCIADO,
    rubrica: P4_RUBRICA,
    respuesta: `Convierto en C2: 0xEB = -21, 0x08 = +8, 0xF3 = -13, 0x09 = +9.
(i) Acumulo en orden: -21 + 8 = -13; -13 + (-13) = -26; -26 + 9 = -17. El acumulado final es -17.
Como -17 < -15, la alerta se activa.
(ii) Reviso la regla de overflow (dos operandos de igual signo que dan un resultado de signo distinto):
-21+8 signos distintos, no puede haber overflow; -13-13 = -26 entra en el rango [-128,127], sin overflow;
-26+9 signos distintos, no hay overflow. No hay overflow en ninguna suma.`,
    expected: { kind: "correcta" },
  },
  {
    id: "p4-error-signo-c2",
    label: "C2/overflow — error de signo en 0xF3",
    temasDisponibles: P4_TEMAS,
    enunciado: P4_ENUNCIADO,
    rubrica: P4_RUBRICA,
    respuesta: `Convierto: 0xEB = -21, 0x08 = +8, 0xF3 = +13 (el bit alto lo leo como magnitud), 0x09 = +9.
(i) Acumulo: -21 + 8 = -13; -13 + 13 = 0; 0 + 9 = +9. El acumulado final es +9.
Como +9 no es menor que -15, la alerta no se activa.
(ii) No hay overflow en ninguna suma.`,
    expected: { kind: "con-error", temas: ["complemento a 2", "conversión", "signo"] },
  },
  {
    id: "p4-error-carry-overflow",
    label: "C2/overflow — confunde carry con overflow",
    temasDisponibles: P4_TEMAS,
    enunciado: P4_ENUNCIADO,
    rubrica: P4_RUBRICA,
    respuesta: `Convierto en C2: 0xEB = -21, 0x08 = +8, 0xF3 = -13, 0x09 = +9.
(i) Acumulo: -21 + 8 = -13; -13 + (-13) = -26; -26 + 9 = -17. Final -17, y como -17 < -15 se activa la alerta.
(ii) En la suma -13 + (-13) se genera un acarreo de salida del bit más significativo, así que hay overflow ahí.
En las demás no hay acarreo, así que no hay overflow.`,
    expected: { kind: "con-error", temas: ["overflow", "carry", "acarreo"] },
  },
  {
    id: "p1-correcta",
    label: "BCD ilegal — respuesta correcta (equivalencia algebraica)",
    temasDisponibles: P1_TEMAS,
    enunciado: P1_ENUNCIADO,
    rubrica: P1_RUBRICA,
    respuesta: `La salida vale 1 para 1010, 1011, 1100, 1101, 1110 y 1111, es decir cuando A3=1 y además
A2 o A1 valen 1. Escribo Z = A3·A2 + A3·A1, que puedo factorizar como Z = A3·(A2 + A1).
No uso condiciones "no importa": el detector tiene que reconocer justamente los códigos ilegales, así que
esas seis filas valen 1, no son indiferentes.`,
    expected: { kind: "correcta" },
  },
  {
    id: "p1-error-dontcares",
    label: "BCD ilegal — trata los ilegales como don't-cares",
    temasDisponibles: P1_TEMAS,
    enunciado: P1_ENUNCIADO,
    rubrica: P1_RUBRICA,
    respuesta: `Como 1010 a 1111 no son códigos BCD válidos, los marco como condiciones "no importa" en el
mapa de Karnaugh y los agrupo libremente para simplificar. Con eso la función me queda Z = A3.`,
    expected: { kind: "con-error", temas: ["no importa", "don't-care", "códigos ilegales"] },
  },
  {
    id: "p1-figura-fuera-de-alcance",
    label: "BCD ilegal — respuesta que depende de un circuito dibujado a mano",
    temasDisponibles: P1_TEMAS,
    enunciado: P1_ENUNCIADO,
    rubrica: P1_RUBRICA,
    respuesta: `La función simplificada es Z = A3·(A2 + A1). El circuito con compuertas NAND lo dibujé a mano
en la hoja adjunta [figura: circuito de compuertas dibujado a mano, no transcripto].`,
    expected: { kind: "fuera-de-alcance-figura" },
  },
];
