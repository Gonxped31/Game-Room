"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AREA_COUNTRIES, AREA_NAME } from "@/lib/games/borderrun/areas";
import { PENALTY_MS } from "@/lib/games/borderrun/constants";
import { capitalDistanceKm, COUNTRIES, findCountry, nameOf, suggest } from "@/lib/games/borderrun/countries";
import { links, refusalOf, status, type Play } from "@/lib/games/borderrun/play";
import { closenessOf } from "@/lib/games/borderrun/route";
import type { Lang } from "@/lib/i18n/lang";
import { formatNumber } from "@/lib/i18n/text";
import { useText } from "@/lib/i18n/useLang";
import RouteMap, { type Shown } from "./RouteMap";
import { TEXT } from "./text";

/**
 * A segmented switch: role="radiogroup", arrow keys move the choice
 * (the pattern the other games use). `wrap` lets the options flow onto
 * several rows.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  render,
  wrap,
  small,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  render: (option: T) => ReactNode;
  wrap?: boolean;
  small?: boolean;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next]);
    buttons.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className="br-seg" data-wrap={wrap ? "" : undefined} data-small={small ? "" : undefined}>
      {options.map((option, index) => (
        <button
          key={option}
          ref={(el) => {
            buttons.current[index] = el;
          }}
          type="button"
          role="radio"
          aria-checked={option === value}
          tabIndex={option === value ? 0 : -1}
          className="br-seg-option"
          onClick={() => onChange(option)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {render(option)}
        </button>
      ))}
    </div>
  );
}

/** m:ss (or h:mm:ss past an hour). */
export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/**
 * "Portugal → Poland", the par (after `kicker`, e.g. the daily's number and
 * map), and the closed borders. `lang` here and below is the page's language
 * (`useLang()`): it gives the words and the country names alike.
 */
export function RouteHeader({ play, lang, kicker }: { play: Play; lang: Lang; kicker?: ReactNode }) {
  const { route } = play;
  const t = TEXT[lang];
  return (
    <div className="br-route">
      <p className="br-route-kicker">
        {kicker}
        {t.par(route.par)}
      </p>
      <h2 className="br-route-title">
        <span>{nameOf(route.start, lang)}</span>
        <span className="br-route-arrow" aria-label={t.to}>
          →
        </span>
        <span>{nameOf(route.end, lang)}</span>
      </h2>
      <p className="br-route-closed">
        {t.closedBorders(route.closed.length)}
        {route.closed.map(([a, b], i) => (
          <span key={`${a}-${b}`} className="br-closed-chip">
            {i ? " " : null}
            {nameOf(a, lang)} <span aria-label={t.and}>✕</span> {nameOf(b, lang)}
          </span>
        ))}
      </p>
    </div>
  );
}

/** The time so far, the guesses against the par, and the penalty once past it. */
export function Toolbar({ play, elapsed, best }: { play: Play; elapsed: number; best?: number }) {
  const { extra } = status(play);
  const t = useText(TEXT);
  return (
    <div className="br-toolbar">
      <span className="br-time" aria-label={t.timeLabel(formatTime(elapsed))}>
        {formatTime(elapsed)}
        {extra ? <span className="br-penalty"> +{(extra * PENALTY_MS) / 1000} s</span> : null}
        {best !== undefined ? <span className="br-best">{t.best(formatTime(best))}</span> : null}
      </span>
      <span className="br-count">
        {t.guesses(play.guesses.length)} · {t.par(play.route.par)}
      </span>
    </div>
  );
}

/**
 * The guess box: type a country in English or French (either, whatever the
 * page's language), pick from the suggestions (arrow keys, or a tap), Enter
 * to guess. The first suggestion is highlighted, so Enter takes it. A
 * refused guess is explained and costs nothing.
 */
