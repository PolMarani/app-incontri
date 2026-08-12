/**
 * Le battute e i rilanci del terzo compagno.
 *
 * Regole di tono, che sono la parte piu' importante di questo file:
 *
 *  1. Il compagno non e' il protagonista. Parla poco, e quando parla lascia
 *     subito la parola. Nessuna frase che chieda una risposta al compagno
 *     stesso.
 *  2. Non commenta MAI le due persone. Zero osservazioni su come parlano, su
 *     chi parla di piu', su come sta andando. Un terzo che ti giudica al primo
 *     appuntamento e' il peggior convitato possibile.
 *  3. Se fa dell'ironia, la fa su di se'. E' l'unica cosa presente al tavolo
 *     su cui puo' scherzare senza ferire nessuno.
 *  4. Niente entusiasmo forzato, niente emoji, niente "che bello!". Il
 *     registro e' quello di un amico che sta zitto in un angolo.
 */

/** Prima e unica presentazione, all'inizio della serata. */
export const APERTURA = [
  'Ci sono, ma sto per i fatti miei. Se vi serve qualcosa toccate lo schermo.',
  'Io resto qui in silenzio. Se vi si inceppa la conversazione ho qualche carta.',
];

/**
 * Cornici per rilanciare una carta dopo un silenzio. La carta arriva dal mazzo
 * della Fase 3: qui c'e' solo il modo di appoggiarla sul tavolo.
 */
export const RILANCIO_SILENZIO = [
  'Ne approfitto:',
  'Buttata li, poi torno a tacere:',
  'Carta:',
  'Se serve una spinta:',
];

/**
 * Rilanci rivolti a chi ha parlato di meno. Mai un nome, mai "tu che parli
 * poco": la formula indiretta lascia a entrambi la possibilita' di rispondere
 * e non mette nessuno sotto accusa.
 */
export const RIEQUILIBRIO = [
  'Questa la lascio a chi finora ha ascoltato di piu:',
  'Domanda per chi ha parlato meno negli ultimi minuti:',
  'Cambio direzione, e la giro a chi non l ha ancora raccontata:',
];

/** Cornici per una carta chiesta esplicitamente da uno dei due. */
export const SU_RICHIESTA = [
  'Subito:',
  'Eccola:',
  'Ne ho una buona:',
];

/**
 * Battute. Solo autoironia sul proprio essere un software seduto a un
 * appuntamento: mai sulle due persone, mai sul locale, mai sul come sta
 * andando.
 */
export const BATTUTE = [
  'Sto zitto, eh. Faccio finta di essere un sottobicchiere.',
  'Se vi state chiedendo se sono geloso: tecnicamente non posso, ma ci lavoro.',
  'Io a un appuntamento non ci sono mai stato. Prendo appunti, si vede?',
  'Continuate pure, io intanto fingo di guardare il menu.',
  'Piccola nota di servizio: sono l unico qui che non puo ordinare niente.',
  'Non sono geloso della piega che ha preso il discorso. Per niente.',
  'Vi avviso che se ridete io lo prendo come merito mio.',
  'Sono la terza ruota piu discreta della citta. Non e una gara che volevo vincere.',
];

/**
 * Proposte di chiusura, quando la serata si sta spegnendo da sola. Servono a
 * togliere l'imbarazzo di essere il primo a dire "andiamo": e' il compagno a
 * metterlo sul tavolo, cosi non lo deve fare nessuno dei due.
 */
export const CHIUSURA = [
  'Se volete chiudere qui e un buon punto. Nessuno dei due deve dirlo per primo: l ho detto io.',
  'Domanda di servizio: si continua o si chiude? Rispondete a gesti, non a me.',
  'Ultimo giro di carte oppure si va? Va bene comunque.',
];

/**
 * Cosa NON deve mai comparire in una frase del compagno. Un test lo verifica su
 * tutte le righe di questo file e su tutto quello che il motore produce.
 */
export const VIETATE = [
  // Nessun giudizio sulle persone o sull'andamento della serata.
  /stai andando (bene|male)/i,
  /sembr(i|a|ate) (a disagio|annoiat|nervos)/i,
  /(parli|parla) (troppo|poco)/i,
  /dovresti (essere|sembrare|parlare|sorridere)/i,
  /secondo me (lui|lei|l altr)/i,
  // Nessuna insinuazione su come finira'.
  /(vi|ti) piac(e|ete)/i,
  /andate a casa insieme/i,
  // Il compagno non chiede attenzione per se'.
  /come sto andando/i,
  /chiedetemi/i,
];
