import { describe, expect, it } from "vitest";
import { detectInAppBrowser } from "./inAppBrowsers";

describe("detectInAppBrowser", () => {
  it.each([
    ["Messenger", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/450.0.0.30.106;FBBV/1]"],
    ["Facebook", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/455.0.0.39.109;FBBV/1]"],
    ["Instagram", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 325.0.3.25.94 (iPhone14,5; iOS 17_4)"],
    ["WhatsApp", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36 WhatsApp/2.24.9"],
    ["TikTok", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_34.0.0 BytedanceWebview/d8a21c6"],
    ["Snapchat", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Snapchat/13.0.0.42 (like Safari/8617.1.17.10.12)"],
    ["LINE", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.5.0"],
  ])("detects %s", (name, ua) => {
    expect(detectInAppBrowser(ua)).toBe(name);
  });

  it.each([
    ["iOS Safari", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"],
    ["Android Chrome", "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"],
    ["desktop Chrome", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"],
  ])("leaves %s alone", (_, ua) => {
    expect(detectInAppBrowser(ua)).toBeNull();
  });
});
