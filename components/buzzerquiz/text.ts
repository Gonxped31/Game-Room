import { APP_TITLE } from "@/lib/games/registry";
import { type Card, FREEZE_MS } from "@/lib/games/buzzerquiz/constants";
import type { Outcome } from "@/lib/games/buzzerquiz/game";
import { formatList, plural, texts } from "@/lib/i18n/text";

/**
 * Buzzer Quiz's interface words (docs/i18n.md). They follow the page's
 * language; the questions follow the room's content language (`settings.lang`),
 * so a French player can play an English quiz. The How to play's words live
 * in Rules.tsx (they hold markup).
 */

type NoneReason = Extract<Outcome, { kind: "none" }>["reason"];

/** A thief on a right answer: their name, or `me` for this device's player. */
type Thief = { name: string; me: boolean };

/** Named WORDS: `TEXT` is ui.tsx's text-face class. */
export const WORDS = texts({
  en: {
    // Shared
    leaveRoom: "Leave room",
    backToHub: `Back to ${APP_TITLE}`,
    connecting: "Connecting to the room…",
    player: "Player",
    someone: "Someone",
    you: "You",
    youTag: "(you)",
    nameYou: (name: string) => `${name} (you)`,

    // Name entry
    nameRequired: "Enter your name to continue.",
    namePrompt: "What's your name?",
    namePlaceholder: "Your name",
    continue: "Continue",
    welcomeBack: "Welcome back! Which one are you on this device?",
    roomFull: "All 4 seats are taken. A seat frees up 2 minutes after its player goes offline.",
    iAm: (name: string) => `I'm ${name}`,
    justWatch: "Just watch",

    // Setup
    newQuiz: "New quiz",
    language: "Language",
    topics: "Topics",
    pickOne: "Pick at least one",
    picked: (n: number) => `${n} picked${n > 1 ? ", mixed" : ""}`,
    questions: "Questions",
    powerCards: "Power cards",
    off: "Off",
    on: "On",
    cardsBlurb: (hand: number) => `Everyone gets ${hand} of Freeze, Double, 50/50, Steal and Shield, one per question at most.`,
    toWaitingRoom: "Continue to the waiting room",
    linkNext: "Next you'll get a link to send to your friends.",
    scoringTitle: "How scoring works",
    scoringBody:
      "Buzz, then pick. Right with 4 choices left scores 3, with 3 left 2, with 2 left 1. A wrong pick is struck out for everyone, and you're out until the next question.",

    // Invite card
    inviteFriends: "Invite friends",
    copy: "Copy",
    copied: "Copied!",
    linkCopied: "Link copied",
    nameRoom: "Name this room (optional)",

    // Waiting room
    playingOnline: "Playing online",
    startsBySelf: "The quiz starts by itself once enough players are here.",
    startingIn: (s: number) => `Starting in ${s} s`,
    waitingForPlayers: "Waiting for more players…",
    gettingReady: "Getting ready…",
    waitingForPlayer: "Waiting for a player…",
    host: "Host",
    theQuiz: "The quiz",
    edit: "Edit",
    choosingTopics: (host: string | undefined) => `${host ?? "The host"} is choosing the topics…`,
    questionCount: (n: number) => `${n} questions`,
    needsPlayers: (n: number) => `Needs ${n} players`,
    startWith: (n: number) => `Start with ${n} players`,
    waitingForHost: (host: string | undefined) => `Waiting for ${host ?? "the host"} to start`,
    waitingRoom: "Waiting room",
    playersOf: (joined: number, total: number) => `Players · ${joined} of ${total}`,

    // Countdown
    questionOf: (n: number, total: number) => `Question ${n} of ${total}`,
    startingInSeconds: (s: number) => `Starting in ${s} seconds`,
    thumbReady: "Thumb on the buzzer…",

    // Final ranking
    wins: (names: string[]) => (names.length === 1 ? `${names[0]} wins!` : `${names.slice(0, -1).join(", ")} and ${names.at(-1)} win!`),
    ordinal: (n: number) => ["1st", "2nd", "3rd", "4th"][n - 1] ?? `${n}th`,
    finalRanking: "Final ranking",
    rematch: "Rematch",
    newTopics: "New topics",

    // A question
    resultsIn: (s: number) => `Results in ${s}`,
    nextQuestionIn: (s: number) => `Next question in ${s}`,
    worth: (n: number) => `Worth ${n} point${n === 1 ? "" : "s"}`,
    nowWorth: (n: number) => `Now worth ${n} point${n === 1 ? "" : "s"}`,
    noPoints: "No points this time",
    buzzed: (name: string) => `${name} buzzed!`,
    choosing: (s: number) => `Choosing… ${s} s`,
    yourTurn: "Your turn! Pick an answer",
    timeToAnswer: "Time to answer",
    /** Appended to the right-answer banner, with its leading space. */
    stole: (thieves: Thief[]) => ` ${thieves.map((t) => (t.me ? "You" : t.name)).join(" and ")} stole ${thieves.length === 1 ? "1 point" : "a point each"}.`,
    /** `name` null: this device's player. */
    gotIt: (name: string | null) => (name == null ? "You got it!" : `${name} got it!`),
    nobodyScored: (reason: NoneReason, answer: string) =>
      `Nobody scored. ${reason === "timeout" ? `Time's up. The answer was ${answer}.` : reason === "one-left" ? `Only one choice was left. The answer was ${answer}.` : `Everyone is out. The answer was ${answer}.`}`,
    wrongMe: "Wrong. You're out for this one.",
    wrongOther: (name: string, canBuzz: boolean) => `${name} was wrong.${canBuzz ? " Buzz again!" : ""}`,
    tooSlow: "Too slow. You're out for this one.",
    yourPick: "your pick",
    tapCaption: "Tap as soon as you know it",
    frozen: (s: number) => `Frozen! ${s} s`,
    othersCanBuzz: "The others can still buzz",
    pickAbove: "Pick an answer above",
    isAnswering: (name: string) => `${name} is answering`,
    buzzedCaption: "Buzzed!",
    secondsLeft: (s: number) => `${s} seconds left`,
    /** The desktop hint: "Press [Space] or click to buzz · Then pick with [A–D]". */
    keysPress: "Press",
    keysSpace: "Space",
    keysThen: "or click to buzz · Then pick with",
    watching: "You're watching. Join at the next rematch.",

    // Building blocks (ui.tsx)
    buzzerLocked: "Buzzer locked",
    buzzerWait: "Buzzer, wait",
    buzz: "Buzz",
    /** What the big buzzer says, by state. */
    buzzerFace: { locked: "LOCKED", wait: "WAIT", ready: "BUZZ" },
    struckOut: (text: string) => `${text}, struck out`,
    answer: "Answer",
    scores: "Scores",

    // Power cards
    cards: {
      freeze: { name: "Freeze", effect: `The others can't buzz for ${FREEZE_MS / 1000} s` },
      double: { name: "Double", effect: "Right answer: double points" },
      fifty: { name: "50/50", effect: "Two wrong answers vanish for you" },
      steal: { name: "Steal", effect: "Someone else right: take 1 point" },
      shield: { name: "Shield", effect: "Wrong: you can buzz again" },
    } as Record<Card, { name: string; effect: string }>,
    noCardsLeft: "No power cards left.",
    yourCards: "Your power cards",
    playACard: "Play a power card",
    playCardLabel: (name: string, effect: string) => `Play ${name}: ${effect}`,
    cardsPlayed: "Power cards played",
    /** `who` null: this device's player. */
    playedCard: (who: string | null, card: string) => `${who ?? "You"} played ${card}`,
  },
  fr: {
    leaveRoom: "Quitter le salon",
    backToHub: `Retour à ${APP_TITLE}`,
    connecting: "Connexion au salon…",
    player: "Joueur",
    someone: "Quelqu'un",
    you: "Toi",
    youTag: "(toi)",
    nameYou: (name) => `${name} (toi)`,

    nameRequired: "Entre ton nom pour continuer.",
    namePrompt: "Comment tu t'appelles ?",
    namePlaceholder: "Ton nom",
    continue: "Continuer",
    welcomeBack: "Te revoilà ! Qui es-tu sur cet appareil ?",
    roomFull: "Les 4 places sont prises. Une place se libère quand la personne qui l'occupe est hors ligne depuis 2 minutes.",
    iAm: (name) => `Je suis ${name}`,
    justWatch: "Juste regarder",

    newQuiz: "Nouveau quiz",
    language: "Langue des questions",
    topics: "Thèmes",
    pickOne: "Choisis-en au moins un",
    picked: (n) => plural("fr", n, `${n} choisi`, `${n} choisis, mélangés`),
    questions: "Questions",
    powerCards: "Cartes pouvoir",
    off: "Non",
    on: "Oui",
    cardsBlurb: (hand) => `Tout le monde reçoit ${hand} cartes parmi Gel, Double, 50/50, Vol et Bouclier, une par question au plus.`,
    toWaitingRoom: "Continuer vers la salle d'attente",
    linkNext: "Tu auras ensuite un lien à envoyer à tes amis.",
    scoringTitle: "Comment on marque",
    scoringBody:
      "Buzze, puis choisis. Une bonne réponse rapporte 3 points avec 4 choix restants, 2 avec 3 et 1 avec 2. Un mauvais choix est barré pour tout le monde, et tu es hors jeu jusqu'à la question suivante.",

    inviteFriends: "Invite tes amis",
    copy: "Copier",
    copied: "Copié !",
    linkCopied: "Lien copié",
    nameRoom: "Nomme ce salon (facultatif)",

    playingOnline: "Partie en ligne",
    startsBySelf: "Le quiz commence tout seul dès qu'il y a assez de joueurs.",
    startingIn: (s) => `Début dans ${s} s`,
    waitingForPlayers: "En attente d'autres joueurs…",
    gettingReady: "On se prépare…",
    waitingForPlayer: "En attente d'un joueur…",
    host: "Hôte",
    theQuiz: "Le quiz",
    edit: "Modifier",
    choosingTopics: (host) => `${host ?? "L'hôte"} choisit les thèmes…`,
    questionCount: (n) => `${n} questions`,
    needsPlayers: (n) => `Il faut ${n} joueurs`,
    startWith: (n) => `Commencer à ${n} joueurs`,
    waitingForHost: (host) => `On attend que ${host ?? "l'hôte"} lance le quiz`,
    waitingRoom: "Salle d'attente",
    playersOf: (joined, total) => `Joueurs · ${joined} sur ${total}`,

    questionOf: (n, total) => `Question ${n} sur ${total}`,
    startingInSeconds: (s) => `Début dans ${plural("fr", s, `${s} seconde`, `${s} secondes`)}`,
    thumbReady: "Le pouce sur le buzzer…",

    wins: (names) => `${formatList("fr", names)} ${names.length === 1 ? "gagne" : "gagnent"} !`,
    ordinal: (n) => (n === 1 ? "1er" : `${n}e`),
    finalRanking: "Classement final",
    rematch: "Revanche",
    newTopics: "Nouveaux thèmes",

    resultsIn: (s) => `Résultats dans ${s}`,
    nextQuestionIn: (s) => `Question suivante dans ${s}`,
    worth: (n) => `Vaut ${plural("fr", n, `${n} point`, `${n} points`)}`,
    nowWorth: (n) => `Ne vaut plus que ${plural("fr", n, `${n} point`, `${n} points`)}`,
    noPoints: "Aucun point cette fois",
    buzzed: (name) => `${name} a buzzé !`,
    choosing: (s) => `Choisit… ${s} s`,
    yourTurn: "À toi ! Choisis une réponse",
    timeToAnswer: "Temps pour répondre",
    stole: (thieves) =>
      thieves.length === 1
        ? thieves[0].me
          ? " Tu as volé 1 point."
          : ` ${thieves[0].name} a volé 1 point.`
        : ` Points volés (1 chacun) : ${formatList("fr", thieves.map((t) => (t.me ? "toi" : t.name)))}.`,
    gotIt: (name) => (name == null ? "Tu as trouvé !" : `${name} a trouvé !`),
    nobodyScored: (reason, answer) =>
      `Personne n'a marqué. ${reason === "timeout" ? "Temps écoulé." : reason === "one-left" ? "Il ne restait qu'un choix." : "Plus personne ne peut répondre."} La réponse était ${answer}.`,
    wrongMe: "Raté. Tu es hors jeu pour celle-ci.",
    wrongOther: (name, canBuzz) => `Mauvaise réponse de ${name}.${canBuzz ? " Tu peux buzzer !" : ""}`,
    tooSlow: "Trop tard. Tu es hors jeu pour celle-ci.",
    yourPick: "ton choix",
    tapCaption: "Appuie dès que tu sais",
    frozen: (s) => `Buzzer gelé ! ${s} s`,
    othersCanBuzz: "Les autres peuvent encore buzzer",
    pickAbove: "Choisis une réponse plus haut",
    isAnswering: (name) => `${name} répond`,
    buzzedCaption: "Buzz envoyé !",
    secondsLeft: (s) => plural("fr", s, `${s} seconde restante`, `${s} secondes restantes`),
    keysPress: "Appuie sur",
    keysSpace: "Espace",
    keysThen: "ou clique pour buzzer · Puis choisis avec",
    watching: "Tu regardes la partie. Tu joueras à la prochaine revanche.",

    buzzerLocked: "Buzzer bloqué",
    buzzerWait: "Buzzer, attends",
    buzz: "Buzzer",
    // PAUSE, not ATTENDS: the word has to fit inside the buzzer.
    buzzerFace: { locked: "BLOQUÉ", wait: "PAUSE", ready: "BUZZ" },
    struckOut: (text) => `${text}, barré`,
    answer: "Réponse",
    scores: "Scores",

    cards: {
      freeze: { name: "Gel", effect: `Personne d'autre ne buzze pendant ${FREEZE_MS / 1000} s` },
      double: { name: "Double", effect: "Bonne réponse : points doublés" },
      fifty: { name: "50/50", effect: "Deux mauvaises réponses disparaissent pour toi" },
      steal: { name: "Vol", effect: "Quelqu'un d'autre trouve : tu lui prends 1 point" },
      shield: { name: "Bouclier", effect: "Raté : tu peux buzzer à nouveau" },
    },
    noCardsLeft: "Plus de cartes pouvoir.",
    yourCards: "Tes cartes pouvoir",
    playACard: "Joue une carte pouvoir",
    playCardLabel: (name, effect) => `Jouer ${name} : ${effect}`,
    cardsPlayed: "Cartes pouvoir jouées",
    playedCard: (who, card) => (who == null ? `Tu as joué ${card}` : `${who} a joué ${card}`),
  },
});
