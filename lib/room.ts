// Excludes visually ambiguous characters (i, l, o, 0, 1) so a code is easy to read/type if needed.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const CODE_LENGTH = 6;

/** A short, URL-safe room code for a fresh room's #hash. */
export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}
