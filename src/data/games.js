/**
 * I giochi a schermo condiviso.
 *
 * Criteri con cui sono stati scritti, in ordine di importanza:
 *
 *  1. DEVONO ESSERE INERENTI ALLA SITUAZIONE. Due persone che non si conoscono,
 *     sedute allo stesso tavolo, in un posto pubblico, con un telefono in
 *     mezzo. Un gioco che si potrebbe fare identico da soli sul divano non ha
 *     motivo di stare qui.
 *
 *  2. IL TELEFONO DEVE SPARIRE. Il campo `schermo` dice quanto lo schermo resta
 *     protagonista: `solo_avvio` e' il grado migliore - l'app da' una regola e
 *     poi il telefono va a faccia in giu'. I giochi `condiviso` sono ammessi ma
 *     restano corti.
 *
 *  3. NESSUN PUNTEGGIO DI COMPATIBILITA'. Niente "siete affini al 78%": e' il
 *     modo piu' rapido di far finire una serata, perche' un numero del genere
 *     viene ricordato al posto di tutto il resto.
 *
 *  4. NIENTE QUIZ CON LA RISPOSTA GIUSTA. Una domanda con una risposta esatta
 *     produce un vincitore e un perdente, non una conversazione.
 *
 *  5. OGNI GIOCO FINISCE RESTITUENDO QUALCOSA. Il campo `chiusura` esiste
 *     perche' il gioco deve consegnare un argomento, non chiudersi in se stesso.
 */

/**
 * @typedef {Object} Gioco
 * @property {string} id
 * @property {string} titolo
 * @property {'solo_avvio'|'a_turno'|'condiviso'} schermo
 * @property {number} durataMin
 * @property {number} minMinuti      minuti di serata prima di poterlo proporre
 * @property {boolean} [finaleSerata]
 * @property {string} premessa       come viene proposto
 * @property {string[]} regole
 * @property {string} chiusura       cosa resta da dirsi quando finisce
 * @property {string} perche         a cosa serve, per chi legge il codice
 * @property {string[]} [materiale]  contenuti pescati a ogni partita
 */

