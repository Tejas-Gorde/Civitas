/**
 * Robust client-side device detection helper for Civitas Digital Voting System.
 * Distinguishes mobile smartphones (Android Chrome, iPhone Safari, Mobile Firefox/Chrome)
 * from desktop workstations (macOS Chrome/Safari, Windows Edge/Chrome).
 */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || "";

  // Common mobile user agent patterns (Android, iPhone, Mobile Safari, etc.)
  const mobileRegex = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS|FxiOS/i;
  const isMobileUA = mobileRegex.test(ua);

  // Touch screen & coarse pointer capabilities
  const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 768;

  // iPadOS 13+ desktop-mode Safari spoof check
  const isIPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;

  return isMobileUA || isIPadOS || (isTouchDevice && isSmallScreen);
}
