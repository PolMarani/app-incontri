# BlindStep — motore di coordinamento e matchmaking

Incontri al buio, di persona, subito. Nessuna chat fra gli utenti: l'app abbina
due persone, negozia un posto neutro, consegna una scheda con luogo, ora, codice
di riconoscimento e carte per rompere il ghiaccio, e resta accanto a entrambi
prima, durante e dopo la serata.

Questo repository contiene il **motore**: la logica delle otto fasi, senza
interfaccia e senza database. Nessuna dipendenza esterna, gira con Node 22+.

```bash
npm test     # 259 test
npm run demo # flusso completo stampato a schermo
```

## I principi, tradotti in codice

| Principio | Dove vive | Cosa significa concretamente |
|---|---|---|
| Zero chat | `phase4-safety.js` | Il canale di supporto porta all'assistente o a un operatore, **mai** all'altra persona. Non esiste nessuna funzione che scriva da un utente all'altro. Il compagno di Fase 5 sta al tavolo con entrambi, non fa da tramite fra i due. |
| Obbligo di incontro | `phase1-compatibility.js` | Se non esiste una sera libera in comune o un posto equo raggiungibile, il match viene **scartato**: senza chat non c'e' un ripiego in cui parcheggiarlo. |
| Posizione neutra | `phase2-location.js` | Tre opzioni pubbliche a meta' strada, presentate in forma anonima; la scelta e' un voto incrociato, non una trattativa. |
| Icebreaker dedicati | `phase3-eventcard.js` | Carte generate dai profili della coppia, con un filtro che vieta le domande da colloquio. La Fase 5 le gioca al momento giusto invece di lasciarle in una lista. |

## Le otto fasi

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

Sopra l'80% si passa alla Fase 2 — ma la soglia è una **politica di prodotto,
non una verità**, ed è per questo che è un parametro:

- **Soglia adattiva** (`sogliaAdattiva()`). L'80% fisso è giusto in una città
  piena e letale al lancio: con pochi iscritti produce zero abbinamenti, e
  l'utente non vede "nessuno di adatto", vede "non funziona" — e disinstalla
  prima che il bacino cresca abbastanza da farla funzionare. Con `adattiva: true`
  la soglia scende quel tanto che basta a proporre N candidati, mai sotto il 65%.
  I gate restano gate: un match impossibile resta impossibile a qualsiasi soglia.
- **Affidabilità** (`reputation.js`). In un'app senza chat l'unica cosa che un
  utente spende è presentarsi, quindi è un ingrediente del matching e non un
  pannello anti-abuso in fondo alle impostazioni. Non è una settima dimensione
  ma un **fattore sul totale** (max −15%): non descrive quanto due persone
  stiano bene insieme, descrive quanto è probabile che l'incontro esista.
  Disdire per tempo costa pochissimo, disdire all'ultimo costa, non presentarsi
  costa moltissimo — è l'unico caso in cui qualcuno resta seduto ad aspettare.
  Chi è nuovo vale 1: il rischio del nuovo arrivato lo assorbe l'app, non
  l'utente che gli si trova davanti. Sotto 0.35 si esce dal circolo, con un
  **percorso di rientro** in due incontri, perché un blocco a vita è
  sproporzionato: la gente attraversa periodi storti.
- **Priorità di recupero.** Chi è rimasto ad aspettare a un tavolo passa avanti
  in coda, altrimenti l'app ha estratto solo un costo dalla sua serata.
- **Niente re-match.** Chi si è già incontrato e non si è ricercato ha già
  risposto: riproporlo è il modo più rapido di far disinstallare l'app.

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

**Copertura onesta.** Promettere "un operatore umano" senza avere nessuno
dall'altra parte è la bugia più pericolosa che questa app possa dire: qualcuno
ci conta in un momento brutto e non trova nessuno. `coperturaUmana()` dichiara
orari e attesa stimata reale; fuori turno lo dice apertamente, promette un
richiamo entro un'ora e mette in primo piano i numeri che **sono presidiati
adesso**.

**Conferma incrociata dei segni.** Il codice della Fase 3 impedisce di abbordare
lo sconosciuto sbagliato, ma non impedisce a un terzo di presentarsi al posto
del match — un segno lo può esibire chiunque lo conosca. Entrambi confermano di
aver visto il segno dell'altro: due conferme incrociate valgono
un'autenticazione reciproca. Se un segno non corrisponde, l'app non chiede
spiegazioni, apre il supporto e propone l'uscita.

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

