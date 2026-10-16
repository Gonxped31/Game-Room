# Game Design Document: Co-Counsel (The Serial Architecture)

> **Status:** v2. Scope for the first release: **one complete case** ("The Case of the Ruined Birthday"), playable as software by two players on a voice or video call. Everything else (more cases, tiers, extras) is designed here but built later.

## 📌 Game Overview

**Co-Counsel** is a 2-player cooperative, asymmetric deduction game. Players are a unified defense team in a digital courtroom, piecing together the truth behind a bizarre everyday mystery. Each player sees only half of the story. They must **talk to each other out loud** to work out which two cards, one from each hand, explain what really happened.

The app never listens. It only knows which cards were played, and it scores how well those plays respect what the other player knew and what the team learned earlier.

### Core Pillars

* **Asymmetry & the Secrecy Rule:** The *Investigator* sees external observations. The *Defendant* knows internal, hidden facts. Players never look at each other's screens. Everything is shared by speaking.
* **Serial Continuity:** A case is a chain of **Parts**. Each Part continues the story and never repeats it. The app gives no recap during play, so players must remember earlier facts to solve later twists.
* **Working Theories, Not Lies:** A solved Part 1 or 2 produces a *working theory*: true, but incomplete. Later Parts deepen it and never contradict it. Only the final Part produces a *verdict*. This keeps twists fair.
* **Plausible Wrong Answers:** Wrong pairs that sound reasonable (traps) exist in every Part. They are what make listening and remembering matter.
* **Trust & Focus:** The game measures how well you listen to your partner (Trust) and how well you remember the case (Focus), both computed from actual card plays, never guessed.

---

## 🕹️ How a Session Works

### Setup & platform
* **Remote or side by side, live.** Both players must be online at the same time and talking, ideally on a phone or video call. The app has no voice chat. This is different from First to Worst, which could be played asynchronously.
* **Room:** Same pattern as First to Worst. A room code in the URL (`/#room-name`), no accounts, no lobby. Each player picks "I'm the Investigator" or "I'm the Defendant" once, saved on their device.
* If a player disconnects, the game waits and resumes at the same Part and attempt. Nothing is lost.

### Turn flow (one Part)
1. **Read.** Each player reads their private screen (new info for this Part) and sees their hand of 3 cards.
2. **Talk.** Players discuss out loud. There is no timer in v1.
3. **Lock in.** Each player secretly picks **one** card and presses "Lock in". Neither card is revealed until both players have locked in.
4. **Reveal.** Both cards flip at once. The pair is judged:
   * **Correct pair:** "Working theory accepted." The Part's theory text is shown and the story continues.
   * **Trap pair:** "Plausible, but something doesn't fit. Talk it through." The Part stays open.
   * **Any other pair:** "That doesn't hold up." The Part stays open.
5. **Attempts:** Each Part allows **2 attempts**. After the 2nd miss, the judge steps in and **simply reveals the correct pair**, with no extra hint. The Part's theory text is shown and play continues. There is no game over.
6. **No live scores.** Focus and Trust are tracked silently and shown only on the end-of-case screen, so players focus on each other instead of the numbers.

Note-taking: allowed by honor system (it is a listening game, not an exam). The app itself shows no recap until the case ends.

---

## 📈 Case Classification (by number of Parts)

Length is the only difficulty setting. Because the app never reminds you of past context, longer cases tax memory and trust more.

| Tier | Parts | Design notes |
| :--- | :--- | :--- |
| 🟢 Easy | up to 3 | One twist, a few facts to remember, 1 trap pair per Part. |
| 🟡 Medium | up to 5 | Third-party characters and conflicting alibis. Several traps per Part that only collapse if you remember an earlier Part. |
| 🔴 Hard | more than 5 | Forensic data, access logs, shifting motives. Multiple "close" wrong answers per Part, some of which were *correct* in an earlier Part. |

**v1 ships one Easy case.** Medium and Hard are defined so the content format can grow into them.

---

## ⚖️ The Trust & Focus Scoring System

Scores come from card data, not from what players say. Every card in the case file lists which **facts** it contradicts (see *Content Rules*). Each lock-in can raise up to two flags:

* **Trust flag:** the card contradicts a fact on the **partner's screen in the same Part**. The partner told you, and you played against it.
* **Focus flag:** the card contradicts a fact established in an **earlier Part**. You forgot something the team already learned.

Cards that only contradict the player's *own* screen are just wrong answers. They cost an attempt but raise no flag.

