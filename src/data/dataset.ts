// File: data/dataset.ts
//
// A dataset is the file tree the explorer shows: the random mock tree, or a
// hand-built task folder loaded from JSON (src/data/datasets/*.json).

import type { TreeNode } from "../lib/TreeModels";
import { HIGHLIGHTS, LANGS, type TaskFileEntry, type TaskSpec } from "./tasks";

export interface Dataset {
  /** Stable key, used in ?dataset= (e.g. "mock", "pets-demo"). */
  id: string;
  /** Shown in the footnote after "dataset " (e.g. "seed 20260923", "pets-demo"). */
  label: string;
  tree: TreeNode[];
  /** Every node in pre-order. */
  flat: TreeNode[];
  byId: ReadonlyMap<string, TreeNode>;
  ids: readonly string[];
  /** Study tasks defined for this dataset, by task ID. */
  tasks: ReadonlyMap<string, TaskSpec>;
}

export function makeDataset(
  id: string,
  label: string,
  tree: TreeNode[],
  tasks: ReadonlyMap<string, TaskSpec> = new Map(),
): Dataset {
  const flatten = (nodes: TreeNode[]): TreeNode[] =>
    nodes.flatMap((n) => [n, ...(n.children ? flatten(n.children) : [])]);
  const flat = flatten(tree);
  return { id, label, tree, flat, byId: new Map(flat.map((n) => [n.id, n])), ids: flat.map((n) => n.id), tasks };
}

/** Folders from the root down to `folderId` (empty for the root). */
export function breadcrumbTrail(dataset: Dataset, folderId: string | null): TreeNode[] {
  if (folderId === null) return [];
  const trail: TreeNode[] = [];
  const walk = (nodes: TreeNode[]): boolean => {
    for (const n of nodes) {
      if (n.id === folderId) {
        trail.push(n);
        return true;
      }
      if (n.children && walk(n.children)) {
        trail.unshift(n);
        return true;
      }
    }
    return false;
  };
  walk(dataset.tree);
  return trail;
}

/** Thumbnail URL relative to the app's base (works under a sub-path deployment too). */
export const thumbnailUrl = (thumbnail: string) => `${import.meta.env.BASE_URL}${thumbnail}`;

// ---------------------------------------------------------------------------
// JSON task folders
// ---------------------------------------------------------------------------

/** One entry in a dataset JSON file. Folders have `children`; files do not. */
export interface DatasetEntry {
  name: string;
  size?: string;
  modified?: string;
  thumbnail?: string;
  tags?: string[];
  children?: DatasetEntry[];
}

/** Shape of src/data/datasets/<id>.json. */
export interface DatasetFile {
  id: string;
  description?: string;
  tree: DatasetEntry[];
  /** Study tasks on this tree, by task ID (see data/tasks.ts). */
  tasks?: Record<string, TaskFileEntry>;
}

/**
 * Validates a dataset file and assigns stable IDs: the slash-separated path of
 * names from the root (e.g. "Photos/IMG_4801.jpg"). Throws on missing names or
 * duplicate names within a folder, since those would give duplicate IDs.
 */
export function datasetFromFile(file: DatasetFile): Dataset {
  if (!file.id || !Array.isArray(file.tree)) throw new Error("Dataset file needs an id and a tree");
  const convert = (entries: DatasetEntry[], parentPath: string): TreeNode[] => {
    const seen = new Set<string>();
    return entries.map((e) => {
      if (!e.name) throw new Error(`Dataset ${file.id}: entry without a name in "${parentPath || "/"}"`);
      if (e.name.includes("/")) throw new Error(`Dataset ${file.id}: "/" is not allowed in names ("${e.name}")`);
      if (seen.has(e.name)) throw new Error(`Dataset ${file.id}: duplicate name "${e.name}" in "${parentPath || "/"}"`);
      seen.add(e.name);
      const id = parentPath ? `${parentPath}/${e.name}` : e.name;
      const node: TreeNode = { id, name: e.name };
      if (e.size) node.size = e.size;
      if (e.modified) node.modified = e.modified;
      if (e.thumbnail) node.thumbnail = e.thumbnail;
      if (e.tags) node.tags = e.tags;
      if (e.children) node.children = convert(e.children, id);
      return node;
    });
  };
  const base = makeDataset(file.id, file.id, convert(file.tree, ""));
  const tasks = new Map<string, TaskSpec>();
  for (const [taskId, entry] of Object.entries(file.tasks ?? {})) {
    validateTask(base, taskId, entry);
    tasks.set(taskId, { id: taskId, ...entry });
  }
  return makeDataset(base.id, base.label, base.tree, tasks);
}

/** Every ID a task refers to must exist, and folders must be folders. */
function validateTask(dataset: Dataset, taskId: string, t: TaskFileEntry) {
  const where = `Dataset ${dataset.id}, task "${taskId}"`;
  const check = (field: string, ids: string[] | undefined, folder: boolean) => {
    for (const id of ids ?? []) {
      const node = dataset.byId.get(id);
      if (!node) throw new Error(`${where}: ${field} refers to unknown item "${id}"`);
      if (folder && !node.children) throw new Error(`${where}: ${field} "${id}" is not a folder`);
    }
  };
  check("folder", t.folder ? [t.folder] : undefined, true);
  check("expanded", t.expanded, true);
  check("preselected", t.preselected, false);
  check("keep", t.keep, false);
  check("anchor", t.anchor !== undefined ? [t.anchor] : undefined, false);
  check("focus", t.focus !== undefined ? [t.focus] : undefined, false);
  check("scrollTo", t.scrollTo !== undefined ? [t.scrollTo] : undefined, false);
  check("targets", t.targets, false);
  if (t.view && t.view !== "tree" && t.view !== "grid") throw new Error(`${where}: view must be "tree" or "grid"`);
  if (t.requires !== undefined) {
    const r = t.requires as Record<string, unknown> | null;
    if (typeof r !== "object" || r === null) throw new Error(`${where}: requires must be an object`);
    for (const key of Object.keys(r))
      if (key !== "view" && key !== "showSelectedOnly") throw new Error(`${where}: unknown requirement "${key}"`);
    if (r.view !== undefined && r.view !== "tree" && r.view !== "grid") throw new Error(`${where}: requires.view must be "tree" or "grid"`);
    if (r.showSelectedOnly !== undefined && typeof r.showSelectedOnly !== "boolean")
      throw new Error(`${where}: requires.showSelectedOnly must be true or false`);
  }
  for (const h of t.highlight === undefined ? [] : Array.isArray(t.highlight) ? t.highlight : [t.highlight])
    if (!(HIGHLIGHTS as readonly unknown[]).includes(h)) throw new Error(`${where}: highlight must be one of ${HIGHLIGHTS.join(", ")}`);
  for (const field of ["instructions", "doneNote"] as const) {
    const text = t[field];
    if (text === undefined || typeof text === "string") continue;
    const values = typeof text === "object" && text !== null ? Object.entries(text) : [];
    if (typeof text !== "object" || text === null || typeof (text as { en?: unknown }).en !== "string")
      throw new Error(`${where}: ${field} must be a string or an object with an "en" text`);
    for (const [lang, value] of values) {
      if (!(LANGS as readonly string[]).includes(lang)) throw new Error(`${where}: unknown language "${lang}" in ${field}`);
      if (typeof value !== "string") throw new Error(`${where}: ${field}.${lang} must be a string`);
    }
  }
}