**Scambio di contatti a doppio consenso.** Zero chat *prima* dell'incontro è il
cuore dell'app e non si tocca. Ma dopo, se la serata è andata bene e uno dei due
si è dimenticato di chiedere il contatto di persona, senza una valvola
l'esperienza muore lì. Ognuno decide da solo entro 12 ore e i contatti si
sbloccano solo a sì reciproco — non è una chat, è una presentazione. Vale la
stessa regola della Fase 7: **chi ha detto sì non deve mai poter sapere che
l'altro ha detto no**, e il messaggio di esito è identico che l'altro abbia
rifiutato o semplicemente non abbia aperto l'app.

`debriefSignalsForMatcher()` restituisce quanto la serata si è retta da sola,
l'equilibrio dei turni e quali categorie di carte hanno funzionato;
`preferenzeDaSegnali()` le trasforma in pesi che `generateIcebreakers()`
consuma. È l'unico punto del sistema in cui i pesi smettono di essere quelli
scritti a mano e diventano quelli visti al tavolo — e resta volutamente cauto:
una sola carta giocata non sposta quasi niente, perché un modello che si
convince in fretta smette di proporre le cose che non ha ancora provato.

### Fase 7 — Momenti di affetto

Durante la serata l'app può proporre un gesto fisico. La scala è di cinque
gradini e non si salta: **brindisi / cinque → contatto di mano → bacio sulla
guancia → abbraccio breve → abbraccio di venti secondi**. Ogni gradino richiede
che il precedente sia stato accettato da entrambi, e l'abbraccio lungo esiste
solo nell'ultimo quinto della serata, perché è un gesto da commiato.

Il problema è ovvio: se la proposta compare **in mezzo al tavolo**, chi non se
la sente deve dire di no davanti all'altra persona — e a quel punto non è più
una scelta libera, è una cosa che si subisce per non fare una figuraccia. Un
gesto fatto per imbarazzo è l'esatto contrario di un gesto affettuoso.

Quindi vale la stessa forma della Fase 2:

1. la proposta arriva **separatamente** sullo schermo di ciascuno;
2. serve il **sì di entrambi**, dato senza sapere cosa ha risposto l'altro;
3. se salta, i due vedono **lo stesso identico messaggio**, che non distingue
   fra "ha detto no", "non ha guardato il telefono" e "è scaduta".
   L'ambiguità è voluta: senza, accettare diventerebbe un rischio e non lo
   farebbe più nessuno;
4. rifiutare costa **un tocco**, non lascia traccia e non viene chiesto perché.

**Cosa è casuale e cosa no.** È casuale il *quando* — la proposta scatta con una
probabilità per tick, quindi non è né prevedibile né programmata. Non è mai
casuale il *se*: clima (serve calore recente, mai dentro un silenzio o una
serata fredda), tempo trascorso, gradino della scala, budget di 3 proposte,
intervallo di 18 minuti, e stop dopo due rifiuti.

**Due cancelli in ingresso.** Serve il consenso esplicito di entrambi, *e*
nessuno dei due deve aver dichiarato di non volere contatto fisico: chi non
vuole essere toccato non deve nemmeno vedere la proposta, perché doverla
rifiutare ogni volta è già un piccolo costo che non ha motivo di pagare.

**Un qualsiasi segnale di rischio spegne la funzione per tutta la serata, in
modo irreversibile.** Se una persona ha avuto anche solo un momento di disagio,
proporle un contatto fisico più tardi è fuori discussione, per quanto il clima
possa sembrare migliorato.

Il riepilogo finale contiene solo ciò che è stato condiviso: **i rifiuti non
risultano da nessuna parte**, come promesso all'utente.


### Fase 8 — Giochi a schermo condiviso

Ogni tanto, in modo imprevedibile, l'app propone un gioco da fare in due su un
telefono solo. Sono nove, e obbediscono a un vincolo che vale più di tutti gli
altri: **il telefono deve sparire**. Un gioco che tiene due persone a fissare
uno schermo per venti minuti ha trasformato un appuntamento in una sala giochi —
quindi ogni gioco dichiara quanto occupa lo schermo (`solo_avvio`, `a_turno`,
`condiviso`), e **più la serata avanza più si preferiscono quelli che lo
liberano subito**.

