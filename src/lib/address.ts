/**
 * Strip apartment/unit/suite/floor markers, ZIP codes, and trailing ", Chicago, IL".
 * Geocoders choke on these; we re-append the city context ourselves.
 */
export const cleanAddress = (raw: string): string => {
  let s = raw.trim();
  s = s.replace(
    /,?\s*(apt|apartment|unit|suite|ste|#|floor|fl|rm|room|bldg)\.?\s*[\w-]+/gi,
    ''
  );
  s = s.replace(/\b\d{5}(-\d{4})?\b/g, '');
  s = s.replace(/,?\s*chicago\s*,?\s*(il|illinois)?/gi, '');
  s = s.replace(/,?\s*(il|illinois)\b/gi, '');
  s = s.replace(/\s+/g, ' ').replace(/,\s*,/g, ',').replace(/^,|,\s*$/g, '').trim();
  return s;
};
