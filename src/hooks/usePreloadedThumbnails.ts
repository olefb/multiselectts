import { useEffect, useMemo, useState } from "react";
import { thumbnailUrl, type Dataset } from "../data/dataset";

/**
 * Loads and decodes every thumbnail of a dataset before it is shown, so image
 * loading never shows up in task timings. Returns true when ready (at once for
 * datasets without thumbnails). Failed images do not block; they surface as
 * broken images and console errors instead.
 */
export function usePreloadedThumbnails(dataset: Dataset): boolean {
  const urls = useMemo(
    () => dataset.flat.flatMap((n) => (n.thumbnail ? [thumbnailUrl(n.thumbnail)] : [])),
    [dataset],
  );
  const [readyFor, setReadyFor] = useState<Dataset | null>(null);

  useEffect(() => {
    if (urls.length === 0) return;
    let cancelled = false;
    const load = (url: string) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.src = url;
        img.decode().then(resolve, resolve);
      });
    Promise.all(urls.map(load)).then(() => {
      if (!cancelled) setReadyFor(dataset);
    });
    return () => {
      cancelled = true;
    };
  }, [dataset, urls]);

  return urls.length === 0 || readyFor === dataset;
}
