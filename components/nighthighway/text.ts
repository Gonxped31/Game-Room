import { LOCALES, texts } from "@/lib/i18n/text";

/**
 * Night Highway's words in English and French (docs/i18n.md). Plain data and
 * functions, no React or next/*: the engine (./engine/engine.js) takes
 * ENGINE_TEXT[lang] from the stage, and the offline download bundles this too.
 *
 * French keyboards: the engine reads keys by position (`e.code`), so on AZERTY
 * the keys under W and A are labelled Z and Q. The French key hints name both.
 */

// Numbers, as the engine wrote them (en-US) and as French writes them ("12 500", "3,2").
const enNum = (n: number) => Math.floor(n).toLocaleString("en-US");
const FR_INT = new Intl.NumberFormat(LOCALES.fr, { maximumFractionDigits: 0 });
const FR_DEC = [1, 2].map((digits) => new Intl.NumberFormat(LOCALES.fr, { minimumFractionDigits: digits, maximumFractionDigits: digits }));
const frNum = (n: number) => FR_INT.format(Math.floor(n));
const frDec = (n: number, digits: 1 | 2) => FR_DEC[digits - 1].format(n);

/** What the engine writes itself: messages, pop-ups, the HUD's live lines, solo's results. */
export interface EngineText {
  /** No WebGL: shown on the boot screen instead of the game. */
  noWebGL: string;
  /** The graphics failed to start. */
  bootError: string;
  /** A whole number (scores), with the language's digit grouping. */
  num: (n: number) => string;
  /** The clock (1 digit) and kilometres (2 digits). */
  decimal: (n: number, digits: 1 | 2) => string;
  /** The countdown's last word, after 3, 2, 1. */
  go: string;
  nitro: string;
  nitroSub: (percent: number) => string;
  phase: string;
  phaseSub: (seconds: number) => string;
  shield: string;
  shieldSub: string;
  shieldUsed: string;
  crash: string;
  crashSub: string;
  nearMiss: string;
  closeCall: string;
  rain: string;
  rainSub: string;
  soundOn: string;
  soundOff: string;
  /** The V key's cameras, in the engine's CAMS order. */
  cams: readonly [string, string, string, string];
  /** The C key's paints, in the engine's PAINTS order. */
  paints: readonly [string, string, string, string, string, string, string];
  /** The L key's light glows, in the engine's GLOW order. */
  glows: readonly [string, string, string];
  /** The HUD's pickup line. */
  phaseLeft: (seconds: number) => string;
  shieldUp: string;
  /** The HUD's line about the other racer. */
  sideBySide: string;
  ahead: (metres: number) => string;
  behind: (metres: number) => string;
  /** Solo's title card and results. */
  bestLine: (best: number) => string;
  newBest: string;
  runComplete: string;
  previousBest: (best: number) => string;
  firstRun: string;
  best: (best: number) => string;
}

