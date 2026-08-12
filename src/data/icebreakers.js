/**
 * Banca delle carte "spunti di conversazione".
 *
 * Criterio editoriale: niente domande da colloquio. Sono bandite le classiche
 * ("che lavoro fai", "quanti anni hai", "cosa cerchi") perche' trasformano un
 * incontro in uno screening. Ogni carta deve fare almeno una di tre cose:
 *  - costringere a scegliere (dilemma),
 *  - far raccontare un fatto specifico gia' successo (aneddoto),
 *  - esporre un'opinione che si potrebbe difendere (posizione).
 *
 * I segnaposto disponibili nei template: {interesse}, {altro}, {curiosita},
 * {valore}, {luogo}.
 */

/** Template legati alla famiglia di interessi condivisa. */
export const FAMILY_PROMPTS = {
  outdoor: [
    'Vi piace stare fuori: qual e la volta che siete tornati piu conciati da un posto, e ne e valsa la pena?',
    'Meglio partire alle cinque del mattino con il freddo o alle undici con il sole e trovare tutti li: chi di voi due cede per primo?',
    'Su {interesse}: la cosa che vi hanno insegnato e che avete scoperto essere una cavolata?',
  ],
  musica: [
    'Entrambi ascoltate musica sul serio: il pezzo che vi imbarazza avere in cima agli ascolti quest anno?',
    'Un concerto che avete visto e che descrivereste male a parole: provateci lo stesso.',
    'Se dovesse partire adesso una canzone che vi rappresenta e tutto il locale la sentisse, quale sarebbe il danno peggiore?',
  ],
  lettura: [
    'Il libro che avete abbandonato a meta senza sensi di colpa e perche.',
    'Su {interesse}: se poteste cancellare dalla vostra memoria una storia per poterla rileggere da zero, quale?',
    'Chi dei due riesce a difendere meglio un finale che tutti hanno odiato?',
  ],
  schermo: [
    'Un film che tutti considerano bellissimo e voi non avete retto: dite il titolo insieme al tre.',
    'Se la vostra giornata di oggi fosse una scena, con che colonna sonora la montereste?',
    'Serie perfetta rovinata dall ultima stagione: chi ha l esempio piu doloroso?',
  ],
  cucina: [
    'Entrambi vi occupate di {interesse}: la cosa piu strana che avete mangiato e rifareste?',
    'Il piatto che vi riesce bene solo a voi e che nessuno vi ha mai chiesto la ricetta.',
    'Un abbinamento che difendereste davanti a chiunque, anche se vi guardano male.',
  ],
  arte: [
    'Su {interesse}: un opera che vi ha annoiato in foto e vi ha ribaltato dal vivo, o il contrario.',
    'Se doveste rubare una sola cosa da un museo sapendo di farla franca, cosa e dove la mettereste in casa?',
    'La cosa piu brutta che vi piace davvero.',
  ],
  tech: [
    'Su {interesse}: la cosa che avete costruito o smontato e che non ha mai funzionato, e quanto ci avete messo ad arrendervi?',
    'Una tecnologia che tutti usano e che secondo voi fra dieci anni sembrera ridicola.',
    'Chi dei due sopravviverebbe piu a lungo senza telefono, e chi sta bluffando?',
  ],
  giochi: [
    'Entrambi giocate: siete piu da alleanza tradita all ultimo turno o da vittoria pulita e noiosa?',
    'Il gioco che avete smesso di proporre agli amici perche rovinava le serate.',
    'Regola della casa che imponete e che non esiste da nessuna parte.',
  ],
  benessere: [
    'Su {interesse}: la routine che raccontate agli altri e quella che fate davvero, quanto distano?',
    'Vi siete mai sentiti stupidi durante una lezione o un allenamento? Racconto integrale.',
    'Meglio essere costanti e mediocri o discontinui e ogni tanto bravissimi?',
  ],
  animali: [
    'Se il vostro animale preferito potesse dire una sola frase su di voi, cosa vi rovinerebbe?',
    'Su {interesse}: il comportamento animale che vi sembra piu intelligente di meta delle persone che conoscete.',
    'Chi dei due si ferma piu spesso per strada a salutare un cane?',
  ],
  viaggi: [
    'Entrambi viaggiate: la cosa piu strana che avete mangiato in viaggio?',
    'Il posto che tutti amano e che a voi non ha detto niente, e ammettetelo senza girarci intorno.',
    'Un viaggio andato storto che oggi raccontate come la parte migliore.',
    'Zaino e nessun piano o tutto prenotato tre mesi prima: chi di voi due dura di piu con il metodo dell altro?',
  ],
  pensiero: [
    'Su {interesse}: una cosa che avete capito tardi e che ora vi sembra ovvia.',
    'Domanda seria fatta male: preferite sapere come finisce tutto o non saperlo mai?',
    'Un argomento su cui avete cambiato idea negli ultimi due anni, e cosa vi ha fatto cambiare.',
  ],
  sociale: [
    'Su {valore}: una cosa concreta che avete cambiato nella vostra vita e una che sapete di non voler cambiare.',
    'Quando vi accorgete che una causa e diventata solo estetica?',
    'La cosa piu utile che avete fatto per il vostro quartiere, anche minuscola.',
  ],
  collezioni: [
    'Su {interesse}: il pezzo che non vendereste mai e quello che avete pagato troppo.',
    'Quando una passione diventa accumulo? Chi dei due e piu vicino al confine?',
    'Fate vedere una foto della cosa piu assurda che possedete.',
  ],
};

