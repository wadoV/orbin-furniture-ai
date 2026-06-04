export const EVENTS = {
  ONBOARDING_COMPLETED: 'onboarding_completed',
  DESIGN_GENERATED: 'design_generated',
  PLAN_GATE_HIT: 'plan_gate_hit',
  PRICING_MODAL_VIEWED: 'pricing_modal_viewed',
  PLAN_UPGRADED: 'plan_upgraded',
  FILE_EXPORTED: 'file_exported',
  ROOM_SHARED: 'room_shared',
  PLAN_GATE_VIEWED: 'plan_gate_viewed',
  UPGRADE_CTA_CLICKED: 'upgrade_cta_clicked'
};

export const trackEvent = (eventName, props = {}) => {
  try {
    const dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
    if (dnt === "1" || dnt === "yes") return;
    
    if (typeof window === 'undefined' || !window.plausible) {
      console.debug(`[Analytics Mock] Event: ${eventName}`, props);
      return;
    }
    
    window.plausible(eventName, { props });
  } catch (error) {
    console.error('Analytics tracking failed:', error);
  }
};
