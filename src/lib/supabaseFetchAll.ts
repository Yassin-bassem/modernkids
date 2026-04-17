/**
 * Fetches ALL rows from a Supabase query, paginating in batches to bypass
 * the default 1000-row limit. Use this whenever a query could return more
 * than 1000 rows (e.g. fetching every order_item for a version).
 *
 * Usage:
 *   const rows = await fetchAllRows((from, to) =>
 *     supabase
 *       .from('order_items')
 *       .select('id, order_id, ...')
 *       .eq('version_id', versionId)
 *       .order('id', { ascending: true })
 *       .range(from, to)
 *   );
 *
 * The builder MUST include `.order(...)` and `.range(from, to)` so pagination
 * is deterministic. Returns all rows or throws on error.
 */
export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await buildQuery(from, to);

    if (error) {
      throw new Error(error.message);
    }

    const batch = data || [];
    all.push(...batch);

    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return all;
}
