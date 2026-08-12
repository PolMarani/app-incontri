# BlindStep — motore di coordinamento e matchmaking

Incontri al buio, di persona, subito. Nessuna chat fra gli utenti: l'app abbina
due persone, negozia un posto neutro, consegna una scheda con luogo, ora, codice
di riconoscimento e carte per rompere il ghiaccio, e resta accanto a entrambi
prima, durante e dopo la serata.

Questo repository contiene il **motore**: la logica delle sei fasi, senza
interfaccia e senza database. Nessuna dipendenza esterna, gira con Node 22+.

```bash
npm test     # 135 test
npm run demo # flusso completo stampato a schermo
```

## I principi, tradotti in codice

| Principio | Dove vive | Cosa significa concretamente |
|---|---|---|
| Zero chat | `phase4-safety.js` | Il canale di supporto porta all'assistente o a un operatore, **mai** all'altra persona. Non esiste nessuna funzione che scriva da un utente all'altro. Il compagno di Fase 5 sta al tavolo con entrambi, non fa da tramite fra i due. |
| Obbligo di incontro | `phase1-compatibility.js` | Se non esiste una sera libera in comune o un posto equo raggiungibile, il match viene **scartato**: senza chat non c'e' un ripiego in cui parcheggiarlo. |
| Posizione neutra | `phase2-location.js` | Tre opzioni pubbliche a meta' strada, presentate in forma anonima; la scelta e' un voto incrociato, non una trattativa. |
| Icebreaker dedicati | `phase3-eventcard.js` | Carte generate dai profili della coppia, con un filtro che vieta le domande da colloquio. La Fase 5 le gioca al momento giusto invece di lasciarle in una lista. |

## Le sei fasi

### Fase 1 — Valutazione del match

Due livelli. Prima i **gate**: nessuna finestra comune di almeno 90 minuti, aree
di spostamento disgiunte, punto a meta' strada fuori portata, vibe
inconciliabili, dealbreaker dichiarati. Se uno salta, il match e' chiuso.

Poi il **punteggio pesato**:

| Dimensione | Peso | Vale 1 quando |
|---|---|---|
| Disponibilita' | 0.22 | c'e' una serata piena in comune (3h) |
| Geografia | 0.18 | il punto a meta' strada e' comodo per entrambi |
| Vibe | 0.20 | la prima scelta di uno e' la prima scelta dell'altro |
| Interessi | 0.22 | ci sono due argomenti veri in comune |
| Valori | 0.12 | i valori dichiarati coincidono |
| Spark | 0.06 | c'e' circa il 55% di divergenza: abbastanza per discutere |

Sopra l'80% si passa alla Fase 2.

Due scelte di calibrazione che vale la pena spiegare:

- **Ogni dimensione vale 1 quando la condizione e' "chiaramente buona", non
  quando e' massima.** Serve una sera libera, non otto; servono due argomenti,
  non dieci. Con una scala tarata sul massimo teorico nessuna coppia reale
  supererebbe l'80% e la soglia diventerebbe decorativa.
- **Gli interessi contano per forza dei legami, non per percentuale di profilo
  coperta.** Gli accoppiamenti sono greedy e ogni tag si usa una volta sola: chi
  scrive "techno, jazz, vinili, concerti" ha *un* argomento in comune con chi
  scrive "opera", non quattro. La parte di profilo che non si sovrappone e' gia'
  valutata da `spark`, contarla due volte punirebbe chi ha interessi propri.

### Fase 2 — Negoziazione "double blind"

