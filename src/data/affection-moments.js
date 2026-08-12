/**
 * I momenti di affetto, in scala.
 *
 * L'intensita' non si salta: si sale di un gradino alla volta, e solo se il
 * gradino precedente e' stato accettato da entrambi. Un abbraccio lungo
 * proposto a freddo al minuto venti non e' un momento di affetto, e' una
 * richiesta imbarazzante fatta da un telefono.
 *
 * `minMinuti` e' il tempo minimo dall'inizio; `finaleSerata` marca i gesti che
 * hanno senso solo al momento di salutarsi.
 */

/**
 * @typedef {Object} MomentoAffetto
 * @property {string} id
 * @property {number} intensita     1..5, l ordine della scala
 * @property {string} titolo
 * @property {string} istruzione    cosa fare, detto a entrambi
 * @property {string} [nota]        perche, quando aiuta saperlo
 * @property {number} minMinuti
 * @property {boolean} [finaleSerata]
 * @property {number} [durataSec]
 */

/** @type {MomentoAffetto[]} */
export const MOMENTI = [
  {
    id: 'brindisi',
    intensita: 1,
    titolo: 'Un brindisi',
    istruzione:
      'Brindate a qualcosa di preciso successo stasera. Non "a noi": a una cosa ' +
      'detta negli ultimi dieci minuti.',
    minMinuti: 10,
  },
  {
    id: 'cinque',
    intensita: 1,
    titolo: 'Un cinque',
    istruzione: 'Un cinque, alla prima cosa su cui vi trovate d accordo. Anche una scema.',
    minMinuti: 10,
  },
  {
    id: 'mano',
    intensita: 2,
    titolo: 'Un contatto di mano',
    istruzione:
      'La prossima volta che vi passate qualcosa - il bicchiere, il menu, il telefono - ' +
      'fatelo senza evitare le dita.',
    nota: 'E il gradino piu piccolo che esista: serve a capire se il contatto e benvenuto.',
    minMinuti: 20,
  },
  {
    id: 'bacio_guancia',
    intensita: 3,
    titolo: 'Un bacio sulla guancia',
    istruzione: 'Uno solo, sulla guancia. Come si saluta qualcuno a cui si vuole bene.',
    minMinuti: 35,
  },
  {
    id: 'abbraccio_breve',
    intensita: 4,
    titolo: 'Un abbraccio breve',
    istruzione: 'Un abbraccio di due o tre secondi. Quello normale, senza pensarci troppo.',
    minMinuti: 45,
    durataSec: 3,
  },
  {
    id: 'abbraccio_lungo',
    intensita: 5,
    titolo: 'Un abbraccio di venti secondi',
    istruzione:
      'Venti secondi contati davvero. I primi cinque sono un saluto, dal decimo in ' +
      'poi diventa un abbraccio: quasi nessuno arriva mai fin li.',
    nota:
      'Se a meta uno dei due ride, va benissimo: e la reazione piu comune e non ' +
      'significa che state sbagliando.',
    minMinuti: 60,
    finaleSerata: true,
    durataSec: 20,
  },
];

/**
 * Come viene presentata la proposta, sullo schermo di una sola persona.
 * Il tono e' quello di un suggerimento che si puo' buttare via: nessuna
 * insistenza, nessun "dai", nessuna promessa su cosa succedera' dopo.
 */
export const CORNICI = [
  'Solo per te, l altra persona non sta leggendo questo.',
  'Ti va? Se dici di no non lo sapra nessuno.',
  'Una proposta. Vale zero se non ti va.',
];

/** Testo del rifiuto: deve costare un tocco e nient'altro. */
export const RIFIUTO = {
  etichetta: 'Non ora',
  conferma: 'Ok. Non risulta da nessuna parte e non te lo richiedo a breve.',
};

/** Testo mostrato quando la proposta non va in porto, qualunque sia il motivo. */
export const ESITO_NEUTRO =
  'Per stavolta niente. Nessun motivo da cercare: puo essere qualsiasi cosa.';
