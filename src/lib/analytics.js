export function trackEvent(eventName, properties) {
  if (typeof window === 'undefined') return;
  window.umami?.track?.(eventName, properties);
}