Il motore cerca locali **pubblici, presidiati e illuminati** (`safetyScore`
minimo 0.6) aperti nella finestra comune, raggiungibili da entrambi e coerenti
con i vincoli dichiarati (niente alcolici, accessibilita', silenzio, aperto).
Li ordina per equita', vibe, sicurezza e lunghezza del tragitto, e ne presenta
tre.

La regola di riservatezza che governa tutta la fase: **nessuno dei due puo'
dedurre dove abita l'altro.**

- niente nome ne' indirizzo prima dell'accordo — chi conosce la citta'
  identificherebbe il locale, e da li' la zona dell'altro;
- ogni utente vede **solo il proprio** tempo di viaggio;
- le opzioni sono identiche e nello stesso ordine per entrambi, cosi' nessuno
  puo' capire quale sia "piu' comoda all'altro".

Il consenso e' un voto: vince l'opzione accettata da entrambi con la somma dei
piazzamenti piu' bassa, a parita' la piu' equa. Se le preferenze non si
incrociano, si rilancia con tre locali diversi.

Il tragitto e' stimato **con i mezzi** quando conviene: dare "42 minuti a piedi"
per un posto che con il tram e' a un quarto d'ora fa rifiutare opzioni buone.

### Fase 3 — Carta incontro e icebreaker

Luogo, indirizzo, giorno e ora esatti, piu' il **codice di riconoscimento
anonimo**, pensato per funzionare senza foto:

- una **parola chiave con risposta** (`"Scusa, aspetti anche tu il cometa?"` →
  `"Si, ma il cometa e sempre in ritardo."`), cosi' nessuno abborda lo
  sconosciuto sbagliato;
- un **segno visivo** a testa, improvvisabile sul posto con quello che c'e' sul
  tavolo — niente da comprare, niente addosso, e soprattutto **nessuna
  descrizione fisica delle persone**;
- chi ha il tragitto piu' corto arriva prima e tiene il tavolo.

Le **carte** sono generate dalla coppia: interessi condivisi, divergenze
leggere, curiosita' dichiarate nei profili, valori comuni, piu' un mazzo base
scritto a mano. Da 3 a 5 finiscono "in evidenza" (categorie tutte diverse), le
altre restano nel mazzo da pescare durante la serata.

Criterio editoriale: sono **bandite** le domande da colloquio — "che lavoro
fai", "quanti anni hai", "parlami di te" — e un test lo verifica su ogni carta
prodotta. Ogni carta deve far scegliere (dilemma), far raccontare un fatto
preciso (aneddoto) o esporre un'opinione difendibile (posizione).

Le **quote** (max 4 per categoria, max 2 per template) esistono perche' senza
limiti il generatore produce venti varianti della stessa domanda: gli interessi
divergenti sono tanti e ogni template li moltiplica, cosi' le carte migliori —
i dilemmi scritti a mano — finivano fuori dal mazzo.

Tutto e' **deterministico**: lo stesso match produce la stessa scheda sui device
di entrambi, senza che i client debbano sincronizzarsi.

### Fase 4 — Conferme, check-in, supporto

**Scaletta delle conferme:** T-24h, T-6h, T-1h. Ogni tappa richiede la conferma
di entrambi; alla scadenza parte un sollecito e, passato il tempo di grazia,
l'incontro si annulla da solo. Serve a far cadere in anticipo gli incontri che
non si terranno, invece di lasciare qualcuno ad aspettare a un tavolo. Chi
subisce l'annullamento riceve un messaggio che non colpevolizza nessuno e la
priorita' sul prossimo abbinamento.

**Check-in e no-show:** la finestra di arrivo si apre 15 minuti prima. Se dopo
20 minuti uno solo ha fatto check-in scatta l'avviso, dopo 35 il no-show e'
confermato e la serata si chiude. Se arrivano entrambi, a meta' serata parte un
controllo discreto ("verde se va, rosso se vuoi che ti tiriamo fuori").

**Pulsanti di sicurezza:** uscita assistita con finta chiamata, segnalazione
allo staff del locale (formato sul protocollo), posizione live a un contatto
fidato, chiamata al 112 con la posizione gia' pronta. Quasi tutti **discreti**:
non producono nessun segnale visibile a chi ti sta di fronte.

**Supporto:** l'assistente automatico gestisce ansia pre-appuntamento, ritardi,
mancate conferme e no-show; disagio durante l'incontro, senso di pericolo e
segnalazioni vanno **subito a un operatore umano**. Un filtro sul testo libero
("mi sta seguendo", "ho paura") scavalca il routing e chiama un umano comunque.
L'assistente dichiara sempre di essere un'AI, si puo' chiedere un operatore in
qualsiasi momento, e i numeri di emergenza (112, 1522, Telefono Amico) sono
sempre a schermo. L'assistente non fa diagnosi e lo dice.

Aprire il supporto **non manda nessun segnale all'altra persona**.

### Fase 5 — Il terzo compagno

Un'AI compresente alla serata: ascolta, rilancia quando la conversazione si
inceppa, tiene d'occhio la sicurezza e ogni tanto fa una battuta. Non è un
tramite fra i due — quelli sono seduti allo stesso tavolo e si parlano da soli —
è una presenza in più, come l'amico che sta zitto in fondo.

**Cosa entra nel motore: niente audio e niente trascrizioni.** Il
riconoscimento gira sul telefono; da lì passano solo segnali derivati (durata
dei silenzi, equilibrio dei turni, risate, domande, segnale di allarme). Non è
una formalità burocratica: due persone sedute in un bar sono in un luogo
pubblico, e un microfono acceso raccoglie anche il tavolo accanto — gente che
non ha acconsentito a niente e che non è nemmeno iscritta. Il contratto
`SignalTick` esiste per rendere *impossibile*, non solo sconsigliato, far
arrivare al server il contenuto di una conversazione privata.

**Il consenso è un cancello, non una preferenza.** Se anche uno solo dei due non
lo dà, il compagno non ascolta niente. Non esiste una modalità "ascolto solo per
uno", perché l'altro sarebbe ascoltato senza aver detto di sì.

Il problema vero non è cosa dire, è **quando**. Il modo più facile di rovinare
un appuntamento è mettere al tavolo qualcosa che interviene troppo:

- **budget** di 6 interventi spontanei a serata, e un intervallo minimo che
  **si allunga da solo ogni volta che parla** — il compagno si fa da parte man
  mano che la conversazione si regge;
- **non tutti i silenzi sono uguali**: otto secondi al minuto cinque sono
  imbarazzo, gli stessi otto secondi al minuto cinquanta sono due persone che
  stanno bene zitte, e interromperle sarebbe il danno vero (`sogliaSilenzio()`);
- **non interrompe mai chi sta raccontando** (energia alta);
- **la battuta arriva solo se si sta già ridendo**. Una battuta dentro un
  silenzio teso è la cosa che lo peggiora di più. Massimo due a serata;
- lo **squilibrio dei turni** deve durare, non basta un istante: allora la carta
  viene girata "a chi finora ha ascoltato di più" — mai un nome, mai
  "tu che parli poco";
- quando la serata si spegne propone la **chiusura**, così non deve essere
  nessuno dei due a dire per primo "andiamo".

**La sicurezza precede tutto ed è sempre silenziosa.** Un allarme detto ad alta
voce davanti alla persona di cui hai paura ti mette in pericolo invece di
toglierti da lì: il segnale va alla Fase 4 senza comparire al tavolo. Resta
attiva anche a compagno zittito, ed è scritto nel consenso iniziale.

Di default il compagno **scrive sullo schermo invece di parlare**: una voce che
esce dal telefono a un primo appuntamento la sentono anche i tavoli vicini.

Regole di tono in `data/companion-lines.js`: non commenta mai le due persone,
non dice mai come sta andando, e se fa ironia la fa **su di sé** — è l'unica
cosa al tavolo su cui può scherzare senza ferire nessuno. Un test verifica ogni
riga contro una lista di frasi vietate.

### Fase 6 — Debrief

È la parte più facile da sbagliare dell'intera app, quindi le regole sono poche
e rigide:

1. **Privato e asimmetrico.** Ognuno vede solo il proprio, e il proprio parla
   solo di sé. Nessuno riceve mai "cosa ha pensato l'altro di te": è
   l'informazione che tutti vorrebbero e l'unica capace di fare danni veri.
2. **Una sola cosa da provare.** Non un elenco. Tre osservazioni critiche di
   fila non sono un allenamento, sono una pagella — e a una pagella non si
   migliora, ci si affeziona in negativo. Prima cosa ha funzionato, poi al
   massimo una cosa per la volta dopo. Se non c'è niente di utile da dire,
   `daProvare` resta `null`: non si inventa una critica per riempire.
3. **Comportamenti, mai persone.** "Hai fatto due domande in un'ora e mezza" è
   un fatto su cui si può agire; "sei poco curioso" è un'etichetta che uno si
   porta dietro.
4. **Niente punteggi.** Nessun voto alla serata, nessun voto alla persona: un
   numero su una cosa così viene ricordato e nient'altro.

`debriefSignalsForMatcher()` restituisce alla Fase 1 quanto la serata si è retta
da sola, l'equilibrio dei turni e quali categorie di carte hanno funzionato. È
il primo dato reale su cosa fa davvero parlare due persone — oggi i pesi e le
famiglie di interessi sono scritti a mano.

## Struttura

```
src/
  engine.js                 orchestrazione delle sei fasi
  phase1-compatibility.js   punteggio, gate, soglia
  phase2-location.js        proposta anonima e consenso
  phase3-eventcard.js       scheda, codice di riconoscimento, icebreaker
  phase4-safety.js          conferme, check-in, no-show, supporto
  phase5-companion.js       il terzo compagno: quando ascoltare e quando parlare
  phase6-debrief.js         debrief privato e segnali di ritorno al matcher
  types.js                  tipi del dominio (JSDoc)
  data/
    taxonomy.js             famiglie di interessi e adiacenza fra vibe
    venues.js               catalogo locali verificati (seed su Milano)
    icebreakers.js          template e mazzo base
    companion-lines.js      battute e rilanci del compagno, con le frasi vietate
    sample-profiles.js      profili di esempio per demo e test
  util/
    geo.js                  distanze, punto medio, equita', tragitti
    time.js                 finestre orarie e intersezioni
    rng.js                  casualita' deterministica per match
test/                       135 test, uno per fase piu' end-to-end
demo/run-demo.js
```

## Uso

```js
import { runMatchFlow } from './src/engine.js';

const flow = runMatchFlow(profiloA, profiloB, { now: new Date() });

if (flow.esito === 'incontro_fissato') {
  const perA = flow.schedaPer(profiloA.id); // gia' ripulita dai dati di B
}
```

Esiti possibili: `incontro_fissato`, `non_compatibile` (gate fallito),
`sotto_soglia`, `nessuna_location`, `nessun_consenso`. Il flusso si ferma alla
prima fase che non passa e dice perche': nessuna fase inventa dati mancanti.

## Cosa manca per andare in produzione

Il motore e' completo e testato, ma resta fuori tutto cio' che tocca il mondo:

- **Persistenza e scheduler.** `advance()` e' idempotente e va chiamata da un
  job periodico; qui non c'e' ne' il job ne' il database.
- **Catalogo locali reale.** `data/venues.js` e' un seed di 14 posti su Milano
  con `safetyScore` inventati. In produzione serve una pipeline di verifica dei
  locali e degli orari, e il `safetyScore` va assegnato da persone.
- **Rete di operatori umani.** La Fase 4 instrada verso un umano ma non lo
  fornisce: serve un team con turni di reperibilita', altrimenti l'escalation
  e' una promessa vuota — ed e' la promessa piu' delicata dell'app.
- **Anti-abuso.** Il motore si fida dei profili che riceve. Servono verifica
  d'identita', storico dei no-show, gestione delle segnalazioni e blocco dei
  re-match fra persone che si sono gia' incontrate.
- **Localizzazione.** Numeri di emergenza, stime di percorrenza e catalogo sono
  tarati sull'Italia.
