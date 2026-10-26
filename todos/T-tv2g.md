T-tv2g | 1 | - | S | devops,regions | Checkmate Grid daily goes live: set DAILY_SECRET on Vercel Production, then deploy the rules (daily board index)
created: 2026-10-26T03:18:11.951Z

Trigger: the regions-daily branch is merged and Vercel has deployed it. Until DAILY_SECRET is set, /regions shows 'The daily puzzle isn't available here.' on its Daily tab (Endless works). Set DAILY_SECRET (Production only) to a long random string, once: changing it later changes every future puzzle. Redeploy, then deploy database.rules.json (database-rules skill; the only change is .indexOn ms under daily/$slug/$day/board). Check: play the daily on production, see yourself on the board. See docs/daily.md, Deploy.
