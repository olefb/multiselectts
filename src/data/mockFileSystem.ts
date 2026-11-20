// File: data/mockFileSystem.ts
//
// Deterministic mock file system for the explorer and the user study.
// Every participant must see the same tree (same names, same IDs), so all
// randomness comes from a seeded PRNG. Override the seed with ?seed=<n>.

import type { TreeNode } from "../lib/TreeModels";

/** Seed used for the study dataset. Changing it changes every task's target IDs. */
export const DEFAULT_SEED = 20260923;

/** Small, fast, seedable PRNG (same algorithm as the property tests). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seedFromUrl = (): number | null => {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("seed");
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) ? n : null;
};

export const DATASET_SEED = seedFromUrl() ?? DEFAULT_SEED;


// Realistic name dictionaries
const FILE_BASENAMES = [
  "thesis_chapter_draft", "experiment_results", "telemetry_dump", "financial_forecast",
  "contract_signed", "vendor_invoice", "presentation_slides", "interview_audio",
  "system_architecture", "benchmark_evaluation", "figure_selection_algebra", "readme",
  "data_cleaned", "participant_metrics", "meeting_notes", "project_specification",
  "budget_summary", "user_study_protocol", "backup_snapshot", "abstract_v2"
];

const EXTENSIONS = [
  { ext: ".pdf", weight: 35 },   // Documents
  { ext: ".txt", weight: 20 },   // Plain text (targets for search testing)
  { ext: ".png", weight: 15 },   // Images
  { ext: ".csv", weight: 10 },   // Tabular data
  { ext: ".docx", weight: 8 },   // Word docs
  { ext: ".jpg", weight: 5 },    // Images
  { ext: ".json", weight: 4 },   // Structured data
  { ext: ".zip", weight: 3 }     // Compressed archives
];

// Helper: Pick a random weighted extension
const getRandomExt = (rand: () => number): string => {
  const roll = rand() * 100;
  let accumulated = 0;
  for (const { ext, weight } of EXTENSIONS) {
    accumulated += weight;
    if (roll <= accumulated) return ext;
  }
  return ".txt";
};

// Helper: Generate realistic human-readable file sizes
const getRandomSize = (rand: () => number): string => {
  const unit = rand() > 0.3 ? "MB" : "KB";
  const value = unit === "MB" ? (rand() * 45 + 0.5).toFixed(1) : Math.floor(rand() * 850 + 20);
  return `${value} ${unit}`;
};

/**
 * Realistic Tree Generator
 * Generates an organic, asymmetrical filesystem structure.
 */
export interface GeneratorConfig {
  maxDepth: number;
  subfoldersPerFolder: number;
  filesPerFolder: number;
}

export const generateRealisticFileSystem = (
  config: GeneratorConfig = { maxDepth: 4, subfoldersPerFolder: 4, filesPerFolder: 8 },
  seed: number = DEFAULT_SEED,
): TreeNode[] => {
  const rand = mulberry32(seed);
  let fileCounter = 0;

  const buildDirectory = (currentDepth: number, parentPath: string): TreeNode[] => {
    if (currentDepth > config.maxDepth) return [];

    const nodes: TreeNode[] = [];

    // Categorized folder names by depth level
const ROOT_FOLDERS = ["Documents", "Projects", "Media", "Finance", "Research", "Archives"];
const SUB_FOLDERS_L2 = ["2024", "2025", "2026", "Client_Alpha", "Internal", "Lab_Tests"];
const SUB_FOLDERS_DEEP = ["Raw", "Final", "Assets", "Review", "Exports", "Notes", "Drafts"];

// Inside buildDirectory:
const numFolders = Math.floor(rand() * config.subfoldersPerFolder) + 1;
for (let i = 0; i < numFolders; i++) {
  // Pick a realistic name based on the current depth level
  let folderName = "";
  if (currentDepth === 1) {
    folderName = ROOT_FOLDERS[i % ROOT_FOLDERS.length];
  } else if (currentDepth === 2) {
    folderName = SUB_FOLDERS_L2[i % SUB_FOLDERS_L2.length];
  } else {
    folderName = SUB_FOLDERS_DEEP[(i + currentDepth) % SUB_FOLDERS_DEEP.length];
  }

  const folderPath = parentPath ? `${parentPath}/${folderName.toLowerCase()}` : folderName.toLowerCase();

  nodes.push({
    id: folderPath,
    name: folderName, // 🚀 Clean, natural name without parentheses
    children: buildDirectory(currentDepth + 1, folderPath)
  });
}

    // 2. Generate Files in this directory
    const numFiles = Math.floor(rand() * config.filesPerFolder) + 3;
    for (let j = 0; j < numFiles; j++) {
      fileCounter++;
      const base = FILE_BASENAMES[fileCounter % FILE_BASENAMES.length];
      const ext = getRandomExt(rand);
      const fileName = `${base}_${j + 1}${ext}`;
      const filePath = parentPath ? `${parentPath}/${fileName}` : fileName;

      nodes.push({
        id: filePath,
        name: fileName,
        size: getRandomSize(rand),
        children: undefined // Denotes a file
      });
    }

    return nodes;
  };

  return buildDirectory(1, "");
};

// 🚀 TUNE SCALE HERE:
// Default settings produce ~1,500 - 2,500 realistic files.
// For a stress test of 10,000+ items, set filesPerFolder to 25 and subfoldersPerFolder to 5.
export const TREE_DATA: TreeNode[] = generateRealisticFileSystem(
  { maxDepth: 4, subfoldersPerFolder: 4, filesPerFolder: 100 },
  DATASET_SEED,
);