/** Fallback quando l'interesse condiviso non ha una famiglia dedicata. */
export const GENERIC_INTEREST_PROMPTS = [
  'Avete in comune {interesse}: com e cominciata, per ciascuno dei due?',
  'Su {interesse}: la cosa che ripetete sempre agli altri e che nessuno vi ascolta mai.',
  'Se doveste convincere qualcuno che {interesse} vale il tempo che ci mettete, che argomento usereste?',
  'Qual e l errore da principiante che avete fatto piu a lungo con {interesse}?',
];

/** Divergenze: uno ce l'ha, l'altro no. Da usare in modo leggero. */
export const DIVERGENCE_PROMPTS = [
  'Uno dei due ha messo {interesse} nel profilo e l altro no: trenta secondi per convincerlo, poi si vota.',
  'Spiegate {interesse} a chi non ne sa niente senza usare le parole tecniche.',
  '{interesse} contro {altro}: avete cinque minuti per decidere quale dei due sopravvive a un apocalisse.',
  'Se doveste passare un sabato intero facendo {interesse}, cosa vi spaventa di piu?',
  'Chi ha nominato {interesse} deve dire la cosa piu noiosa che comporta, onestamente.',
];

/** Costruite sulle curiosita' dichiarate: sono l'oro dei profili. */
export const CURIOSITY_PROMPTS = [
  'Nel profilo e comparso "{curiosita}". Serve la storia completa, non il riassunto.',
  '"{curiosita}": da quanto va avanti e chi nella vostra vita ancora non lo sa?',
  '"{curiosita}" e la cosa piu strana emersa stasera. L altro puo fare tre domande, una alla volta.',
];

/** Valori condivisi, girati in modo concreto e non predicatorio. */
export const VALUE_PROMPTS = [
  'Condividete {valore}: una volta in cui vi e costato qualcosa tenerci davvero?',
  'Su {valore}: dove finisce il principio e comincia la comodita, per ciascuno di voi?',
];