export const ENGINE_TEXT = texts<EngineText>({
  en: {
    noWebGL: "This game needs WebGL, and this browser has it turned off. Try another browser or turn on hardware acceleration.",
    bootError: "The graphics engine hit an error while starting. Reloading the page usually fixes it.",
    num: enNum,
    decimal: (n, digits) => n.toFixed(digits),
    go: "Go",
    nitro: "Nitro",
    nitroSub: (percent) => `+${percent}%`,
    phase: "Phase",
    phaseSub: (seconds) => `${seconds} s · drive through traffic`,
    shield: "Shield",
    shieldSub: "absorbs your next crash",
    shieldUsed: "crash absorbed",
    crash: "Crash",
    crashSub: "combo lost",
    nearMiss: "Near miss",
    closeCall: "Close call",
    rain: "Rain",
    rainSub: "wet road · the car slides",
    soundOn: "Sound on",
    soundOff: "Sound off",
    cams: ["Chase camera", "Cinematic camera", "Bumper camera", "Roof camera"],
    paints: ["Midnight blue", "Candy red", "Pearl white", "Gloss black", "Ultraviolet", "Harbor teal", "Sunset orange"],
    glows: ["Soft lights", "Normal lights", "Vivid lights"],
    phaseLeft: (seconds) => `Phase ${seconds.toFixed(1)} s`,
    shieldUp: "Shield up",
    sideBySide: "side by side",
    ahead: (metres) => `${metres} m ahead`,
    behind: (metres) => `${metres} m behind`,
    bestLine: (best) => `Best run on this device: ${enNum(best)}`,
    newBest: "New best run",
    runComplete: "Run complete",
    previousBest: (best) => `Previous best ${enNum(best)}`,
    firstRun: "First run on this device",
    best: (best) => `Best ${enNum(best)}`,
  },
  fr: {
    noWebGL: "Ce jeu a besoin de WebGL, et ce navigateur l'a désactivé. Essaie un autre navigateur ou active l'accélération matérielle.",
    bootError: "Le moteur graphique a rencontré une erreur au démarrage. Recharger la page règle généralement le problème.",
    num: frNum,
    decimal: frDec,
    // "Go" is what French countdowns shout too, and "Partez !" won't fit the countdown's huge type on a phone.
    go: "Go",
    nitro: "Nitro",
    nitroSub: (percent) => `+${percent} %`,
    phase: "Passe-muraille",
    phaseSub: (seconds) => `${seconds} s · traverse la circulation`,
    shield: "Bouclier",
    shieldSub: "encaisse ta prochaine collision",
    shieldUsed: "collision encaissée",
    crash: "Collision",
    crashSub: "combo perdu",
    nearMiss: "Frôlement",
    closeCall: "De justesse",
    rain: "Pluie",
    rainSub: "route mouillée · la voiture glisse",
    soundOn: "Son activé",
    soundOff: "Son coupé",
    cams: ["Caméra poursuite", "Caméra cinéma", "Caméra pare-chocs", "Caméra toit"],
    paints: ["Bleu nuit", "Rouge bonbon", "Blanc nacré", "Noir brillant", "Ultraviolet", "Bleu canard", "Orange couchant"],
    glows: ["Lumières douces", "Lumières normales", "Lumières vives"],
    phaseLeft: (seconds) => `Passe-muraille ${frDec(seconds, 1)} s`,
    shieldUp: "Bouclier actif",
    sideBySide: "côte à côte",
    ahead: (metres) => `${metres} m devant`,
    behind: (metres) => `${metres} m derrière`,
    bestLine: (best) => `Record sur cet appareil : ${frNum(best)}`,
    newBest: "Nouveau record",
    runComplete: "Course terminée",
    previousBest: (best) => `Ancien record ${frNum(best)}`,
    firstRun: "Première course sur cet appareil",
    best: (best) => `Record ${frNum(best)}`,
  },
});

/** Words both the stage and the race screens show. */
const EN_SHARED = {
  phoneNote: "Best on a computer: on a phone, Night Highway may lag.",
  back: "Back to all games",
  pickups: "Pickups",
  rain: "Rain",
  desert: "Desert",
  score: "Score",
  distance: "Distance",
  topSpeed: "Top speed",
  average: "Average",
  nearMisses: "Near misses",
  overtakes: "Overtakes",
  crashes: "Crashes",
};
const FR_SHARED: typeof EN_SHARED = {
  phoneNote: "Mieux sur ordinateur : sur téléphone, Night Highway peut saccader.",
  back: "Retour à tous les jeux",
  pickups: "Bonus",
  rain: "Pluie",
  desert: "Désert",
  score: "Score",
  distance: "Distance",
  topSpeed: "Vitesse max",
  average: "Moyenne",
  nearMisses: "Frôlements",
  overtakes: "Dépassements",
  crashes: "Collisions",
};

