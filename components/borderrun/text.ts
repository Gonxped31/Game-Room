import type { Area } from "@/lib/games/borderrun/constants";
import type { Refusal } from "@/lib/games/borderrun/play";
import type { Closeness } from "@/lib/games/borderrun/route";
import type { Lang } from "@/lib/i18n/lang";
import { plural, texts } from "@/lib/i18n/text";

/**
 * Detour's words (docs/i18n.md). Country and capital names come from
 * countries.json and map names from AREA_NAME (lib/games/borderrun/areas.ts);
 * How to play's are in Rules.tsx; everything else a player reads is here.
 * Plain module, no next/* imports: the offline export (exports/borderrun/)
 * bundles it.
 *
 * French: a route is « un parcours » (invariable: "3 parcours"), a guess
 * « un essai », and the par stays « le par » (golf's word in French too).
 */

/** Narrow no-break space (before ? ! ;) and no-break space (before :, inside « »). */
export const NNBSP = " ";
export const NBSP = " ";

/** "#3" / "3e" ("1er"): a place on a board. */
const place = (lang: Lang, n: number) => (lang === "fr" ? `${n}${n === 1 ? "er" : "e"}` : `#${n}`);

const essais = (n: number) => plural("fr", n, `${n} essai`, `${n} essais`);

/** "en Europe", "dans le monde": where a best was set. */
const AREA_IN_FR: Record<Area, string> = {
  europe: "en Europe",
  americas: "dans les Amériques",
  africa: "en Afrique",
  asia: "en Asie",
  eurasia: "en Europe et Asie",
  world: "dans le monde",
};

/**
 * The daily routes' messages (lib/daily/client.ts, app/api/daily/, the
 * service and Detour's verify) come in English; these are the French for the
 * ones a player can meet. Anything else reads as the generic one.
 */
const SERVER_ERROR_FR: Record<string, string> = {
  "The daily puzzle needs a connection.": "Le défi du jour a besoin d'une connexion.",
  "Can't reach the server. Check your connection.": "Impossible de joindre le serveur. Vérifie ta connexion.",
  "Something went wrong. Try again.": "Un problème est survenu. Réessaie.",
  "The daily puzzle isn't available here.": "Le défi du jour n'est pas disponible ici.",
  "That puzzle is over.": "Ce défi est terminé.",
  "Press Start first.": "Appuie d'abord sur Commencer.",
  "That route isn't complete.": "Ce parcours n'est pas terminé.",
};

