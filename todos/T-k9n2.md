T-k9n2 | 3 | - | S | frontend,admin | Closed rooms: hide the footer's Reset game link when roomClosed (it silently does nothing)
created: 2026-10-25T13:14:23.997Z

After T-058, a closed room still shows the shared Footer's 'Reset game' link. Clicking it does nothing (the rules refuse the write, silently). Hide it when the session's roomClosed is true; New room already works (its leave() is refused, then a fresh room is created). Touches components/Footer.tsx and the five game pages that pass onReset.