/** The stage's markup (Stage.tsx): HUD labels, touch controls, solo's title and results cards. */
export const STAGE_TEXT = texts({
  en: {
    ...EN_SHARED,
    canvas: "Night Highway driving game",
    time: "Time",
    /** The HUD's "0.00 km · 3 near misses": the words around the near-miss count. */
    nearMissesBefore: "",
    nearMissesAfter: " near misses",
    hint: "W / ↑ gas · S / ↓ brake · A D / ← → steer",
    hint2: "Shift or Space nitro · V camera · C paint · L glow · H hide HUD",
    /** Solo only (no pausing in a race). */
    hintPause: " · P pause",
    gear: "Gear",
    kickerCity: "60 seconds · one road · after midnight",
    kickerDesert: "60 seconds · one canyon · at sundown",
    lede: "Weave through late traffic, chain near misses for points, and see how far one minute takes you.",
    drive: "Drive",
    enter: "Enter",
    options: "Options",
    keys: [
      ["W ↑", "Gas"],
      ["S ↓", "Brake"],
      ["A D ← →", "Steer"],
      ["Shift", "Nitro"],
      ["V", "Camera"],
      ["C", "Paint"],
      ["L", "Light glow"],
      ["M", "Sound"],
      ["H", "Hide HUD"],
    ] as [string, string][],
    driveAgain: "Drive again",
    paused: "Paused",
    pauseHelp: "P to resume · R to restart",
    steerLeft: "Steer left",
    steerRight: "Steer right",
    brake: "Brake",
    nitro: "Nitro",
    boot: "Warming up the engine…",
    // The solo page (app/nighthighway/solo): its tab title and its link to a race.
    solo: "Solo",
    raceAFriend: "Race a friend",
  },
  fr: {
    ...FR_SHARED,
    canvas: "Night Highway, jeu de conduite",
    time: "Temps",
    nearMissesBefore: "frôlements : ",
    nearMissesAfter: "",
    hint: "↑ ou W/Z accélérer · ↓ ou S freiner · ← → ou A/Q D tourner",
    hint2: "Maj ou Espace nitro · V caméra · C peinture · L lumières · H masquer l'affichage",
    hintPause: " · P pause",
    gear: "Rapport",
    kickerCity: "60 secondes · une route · après minuit",
    kickerDesert: "60 secondes · un canyon · au coucher du soleil",
    lede: "Faufile-toi dans la circulation de nuit, enchaîne les frôlements pour marquer des points et vois jusqu'où une minute peut te mener.",
    drive: "Démarrer",
    enter: "Entrée",
    options: "Options",
    keys: [
      ["W/Z ↑", "Accélérer"],
      ["S ↓", "Freiner"],
      ["A/Q D ← →", "Tourner"],
      ["Maj", "Nitro"],
      ["V", "Caméra"],
      ["C", "Peinture"],
      ["L", "Halo des lumières"],
      ["M", "Son"],
      ["H", "Masquer l'affichage"],
    ],
    driveAgain: "Repartir",
    paused: "Pause",
    pauseHelp: "P pour reprendre · R pour recommencer",
    steerLeft: "Tourner à gauche",
    steerRight: "Tourner à droite",
    brake: "Frein",
    nitro: "Nitro",
    boot: "Le moteur chauffe…",
    solo: "Solo",
    raceAFriend: "Défie un ami",
  },
});

