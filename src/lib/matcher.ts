import Fuse from 'fuse.js';
import type { Item } from './db';

// Fuzzy matching over the catalog. Aliases carry both Telugu script and
// Roman transliterations ("biyyam", "kandi pappu") so voice transcripts and
// scanned text match regardless of which script they arrive in.

function buildFuse(items: Item[]) {
  return new Fuse(items, {
    keys: [
      { name: 'name_en', weight: 2 },
      { name: 'name_te', weight: 2 },
      { name: 'aliases', weight: 2 },
      { name: 'brand', weight: 1 },
    ],
    threshold: 0.4,
    ignoreLocation: true,
    includeScore: true,
  });
}

let cachedFuse: Fuse<Item> | null = null;
let cachedItems: Item[] | null = null;

function fuseFor(items: Item[]): Fuse<Item> {
  if (cachedFuse && cachedItems === items) return cachedFuse;
  cachedFuse = buildFuse(items);
  cachedItems = items;
  return cachedFuse;
}

/** Best single match for a free-text query, or null if nothing is close enough. */
export function matchItem(query: string, items: Item[]): Item | null {
  const q = query.trim();
  if (!q) return null;
  const results = fuseFor(items).search(q, { limit: 1 });
  return results.length > 0 ? results[0].item : null;
}

/** Top-N matches for interactive search boxes. */
export function searchItems(query: string, items: Item[], limit = 8): Item[] {
  const q = query.trim();
  if (!q) return [];
  return fuseFor(items)
    .search(q, { limit })
    .map((r) => r.item);
}
