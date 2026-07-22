import type { DepartmentRead } from '@/types';

/** Departments ordered as a pre-order tree walk, each labelled with indentation. */
export function orderedDepartmentOptions(
  departments: DepartmentRead[],
): { id: string; label: string; depth: number }[] {
  const children = new Map<string | null | undefined, DepartmentRead[]>();
  for (const dept of departments) {
    const key = dept.parent_id ?? null;
    const list = children.get(key) ?? [];
    list.push(dept);
    children.set(key, list);
  }
  for (const list of children.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  const out: { id: string; label: string; depth: number }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const dept of children.get(parentId) ?? []) {
      out.push({ id: dept.id, label: `${'　'.repeat(depth)}${dept.name}`, depth });
      walk(dept.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}
