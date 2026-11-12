/**
 * Filtrado y ordenamiento de listados (vehículos, almacenes, pedidos).
 * Un solo criterio de orden a la vez; los valores sin dato van siempre al
 * final, en cualquier dirección, y el orden es estable.
 */

export type SortDir = "asc" | "desc";
export type SortValue = number | string | null | undefined;

const missing = (v: SortValue) => v == null || (typeof v === "number" && Number.isNaN(v));

export function sortBy<T>(items: readonly T[], key: (item: T) => SortValue, dir: SortDir = "asc"): T[] {
  const sign = dir === "asc" ? 1 : -1;
  return items
    .map((item, index) => ({ item, index, value: key(item) }))
    .sort((a, b) => {
      const ma = missing(a.value), mb = missing(b.value);
      if (ma || mb) return ma === mb ? a.index - b.index : ma ? 1 : -1;
      const cmp = typeof a.value === "number" && typeof b.value === "number"
        ? a.value - b.value
        : String(a.value).localeCompare(String(b.value), "es", { numeric: true });
      return cmp ? sign * cmp : a.index - b.index;
    })
    .map((x) => x.item);
}

/** Conserva los elementos que cumplen todos los predicados (null = filtro inactivo). */
export function filterBy<T>(items: readonly T[], predicates: (((item: T) => boolean) | null | undefined)[]): T[] {
  const active = predicates.filter((p): p is (item: T) => boolean => !!p);
  return active.length ? items.filter((i) => active.every((p) => p(i))) : [...items];
}

/** Filtro de selección múltiple (chips): sin nada elegido, no filtra. */
export function inSet<T, V>(selected: ReadonlySet<V>, value: (item: T) => V | null | undefined): ((item: T) => boolean) | null {
  if (!selected.size) return null;
  return (item) => {
    const v = value(item);
    return v != null && selected.has(v);
  };
}

/** Alterna un valor dentro de un conjunto inmutable. */
export function toggleIn<V>(set: ReadonlySet<V>, value: V): Set<V> {
  const next = new Set(set);
  if (!next.delete(value)) next.add(value);
  return next;
}

/**
 * Ids de las filas que cumplen el filtro de color, en orden estable; null si el
 * filtro no está activo (el mapa dibuja todo). `always` se muestra siempre (el
 * vehículo fijado, que la lista también conserva fuera del filtro).
 */
export function idsMatching<T extends { id: string }>(rows: readonly T[], active: boolean, matches: (row: T) => boolean, always?: string | null): string[] | null {
  if (!active) return null;
  return rows.filter((r) => r.id === always || matches(r)).map((r) => r.id).sort();
}