/** The race page's screens (Screens.tsx) and statuses (app/nighthighway/page.tsx). */
export const SCREENS_TEXT = texts({
  en: {
    ...EN_SHARED,
    num: enNum,
    km: (metres: number) => `${(metres / 1000).toFixed(2)} km`,
    nameRequired: "Enter your name to race.",
    entryKicker: "60 seconds · one road · two drivers",
    otherWaiting: (name: string) => `${name} is waiting at the start line. What's your name?`,
    raceAFriend: "Race a friend down the same road after midnight: same traffic, same clock, highest score wins. What's your name?",
    yourName: "Your name",
    continue: "Continue",
    welcomeBack: "Welcome back! Which driver are you on this device?",
    seatsTaken: "Both seats are taken. A seat frees up 2 minutes after its driver goes offline.",
    iAm: (name: string) => `I'm ${name}`,
    isDriving: (name: string) => `${name} is driving`,
    or: "Or",
    driveSoloLink: "drive solo",
    leaveRoom: "Leave room",
    waitingKicker: "Waiting for the other driver",
    waitingLede: "Send them the link. You race the same road at the same time, and each of you sees the other as a ghost car.",
    waitingBefore: "Waiting for a while? ",
    practiceSolo: "Practice solo",
    waitingAfter: " in the meantime.",
    stat: "Stat",
    didntFinish: "Didn't finish",
    you: "You",
    /** The other racer when their name is missing, starting a sentence or after a separator. */
    theOtherDriver: "The other driver",
    /** ...and mid-sentence. */
    theOtherDriverInline: "the other driver",
    readyToRace: "Ready to race?",
    deadHeat: "Dead heat",
    youWin: "You win",
    wins: (name: string) => `${name} wins`,
    raceResult: (race: number) => `Race ${race} result`,
    startLine: "Start line",
    lobbyLede: (name: string) => `Same road, same traffic, same 60 seconds. Weave through it, chain near misses, and outscore ${name}.`,
    nextRace: "Next race",
    notReady: "Not ready",
    raceAgain: "Race again",
    ready: "Ready",
    offline: (name: string) => `${name} is offline.`,
    starting: "Starting…",
    waitingFor: (name: string) => `Waiting for ${name}…`,
    isReady: (name: string) => `${name} is ready.`,
    startsWhenBoth: "The race starts when you're both ready.",
    runComplete: "Run complete",
    waitingToFinish: (name?: string) => `Waiting for ${name ?? "the other driver"} to finish…`,
    getReady: "Get ready",
    room: (name: string) => `Room ${name}`,
    newRoom: "New room",
    driveSolo: "Drive solo",
    matchKicker: "Matchmaking",
    matchKickerVs: (me: string, other: string) => `Matchmaking · ${me} vs ${other}`,
    otherLeft: "The other driver left the room.",
    lookingLede: "Looking for another driver. You race whoever joins first, on the same road at the same time.",
    findAnother: "Find another driver",
    matchedOnline: "Matched online",
    // The page's statuses in a matchmaking room.
    waitingForDriver: "Waiting for a driver…",
    lookingForDriver: "Looking for a driver…",
    startingIn: (seconds: number) => `Starting in ${seconds} s`,
    gettingReady: "Getting ready…",
    /** A matchmaking room's other driver is offline (`name` may be missing). */
    matchOffline: (name?: string) => `${name ?? "the other driver"} is offline.`,
  },
  fr: {
    ...FR_SHARED,
    num: frNum,
    km: (metres) => `${frDec(metres / 1000, 2)} km`,
    nameRequired: "Entre ton nom pour faire la course.",
    entryKicker: "60 secondes · une route · deux pilotes",
    otherWaiting: (name) => `${name} t'attend sur la ligne de départ. Comment tu t'appelles ?`,
    raceAFriend: "Fais la course avec un ami sur la même route, après minuit : même circulation, même chrono, le meilleur score gagne. Comment tu t'appelles ?",
    yourName: "Ton nom",
    continue: "Continuer",
    welcomeBack: "Te revoilà ! Quel pilote es-tu sur cet appareil ?",
    seatsTaken: "Les deux places sont prises. Une place se libère 2 minutes après la déconnexion de son pilote.",
    iAm: (name) => `Je suis ${name}`,
    isDriving: (name) => `${name} est au volant`,
    or: "Ou",
    driveSoloLink: "roule en solo",
    leaveRoom: "Quitter le salon",
    waitingKicker: "En attente de l'autre pilote",
    waitingLede: "Envoie-lui le lien. Vous roulez sur la même route en même temps, et chacun voit l'autre en voiture fantôme.",
    waitingBefore: "Ça prend du temps ? ",
    practiceSolo: "Entraîne-toi en solo",
    waitingAfter: " en attendant.",
    stat: "Statistique",
    didntFinish: "Abandon",
    you: "Toi",
    theOtherDriver: "L'autre pilote",
    theOtherDriverInline: "l'autre pilote",
    readyToRace: "On y va ?",
    deadHeat: "Ex æquo",
    youWin: "Tu gagnes",
    wins: (name) => `${name} gagne`,
    raceResult: (race) => `Résultat de la course ${race}`,
    startLine: "Ligne de départ",
    lobbyLede: (name) => `Même route, même circulation, mêmes 60 secondes. Faufile-toi, enchaîne les frôlements et bats ${name} au score.`,
    nextRace: "Prochaine course",
    notReady: "Pas encore",
    raceAgain: "Rejouer",
    ready: "C'est parti",
    offline: (name) => `${name} est hors ligne.`,
    starting: "Ça démarre…",
    waitingFor: (name) => `On attend ${name}…`,
    isReady: (name) => `${name} attend le départ.`,
    startsWhenBoth: "La course démarre quand les deux pilotes ont appuyé.",
    runComplete: "Course terminée",
    waitingToFinish: (name) => `${name ?? "L'autre pilote"} roule encore…`,
    getReady: "Prépare-toi",
    room: (name) => `Salon ${name}`,
    newRoom: "Nouveau salon",
    driveSolo: "Rouler en solo",
    matchKicker: "Partie rapide",
    matchKickerVs: (me, other) => `Partie rapide · ${me} contre ${other}`,
    otherLeft: "L'autre pilote a quitté le salon.",
    lookingLede: "On cherche un autre pilote. Tu affrontes la première personne qui arrive, sur la même route, en même temps.",
    findAnother: "Trouver un autre pilote",
    matchedOnline: "Partie rapide",
    waitingForDriver: "En attente d'un pilote…",
    lookingForDriver: "Recherche d'un pilote…",
    startingIn: (seconds) => `Départ dans ${seconds} s`,
    gettingReady: "On se prépare…",
    matchOffline: (name) => `${name ?? "L'autre pilote"} est hors ligne.`,
  },
});