/** Ancorate al posto in cui siete, da giocare guardandosi intorno. */
export const VENUE_PROMPTS = {
  caffe_tranquillo: [
    'Scegliete un tavolo che non e il vostro e inventate cosa si stanno dicendo. Poi confrontate le versioni.',
    'Ordinate a testa quello che pensate piacerebbe all altro e vedete chi ha sbagliato di piu.',
  ],
  libreria: [
    'Cinque minuti, ognuno torna con un libro scelto per l altro. Bisogna motivare la scelta senza averlo letto.',
    'Aprite un libro a caso a pagina 42 e leggete la prima frase ad alta voce: e il vostro oroscopo della serata.',
  ],
  bar_serale: [
    'Guardatevi intorno e scegliete la persona con la storia piu improbabile. Costruitela insieme.',
    'Ognuno ordina qualcosa che non ha mai provato. Chi fa la faccia peggiore paga il prossimo giro.',
  ],
  aperitivo: [
    'Dividetevi il piatto peggiore del buffet e decretate chi ha avuto la parte piu ingiusta.',
    'Un aperitivo dice molto di una citta: cosa direbbe questo posto di Milano a uno straniero?',
  ],
  parco: [
    'Camminate finche uno dei due non trova qualcosa che merita di essere fotografata. Chi cede per primo?',
    'Scegliete un albero e decidete a quale dei due assomiglia di piu, con motivazione.',
  ],
  passeggiata: [
    'Regola: si gira a destra a ogni incrocio per quattro incroci. Dove siete finiti?',
    'Ognuno indica un palazzo in cui non vivrebbe mai e spiega perche.',
  ],
  museo: [
    'Ognuno sceglie l opera che appenderebbe in cucina. Nessuna scelta seria ammessa.',
    'Trovate insieme il quadro con la faccia piu antipatica e datele un nome.',
  ],
  mostra: [
    'Inventate la didascalia di un opera senza leggere quella vera, poi controllate quanto vi siete allontanati.',
    'Chi dei due dura di piu davanti a una sola opera senza tirare fuori il telefono?',
  ],
  mercato: [
    'Budget di cinque euro a testa: comprate la cosa piu strana e ve la dividete.',
    'Scegliete un banco e provate a indovinare da quanti anni ci lavora chi ci sta dietro.',
  ],
  boardgame_cafe: [
    'Ognuno sceglie un gioco per l altro basandosi solo sulla scatola. Si gioca quello scelto per voi.',
    'Prima partita: chi perde risponde a una domanda scelta dall altro dal mazzo.',
  ],
  gelateria: [
    'Ordinate a testa il gusto che l altro non prenderebbe mai. Un cucchiaino e obbligatorio.',
    'Classifica definitiva dei gusti sopravvalutati, e bisogna essere d accordo prima di finire il cono.',
  ],
  concerto_piccolo: [
    'Prima che inizi: scommettete su quanti pezzi durera prima che uno dei due dica "questo lo conosco".',
    'Descrivete la band che state per sentire a qualcuno che non l ha mai sentita, partendo solo dal nome.',
  ],
};

