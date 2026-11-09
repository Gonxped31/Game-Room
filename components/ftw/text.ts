import { ITEMS_PER_ROUND, MAX_ITEM_LENGTH, MAX_PROMPT_LENGTH } from "@/lib/games/ftw/constants";
import { plural, texts } from "@/lib/i18n/text";

const N = ITEMS_PER_ROUND;

/**
 * Same Page's interface words (docs/i18n.md). French says "sujet" for a
 * prompt, "thème" for a topic, "élément" for an item and "note" for a rank
 * note. The prompts themselves follow the room's content language instead
 * (lib/games/ftw/prompts.ts); the result headlines live in placement.ts.
 */
export const FTW_TEXT = texts({
  en: {
    // The page
    yourTurnTitle: (title: string) => `▶ Your turn! · ${title}`,
    connecting: "Connecting to the room…",
    yourPartner: "Your partner",
    theRanker: "The ranker",
    roleRanking: "Ranking",
    roleGuessing: "Guessing",

    // The round
    rankingTitle: "You're ranking",
    guessingTitle: "You're guessing",
    willGuess: (partner: string) => `${partner} will guess your order.`,
    howDidTheyRank: (partner: string) => `How did ${partner} rank these?`,
    scale: `1 = best · ${N} = worst`,
    notePicked: (n: number) => `Note ${n} picked. Now tap an item.`,
    tapToSwap: "Tap a note on the sheet to swap it.",
    tapNoteThenItem: "Tap a note, then an item.",
    items: "Items",
    itemRanked: (label: string, n: number) => `${label}, rank ${n}`,
    itemUnranked: (label: string) => `${label}, no rank yet`,
    itemFaceDown: (label: string, partner: string) => `${label}, ${partner} placed a note`,
    partnerLockedIn: (partner: string) => `${partner} locked in their order`,
    yourNotes: "Your notes",
    note: (n: number) => `Note ${n}`,
    lockRanking: "Lock my ranking",
    lockGuess: "Lock my guess",
    placeMore: (missing: number) => `Place ${missing} more note${missing === 1 ? "" : "s"}`,
    shufflePrompt: "Shuffle prompt",
    progress: (placed: number) => `${placed} of ${N} placed`,
    waitingFor: (partner: string) => `Waiting for ${partner}…`,
    canPlayLater: (partner: string) => `${partner} can play later.`,
    weKeepAnswers: " We'll keep your answers.",
    isGuessing: (partner: string, progress: string) => `${partner} is guessing. ${progress}`,
    isRanking: (partner: string, progress: string) => `${partner} is ranking. ${progress}`,

    // The reveal
    pointsFor: (n: number, name: string) => `+${n} for ${name}`,
    pointsForYou: (n: number) => `+${n} for you`,
    you: "You",
    youRanked: (partner: string) => `You ranked, ${partner} guessed`,
    partnerRanked: (partner: string) => `${partner} ranked, you guessed`,
    round: (n: number) => `Round ${n}`,
    results: "Results",
    youSaid: (n: number) => `you ${n}`,
    match: "match",
    noMatch: "no match",
    nextRound: (isRanker: boolean) => `Next round · ${isRanker ? "you guess" : "you rank"}`,
    leaveRoom: "Leave room",

    // Scores and recap
    scores: (players: { name: string; score: number; isMe: boolean }[]) => `Scores: ${players.map((p) => `${p.name}${p.isMe ? " (you)" : ""} ${p.score}`).join(", ")}`,
    youTag: " (you)",
    recap: (rounds: number) => `Session recap (${rounds} round${rounds === 1 ? "" : "s"})`,
    recapLine: (round: number, ranker: string | undefined, score: number) => `Round ${round} · ${ranker ?? "The ranker"} ranked · ${score}/${N}`,

    // Write my own prompt
    writeOwn: "Write my own prompt",
    customPlaceholder: `Line 1: the prompt\nThen exactly ${N} items, one per line`,
    customLabel: "Custom prompt: line 1 is the prompt, then one item per line",
    customLineCount: `Add a prompt on line 1, then exactly ${N} items, one per line.`,
    customTooLong: `Keep the prompt to ${MAX_PROMPT_LENGTH} characters or fewer, and each item to ${MAX_ITEM_LENGTH}.`,
    usePrompt: "Use this prompt",

    // Topics and the prompt language
    topicsSummary: (summary: string) => `Topics: ${summary}`,
    anyTopic: "Any topic",
    rankerPicksTopics: (ranker: string) => `${ranker} picks the topics while they're ranking. You'll pick them on your turn.`,
    youPickTopics: "While you're ranking, you pick the topics. The next prompt comes from them.",
    promptTopics: "Prompt topics",
    langFromNext: "From the next prompt.",
    promptLanguage: "Prompt language",
  },
  fr: {
    yourTurnTitle: (title) => `▶ À toi de jouer ! · ${title}`,
    connecting: "Connexion au salon…",
    yourPartner: "Ton binôme",
    theRanker: "Ton binôme",
    roleRanking: "Tu classes",
    roleGuessing: "Tu devines",

    rankingTitle: "Tu classes",
    guessingTitle: "Tu devines",
    willGuess: (partner) => `${partner} va deviner ton ordre.`,
    howDidTheyRank: (partner) => `Devine l'ordre de ${partner}.`,
    scale: `1 = meilleur · ${N} = pire`,
    notePicked: (n) => `Note ${n} choisie. Touche maintenant un élément.`,
    tapToSwap: "Touche une note sur la feuille pour l'échanger.",
    tapNoteThenItem: "Touche une note, puis un élément.",
    items: "Éléments",
    itemRanked: (label, n) => `${label}, rang ${n}`,
    itemUnranked: (label) => `${label}, pas encore de rang`,
    itemFaceDown: (label, partner) => `${label}, ${partner} a posé une note`,
    partnerLockedIn: (partner) => `${partner} a validé son ordre`,
    yourNotes: "Tes notes",
    note: (n) => `Note ${n}`,
    lockRanking: "Valider mon classement",
    lockGuess: "Valider ma réponse",
    placeMore: (missing) => plural("fr", missing, `Encore ${missing} note à placer`, `Encore ${missing} notes à placer`),
    shufflePrompt: "Changer de sujet",
    progress: (placed) => plural("fr", placed, `${placed} note posée sur ${N}`, `${placed} notes posées sur ${N}`),
    waitingFor: (partner) => `On attend ${partner}…`,
    canPlayLater: (partner) => `${partner} pourra jouer plus tard.`,
    weKeepAnswers: " On garde tes réponses.",
    isGuessing: (partner, progress) => `${partner} est en train de deviner. ${progress}`,
    isRanking: (partner, progress) => `${partner} est en train de classer. ${progress}`,

    pointsFor: (n, name) => `+${n} pour ${name}`,
    pointsForYou: (n) => `+${n} pour toi`,
    you: "Toi",
    youRanked: (partner) => `Tu as classé, ${partner} a deviné`,
    partnerRanked: (partner) => `${partner} a classé, tu as deviné`,
    round: (n) => `Manche ${n}`,
    results: "Résultats",
    youSaid: (n) => `toi ${n}`,
    match: "pareil",
    noMatch: "différent",
    nextRound: (isRanker) => `Manche suivante · ${isRanker ? "tu devines" : "tu classes"}`,
    leaveRoom: "Quitter le salon",

    scores: (players) => `Scores : ${players.map((p) => `${p.name}${p.isMe ? " (toi)" : ""} ${p.score}`).join(", ")}`,
    youTag: " (toi)",
    recap: (rounds) => `Récap de la partie (${plural("fr", rounds, `${rounds} manche`, `${rounds} manches`)})`,
    recapLine: (round, ranker, score) => (ranker ? `Manche ${round} · classée par ${ranker} · ${score}/${N}` : `Manche ${round} · ${score}/${N}`),

    writeOwn: "Écrire mon propre sujet",
    customPlaceholder: `Ligne 1 : le sujet\nPuis exactement ${N} éléments, un par ligne`,
    customLabel: "Sujet perso : la ligne 1 est le sujet, puis un élément par ligne",
    customLineCount: `Écris le sujet sur la ligne 1, puis exactement ${N} éléments, un par ligne.`,
    customTooLong: `Le sujet doit faire ${MAX_PROMPT_LENGTH} caractères au plus, et chaque élément ${MAX_ITEM_LENGTH}.`,
    usePrompt: "Utiliser ce sujet",

    topicsSummary: (summary) => `Thèmes : ${summary}`,
    anyTopic: "Tous les thèmes",
    rankerPicksTopics: (ranker) => `${ranker} choisit les thèmes pendant son classement. Tu les choisiras à ton tour.`,
    youPickTopics: "Pendant que tu classes, c'est toi qui choisis les thèmes. Le prochain sujet viendra de là.",
    promptTopics: "Thèmes des sujets",
    langFromNext: "Dès le prochain sujet.",
    promptLanguage: "Langue des sujets",
  },
});
