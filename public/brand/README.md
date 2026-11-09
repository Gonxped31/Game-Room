# Partyfox logo (the fox bubble)

A fox head shaped like a chat bubble, next to a lowercase "partyfox" in Fredoka SemiBold (outlined, so no font is needed). These are the asset files only: nothing in the app uses them yet.

## Colors
| Use | Hex |
| :-- | :-- |
| Fox orange | #F2873B |
| Inner ears, "fox" on light backgrounds | #C9612A |
| Cheeks | #FFF7EC |
| Ink ("party", eyes, nose) | #16363B |
| Teal (app background, icon tile) | #0F7983 |
| "fox" on teal or dark backgrounds | #FFC08A |

## Files
- `svg/partyfox-logo.svg`: fox and word, for light backgrounds. `-white` for teal or dark backgrounds (transparent), `-on-teal` with the teal background baked in.
- `svg/partyfox-mark.svg`: the fox bubble alone. `svg/partyfox-icon.svg`: on a rounded teal tile; `-square` unrounded (iOS and Android round it themselves); `-maskable` sized for Android's safe zone.
- `png/`: the logos at 1740x480, the mark and icon at 1024.
- `favicon/`: `favicon.ico` (16, 32, 48), `favicon.svg`, 16/32/48 PNGs, `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png` and `icon-512-maskable.png` for the web app manifest. `favicon-small.svg` is the source of the 16px PNG (a larger fox, so it stays readable).
