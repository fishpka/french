export function trackEvent(eventName) {
  if (typeof window === 'undefined') return;
  window.umami?.track?.(eventName);
}
