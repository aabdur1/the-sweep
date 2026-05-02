import { useCallback, useEffect, useState } from 'react';
import type { SavedAddress } from '../types';
import * as saved from '../lib/savedAddresses';

export interface UseSavedAddressesApi {
  saved: SavedAddress[];
  isSaved: (lat: number, lon: number) => SavedAddress | undefined;
  save: (entry: Omit<SavedAddress, 'id' | 'savedAt'>) => SavedAddress;
  rename: (id: string, label: string) => void;
  remove: (id: string) => void;
}

export const useSavedAddresses = (): UseSavedAddressesApi => {
  const [list, setList] = useState<SavedAddress[]>(() => saved.list());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === saved.STORAGE_KEY) setList(saved.list());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return {
    saved: list,
    isSaved: useCallback(saved.exists, []),
    save: useCallback((entry) => {
      const created = saved.add(entry);
      setList(saved.list());
      return created;
    }, []),
    rename: useCallback((id, label) => {
      saved.rename(id, label);
      setList(saved.list());
    }, []),
    remove: useCallback((id) => {
      saved.remove(id);
      setList(saved.list());
    }, []),
  };
};
