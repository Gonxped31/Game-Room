import { plural, texts } from "@/lib/i18n/text";
import type { RoomQuestion } from "@/lib/session/shared/roomActions";
import type { Mode, Pawn } from "@/lib/games/lasthop/constants";

/**
 * Last Hop's words in English and French (docs/i18n.md), except How to play's,
 * which live in Rules.tsx. French: pieces are "pions", a move is a "coup", a
 * round a "manche", a match a "partie"; the modes are Piste and Grille.
 */

const NBSP = " "; // no-break space, before : and inside « »
const NNBSP = " "; // narrow no-break space, before ? ! ;
/** "de Léa", "d'Alex": French elides "de" before a vowel. */
const de = (name: string) => (/^[aeiouyàâäéèêëîïôöùûüœæ]/i.test(name) ? `d'${name}` : `de ${name}`);

export const TEXT = texts({
  en: {
    modes: {
      track: { label: "Track", detail: "Quick and sharp. One row, every move counts." },
      grid: { label: "Grid", detail: "Longer, more open. Pieces move two ways." },
    } as Record<Mode, { label: string; detail: string }>,
    pawns: {
      square: "Square",
      circle: "Circle",
      frog: "Frog",
      bunny: "Bunny",
      bear: "Bear",
      star: "Star",
      heart: "Heart",
      ghost: "Ghost",
    } as Record<Pawn, string>,

    // The page
    yourMoveTitle: "Your move",
    player: (n: 1 | 2) => `Player ${n}`,
    theHost: "The host",
    connecting: "Connecting to the room…",
    waitingForPlayer: "Waiting for a player…",
    lookingForPlayer: "Looking for a player…",
    otherLeft: "The other player left.",
    startingIn: (secs: number) => `Starting in ${secs} s`,
    starting: "Starting…",
    gettingReady: "Getting ready…",
    isOffline: (name: string) => `${name} is offline.`,
    getReady: (secs: string) => `Get ready… ${secs}`,
    yourMove: "Your move",
    toMove: (name: string) => `${name} to move`,

    // Header and footer
    round: (n: number) => `Round ${n}`,
    allGames: "All games",
    room: (label: string) => `Room: ${label}`,
    resetGame: "Reset game",
    newRoom: "New room",
    leaveRoom: "Leave room",
    resetConfirm: {
      title: "Reset the game?",
      message: "The match ends and you're back in the lobby, in the same mode. Seats stay as they are.",
      cancelLabel: "Cancel",
      confirmLabel: "Reset game",
      busyLabel: "Resetting…",
    } as RoomQuestion,

    // Player bar
    you: " (you)",
    offline: " · offline",
    barLine: (moves: number, wins: number) => `${moves === 1 ? "1 move" : `${moves} moves`} available · ${wins} ${wins === 1 ? "round" : "rounds"}`,
    clockLabel: (name: string, clock: string, running: boolean) => `${name}'s clock: ${clock}${running ? ", running" : ""}`,

    // Lobby
    clockLine: (minutes: number, seconds: number) => `${minutes} min each, +${seconds} s a move`,
    lobbyTitle: "Make the last move",
    lobbyRules: [
      "Your pieces only go forward: slide into the next empty square, or jump one of theirs.",
      "If it's your turn and you can't move, you lose the round. Rushing burns your moves.",
      "Each board is played twice, swapping sides. You each have a chess clock.",
    ],
    modeLabel: "Mode",
    nextMatchModeLabel: "Mode for the next match",
    startMatch: "Start the match",
    waitingForHost: (host: string) => `Waiting for ${host} to start the match…`,

    // Matchmaking
    matchmaking: (mode: string) => `Matchmaking · ${mode}`,
    versus: "vs",
    findAnother: "Find another player",

    // Between rounds
    youMadeLastHop: "You made the last hop!",
    madeLastHop: (name: string) => `${name} made the last hop`,
    takesRound: (name: string) => `${name} takes the round`,
    youRanOut: "You ran out of time.",
    ranOut: (name: string) => `${name} ran out of time.`,
    youStuck: "You had no move left.",
    stuck: (name: string) => `${name} had no move left.`,
    next: (sameBoard: boolean, nextIn: number | null) => `${sameBoard ? "Next: the same board, sides swapped" : "Next: a new board"}${nextIn != null ? ` in ${nextIn}` : ""}.`,

    // Pawn picker
    yourPawn: "Your pawn: ",
    takenBy: (pawn: string, name: string) => `${pawn} (${name}'s)`,

    // Match over
    draw: "A draw",
    youWinMatch: "You win the match!",
    winsMatch: (name: string) => `${name} wins the match`,
    roundOf: (n: number) => `Round ${n}: `,
    onTime: "on time",
    lastHop: "last hop",
    moveCount: (n: number) => `${n} moves`,
    nextMatch: "Next match",
    nextMatchIs: "Next match: ",
    waitingForHostToStart: (host: string) => ` · Waiting for ${host} to start it…`,
    playAgain: "Play again",

    // Vote
    replay: (mode: string) => `Replay ${mode}`,
    changeTo: (mode: string) => `Change to ${mode}`,
    voteFirst: "Vote for the next match. It starts when you both pick the same.",
    theyVoted: (name: string, choice: string) => `${name} voted: ${choice}.`,
    waitingForVote: (name: string) => `Waiting for ${name} to vote…`,
    pickSame: (name: string, choice: string) => `${name} voted: ${choice}. Pick the same to start.`,
    whatNext: "What next?",
    voterYou: "You",

    // Board
    track: "The track",
    grid: "The grid",
    square: (x: number) => `Square ${x}`,
    cell: (row: number, column: number) => `Row ${row}, column ${column}`,
    moveHere: (where: string) => `${where}: move here`,
    empty: (where: string) => `${where}: empty`,
    piece: (where: string, owner: string, state: "" | "selected" | "canMove" | "cantMove") =>
      `${where}: ${owner}'s piece${{ "": "", selected: ", selected", canMove: ", can move", cantMove: ", can't move" }[state]}`,

    // How to play's link (its title follows the page language by itself)
    readRules: "Read the full rules",
  },
  fr: {
    modes: {
      track: { label: "Piste", detail: "Vif et serré. Une seule rangée, chaque coup compte." },
      grid: { label: "Grille", detail: "Plus long, plus ouvert. Les pions vont dans deux directions." },
    },
    pawns: {
      square: "Carré",
      circle: "Rond",
      frog: "Grenouille",
      bunny: "Lapin",
      bear: "Ours",
      star: "Étoile",
      heart: "Cœur",
      ghost: "Fantôme",
    },

    yourMoveTitle: "À toi de jouer",
    player: (n) => `Joueur ${n}`,
    theHost: "l'hôte",
    connecting: "Connexion au salon…",
    waitingForPlayer: "En attente d'un joueur…",
    lookingForPlayer: "Recherche d'un joueur…",
    otherLeft: "L'autre joueur a quitté le salon.",
    startingIn: (secs) => `Début dans ${secs}${NBSP}s`,
    starting: "C'est parti…",
    gettingReady: "Préparation…",
    isOffline: (name) => `${name} est hors ligne.`,
    getReady: (secs) => `Prépare-toi… ${secs}`,
    yourMove: "À toi de jouer",
    toMove: (name) => `Au tour ${de(name)}`,

    round: (n) => `Manche ${n}`,
    allGames: "Tous les jeux",
    room: (label) => `Salon${NBSP}: ${label}`,
    resetGame: "Remettre à zéro",
    newRoom: "Nouveau salon",
    leaveRoom: "Quitter le salon",
    resetConfirm: {
      title: `Remettre la partie à zéro${NNBSP}?`,
      message: "La partie s'arrête et tout le monde revient dans la salle d'attente, dans le même mode. Les places ne changent pas.",
      cancelLabel: "Annuler",
      confirmLabel: "Remettre à zéro",
      busyLabel: "Remise à zéro…",
    },

    you: " (toi)",
    offline: " · hors ligne",
    barLine: (moves, wins) =>
      `${plural("fr", moves, `${moves} coup possible`, `${moves} coups possibles`)} · ${plural("fr", wins, `${wins} manche`, `${wins} manches`)}`,
    clockLabel: (name, clock, running) => `Chrono ${de(name)}${NBSP}: ${clock}${running ? ", en marche" : ""}`,

    clockLine: (minutes, seconds) => `${minutes}${NBSP}min par joueur, +${seconds}${NBSP}s par coup`,
    lobbyTitle: "Joue le dernier coup",
    lobbyRules: [
      `Tes pions ne font qu'avancer${NBSP}: ils glissent dans la case vide suivante, ou sautent par-dessus un pion adverse.`,
      "Si c'est ton tour et que tu ne peux plus bouger, tu perds la manche. Foncer, c'est gaspiller tes coups.",
      "Chaque plateau se joue deux fois, en échangeant les côtés. Chaque joueur a son chrono, comme aux échecs.",
    ],
    modeLabel: "Mode",
    nextMatchModeLabel: "Mode de la prochaine partie",
    startMatch: "Commencer la partie",
    waitingForHost: (host) => `C'est ${host} qui lance la partie…`,

    matchmaking: (mode) => `Partie rapide · ${mode}`,
    versus: "contre",
    findAnother: "Trouver un autre joueur",

    youMadeLastHop: `Tu as fait le dernier saut${NNBSP}!`,
    madeLastHop: (name) => `${name} a fait le dernier saut`,
    takesRound: (name) => `${name} remporte la manche`,
    youRanOut: "Tu es à court de temps.",
    ranOut: (name) => `${name} est à court de temps.`,
    youStuck: "Tu n'avais plus aucun coup.",
    stuck: (name) => `${name} n'avait plus aucun coup.`,
    next: (sameBoard, nextIn) =>
      `${sameBoard ? `Ensuite${NBSP}: le même plateau, côtés inversés` : `Ensuite${NBSP}: un nouveau plateau`}${nextIn != null ? ` dans ${nextIn}` : ""}.`,

    yourPawn: `Ton pion${NBSP}: `,
    takenBy: (pawn, name) => `${pawn} (pris par ${name})`,

    draw: "Partie nulle",
    youWinMatch: `Tu remportes la partie${NNBSP}!`,
    winsMatch: (name) => `${name} remporte la partie`,
    roundOf: (n) => `Manche ${n}${NBSP}: `,
    onTime: "au temps",
    lastHop: "dernier saut",
    moveCount: (n) => plural("fr", n, `${n} coup`, `${n} coups`),
    nextMatch: "Prochaine partie",
    nextMatchIs: `Prochaine partie${NBSP}: `,
    waitingForHostToStart: (host) => ` · C'est ${host} qui la lance…`,
    playAgain: "Rejouer",

    replay: (mode) => `Rejouer en mode ${mode}`,
    changeTo: (mode) => `Passer en mode ${mode}`,
    voteFirst: "Vote pour la prochaine partie. Elle commence dès que vous faites le même choix.",
    theyVoted: (name, choice) => `${name} a voté${NBSP}: ${choice}.`,
    waitingForVote: (name) => `${name} n'a pas encore voté…`,
    pickSame: (name, choice) => `${name} a voté${NBSP}: ${choice}. Fais le même choix pour commencer.`,
    whatNext: `Et maintenant${NNBSP}?`,
    voterYou: "Toi",

    track: "La piste",
    grid: "La grille",
    square: (x) => `Case ${x}`,
    cell: (row, column) => `Rangée ${row}, colonne ${column}`,
    moveHere: (where) => `${where}${NBSP}: jouer ici`,
    empty: (where) => `${where}${NBSP}: vide`,
    piece: (where, owner, state) =>
      `${where}${NBSP}: pion ${de(owner)}${{ "": "", selected: ", sélectionné", canMove: ", peut bouger", cantMove: ", bloqué" }[state]}`,

    readRules: "Lire toutes les règles",
  },
});
