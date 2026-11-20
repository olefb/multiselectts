// File: data/datasets.ts
// Registry of the datasets the explorer can show: the seeded mock tree plus
// every JSON task folder in src/data/datasets/ (bundled at build time).

import { datasetFromFile, makeDataset, type Dataset, type DatasetFile } from "./dataset";
import { DATASET_SEED, TREE_DATA } from "./mockFileSystem";

export const MOCK_DATASET: Dataset = makeDataset("mock", `seed ${DATASET_SEED}`, TREE_DATA);

const files = import.meta.glob<DatasetFile>("./datasets/*.json", { eager: true, import: "default" });

export const DATASETS: ReadonlyMap<string, Dataset> = new Map([
  [MOCK_DATASET.id, MOCK_DATASET],
  ...Object.values(files).map((f) => {
    const d = datasetFromFile(f);
    return [d.id, d] as const;
  }),
]);

export function datasetOrMock(id: string | null): Dataset {
  return (id && DATASETS.get(id)) || MOCK_DATASET;
}