export const TEXT = texts({
  en: {
    loading: "Loading…",
    modeLabel: "Mode",
    modeDaily: "Daily route",
    modeEndless: "Endless",
    back: "Back to all games",

    // The route's header and the toolbar.
    par: (n: number) => `par ${n}`,
    to: "to",
    and: "and",
    closedBorders: (n: number): string => (n === 1 ? "Closed border: " : "Closed borders: "),
    timeLabel: (time: string) => `Time ${time}`,
    best: (time: string) => ` · best ${time}`,
    guesses: (n: number) => `${n} ${n === 1 ? "guess" : "guesses"}`,

    // The guess box.
    refusal: {
      // Also what a part of the start's name gets ("Fra" when France is the start): it isn't offered either.
      unknown: (name: string) => `No country left on this map matches “${name}”.`,
      "not-on-map": (name: string, area: string) => `${name} isn’t on this map (${area}).`,
      endpoint: (name: string) => `${name} is the start or the end already.`,
      repeat: (name: string) => `You already tried ${name}.`,
      done: () => "The route is complete.",
    } as Record<Refusal, (name: string, area: string) => string>,
    guessLabel: "Guess a country",
    placeholder: "A country…",
    guess: "Guess",
    countries: "Countries",
    yourGuesses: "Your guesses",
    closeness: { best: "On route", close: "Close", off: "Off route" } as Record<Closeness, string>,
    hint: (start: string) => `Name a country that borders ${start}, or any on the way.`,
    capitals: (from: string, to: string) => `${from} → ${to}:`,
    crowFlies: (km: string) => `${km} km as the crow flies, capital to capital`,

    // The map.
    mapLabel: (area: string, shown: string) => `Map of ${area}: ${shown}`,
    tone: { endpoint: "start or end", best: "on a shortest route", close: "close", off: "off the route", reveal: "a route" },
    wholeMap: "Show the whole map",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",

    // Endless.
    endless: "Endless",
    endlessIntro: "Pick a map, then start. Link the two countries by land in as few guesses as you can.",
    map: "Map",
    yourBest: (area: Area, areaName: string, time: string) => `Your best on ${areaName}: ${time}`,
    noBest: "No best score on this map yet.",
    start: "Start",
    change: "Change",
    routeComplete: (time: string) => `Route complete: ${time}`,
    pastPar: (time: string, seconds: number, extra: number) => `${time} + ${seconds} s for ${extra} ${extra === 1 ? "guess" : "guesses"} past par. `,
    onPar: "On par. ",
    newBest: "A new best on this map.",
    bestWas: (time: string) => `Best ${time}.`,
    nextRoute: "Next route",
    oneWay: "One way through",
    showRoute: "Show a route",
    newRoute: "New route",

    // The daily route.
    loadingDaily: "Loading today's route…",
    daily: (n: number) => `Daily #${n}`,
    dailyIntro: (seconds: number) => `Two countries, a border or two closed. Link them by land: ${seconds} s added for each guess past the par.`,
    boardName: "Your name on the board",
    anonymous: "Anonymous",
    starting: "Starting…",
    dailyNote: "The clock starts when you press Start. One try a day.",
    streakShort: (n: number) => ` Streak: ${n} 🔥`,
    todaysBoard: "Today's board",
    checking: "Checking…",
    complete: "Route complete",
    tryAgain: "Try again",
    doneIn: (time: string) => `Done in ${time}`,
    penaltyNote: (time: string, seconds: number) => `${time} + ${seconds} s for guesses past the par`,
    rankToday: (rank: number, players: number) => `${place("en", rank)} of ${players} today`,
    unranked: {
      connection: "Not ranked: someone on this connection already played today's ranked route.",
      "too-fast": "Not ranked: that was faster than a person can type.",
      regular: "Not ranked: those guesses didn't look like a person playing.",
    } as Record<string, string>,
    streak: (n: number) => `Streak: ${n} ${n === 1 ? "day" : "days"} 🔥`,
    share: "Share",
    copied: "Copied. Paste it anywhere.",
    shareRank: (rank: number, players: number) => ` · ${place("en", rank)} of ${players}`,
    shareStreak: (n: number) => ` · ${n} days 🔥`,
    endlessStillWorks: "Endless routes still work: switch to Endless above.",
    /** A daily server message (English): shown as it is. */
    serverError: (message: string) => message,
  },
  fr: {
    loading: "Chargement…",
    modeLabel: "Mode",
    modeDaily: "Défi du jour",
    modeEndless: "Infini",
    back: "Retour à tous les jeux",

    par: (n) => `par ${n}`,
    to: "vers",
    and: "et",
    closedBorders: (n) => (n === 1 ? `Frontière fermée${NBSP}: ` : `Frontières fermées${NBSP}: `),
    timeLabel: (time) => `Temps ${time}`,
    best: (time) => ` · record ${time}`,
    guesses: essais,

    // Names go inside « », so they read without their article (« France », not « la France »).
    refusal: {
      unknown: (name) => `Aucun pays restant sur cette carte ne correspond à «${NBSP}${name}${NBSP}».`,
      "not-on-map": (name, area) => `«${NBSP}${name}${NBSP}» n'est pas sur cette carte (${area}).`,
      endpoint: (name) => `«${NBSP}${name}${NBSP}» est déjà le départ ou l'arrivée.`,
      repeat: (name) => `Tu as déjà essayé «${NBSP}${name}${NBSP}».`,
      done: () => "Le parcours est terminé.",
    },
    guessLabel: "Propose un pays",
    placeholder: "Un pays…",
    guess: "Valider",
    countries: "Pays",
    yourGuesses: "Tes essais",
    closeness: { best: "Sur le parcours", close: "Proche", off: "Hors parcours" },
    hint: (start) => `Nomme un pays voisin du départ (${start}), ou n'importe lequel sur le chemin.`,
    capitals: (from, to) => `${from} → ${to}${NBSP}:`,
    crowFlies: (km) => `${km} km à vol d'oiseau, de capitale à capitale`,

    mapLabel: (area, shown) => `Carte (${area})${NBSP}: ${shown}`,
    tone: { endpoint: "départ ou arrivée", best: "sur un plus court chemin", close: "proche", off: "hors parcours", reveal: "un parcours" },
    wholeMap: "Voir toute la carte",
    zoomIn: "Zoomer",
    zoomOut: "Dézoomer",

    endless: "Infini",
    endlessIntro: "Choisis une carte, puis commence. Relie les deux pays par la terre en le moins d'essais possible.",
    map: "Carte",
    yourBest: (area, _areaName, time) => `Ton record ${AREA_IN_FR[area]}${NBSP}: ${time}`,
    noBest: "Pas encore de record sur cette carte.",
    start: "Commencer",
    change: "Changer",
    routeComplete: (time) => `Parcours terminé${NBSP}: ${time}`,
    pastPar: (time, seconds, extra) => `${time} + ${seconds} s pour ${essais(extra)} au-delà du par. `,
    onPar: "Pile le par. ",
    newBest: "Nouveau record sur cette carte.",
    bestWas: (time) => `Record${NBSP}: ${time}.`,
    nextRoute: "Parcours suivant",
    oneWay: "Un chemin possible",
    showRoute: "Voir un parcours",
    newRoute: "Nouveau parcours",

    loadingDaily: "Chargement du parcours du jour…",
    daily: (n) => `Défi du jour n°${NBSP}${n}`,
    dailyIntro: (seconds) => `Deux pays, une ou deux frontières fermées. Relie-les par la terre${NBSP}: ${seconds} s de plus pour chaque essai au-delà du par.`,
    boardName: "Ton nom au classement",
    anonymous: "Anonyme",
    starting: "Lancement…",
    dailyNote: "Le chrono démarre quand tu appuies sur Commencer. Une tentative par jour.",
    streakShort: (n) => ` Série${NBSP}: ${n} 🔥`,
    todaysBoard: "Classement du jour",
    checking: "Vérification…",
    complete: "Parcours terminé",
    tryAgain: "Réessayer",
    doneIn: (time) => `Terminé en ${time}`,
    penaltyNote: (time, seconds) => `${time} + ${seconds} s pour les essais au-delà du par`,
    rankToday: (rank, players) => `${place("fr", rank)} sur ${players} aujourd'hui`,
    unranked: {
      connection: `Hors classement${NBSP}: quelqu'un sur cette connexion a déjà joué le parcours classé du jour.`,
      "too-fast": `Hors classement${NBSP}: c'est plus rapide que ce qu'une personne peut taper.`,
      regular: `Hors classement${NBSP}: ces essais ne ressemblent pas à ceux d'une personne.`,
    },
    streak: (n) => `Série${NBSP}: ${plural("fr", n, `${n} jour`, `${n} jours`)} 🔥`,
    share: "Partager",
    copied: `Copié${NNBSP}! Colle-le où tu veux.`,
    shareRank: (rank, players) => ` · ${place("fr", rank)} sur ${players}`,
    shareStreak: (n) => ` · ${n} jours 🔥`,
    endlessStillWorks: `Le mode Infini marche toujours${NBSP}: passe sur Infini plus haut.`,
    serverError: (message) => SERVER_ERROR_FR[message] ?? "Un problème est survenu. Réessaie.",
  },
});