| Gioco | Schermo | Cosa fa |
|---|---|---|
| **L'infiltrato** | solo avvio | A uno dei due arriva una bugia da infilare nella conversazione. O a nessuno: una volta su quattro non mente nessuno, ed è quello che rende il gioco vivo. Si parla normalmente per dieci minuti, poi si accusa. |
| **L'ultimo posto** | a turno | Una cosa che non si può tagliare in due (l'ultimo posto sull'ultimo treno, una scusa perfetta spendibile una volta sola). Ognuno scrive come la dividerebbe, si scopre, si tratta. |
| **Bestia comune** | condiviso | Schermo diviso a metà, mezza creatura a testa senza sbirciare. Alla fine le metà si uniscono e le si dà un nome. |
| **Prove** | solo avvio | Sessanta secondi per trovare una foto nella propria galleria ("l'ultima cosa che hai fotografato per non dimenticarla"). Chi guarda ha tre domande, chi mostra può rifiutarne una senza dire perché. |
| **La riga** | condiviso | Non pro/contro: uno spettro. "Arrivare a cena con le mani vuote: non ci pensa nessuno ↔ non ti invito più." Ognuno mette il segno al buio, si scopre insieme. |
| **L'inventario** | solo avvio | "L'oggetto qui dentro che ha visto più cose." Si sceglie guardando la stanza, un minuto a testa per difenderlo. |
| **Vite degli altri** | a turno | Ognuno sceglie in silenzio un tavolo e scrive tre parole. Si scopre, si indovina chi ha scelto chi, si costruisce una storia sola con tutte e sei. |
| **Il testimone** | a turno | Dieci secondi per leggere una scena assurda, poi la si racconta in cinque frasi mentre l'altro fa domande per trovare il dettaglio nascosto. Poi si scambiano i ruoli. |
| **Il patto** | condiviso | Solo a fine serata: una frase sola scritta da entrambi, una regola che varrebbe se vi rivedeste. Si chiude solo se va bene a tutti e due. |

**Quando proporre un gioco è l'esatto contrario di quando proporre una carta.**
Una carta riempie un silenzio: costa poco e si può ignorare. Un gioco chiede
dieci minuti e cambia la forma della serata — quindi **mai mentre la
conversazione gira** (interromperebbe proprio la cosa che dovrebbe produrre), e
solo nei momenti piatti in cui la serata gira a vuoto ma il clima non è brutto.
Due a serata, venticinque minuti di distanza, mai uno che sfori l'orario di
chiusura, e la proposta dichiara sempre **durata e via d'uscita**: un gioco che
non dice quanto dura è una trappola.

Quattro cose che nessun gioco fa: **nessun punteggio di compatibilità** (un
"siete affini al 78%" viene ricordato al posto di tutta la serata), **nessun
quiz con la risposta giusta** (produce un vincitore e un perdente, non una
conversazione), nessun gioco che si potrebbe fare identico da soli sul divano, e
nessun gioco che si chiude in sé stesso — ognuno ha una `chiusura` che rimette
in mano un argomento.

### L'arbitro dell'attenzione

Con carte, battute, proposte di affetto e giochi, il rischio non è più che
l'app dica la cosa sbagliata: è che **chieda attenzione tre volte in cinque
minuti**. Ogni modulo preso da solo si comporta bene — il problema nasce dalla
somma, e nessuno dei moduli può vederla.

`attention.js` è l'unico posto che tiene il conto: una richiesta alla volta, una
pausa dopo ognuna proporzionale a quanto è stata invadente (una carta pesa 1, un
gioco pesa 4), e un tetto per la serata. Chi non ottiene il turno non insiste.
Il riepilogo finisce nei segnali al matcher: una serata con poche interruzioni è
una serata che si è retta da sola.


### Il runtime della serata

Le fasi 5, 7 e 8 vivono sugli stessi segnali e vogliono lo stesso telefono.
Finché ognuna veniva guidata dal chiamante, tre cose non funzionavano:

1. **Il tetto sulle interruzioni non esisteva davvero** — il budget di
   attenzione lo consultava una fase sola, le altre parlavano quando volevano.
2. **Le precedenze erano casuali** — se nello stesso istante il compagno voleva
   una carta, l'affetto una proposta e i giochi una partita, vinceva quella che
   il chiamante aveva scritto per prima nel proprio codice.
3. **Il ciclo dei tick era duplicato** in ogni client, e con lui la logica di
   coordinamento: il posto più facile del sistema in cui sbagliare.

`evening.js` risolve tutte e tre. I moduli tornano a fare una cosa sola — dire
se *avrebbe senso* parlare adesso — e chi parla davvero lo decide il runtime:

