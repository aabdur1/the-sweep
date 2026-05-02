import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaceSuggestion } from '../types';
import { autocomplete, isConfigured, newSessionToken } from '../lib/googlePlaces';

const DEBOUNCE_MS = 250;

export interface UseAddressSearchApi {
  query: string;
  setQuery: (v: string) => void;
  suggestions: PlaceSuggestion[];
  isSearching: boolean;
  hasGoogle: boolean;
  /** Returns the current session token so the consumer can pair it with the
   *  follow-up Place Details call before resetting. */
  getSessionToken: () => string;
  /** Call after the user selects a suggestion (or cancels). Resets the token
   *  so the next session starts fresh. */
  resetSession: () => void;
}

export const useAddressSearch = (): UseAddressSearchApi => {
  const [query, setQueryState] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const sessionTokenRef = useRef<string>(newSessionToken());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef<string>('');

  const setQuery = useCallback((v: string) => {
    setQueryState(v);
    lastQueryRef.current = v;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!isConfigured() || v.trim().length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      const captured = lastQueryRef.current;
      const results = await autocomplete(captured, sessionTokenRef.current);
      // Drop stale results if the user has typed more since.
      if (captured === lastQueryRef.current) {
        setSuggestions(results);
        setIsSearching(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  const resetSession = useCallback(() => {
    sessionTokenRef.current = newSessionToken();
    setSuggestions([]);
    setIsSearching(false);
  }, []);

  const getSessionToken = useCallback(() => sessionTokenRef.current, []);

  // Cleanup pending debounce on unmount.
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return {
    query,
    setQuery,
    suggestions,
    isSearching,
    hasGoogle: isConfigured(),
    getSessionToken,
    resetSession,
  };
};
