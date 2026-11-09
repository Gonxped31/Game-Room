T-qkje | 2 | - | S | cocounsel | Co-Counsel: How to play says the case ends after the 3rd miss, the code ends it ON the 3rd: make the rule and the text agree
created: 2026-11-09T13:35:19.484Z

Trigger: none, any time. The English rules in components/cocounsel/Rules.tsx say "3 misses... The one after that ends it", but lib/games/cocounsel ends the case on the 3rd miss (MAX_CASE_ATTEMPTS). The French rules were written to match the code ("à la 3e erreur, l'affaire est ajournée"). Decide which is intended, make English and French say the same, and update the co-counsel skill if the rule changes. Why: players read rules that contradict what happens.
