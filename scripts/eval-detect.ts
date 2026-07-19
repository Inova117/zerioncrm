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
import { detectObjection, detectMoment, detectHora } from '../src/data/salesPlaybook';

type ObjCase = [text: string, expected: string | null];
type MomCase = [text: string, expected: string | null];
type HoraCase = [text: string, expected: boolean];

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
  // regresiones de la auditoría (jul 2026): sombras entre cards y variantes
  ['ya tengo mi pagina web', 'ya-tengo-pagina'],
  ['tampoco me interesa eso', 'no-interesa'],
  ['cualquier cosa yo le aviso', 'yo-le-aviso'],
  ['listo entonces yo le llamo', 'yo-le-aviso'],
  // card nueva de la auditoría Hormozi (jul 2026): extrapola el fracaso pasado
  ['ya pague publicidad en facebook y no me sirvio de nada', 'ya-intente'],
  ['ya intente con una pagina y no me funciono', 'ya-intente'],
  ['puse plata en anuncios y nada', 'ya-intente'],
  // cards nuevas del Playbook Web Local v1.1 (demo-first)
  ['y que mensualidad me van a sacar despues', 'mensualidad-oculta'],
  ['con que derecho usaron mis fotos', 'mis-fotos'],
  ['yo no pedi nada de eso', 'mis-fotos'],
  ['otra empresa me la ofrecieron gratis', 'gratis-permanencia'],
  ['como consiguio mi numero', 'mi-numero'],
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
  // regresiones de la auditoría (jul 2026): el momento CIERRE (prioridad 97)
  // secuestraba objeciones — un "de acuerdo pero…" NO es un sí.
  ['si de acuerdo pero esta muy caro', 'precio'],
  ['de acuerdo hagamoslo asi', 'cierre'],
  ['tampoco me interesa senor', 'objecion'],
  ['ya tengo mi pagina web', 'objecion'],
  ['cuanto es lo menos que me deja', 'precio'],
  ['cuanto es la mensualidad', 'senal-compra'],
  ['le pago cuando la vea funcionando', 'senal-compra'],
  ['ya pues lo voy a pensar', 'objecion'],
  ['me parece bien pero dejeme pensarlo', 'objecion'],
  ['cuando estaria lista mi pagina', 'cierre'],
  [' alo buenas', 'apertura'],
  ['yo le aviso que llamo mas tarde', 'gatekeeper'],
  // negativos
  ['aja', null],
  ['mmm ya veo', null],
  ['en que le puedo ayudar', null],
];

// --- Hora de lectura amarrada (el test de compromiso del T1) ----------------
const HORA_CASES: HoraCase[] = [
  ['la veo en la noche', true],
  ['ahorita no puedo pero la reviso como a las 8', true],
  ['como a las 8 esta bien', true],
  ['en la noche puede ser', true],
  ['a las ocho la reviso', true],
  ['si a las 8', true],
  // negativos: la evasiva clásica NO cuenta como hora amarrada
  ['cualquier cosa yo le aviso en la noche', false],
  ['manana le aviso', false],
  ['yo le aviso', false],
  ['abrimos a las 8 de la manana', false],
  ['no tengo tiempo ahorita', false],
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
for (const [text, expected] of HORA_CASES) {
  const got = detectHora(text);
  if (got === expected) pass++;
  else {
    fail++;
    failures.push(`[hora]     "${text}" → ${got} (esperado ${expected})`);
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
