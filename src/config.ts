// Every brand- and launch-level setting lives here, so a rename or a price change is one edit.

export const BRAND = {
  name: 'cori',
  collection: 'Collection 00',
  tagline: 'Running vests that go to brunch.',
  city: 'London',
  // TODO(founder): real contact email and Instagram handle once the name is cleared.
  email: 'hello@example.com',
  instagram: '',
};

// "chameleon": monochrome buttons, the heart takes the colour of the design on top.
// "ink": everything black and white. "cobalt": one signature blue. Compare with ?accent=… in dev.
export const THEME = { accent: 'chameleon' as 'chameleon' | 'ink' | 'cobalt' };

export const PRICE = { amount: 45, label: '£45', note: 'launch price' };

export const SIZES = [
  { id: 'xs-m', label: 'XS–M', uk: 'UK 6–12', bust: 'bust 76–94 cm' },
  { id: 'l-xxl', label: 'L–XXL', uk: 'UK 14–20', bust: 'bust 94–112 cm' },
  { id: 'unsure', label: 'Not sure / neither fits', uk: '', bust: '' },
] as const;

export const UK_SIZES_OUTSIDE = ['UK 4 or smaller', 'UK 22', 'UK 24', 'UK 26', 'UK 28+'];

export const CATALOG = {
  // Bump whenever designs are added, removed or re-photographed; it tags every event.
  version: '2026-10-14.2',
  // Sketches are stand-ins for designs that don't exist yet. Turn this off before sharing the vote,
  // or pass ?preview=1 to see them anyway.
  showSketches: true,
};

export const ENDPOINTS = {
  events: import.meta.env.PUBLIC_EVENTS_URL ?? '',
  signup: import.meta.env.PUBLIC_SIGNUP_URL ?? '',
};

export const CONSENT = {
  version: '2026-10-14.1',
  launchEmail: `We'll email you once when your favourite design launches.`,
  newsletter: `Also send me the ${BRAND.name} newsletter: new designs, run-club meet-ups, early news. Unsubscribe anytime.`,
};
