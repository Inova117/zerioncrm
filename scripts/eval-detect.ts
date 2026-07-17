// ============================================================================
// Eval harness del Copilot — mide la precisión de la capa instantánea
// (battlecards + momentos) contra casos etiquetados del habla real.
//
//   npm run eval:copilot
//
// Es el control de calidad ANTES de las llamadas reales y la red de seguridad
// al editar triggers: si un regex se rompe o se vuelve demasiado codicioso,
// esto lo caza en segundos. Salida: precisión por categoría + fallos exactos.
// Sale con código 1 si algo falla (sirve de gate en CI).
// ============================================================================
import { detectObjection, detectMoment } from '../src/data/salesPlaybook';

type ObjCase = [text: string, expected: string | null];
type MomCase = [text: string, expected: string | null];

// --- Objeciones: variantes del habla real (expected = id de battlecard) -----
const OBJ_CASES: ObjCase[] = [
  // caro / plata
  ['uy no eso esta muy caro', 'caro'],
  ['esta carisimo eso', 'caro'],
  ['chuta esta carito', 'caro'],
  ['es mucha plata de una', 'caro'],
  ['no tengo plata ahorita', 'caro'],
  ['eso ha de costar un ojo de la cara', 'caro'],
  // regateo
  ['hagame un descuentito pues', 'regateo'],
  ['en cuanto me lo deja', 'regateo'],
  ['ese es el ultimo precio o hay rebaja', 'regateo'],
  // sobrino / familiar
  ['mi sobrino me la esta haciendo', 'sobrino'],
  ['tengo un pana que me ayuda con eso', 'sobrino'],
  ['ya tengo quien me lo haga', 'sobrino'],
  ['mi hijo sabe de esas cosas', 'sobrino'],
  // ya tengo página
  ['ya tenemos pagina hace anos', 'ya-tengo-pagina'],
  ['si tenemos web ahi esta la pagina', 'ya-tengo-pagina'],
  // redes
  ['con el facebook me va bien', 'facebook'],
  ['puro whatsapp trabajo yo', 'facebook'],
  ['la gente me escribe por el insta', 'facebook'],
  // mándame info
  ['mandame la informacion por whatsapp', 'mandame-info'],
  ['pasame la info y yo te aviso', 'mandame-info'],
  ['mandeme una proforma mejor', 'mandame-info'],
  // sin tiempo
  ['estoy ocupado llamame luego', 'no-tiempo'],
  ['ando full ahorita estoy atendiendo', 'no-tiempo'],
  ['estoy con un cliente ahorita no puedo', 'no-tiempo'],
  // pensarlo
  ['dejame pensarlo y yo le aviso', 'pensarlo'],
  ['lo voy a pensar con calma', 'pensarlo'],
  // consultar
  ['tengo que hablar con mi esposa primero', 'consultar'],
  ['eso lo ve mi socio no decido yo solo', 'consultar'],
  ['lo converso en casa y le aviso', 'consultar'],
  // desconfianza
  ['no sera estafa esto', 'desconfianza'],
  ['a mi ya me estafaron con eso mismo', 'desconfianza'],
  ['no los conozco de donde me llama', 'desconfianza'],
  // ventas flojas
  ['las ventas estan flojas este mes', 'ventas-flojas'],
  ['esta dura la situacion apenas sobreviviendo', 'ventas-flojas'],
  // recomendación
  ['a mi me llegan por recomendacion nomas', 'recomendacion'],
  ['aqui todo es de boca en boca', 'recomendacion'],
  ['mis clientes ya me conocen no necesito publicidad', 'recomendacion'],
  // más barato
  ['el otro me cobraba menos', 'mas-barato'],
  ['un muchacho me lo hace a mitad de precio', 'mas-barato'],
  // no interesa
  ['no me interesa gracias', 'no-interesa'],
  ['no gracias asi estamos bien', 'no-interesa'],
  // preguntas trampa
  ['me garantiza que salgo primero en google', 'garantia-google'],
  ['y en cuanto tiempo aparezco en google', 'tiempo-google'],
  ['el dominio queda a mi nombre o de ustedes', 'dominio-mio'],
  ['y si dejo de pagar el mensual me la quitan', 'dejo-de-pagar'],
  ['eso de las automatizaciones que es', 'automatizacion'],
  ['yo no entiendo nada de computadoras quien la maneja despues', 'no-entiendo-computadoras'],
  ['me consiguen seguidores tambien o solo la pagina', 'redes-seguidores'],
  ['eso suena muy robot a mi gente le gusta hablar con personas', 'suena-robot'],
  // dinero / cierre
  ['mejor empiece y yo le voy pagando', 'fiado'],
  ['dejeme ver mi semana y yo le escribo', 'yo-le-aviso'],
  ['uy verdad era hoy se me olvido por completo', 'planton'],
  // --- NEGATIVOS: no deben disparar nada -----------------------------------
  ['mi hija carolina esta de vacaciones', null],
  ['vendemos caramelos y chocolates', null],
  ['el local queda por la avenida principal', null],
  ['claro que si con mucho gusto', null],
];

// --- Momentos (expected = id de momento) ------------------------------------
const MOM_CASES: MomCase[] = [
  ['cuanto cuesta eso', 'senal-compra'],
  ['que incluye el servicio', 'senal-compra'],
  ['tienen ejemplos de trabajos hechos', 'senal-compra'],
  ['ya pues hagamoslo', 'cierre'],
  ['si me interesa mandeme eso', 'cierre'],
  ['como le pago entonces', 'cierre'],
  ['de parte de quien', 'gatekeeper'],
  ['no se encuentra el dueno', 'gatekeeper'],
  ['dejeme su numero y el le devuelve la llamada', 'gatekeeper'],
  ['te dejo tengo que colgar', 'peligro'],
  ['ya le dije que no deje de llamar', 'peligro'],
  ['hay descuento si pago de una', 'precio'],
  ['se puede pagar en cuotas', 'precio'],
  ['y ustedes que hacen exactamente', 'pitch'],
  ['a ver expliqueme como funciona eso', 'pitch'],
  ['ya pues digame de que se trata', 'pitch'],
  ['ya digame rapidito que necesita', 'pitch'],
  ['puro boca a boca me llegan los clientes', 'descubrimiento'],
  ['el whatsapp lo contesto yo cuando puedo', 'descubrimiento'],
  ['quien habla', 'apertura'],
  ['si con el mismo', 'apertura'],
  ['gracias por llamar que este bien', 'despedida'],
  ['no me interesa nada de eso', 'objecion'],
  // negativos
  ['aja', null],
  ['mmm ya veo', null],
];

let pass = 0;
let fail = 0;
const failures: string[] = [];

for (const [text, expected] of OBJ_CASES) {
  const got = detectObjection(text)?.id ?? null;
  if (got === expected) pass++;
  else {
    fail++;
    failures.push(`[objeción] "${text}" → ${got ?? '∅'} (esperado ${expected ?? '∅'})`);
  }
}
for (const [text, expected] of MOM_CASES) {
  const got = detectMoment(text)?.id ?? null;
  if (got === expected) pass++;
  else {
    fail++;
    failures.push(`[momento]  "${text}" → ${got ?? '∅'} (esperado ${expected ?? '∅'})`);
  }
}

const total = pass + fail;
console.log(`\nEval del detector instantáneo: ${pass}/${total} (${((pass / total) * 100).toFixed(1)}%)`);
if (failures.length) {
  console.log('\nFALLOS:');
  for (const f of failures) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('Todo verde ✓\n');