| Metric | Formula |
| :--- | :--- |
| **Trust %** | `100 × (1 − trust flags ÷ total lock-ins)` |
| **Focus %** | `100 × (1 − focus flags ÷ lock-ins in Parts 2+)`. Part 1 has no earlier facts, so it isn't counted. |
| **Attempts** | Shown as a plain stat, e.g. "4 attempts across 3 Parts" (max 6 with 2 per Part). Not scored. |

Scores are **team scores**. A per-player breakdown exists in the data but is hidden by default, so the game stays playful and never turns into a blame sheet.

### Duo classification (end-of-case screen)
Evaluated top to bottom, first match wins:

| Condition | Classification |
| :--- | :--- |
| Trust ≥ 90 and Focus ≥ 90 | **Mind-Reading Team** |
| Trust ≥ 90 and Focus < 90 | **Loyal, Slightly Forgetful** |
| Focus ≥ 90 and Trust < 90 | **Sharp, Slightly Suspicious** |
| Trust ≥ 70 and Focus ≥ 70 | **Solid Partners** |
| Otherwise | **Still Learning Each Other** |

**Example end screen**
* **Case Status:** Resolved. Verdict: Not Guilty
* **Focus:** 92%. Strong memory across all Parts.
* **Trust:** 98%. You listened to each other.
* **Duo:** Mind-Reading Team

---

## 🔎 The Launch Case: "The Case of the Ruined Birthday" (Easy, 3 Parts)

### Case bible (the canon truth)
* It is **Friday, Maya's birthday**. Maya booked Bellini's for two at **8:00 PM**.
* Three weeks ago she sent Leo a calendar invite: **"Maya's birthday 🎂 — Bellini's", Friday 8:00 PM**. The title has no meal word in it.
* Leo is secretly planning a **surprise baking masterclass** for Maya. Earlier this month he researched and booked it on the **shared laptop** using a **VPN set to Tokyo**, so Maya wouldn't see it in the history.
* His calendar app **auto-detects its time zone**. While the VPN was on, it switched to Tokyo time, so Maya's invite now displays **Saturday 9:00 AM** (Friday 8:00 PM Toronto = Saturday 9:00 AM Tokyo, a 13-hour shift).
* Leo assumed the plan was a **birthday brunch on Saturday morning**, so he told his friend Dave days ago that he was free Friday night.
* Friday evening he joins Dave's tournament match. Maya waits at Bellini's from 8:00 PM and walks to his apartment at 9:00 PM.
* **Truth:** Leo wasn't neglectful, and Dave wasn't to blame. A secret, a VPN and an auto time zone moved the dinner to the wrong day.

### Fact ledger
Facts are what cards can contradict. IDs are referenced in the card tables below.

| ID | Screen | Fact |
| :--- | :--- | :--- |
| P1-I1 | Investigator | Maya booked Bellini's for 8:00 PM tonight, her birthday. |
| P1-I2 | Investigator | Leo was mid-match with his headset on, and looked more shocked than guilty. |
| P1-D1 | Defendant | Leo had no idea the dinner was tonight. |
| P1-D2 | Defendant | Leo is secretly planning a birthday surprise for Maya. |
| P2-I1 | Investigator | Dave's 7:15 PM text says Leo had **already told him** he was free tonight. |
| P2-D1 | Defendant | Leo told Dave he was free because he believed the plans were **Saturday at 9:00 AM**. |
| P2-D2 | Defendant | Dave only reminded Leo about the match. He didn't talk him out of anything. |
| P3-I1 | Investigator | Maya sent the invite for Friday 8:00 PM and **never edited it**. |
| P3-I2 | Investigator | The invite on Leo's laptop shows **Saturday 9:00 AM**. |
| P3-D1 | Defendant | Leo never edited the invite. |
| P3-D2 | Defendant | Leo used a Tokyo VPN on the laptop. His calendar auto-detects its time zone. |

---

### 🎬 Part 1: The Empty Table
*Surface layer. Everything looks like pure negligence.*

**Investigator's screen**
> It's your birthday. You booked Bellini's for two at 8:00 PM tonight. Leo never showed and didn't answer your texts at 8:15 or 8:45. At 9:00 PM you walked to his apartment and found him at his PC, headset on, mid-match with his friends. When he saw you, he looked more shocked than guilty.

