/**
 * Apps whose built-in browser keeps its own storage, separate from Safari's
 * or Chrome's - a guest ID (and with it the "Your rooms" list) created in
 * there is lost to the player's real browser. Invite links get opened in
 * these all the time. Checked in order: Messenger's user agent also matches
 * Facebook's markers, so it comes first.
 */
export const IN_APP_BROWSERS: readonly { name: string; pattern: RegExp }[] = [
  { name: "Messenger", pattern: /FBAN\/Messenger|FB_IAB\/MESSENGER|MessengerForiOS|MessengerLite/i },
  { name: "Instagram", pattern: /Instagram/i },
  { name: "Facebook", pattern: /FBAN|FBAV|FB_IAB|FBIOS/i },
  { name: "WhatsApp", pattern: /WhatsApp/i },
  { name: "TikTok", pattern: /musical_ly|BytedanceWebview|TikTok/i },
  { name: "Snapchat", pattern: /Snapchat/i },
  { name: "LINE", pattern: /\bLine\//i },
];

/** The in-app browser this user agent belongs to, or null for a regular browser. */
export function detectInAppBrowser(userAgent: string): string | null {
  return IN_APP_BROWSERS.find(({ pattern }) => pattern.test(userAgent))?.name ?? null;
}
