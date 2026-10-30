T-7nbm | 2 | - | S | test,nighthighway | Night Highway traffic.test 'never lets two vehicles overlap' times out when the machine is busy: give it a longer timeout or a lighter simulation
created: 2026-10-30T17:59:25.795Z

Seen twice on 2026-10-30 in ./scripts/check (lib/games/nighthighway/traffic.test.ts:50) while an emulator-backed dev server ran on the same machine; it passes alone and on rerun. It simulates three whole races step by step, so under load it can pass vitest's default 5 s timeout. Fix: a per-test timeout (it(..., 20_000)) or fewer seeds/steps; then run ./scripts/check with a dev server up to confirm. Why: a flaky check hides real failures.