export function GuessInput({ play, lang, onGuess, disabled }: { play: Play; lang: Lang; onGuess: (code: string) => void; disabled?: boolean }) {
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const t = TEXT[lang];
  const { route, guesses } = play;
  const options = useMemo(() => {
    const taken = new Set([route.start, route.end, ...guesses.map((g) => g.code)]);
    return suggest(text, [...AREA_COUNTRIES[route.area]].filter((code) => !taken.has(code)), lang, 5);
  }, [text, route, guesses, lang]);
  const open = options.length > 0 && !disabled;
  const current = open ? Math.min(active, options.length - 1) : -1;

  const guess = (code: string | null) => {
    const refusal = refusalOf(play, code);
    if (refusal) {
      setMessage(t.refusal[refusal](code ? nameOf(code, lang) : text.trim(), AREA_NAME[route.area][lang]));
      return;
    }
    setMessage(null);
    setText("");
    setActive(0);
    onGuess(code!);
    input.current?.focus();
  };
  const submit = () => {
    if (!text.trim()) return;
    guess(current >= 0 ? options[current] : findCountry(text));
  };

  return (
    <form
      className="br-guess"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="br-guess-row">
        <input
          ref={input}
          className="br-input"
          role="combobox"
          aria-label={t.guessLabel}
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={current >= 0 ? `${id}-${current}` : undefined}
          aria-describedby={message ? `${id}-message` : undefined}
          aria-invalid={message ? true : undefined}
          value={text}
          disabled={disabled}
          placeholder={t.placeholder}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          enterKeyHint="go"
          onChange={(event) => {
            setText(event.target.value);
            setActive(0);
            setMessage(null);
          }}
          onKeyDown={(event) => {
            if (!open) return;
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const step = event.key === "ArrowDown" ? 1 : -1;
              setActive((current + step + options.length) % options.length);
            } else if (event.key === "Escape") {
              setText("");
            }
          }}
        />
        <button type="submit" className="br-button br-button-primary" disabled={disabled || !text.trim()}>
          {t.guess}
        </button>
      </div>
      <ul id={`${id}-list`} role="listbox" aria-label={t.countries} className="br-suggest" hidden={!open}>
        {open
          ? options.map((code, i) => (
              <li
                key={code}
                id={`${id}-${i}`}
                role="option"
                aria-selected={i === current}
                className="br-suggest-option"
                // Keep the input's focus (and the phone's keyboard) through a tap.
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => guess(code)}
              >
                {nameOf(code, lang)}
                {/* The other language's name too: either can be typed. */}
                <span className="br-suggest-other" lang={lang === "en" ? "fr" : "en"}>
                  {nameOf(code, lang === "en" ? "fr" : "en")}
                </span>
              </li>
            ))
          : null}
      </ul>
      <p id={`${id}-message`} className="br-message" role={message ? "alert" : undefined}>
        {message}
      </p>
    </form>
  );
}

/** The guesses so far, newest first, each with how close it is. */
export function GuessList({ play, lang }: { play: Play; lang: Lang }) {
  const t = TEXT[lang];
  const graded = play.guesses.map((guess) => ({ code: guess.code, closeness: closenessOf(play.route, guess.code) }));
  if (!graded.length) return <p className="br-hint">{t.hint(nameOf(play.route.start, lang))}</p>;
  return (
    <ol className="br-guesses" reversed aria-label={t.yourGuesses}>
      {graded
        .map((guess, i) => ({ ...guess, i }))
        .reverse()
        .map(({ code, closeness, i }) => (
          <li key={code} className="br-guess-item" data-tone={closeness}>
            <span className="br-guess-number">{i + 1}</span>
            <span className="br-guess-name">{nameOf(code, lang)}</span>
            <span className="br-guess-tag">{t.closeness[closeness]}</span>
          </li>
        ))}
    </ol>
  );
}

/** What the map draws for a game: the start and end, each guess in its tone; once done, guesses off the final route fade. */
export function shownOf(play: Play, reveal?: string[] | null): Shown[] {
  const { path } = status(play);
  const onPath = new Set(path ?? []);
  const shown: Shown[] = play.guesses.map((guess) => ({ code: guess.code, tone: closenessOf(play.route, guess.code), faded: path ? !onPath.has(guess.code) : false }));
  const guessed = new Set(play.guesses.map((guess) => guess.code));
  for (const code of reveal ?? []) if (!guessed.has(code) && code !== play.route.start && code !== play.route.end) shown.push({ code, tone: "reveal" });
  shown.push({ code: play.route.start, tone: "endpoint" }, { code: play.route.end, tone: "endpoint" });
  return shown;
}

/** The map for a game in progress (with the run's links as it grows), or finished: then the route (yours, or the one shown on giving up) is drawn and named. */
export function PlayMap({ play, lang, reveal }: { play: Play; lang: Lang; reveal?: string[] | null }) {
  const shown = useMemo(() => shownOf(play, reveal), [play, reveal]);
  const run = useMemo(() => links(play), [play]);
  const route = reveal ?? status(play).path;
  // Keyed by the route, so a new one starts with the whole map in view (the zoom stays on finishing).
  const key = `${play.route.area}:${play.route.start}:${play.route.end}:${play.route.closed.join(";")}`;
  return <RouteMap key={key} area={play.route.area} shown={shown} closed={play.route.closed} lang={lang} route={route} links={run} />;
}

/** "Lisbon → Warsaw: 2,760 km as the crow flies" ("2 760 km" in French): the capitals, once the route is over. */
export function CapitalLine({ play, lang }: { play: Play; lang: Lang }) {
  const { start, end } = play.route;
  const t = TEXT[lang];
  const km = capitalDistanceKm(start, end);
  const from = COUNTRIES[start].capital;
  const to = COUNTRIES[end].capital;
  if (km === null || !from || !to) return null;
  return (
    <p className="br-capitals">
      <span className="br-capitals-names">{t.capitals(from[lang], to[lang])}</span> {t.crowFlies(formatNumber(lang, km))}
    </p>
  );
}

/** "Portugal → Spain → France → Germany → Poland". */
export function PathLine({ path, lang }: { path: string[]; lang: Lang }) {
  return <p className="br-path">{path.map((code) => nameOf(code, lang)).join(" → ")}</p>;
}