/** Carte valide sempre, indipendenti dai profili. */
export const UNIVERSAL_DECK = [
  { categoria: 'dilemma', testo: 'Chi di voi due sopravviverebbe piu a lungo su un isola deserta, e perche l altro si sbaglia?' },
  { categoria: 'dilemma', testo: 'Potete cancellare un ricordo vostro o leggere un ricordo di chiunque altro: cosa scegliete?' },
  { categoria: 'dilemma', testo: 'Meglio essere sempre in anticipo di venti minuti o sempre in ritardo di cinque, per sempre?' },
  { categoria: 'dilemma', testo: 'Sapere esattamente quando morirete o sapere esattamente come: si sceglie e si motiva.' },
  { categoria: 'dilemma', testo: 'Rifareste lo stesso identico anno di vita dieci volte o un anno diverso ma peggiore una sola volta?' },
  { categoria: 'dilemma', testo: 'Vi tolgono per sempre la musica o per sempre i libri: chi decide piu in fretta?' },
  { categoria: 'dilemma', testo: 'Meglio essere considerati bravissimi in una cosa che non vi interessa o mediocri in quella che amate?' },
  { categoria: 'ipotetico', testo: 'Vi svegliate domani con una abilita inutile ma spettacolare: quale scegliete?' },
  { categoria: 'ipotetico', testo: 'Avete un annuncio da leggere a tutta la citta, dieci secondi. Cosa dite?' },
  { categoria: 'ipotetico', testo: 'Se doveste sparire per un mese senza dare spiegazioni, dove vi troverebbero e chi indovinerebbe per primo?' },
  { categoria: 'ipotetico', testo: 'Vi affidano un locale in questa via per un anno: cosa ci mettete dentro?' },
  { categoria: 'ipotetico', testo: 'Domani cambiate mestiere e non potete tornare indietro: qual e la prima cosa che provate?' },
  { categoria: 'ipotetico', testo: 'Vi danno un ora di preavviso per un viaggio ovunque: cosa mettete in borsa e dove andate?' },
  { categoria: 'opinione_impopolare', testo: 'Un opinione impopolare che difendereste anche a tavola con dodici parenti contro.' },
  { categoria: 'opinione_impopolare', testo: 'Una cosa che tutti dicono di amare e che secondo voi amano per finta.' },
  { categoria: 'opinione_impopolare', testo: 'La regola sociale piu inutile che continuate a rispettare comunque.' },
  { categoria: 'opinione_impopolare', testo: 'Un classico intoccabile che secondo voi non regge piu: nominatelo e preparatevi a difenderlo.' },
  { categoria: 'opinione_impopolare', testo: 'Qualcosa di universalmente considerato rilassante che a voi mette ansia.' },
  { categoria: 'abitudini', testo: 'La cosa piu strana che fate quando siete soli in casa e che non avete mai raccontato.' },
  { categoria: 'abitudini', testo: 'Il piccolo rituale che vi rovina la giornata se salta.' },
  { categoria: 'abitudini', testo: 'Quanto tempo passa fra la sveglia e la prima parola detta ad alta voce?' },
  { categoria: 'abitudini', testo: 'Su cosa spendete piu di quanto ammettereste in pubblico?' },
  { categoria: 'abitudini', testo: 'La bugia piccolissima che dite piu spesso.' },
  { categoria: 'abitudini', testo: 'Come vi comportate davvero quando siete in ritardo: accelerate o vi arrendete?' },
  { categoria: 'retrospettiva', testo: 'La decisione presa in meno di un minuto che ha cambiato piu cose.' },
  { categoria: 'retrospettiva', testo: 'Una cosa che a vent anni vi sembrava fondamentale e oggi non riuscite nemmeno a ricordare perche.' },
  { categoria: 'retrospettiva', testo: 'Il complimento piu strano che vi abbiano fatto e che vi e rimasto addosso.' },
  { categoria: 'retrospettiva', testo: 'La cosa piu coraggiosa che avete fatto e che a nessuno e sembrata coraggiosa.' },
  { categoria: 'retrospettiva', testo: 'Un consiglio che avete ignorato e avevate ragione a ignorare.' },
  { categoria: 'gioco', testo: 'Due verita e una bugia, ma solo su cose successe questa settimana.' },
  { categoria: 'gioco', testo: 'Ognuno indovina tre cose sull altro. Vale solo se sono specifiche e rischiose.' },
  { categoria: 'gioco', testo: 'Descrivetevi a vicenda come vi descriverebbe il vostro migliore amico, esagerando.' },
  { categoria: 'gioco', testo: 'Scegliete una domanda che nessuno vi ha mai fatto e fatevela a vicenda.' },
  { categoria: 'gioco', testo: 'Un minuto ciascuno per raccontare la vostra giornata come se fosse il trailer di un film.' },
  { categoria: 'gioco', testo: 'Vietato dire "non lo so" per i prossimi dieci minuti: chi sgarra offre da bere.' },
];

/**
 * Argomenti banditi dal generatore. Servono anche da rete di sicurezza: un
 * test verifica che nessuna carta prodotta li contenga.
 */
export const BANNED_PATTERNS = [
  /che lavoro fai/i,
  /di cosa ti occupi/i,
  /quanti anni hai/i,
  /dove abiti/i,
  /sei fidanzat/i,
  /cosa cerchi (qui|su)/i,
  /parlami di te/i,
  /il tuo ex/i,
  /quanto guadagni/i,
];
