import type { CaseScreen } from "@/lib/games/cocounsel/caseTypes";
import type { AttemptOutcome, DuoClassification } from "@/lib/games/cocounsel/game";
import type { RoomQuestion } from "@/lib/session/shared/roomActions";
import { plural, texts } from "@/lib/i18n/text";

/**
 * Co-Counsel's words (docs/i18n.md). The case text itself (titles, screens,
 * cards, verdicts) comes from cases.json / cases.fr.json in each viewer's own
 * interface language; the How to play words live in Rules.tsx (they need markup).
 *
 * French role names: the roles are sides of the story, not people, so they
 * stay neutral for the player ("côté enquête" / "côté défense") instead of
 * the gendered enquêteur/enquêtrice, accusé/accusée. A case "Part" is an
 * "acte" (a "partie" is a whole game in the glossary).
 */

type Stamp = { label: string; heading: string; body: string };

const ROLE_EN: Record<CaseScreen, string> = { investigator: "Investigator", defendant: "Defendant" };
const ROLE_FR: Record<CaseScreen, string> = { investigator: "Enquête", defendant: "Défense" };
const SIDE_FR: Record<CaseScreen, string> = { investigator: "côté enquête", defendant: "côté défense" };

export const CC_TEXT = texts({
  en: {
    /** A role on its own: a header label, a hand in the rules. */
    role: ROLE_EN,
    /** "Maya, the Investigator". */
    asRole: (name: string, role: CaseScreen) => `${name}, the ${ROLE_EN[role]}`,
    /** The case file's label above each screen: "Maya, Investigator". */
    nameAndRole: (name: string, role: CaseScreen) => `${name}, ${ROLE_EN[role]}`,
    /** The Footer's "Maya · Investigator". */
    identity: (name: string, role: CaseScreen) => `${name} · ${ROLE_EN[role]}`,

    // Page
    backToGames: "Back to all games",
    connecting: "Connecting to the room…",
    yourTurnTitle: (title: string) => `▶ Your turn! · ${title}`,
    seeWhatHappened: "See what happened",
    seeVerdict: "See the verdict",
    continueToPart: (n: number) => `Continue to Part ${n}`,

    // Header controls
    backToCases: "Back to case selection",
    toLight: "Switch to light mode",
    toDark: "Switch to dark mode",

    // CasePicker
    tier: { easy: "Easy", medium: "Medium", hard: "Hard" } as Record<"easy" | "medium" | "hard", string>,
    pickCase: "Pick a case",
    pickCaseIntro: "You both play the case you choose here. Best played on a call with your partner.",
    justPlayed: "Just played",
    inProgress: "In progress",
    parts: (n: number) => `${n} Parts`,
    resumeAria: (title: string) => `Resume ${title}`,
    chooseAria: (title: string) => `Choose ${title}`,
    resumeCase: "Resume this case",
    playAgain: "Play it again",
    chooseCase: "Choose this case",

    // ConfirmRoleScreen
    welcomeBack: "Welcome back!",
    lastTime: (name: string, role: CaseScreen) => `Last time you were ${name}, the ${ROLE_EN[role]}.`,
    continueAs: (name: string, role: CaseScreen) => `Continue as ${name}, the ${ROLE_EN[role]}`,
    switchRole: "Switch role instead",

    // RolePicker
    tagline: "Two sides of one story. Talk it out to solve it.",
    whoAreYou: "Who are you this round?",
    whichOne: "Welcome back! Which one are you?",
    bothTaken: "Both roles are taken.",
    otherPicks: "Your partner picks the other role. Never look at each other's screen.",
    roleFreesUp: "A role frees up 2 minutes after its player goes offline.",
    iAmName: (name: string) => `I'm ${name}`,
    iAmRole: { investigator: "I'm the Investigator", defendant: "I'm the Defendant" } as Record<CaseScreen, string>,
    pitch: {
      investigator: "You saw what happened from the outside. You hold the evidence.",
      defendant: "You know what was going on inside. You hold the motives.",
    } as Record<CaseScreen, string>,

    // A Part
    youAre: (name: string, role: CaseScreen) => `You're ${name}, the ${ROLE_EN[role]}`,
    partOf: (n: number, total: number) => `Part ${n} of ${total}`,
    triesLeft: (n: number) => `${n} ${n === 1 ? "try" : "tries"} left`,
    whatYouKnow: "What you know",
    yourCards: "Your cards",
    sayItOutLoud: "Say it out loud. Don't show your screen.",
    lockInCard: (n: number) => `Lock in card ${n}`,
    pickToLockIn: "Pick a card to lock in",
    yourCard: "Your card",
    cardOf: (name: string) => `${name}'s card`,
    stillChoosing: (name: string) => `${name} is still choosing`,
    lockedWaiting: (name: string) => `Locked in. Waiting for ${name}.`,
    keepTalking: "Keep talking. Both cards flip at the same time.",

    // RevealScreen
    solvedFirstTry: "Solved on the first try",
    caseNotes: "Case notes",
    pickAgain: "Pick again",
    stamp: {
      solved: { label: "WORKING THEORY", heading: "Working theory accepted.", body: "" },
      judgeRevealed: {
        label: "CASE ADJOURNED",
        heading: "The judge reveals the pair, then dismisses the case.",
        body: "Too many misreadings - the court has run out of patience.",
      },
      adjourned: {
        label: "CASE ADJOURNED",
        heading: "The judge dismisses the case.",
        body: "Too many misreadings - the court has run out of patience. No ruling is given.",
      },
      trap: { label: "DOESN'T FIT", heading: "Plausible, but something doesn't fit.", body: "Talk it through, then pick again." },
      wrong: { label: "DOESN'T HOLD UP", heading: "That doesn't hold up.", body: "Talk it through, then pick again." },
    } as Record<AttemptOutcome, Stamp>,

    // AdjournedScreen
    adjournedStamp: "Case Adjourned",
    ranOut: (n: number, total: number) => `Too many misreadings - the court ran out of patience on Part ${n} of ${total}.`,
    rulingOnWayOut: "The judge still delivers a ruling on the way out:",
    dismissed: "The case is dismissed before being fully heard - no final answer this time.",
    seeCaseFile: "See the full case file",
    startNewCase: "Start a new case",
    waitingForPartner: "Waiting for your partner to pick the next case…",

    // VerdictScreen
    focus: "Focus",
    focusSub: "How well you remembered",
    trust: "Trust",
    trustSub: "How well you listened",
    yourDuo: "Your duo",
    duo: {
      "Mind-Reading Team": "Mind-Reading Team",
      "Loyal, Slightly Forgetful": "Loyal, Slightly Forgetful",
      "Sharp, Slightly Suspicious": "Sharp, Slightly Suspicious",
      "Solid Partners": "Solid Partners",
      "Still Learning Each Other": "Still Learning Each Other",
    } as Record<DuoClassification, string>,
    attemptsAcross: (attempts: number, parts: number) => `${attempts} attempts across ${parts} Parts`,
    pickAnotherCase: "Pick another case",
    rematch: "Rematch with swapped roles",
    orWait: "Or wait for your partner to pick another case.",

    // RecapScreen
    fullCaseFile: "The full case file",
    everyPart: "Every Part, both sides of the story.",
    partTitle: (n: number, title: string) => `Part ${n}: ${title}`,
    correctPair: "The correct pair",
    backToVerdict: "Back to the verdict",

    // Footer
    roomLabel: (room: string) => `Room: ${room}`,
    resetCase: "Reset case",
    newRoom: "New room",
    leaveRoom: "Leave room",
    resetConfirm: {
      title: "Reset the whole case?",
      message: "The case starts over from Part 1. Seats stay as they are.",
      cancelLabel: "Cancel",
      confirmLabel: "Reset case",
      busyLabel: "Resetting…",
    } as RoomQuestion,
  },
  fr: {
    role: ROLE_FR,
    asRole: (name, role) => `${name}, ${SIDE_FR[role]}`,
    nameAndRole: (name, role) => `${name}, ${SIDE_FR[role]}`,
    identity: (name, role) => `${name} · ${ROLE_FR[role]}`,

    backToGames: "Retour à tous les jeux",
    connecting: "Connexion au salon…",
    yourTurnTitle: (title) => `▶ À toi de jouer ! · ${title}`,
    seeWhatHappened: "Voir ce qui s'est passé",
    seeVerdict: "Voir le verdict",
    continueToPart: (n) => `Passer à l'acte ${n}`,

    backToCases: "Retour au choix de l'affaire",
    toLight: "Passer au mode clair",
    toDark: "Passer au mode sombre",

    tier: { easy: "Facile", medium: "Moyen", hard: "Difficile" },
    pickCase: "Choisis une affaire",
    pickCaseIntro: "L'affaire choisie ici se joue à deux. Idéal pendant un appel.",
    justPlayed: "Jouée à l'instant",
    inProgress: "En cours",
    parts: (n) => plural("fr", n, `${n} acte`, `${n} actes`),
    resumeAria: (title) => `Reprendre ${title}`,
    chooseAria: (title) => `Choisir ${title}`,
    resumeCase: "Reprendre cette affaire",
    playAgain: "La rejouer",
    chooseCase: "Choisir cette affaire",

    welcomeBack: "Te revoilà !",
    lastTime: (name, role) => `La dernière fois, tu jouais ${name}, ${SIDE_FR[role]}.`,
    continueAs: (name, role) => `Continuer avec ${name}, ${SIDE_FR[role]}`,
    switchRole: "Prendre l'autre rôle",

    tagline: "Deux versions d'une même histoire. C'est en parlant qu'on la résout.",
    whoAreYou: "Qui joues-tu cette fois ?",
    whichOne: "Te revoilà ! Quel rôle avais-tu ?",
    bothTaken: "Les deux rôles sont pris.",
    otherPicks: "L'autre joueur prend le rôle restant. Et pas question de regarder son écran.",
    roleFreesUp: "Un rôle se libère quand son joueur est hors ligne depuis 2 minutes.",
    iAmName: (name) => `Je suis ${name}`,
    iAmRole: { investigator: "Je prends l'enquête", defendant: "Je prends la défense" },
    pitch: {
      investigator: "Tu as vu ce qui s'est passé, de l'extérieur. Tu détiens les preuves.",
      defendant: "Tu sais ce qui se passait à l'intérieur. Tu détiens les mobiles.",
    },

    youAre: (name, role) => `Tu joues ${name}, ${SIDE_FR[role]}`,
    partOf: (n, total) => `Acte ${n} sur ${total}`,
    triesLeft: (n) => plural("fr", n, `${n} essai restant`, `${n} essais restants`),
    whatYouKnow: "Ce que tu sais",
    yourCards: "Tes cartes",
    sayItOutLoud: "Dis-le à voix haute. Ne montre pas ton écran.",
    lockInCard: (n) => `Valider la carte ${n}`,
    pickToLockIn: "Choisis une carte à valider",
    yourCard: "Ta carte",
    cardOf: (name) => `Carte de ${name}`,
    stillChoosing: (name) => `${name} choisit encore`,
    lockedWaiting: (name) => `Carte validée. On attend ${name}.`,
    keepTalking: "Continue à parler. Les deux cartes se retournent en même temps.",

    solvedFirstTry: "Résolu du premier coup",
    caseNotes: "Notes de l'affaire",
    pickAgain: "Choisir de nouveau",
    stamp: {
      solved: { label: "HYPOTHÈSE RETENUE", heading: "Hypothèse retenue.", body: "" },
      judgeRevealed: {
        label: "AFFAIRE AJOURNÉE",
        heading: "Le juge révèle la bonne paire, puis ajourne l'affaire.",
        body: "Trop de fausses pistes : la cour a perdu patience.",
      },
      adjourned: {
        label: "AFFAIRE AJOURNÉE",
        heading: "Le juge ajourne l'affaire.",
        body: "Trop de fausses pistes : la cour a perdu patience. Aucun jugement n'est rendu.",
      },
      trap: { label: "ÇA CLOCHE", heading: "Plausible, mais quelque chose cloche.", body: "Parles-en avec l'autre, puis choisis de nouveau." },
      wrong: { label: "ÇA NE TIENT PAS", heading: "Ça ne tient pas la route.", body: "Parles-en avec l'autre, puis choisis de nouveau." },
    },

    adjournedStamp: "Affaire ajournée",
    ranOut: (n, total) => `Trop de fausses pistes : la cour a perdu patience à l'acte ${n} sur ${total}.`,
    rulingOnWayOut: "En sortant, le juge rend quand même son verdict :",
    dismissed: "L'affaire est classée avant la fin de l'audience : pas de réponse finale cette fois.",
    seeCaseFile: "Voir le dossier complet",
    startNewCase: "Ouvrir une nouvelle affaire",
    waitingForPartner: "On attend que l'autre joueur choisisse la prochaine affaire…",

    focus: "Concentration",
    focusSub: "La mémoire du duo",
    trust: "Confiance",
    trustSub: "L'écoute du duo",
    yourDuo: "Ton duo",
    duo: {
      "Mind-Reading Team": "Duo télépathe",
      "Loyal, Slightly Forgetful": "Fidèle, un peu tête en l'air",
      "Sharp, Slightly Suspicious": "Perspicace, un peu sceptique",
      "Solid Partners": "Partenaires solides",
      "Still Learning Each Other": "Encore en rodage",
    },
    attemptsAcross: (attempts, parts) =>
      `${plural("fr", attempts, `${attempts} tentative`, `${attempts} tentatives`)} en ${plural("fr", parts, `${parts} acte`, `${parts} actes`)}`,
    pickAnotherCase: "Choisir une autre affaire",
    rematch: "Rejouer en échangeant les rôles",
    orWait: "Ou attends que l'autre joueur choisisse une autre affaire.",

    fullCaseFile: "Le dossier complet",
    everyPart: "Chaque acte, les deux versions de l'histoire.",
    partTitle: (n, title) => `Acte ${n} : ${title}`,
    correctPair: "La bonne paire",
    backToVerdict: "Retour au verdict",

    roomLabel: (room) => `Salon : ${room}`,
    resetCase: "Recommencer l'affaire",
    newRoom: "Nouveau salon",
    leaveRoom: "Quitter le salon",
    resetConfirm: {
      title: "Recommencer toute l'affaire ?",
      message: "L'affaire reprend à l'acte 1. Les places ne changent pas.",
      cancelLabel: "Annuler",
      confirmLabel: "Recommencer",
      busyLabel: "On recommence…",
    },
  },
});
