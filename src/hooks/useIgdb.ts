import { useEffect, useState } from 'react';

import { fetchGameInfo, type IgdbInfo } from '@/api/igdb';

export function useIgdb(query: string) {
  const [info, setInfo] = useState<IgdbInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchGameInfo(query)
      .then((result) => {
        if (!cancelled) setInfo(result);
      })
      .catch((error) => console.warn('IGDB', error));
    return () => {
      cancelled = true;
    };
  }, [query]);

  return info;
}