/** @type {Gioco[]} */
export const GIOCHI = [
  {
    id: 'infiltrato',
    titolo: 'L infiltrato',
    schermo: 'solo_avvio',
    durataMin: 12,
    minMinuti: 25,
    premessa:
      'Uno dei due sta per ricevere una bugia da infilare nella conversazione. ' +
      'Oppure nessuno dei due. Non lo saprete.',
    regole: [
      'Guardate lo schermo uno alla volta: a uno arriva una bugia da raccontare, all altro la stessa schermata vuota.',
      'Da adesso si parla normalmente per dieci minuti. Chi ha la bugia deve piazzarla senza forzare.',
      'Alla fine ognuno dice se pensa che l altro abbia mentito, e su cosa.',
      'Poi si tocca lo schermo e si scopre la verita.',
    ],
    chiusura:
      'Chi ha indovinato dica da cosa l ha capito: e li che si scopre quanto ci si stava ' +
      'davvero ascoltando.',
    perche:
      'E il gioco che sfrutta meglio la situazione: due persone che non si conoscono non ' +
      'hanno modo di verificare niente. Si dissolve dentro la conversazione invece di ' +
      'sostituirla, e il telefono resta spento per dieci minuti.',
    materiale: [
      'Sostieni di essere allergico a una cosa comunissima. Non dirlo subito: aspetta che venga il momento.',
      'Sostieni di aver lavorato tre mesi in un posto assurdo. Inventa un dettaglio noioso, sono quelli che convincono.',
      'Sostieni di avere paura di un animale del tutto innocuo.',
      'Sostieni di aver conosciuto una persona famosa in una circostanza banale.',
      'Sostieni di non aver mai visto un film che hanno visto tutti.',
      'Sostieni di sapere fare una cosa manuale molto specifica.',
      'Sostieni che una cicatrice o un oggetto che hai addosso ha una storia che non ha.',
      'Sostieni di essere stato in una citta in cui non sei mai stato. Prepara un dettaglio sul cibo.',
    ],
  },
  {
    id: 'ultimo_posto',
    titolo: 'L ultimo posto',
    schermo: 'a_turno',
    durataMin: 6,
    minMinuti: 20,
    premessa: 'Una cosa sola, due persone. Vediamo come ve la dividete.',
    regole: [
      'Sullo schermo compare una cosa che non si puo tagliare in due.',
      'Ognuno scrive, senza far vedere, come la dividerebbe e una riga sul perche.',
      'Si gira lo schermo e si legge tutto insieme.',
      'Se le proposte non coincidono avete tre minuti per trovare un accordo. Se coincidono, spiegatevi il perche.',
    ],
    chiusura:
      'La cosa interessante non e come ve la siete divisa, e quale delle due ragioni vi ha ' +
      'convinto di piu.',
    perche:
      'Una trattativa breve mostra in cinque minuti come una persona sta dentro un ' +
      'disaccordo: molto piu di qualsiasi domanda diretta sul carattere.',
    materiale: [
      'L ultimo posto sull ultimo treno della notte.',
      'Una scusa perfetta per uscire da qualsiasi situazione, spendibile una volta sola.',
      'Sei mesi di ferie, da usare entro un anno.',
      'Il diritto di rifare una scelta gia fatta, una sola.',
      'Un biglietto per un posto in cui nessuno dei due e mai stato.',
      'La possibilita di far dimenticare a una persona una cosa che ha visto.',
      'Un ora al giorno in cui il telefono di tutti gli altri non funziona.',
    ],
  },
  {
    id: 'bestia_comune',
    titolo: 'Bestia comune',
    schermo: 'condiviso',
    durataMin: 7,
    minMinuti: 15,
    premessa: 'Lo schermo si divide in due. Disegnate mezza creatura a testa, senza sbirciare.',
    regole: [
      'Il telefono sta in mezzo: meta schermo a testa, e la meta dell altro resta coperta.',
      'Novanta secondi. Non serve saper disegnare, serve solo non fermarsi.',
      'Alla fine le due meta si uniscono.',
      'Insieme le date un nome e decidete cosa mangia.',
    ],
    chiusura:
      'Tenetela: e la prima cosa che avete fatto insieme, ed e ragionevolmente orribile.',
    perche:
      'Produce un oggetto condiviso in sette minuti e non richiede nessuna abilita. Il ' +
      'risultato brutto e il punto, non un effetto collaterale.',
    materiale: [
      'Un animale che vive soltanto in questo quartiere.',
      'La creatura che abita nei tubi di questo locale.',
      'L animale domestico che avremo fra cinquant anni.',
      'La bestia che si mangia i calzini spaiati.',
      'Un animale progettato apposta per sopravvivere a un lunedi.',
    ],
  },
  {
    id: 'prove',
    titolo: 'Prove',
    schermo: 'solo_avvio',
    durataMin: 8,
    minMinuti: 20,
    premessa: 'Sessanta secondi per trovare una foto nel vostro telefono. Poi si mostra.',
    regole: [
      'Lo schermo da una consegna e parte un minuto.',
      'Ognuno cerca nella propria galleria. Vale la prima cosa che trovate, non la migliore.',
      'Si mostrano insieme.',
      'Chi guarda ha diritto a tre domande. Chi mostra puo rifiutarne una senza dire perche.',
    ],
    chiusura:
      'La foto conta meno del motivo per cui era ancora li dentro.',
    perche:
      'Ognuno ha addosso un archivio della propria vita e non lo mostra quasi mai. Il ' +
      'diritto di rifiutare una domanda tiene il gioco lontano dall interrogatorio.',
    materiale: [
      'La foto piu inspiegabile che avete in galleria.',
      'L ultima cosa che avete fotografato solo per non dimenticarla.',
      'Una foto che avete fatto e che non c entra niente con voi.',
      'La foto piu vecchia che riuscite a trovare in un minuto.',
      'Uno screenshot che vi siete salvati e non avete piu riguardato.',
      'Una foto di cibo che vi era sembrata bellissima sul momento.',
    ],
  },
  {
    id: 'la_riga',
    titolo: 'La riga',
    schermo: 'condiviso',
    durataMin: 6,
    minMinuti: 15,
    premessa: 'Non e ne giusto ne sbagliato: e una riga, e voi state da qualche parte sopra.',
    regole: [
      'Compare una situazione con due estremi.',
      'Ognuno mette il proprio segno sulla riga senza vedere quello dell altro.',
      'Si scoprono insieme.',
      'Chi sta piu vicino a un estremo difende la sua posizione per trenta secondi.',
    ],
    chiusura:
      'Le righe su cui siete lontani valgono piu di quelle su cui siete vicini: quelle ' +
      'danno da parlare per il resto della serata.',
    perche:
      'Uno spettro evita il si/no e produce sfumature. Le domande sono volutamente su ' +
      'galateo minore: la gente ha opinioni fortissime e nessuna occasione di dirle.',
    materiale: [
      'Arrivare a cena da qualcuno con le mani vuote | non ci pensa nessuno / non ti invito piu',
      'Rispondere a un messaggio dopo tre giorni | capita a tutti / e gia una risposta',
      'Mangiare da soli al ristorante | il massimo della liberta / non ci riuscirei mai',
      'Regalare una cosa che ti hanno regalato | riciclo intelligente / tradimento',
      'Restituire un libro con le orecchie alle pagine | e vissuto / non te lo presto piu',
      'Dire a qualcuno che ha una cosa fra i denti | obbligo morale / lascio perdere',
      'Cantare in macchina con una persona che conosci da poco | subito / mai',
      'Guardare il finale prima dell inizio | legittimo / barbarie',
      'Tenere le scarpe in casa degli altri | dipende / mai e poi mai',
    ],
  },
  {
    id: 'inventario',
    titolo: 'L inventario',
    schermo: 'solo_avvio',
    durataMin: 5,
    minMinuti: 12,
    premessa: 'Guardatevi intorno. Il gioco e tutto qui dentro.',
    regole: [
      'Lo schermo da una categoria.',
      'Ognuno sceglie un oggetto che vede da dove e seduto. Vale tutto, anche quello degli altri tavoli.',
      'Un minuto a testa per difendere la propria scelta.',
      'Non si vota: si decide insieme se una delle due e chiaramente migliore, e di solito non lo e.',
    ],
    chiusura: 'Se avete scelto lo stesso oggetto, avete un problema o un ottimo segno.',
    perche:
      'Costringe a guardare il posto in cui siete invece dello schermo, e funziona ovunque ' +
      'senza contenuti da scaricare.',
    materiale: [
      'L oggetto qui dentro che sopravviverebbe piu a lungo a tutti noi.',
      'L oggetto che ha visto piu cose.',
      'L oggetto che rubereste se il locale chiudesse domani.',
      'La cosa piu inutile in questa stanza, e va difesa comunque.',
      'L oggetto che sembra piu fuori posto.',
      'La cosa che qualcuno ha scelto con piu cura, secondo voi.',
    ],
  },
  {
    id: 'vite_degli_altri',
    titolo: 'Vite degli altri',
    schermo: 'a_turno',
    durataMin: 7,
    minMinuti: 20,
    premessa: 'Il locale e pieno di gente che non saprete mai. Inventiamogliela.',
    regole: [
      'Ognuno sceglie in silenzio una persona o un tavolo. Non si indica e non si fissa nessuno.',
      'Tre parole a testa sullo schermo, senza far vedere.',
      'Si scopre insieme, e ognuno prova a capire chi ha scelto l altro.',
      'Poi costruite una sola storia che tenga insieme tutte e sei le parole.',
    ],
    chiusura:
      'Regola unica: niente di cattivo su nessuno. Le storie migliori sono comunque quelle ' +
      'gentili.',
    perche:
      'Il posto pubblico diventa materiale invece che sfondo. La regola sulla gentilezza non ' +
      'e moralismo: le storie cattive fanno ridere trenta secondi e poi raffreddano il tavolo.',
    materiale: [
      'Scegliete qualcuno che sembra stia aspettando qualcosa.',
      'Scegliete qualcuno che sembra venire qui da anni.',
      'Scegliete due persone che secondo voi si conoscono da poco.',
      'Scegliete qualcuno che sta chiaramente pensando ad altro.',
    ],
  },
  {
    id: 'testimone',
    titolo: 'Il testimone',
    schermo: 'a_turno',
    durataMin: 8,
    minMinuti: 25,
    premessa: 'Uno guarda per dieci secondi, l altro deve ricostruire.',
    regole: [
      'Uno dei due gira lo schermo verso di se: ha dieci secondi per leggere una scena.',
      'Lo schermo si spegne. Ora deve raccontarla, ma puo dire solo cinque frasi.',
      'L altro fa domande finche non trova il dettaglio nascosto - c e sempre, ed e piccolo.',
      'Poi ci si scambia i ruoli.',
    ],
    chiusura:
      'Chi fa le domande scopre qualcosa su di se: c e chi parte dai fatti e chi parte dalle ' +
      'persone.',
    perche:
      'E l unico gioco della lista che mette in scena l ascolto invece di chiederlo. Il modo ' +
      'in cui uno interroga dice piu di quello che racconta.',
    materiale: [
      'Una donna aspetta a una fermata con due valigie identiche. Ne apre una, ci mette dentro il biglietto dell autobus, la richiude.',
      'Un uomo cerca le chiavi in tutte le tasche. Le trova in mano. Continua a cercare per altri dieci secondi.',
      'Un bambino spiega una regola del gioco a un adulto che ha gia perso. Tiene un dado in bocca.',
      'Un cameriere porta tre caffe a un tavolo dove siede una persona sola. Nessuno dei tre e per lei.',
      'Una coppia litiga in silenzio davanti a un frigorifero aperto. Dentro c e solo una candela.',
      'Un uomo legge un giornale di sei anni fa in sala d attesa. Ogni tanto annuisce.',
    ],
  },
  {
    id: 'il_patto',
    titolo: 'Il patto',
    schermo: 'condiviso',
    durataMin: 4,
    minMinuti: 70,
    finaleSerata: true,
    premessa: 'Ultima cosa. Una frase sola, scritta da tutti e due.',
    regole: [
      'Il telefono passa da una mano all altra. Ognuno puo scrivere, cancellare, cambiare.',
      'Si chiude quando la frase va bene a entrambi. Se non va bene a uno, non si chiude.',
      'Deve essere una regola, non un complimento: qualcosa che varrebbe se vi rivedeste.',
    ],
    chiusura: 'Ve la mandiamo tutti e due. Vale anche se non vi rivedete mai piu.',
    perche:
      'Chiude la serata con una cosa fatta insieme invece che con un saluto. E soprattutto ' +
      'sposta il momento imbarazzante del commiato su un compito da svolgere.',
    materiale: [
      'La regola che varrebbe se vi rivedeste.',
      'Una cosa che vi impegnate a fare entrambi entro un mese, anche separatamente.',
      'Il divieto assoluto che imponete a voi due, qualunque cosa succeda.',
    ],
  },
];

/** Cornici della proposta: leggere, e con l uscita sempre in vista. */
export const PROPOSTA_GIOCO = [
  'Vi va di giocare a una cosa? Cinque minuti, poi il telefono torna sul tavolo.',
  'Ho un gioco, se vi va. Se non vi va lo dite e non se ne parla piu.',
  'Se avete voglia c e una cosa breve da fare in due.',
];

/** Cosa si vede se non se ne fa niente: uguale per tutti e due. */
export const GIOCO_NON_FATTO = 'Niente gioco. Il telefono torna dov era.';