**Defendant's screen**
> You were deep in an online match with friends. When Maya walks in, you're mortified. You had no idea tonight was the dinner. You also can't explain yourself yet: you've been quietly planning a birthday surprise for her for weeks, and you don't want to spoil it.

| Card | Holder | Text | Type | Flags if played |
| :--- | :--- | :--- | :--- | :--- |
| I1 | Investigator | "He looked shocked, not guilty." | ✅ Correct | none |
| I2 | Investigator | "He doesn't care about my birthday." | ⚠️ Trap | Trust (contradicts P1-D2) |
| I3 | Investigator | "He ignored my texts on purpose." | ❌ Decoy | Trust (contradicts P1-D1) |
| D1 | Defendant | "I had no idea tonight was the dinner." | ✅ Correct | none |
| D2 | Defendant | "I forgot her birthday entirely." | ⚠️ Trap | none (only contradicts own screen) |
| D3 | Defendant | "I was too sick to come." | ❌ Decoy | Trust (contradicts P1-I2) |

* **Correct pair:** I1 + D1
* **Trap pair:** I2 + D2 (the obvious "he's negligent" story)
* **Working theory shown:** *Leo didn't know the dinner was tonight. The question is why.*

---

### 🎬 Part 2: The Buddy
*The story continues in the apartment. Nothing is recapped.*

**Investigator's screen**
> As Leo shuts down his PC, his phone lights up on the desk. A message from his friend Dave, sent at 7:15 PM: *"Tournament starts in 15. You said you were free tonight, don't flake on us."*

**Defendant's screen**
> You decide to be honest about this much: you told Dave days ago that you were free tonight, because you believed the birthday plans were on Saturday at 9:00 AM. Dave only reminded you about the match at 7:15. You're still hiding the surprise.

| Card | Holder | Text | Type | Flags if played |
| :--- | :--- | :--- | :--- | :--- |
| I4 | Investigator | "Dave talked him out of coming." | ⚠️ Trap | Trust (contradicts P2-D2) |
| I5 | Investigator | "Leo had promised Dave his evening before Dave asked." | ✅ Correct | none |
| I6 | Investigator | "Leo lied to me about having plans." | ❌ Decoy | Trust (contradicts P2-D1) |
| D4 | Defendant | "I believed the birthday plans were Saturday morning." | ✅ Correct | none |
| D5 | Defendant | "Dave pressured me into skipping the dinner." | ⚠️ Trap | Trust (contradicts P2-I1) |
| D6 | Defendant | "I double-booked on purpose." | ❌ Decoy | none (only contradicts own screen) |

* **Correct pair:** I5 + D4
* **Trap pair:** I4 + D5 (the "peer pressure" story)
* **Working theory shown:** *Leo thought the plans were Saturday morning, and Dave is a bystander. Where did Leo get that idea?*

---

### 🎬 Part 3: The Invite
*The final layer. It needs the facts from Part 2 (Dave is a bystander, and Leo knew "Saturday 9:00 AM") and the secret surprise from Part 1.*

**Investigator's screen**
> You ask to see the invite you sent three weeks ago. You're certain it said Friday at 8:00 PM, and you never edited it. Your confirmation email still says so. On Leo's laptop, the calendar shows "Maya's birthday 🎂 — Bellini's" on **Saturday at 9:00 AM**.

**Defendant's screen**
> You open your calendar and see the same thing: Saturday, 9:00 AM. You never touched the invite. Earlier this month you researched and booked a surprise baking masterclass for Maya on the shared laptop, using a VPN set to Tokyo so she wouldn't see it in the history. Your calendar app detects its time zone automatically.

| Card | Holder | Text | Type | Flags if played |
| :--- | :--- | :--- | :--- | :--- |
| I7 | Investigator | "The invite on his screen shows a different day and time than the one I sent." | ✅ Correct | none |
| I8 | Investigator | "Leo changed the invite himself." | ❌ Decoy | Trust (contradicts P3-D1) |
| I9 | Investigator | "Dave swapped my invite for a fake one." | ⚠️ Memory lure | Focus (contradicts P2-D2) |
| D7 | Defendant | "My calendar switched to Tokyo time while my VPN was on." | ✅ Correct | none |
| D8 | Defendant | "Maya edited the invite after I accepted it." | ⚠️ Trap | Trust (contradicts P3-I1) |
| D9 | Defendant | "I never opened the invite." | ⚠️ Memory lure | Focus (contradicts P2-D1) |