| | Precedenza | Perché |
|---|---|---|
| 1 | **Sicurezza** | Sempre, prima di tutto, e in silenzio. Blocca affetto e giochi per il resto della serata. |
| 2 | **Richiesta esplicita** | Se lo chiedono loro non è un'interruzione: non consuma budget. |
| 3 | **Momenti di affetto** | Rari e legati a un clima che passa. |
| 4 | **Giochi** | Solo dopo che le mosse leggere non sono bastate. |
| 5 | **Compagno** | Carte e battute. |

Il criterio dell'ordine è **quanto un'occasione è deperibile**: una carta si può
giocare anche cinque minuti dopo, un momento caldo no. Il criterio dei giochi è
invece l'**escalation** — un gioco chiede dieci minuti, quindi diventa
ammissibile solo dopo che il compagno ha già provato almeno due rilanci: saltare
subito alla soluzione grossa per un problema che forse non c'è è il modo più
sicuro di rovinare una serata che stava andando bene.

Quando il telefono è occupato, il compagno **rinuncia invece di accodarsi**: una
carta buona fra dieci minuti non è più la stessa carta.

Ogni funzione ha il **suo consenso separato**: chi accetta il compagno non ha
accettato per questo i momenti di affetto, e chi gioca volentieri non ha
accettato un microfono acceso. Fondere i consensi in un interruttore solo
sarebbe comodo e disonesto.

Lo stato è **serializzabile** (`snapshotEvening`): una serata dura due ore e il
processo che la segue può morire in mezzo, quindi anche i generatori pseudocasuali
espongono il proprio stato — altrimenti dopo un riavvio i due telefoni
mostrerebbero cose diverse.


## Struttura

```
src/
  engine.js                 orchestrazione delle otto fasi
  evening.js                runtime della serata: un ciclo solo, un arbitro solo
  phase1-compatibility.js   punteggio, gate, soglia
  phase2-location.js        proposta anonima e consenso
  phase3-eventcard.js       scheda, codice di riconoscimento, icebreaker
  phase4-safety.js          conferme, check-in, no-show, supporto
  phase5-companion.js       il terzo compagno: quando ascoltare e quando parlare
  phase6-debrief.js         debrief privato, scambio contatti, segnali al matcher
  phase7-affection.js       momenti di affetto a doppio consenso
  phase8-games.js           giochi a schermo condiviso
  attention.js              budget di attenzione condiviso
  diagnostics.js            copertura del catalogo per profilo di vincoli
  reputation.js             affidabilita, blocchi e percorso di rientro
  types.js                  tipi del dominio (JSDoc)
  data/
    taxonomy.js             famiglie di interessi e adiacenza fra vibe
    venues.js               catalogo locali verificati (seed su Milano)
    icebreakers.js          template e mazzo base
    companion-lines.js      battute e rilanci del compagno, con le frasi vietate
    affection-moments.js    la scala dei gesti, dal brindisi all abbraccio lungo
    games.js                i nove giochi, con regole e materiale
    sample-profiles.js      profili di esempio per demo e test
  util/
    geo.js                  distanze, punto medio, equita', tragitti
    time.js                 finestre orarie e intersezioni
    rng.js                  casualita' deterministica per match
test/                       259 test, uno per fase piu' end-to-end
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
- **Verifica d'identita'.** Lo storico dei no-show, le segnalazioni e il blocco
  dei re-match ci sono (`reputation.js`), ma il motore si fida ancora del fatto
  che dietro un profilo ci sia quella persona: la verifica documentale e' fuori
  da qui.
- **Riconoscimento sul dispositivo.** La Fase 5 consuma `SignalTick` e i test la
  coprono con tracce simulate, ma separare due voci, contare le risate e
  rilevare il disagio in tempo reale in un bar rumoroso e' un progetto a se', ed
  e' li' che sta il rischio tecnico vero.
- **Isocrone reali.** Il punto a meta' strada e' geometrico: due persone
  equidistanti in chilometri possono essere a quaranta minuti di differenza in
  tram. Serve un servizio di routing.
- **Copertura del catalogo.** `diagnostics.js` misura quanta parte del catalogo
  e' utilizzabile per ogni profilo di vincoli, ma il seed su Milano non ha
  abbastanza locali accessibili perche' il numero sia significativo: e' una
  metrica pronta, in attesa di un catalogo vero.
- **Localizzazione.** Numeri di emergenza, stime di percorrenza e catalogo sono
  tarati sull'Italia.
