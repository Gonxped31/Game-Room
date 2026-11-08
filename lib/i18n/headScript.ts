import { FR_PREFIX, LANG_CHOICE_KEY } from "./lang";

/**
 * Runs in <head> before the page paints (app/layout.tsx), so nobody sees the
 * wrong language flash:
 * - a guest's explicit choice from the language switch wins, on any page;
 * - with no choice made, a French browser landing on an English (unprefixed)
 *   link goes to its French twin; a /fr link stays French;
 * - <html lang> becomes "fr" on French pages.
 * The #room code and the ?tags ride along. /admin and /api are left alone.
 * Plain ES5 in a string: it runs before any bundle. Any failure leaves the
 * page as it is.
 */
export const LANG_HEAD_SCRIPT = `(function(){try{
var l=location,p=l.pathname,P=${JSON.stringify(FR_PREFIX)},fr=p===P||p.indexOf(P+"/")===0;
if(/^\\/(admin(\\/|$)|api\\/)/.test(p))return;
var c=null;try{c=localStorage.getItem(${JSON.stringify(LANG_CHOICE_KEY)})}catch(e){}
if(c!=="en"&&c!=="fr"){var n=navigator,b=((n.languages&&n.languages[0])||n.language||"").toLowerCase();c=!fr&&(b==="fr"||b.indexOf("fr-")===0)?"fr":null}
if(c==="fr"&&!fr){l.replace(P+(p==="/"?"":p)+l.search+l.hash);return}
if(c==="en"&&fr){l.replace((p.slice(P.length)||"/")+l.search+l.hash);return}
if(fr)document.documentElement.lang="fr";
}catch(e){}})();`;