* **Correct pair:** I7 + D7
* **Trap pairs:**
  * I7 + D8 (sounds consistent, but Maya never edited it)
  * I9 + D9 (a leftover from Part 2's "Dave" story; it only collapses if you remember Parts 1 and 2)
* **Case complete, verdict shown:** see below.

---

### 🏆 Verdict: NOT GUILTY
Leo wasn't neglecting Maya's birthday, and Dave wasn't pulling the strings. A secret surprise, a VPN set to Tokyo, and a calendar that auto-detects its time zone moved a Friday-night dinner to Saturday morning. The baking masterclass was waiting for Saturday. Leo owes Maya one very good weekend.

After the verdict, show a **full recap screen**: the three Parts side by side, both screens, with the correct pairs highlighted. This is the first time either player sees the other's text.

---

## 🧩 Content Rules (for writing and validating cases)

Cases are stored as data and checked by a validator before they can ship.

```json
{
  "id": "ruined-birthday",
  "tier": "easy",
  "parts": [{
    "n": 1,
    "title": "The Empty Table",
    "screens": {
      "investigator": { "info": "...", "facts": [{ "id": "P1-I1", "text": "..." }] },
      "defendant":    { "info": "...", "facts": [{ "id": "P1-D1", "text": "..." }] }
    },
    "hands": {
      "investigator": [{ "id": "I1", "text": "...", "contradicts": [] }],
      "defendant":    [{ "id": "D1", "text": "...", "contradicts": [] }]
    },
    "correct": ["I1", "D1"],
    "traps": [{ "pair": ["I2", "D2"] }],
    "theory": "Leo didn't know the dinner was tonight. The question is why."
  }],
  "verdict": { "title": "NOT GUILTY", "text": "..." }
}
```

**Validator checks**
1. Every Part has exactly **one** correct pair, and 3 cards per hand.
2. Every Part has at least one trap pair, and traps are never the correct pair.
3. Every `contradicts` entry refers to an existing fact ID. A fact from the partner's screen in the same Part gives a Trust flag, and a fact from an earlier Part gives a Focus flag.
4. From Part 2 onward, at least one card per Part is a **memory lure** (a Focus flag).
5. **No keyword matching:** a correct pair must not share distinctive words, so players can't solve it by wording alone.
6. Decoys must be plausible, not silly. If a card is obviously absurd, rewrite it.
7. Later Parts may deepen or recontextualize a working theory, but never contradict a fact stated in an earlier Part's ledger.
8. Check numbers and times with a calculator (for example, the 13-hour Toronto-to-Tokyo shift in this case).

---

## 🛠️ Technical Notes

* **Stack:** reuse the First to Worst stack (Next.js, Firebase Realtime Database, env-var config, room in URL hash, local fallback mode for testing in two tabs).
* **Game state:** `caseId`, `partIndex`, `attempts`, `phase` (`SELECTING`, `REVEALED`, `PART_DONE`, `CASE_DONE`), `locks` (one card ID per role, hidden until both are set), and a `log` of every attempt (cards, result, flags). Scores are computed from the log.
* **Transactions:** the move from `SELECTING` to `REVEALED` happens in a transaction that requires both locks. Advancing to the next Part must be idempotent.
* **Content:** the case JSON ships with the app. Each client renders only its own role's data. A curious player could read the whole file. As with First to Worst, this is accepted for a trusted pair.
* **Rematch (swap roles):** supported, but note that on a second run both players already know the story. See below.

---

## 🔁 Rematch & Future Content

* **Rematch:** roles swap, and the goal becomes a *clean run*: zero flags and first-try solves. Replay value of a single case is limited, and the doc is honest about that.
* **More cases** are the real growth path. Cases can be drafted with Claude and then run through the validator above.
* **Ideas for later:** custom player names in place of Maya and Leo (needs gender-neutral wording), an optional in-app "case file" assist for beginners, non-acquittal verdicts ("guilty, with mitigating facts"), and Medium and Hard cases.

---

## ✅ Decisions Made

1. **Attempts:** 2 per Part.
2. **Judge's intervention:** after the 2nd miss, the correct pair is revealed. No hint.
3. **Score visibility:** Focus and Trust are shown only at the end of the case.
4. **Theme and title:** keep "Co-Counsel" and the courtroom theme, with a light touch: "Case File" headers, a judge for interventions, and a verdict screen.

## ❓ Still Open

* Whether 2 attempts feels too tight once real players try it. Revisit after the first playthrough.