/** The race room's words (app/borderrun/page.tsx, components/borderrun/race/Screens.tsx); mode names and start problems come from components/race/Screens.tsx. */
export const RACE_TEXT = texts({
  en: {
    modeLine: {
      challenge: (min: number, max: number) => `${min}–${max} players. The lowest total time wins.`,
      survival: (min: number, max: number) => `${min}–${max} players. The slowest are out after each route.`,
    },
    modeLabel: "Mode",
    mixed: "Mixed",
    map: "Map",
    mapLine: (map: string) => `Map: ${map}`,
    routesSuffix: (n: number) => `, ${n} routes`,
    routes: "Routes",
    routeCount: (n: string) => `${n} routes`,
    /** RoundView's `unit`: "You gave up this route." */
    unit: "route",
    connecting: "Connecting to the room…",
    lobbyRules: "Each route is the same for everyone. The time limit is 3 minutes; each guess past the par adds 15 s.",
    startingIn: (s: number) => `Starting in ${s} s`,
    waiting: (min: number) => `Waiting for more players… (${min} needed)`,
    gettingReady: "Getting ready…",
    doneIn: (time: string, extra: number) => `Done in ${time}${extra ? ` (${extra} past the par)` : ""}.`,
    gaveUp: "Gave up",
    progress: (found: number, par: number, guesses: number) => `${found} of ${par} found, ${guesses} ${guesses === 1 ? "guess" : "guesses"}`,
    routeOf: (n: number, total: number) => `Route ${n} of ${total}`,
    routeLeft: (n: number, left: number) => `Route ${n}, ${left} left`,
    route: (n: number) => `Route ${n}`,
    didntFinish: "Didn't finish",
    pastPar: (extra: number, seconds: number) => `${extra} past the par, +${seconds} s`,
    onPar: "On par",
    found: (found: number, par: number) => `${found} of ${par} found`,
    finalIn: (s: number) => `Final standings in ${s} s`,
    nextIn: (s: number) => `Next route in ${s} s`,
    /** `who` null: mine. */
    caption: (who: string | null, theRoute: boolean) => `${who === null ? "Your" : `${who}'s`} guesses, and ${theRoute ? "the route" : "a route"}:`,
    winner: "Winner",
    outOn: (n: number) => `Out on route ${n}`,
    finished: (done: number, of: number) => `${done} of ${of} routes finished`,
    played: (n: number) => `${n} ${n === 1 ? "route" : "routes"} played`,
    youWin: "You win!",
    wins: (name: string) => `${name} wins!`,
    gameOver: "Game over",
    loadingMode: (mode: string) => `Loading the ${mode}…`,
  },
  fr: {
    modeLine: {
      challenge: (min, max) => `De ${min} à ${max} joueurs. Le plus petit temps total gagne.`,
      survival: (min, max) => `De ${min} à ${max} joueurs. Les plus lents sont éliminés après chaque parcours.`,
    },
    modeLabel: "Mode",
    mixed: "Mixte",
    map: "Carte",
    mapLine: (map) => `Carte${NBSP}: ${map}`,
    routesSuffix: (n) => `, ${n} parcours`,
    routes: "Parcours",
    routeCount: (n) => `${n} parcours`,
    unit: "parcours",
    connecting: "Connexion au salon…",
    lobbyRules: `Le même parcours pour tout le monde. Limite de temps${NBSP}: 3 minutes${NNBSP}; chaque essai au-delà du par ajoute 15 s.`,
    startingIn: (s) => `Début dans ${s} s`,
    waiting: (min) => `En attente d'autres joueurs… (il en faut ${min})`,
    gettingReady: "Préparation…",
    doneIn: (time, extra) => `Terminé en ${time}${extra ? ` (${essais(extra)} au-delà du par)` : ""}.`,
    gaveUp: "Abandon",
    progress: (found, par, guesses) => `${found} sur ${par} trouvés, ${essais(guesses)}`,
    routeOf: (n, total) => `Parcours ${n} sur ${total}`,
    routeLeft: (n, left) => `Parcours ${n}, ${left} en lice`,
    route: (n) => `Parcours ${n}`,
    didntFinish: "Pas terminé",
    pastPar: (extra, seconds) => `${essais(extra)} au-delà du par, +${seconds} s`,
    onPar: "Pile le par",
    found: (found, par) => `${found} sur ${par} trouvés`,
    finalIn: (s) => `Classement final dans ${s} s`,
    nextIn: (s) => `Parcours suivant dans ${s} s`,
    caption: (who, theRoute) => `${who === null ? "Tes essais" : `Les essais de ${who}`}, et ${theRoute ? "le parcours" : "un parcours"}${NBSP}:`,
    winner: "Victoire",
    outOn: (n) => `Hors course au parcours ${n}`,
    finished: (done, of) => `${plural("fr", done, `${done} parcours terminé`, `${done} parcours terminés`)} sur ${of}`,
    played: (n) => plural("fr", n, `${n} parcours joué`, `${n} parcours joués`),
    youWin: `Tu gagnes${NNBSP}!`,
    wins: (name) => `${name} gagne${NNBSP}!`,
    gameOver: "Partie terminée",
    loadingMode: (mode) => `Chargement du mode ${mode}…`,
  },
});
