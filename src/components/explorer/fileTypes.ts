// File: components/explorer/fileTypes.ts
//
// File-type icons. Real file managers show a type icon (a red PDF, a blue Word
// document, ...), which lets people find files of one type by eye. Without it,
// visual search in the traditional condition (Task C: "all PDFs except the
// drafts") would be slower than in Explorer or Finder. Same in both systems.

export interface FileType {
  /** Short label drawn on the icon. */
  label: string;
  /** Icon colour (white label on it). */
  color: string;
}

const TYPES: Record<string, FileType> = {
  pdf: { label: "PDF", color: "#d93025" },
  doc: { label: "DOC", color: "#2b579a" },
  docx: { label: "DOC", color: "#2b579a" },
  xls: { label: "XLS", color: "#217346" },
  xlsx: { label: "XLS", color: "#217346" },
  csv: { label: "CSV", color: "#0f7b6c" },
  ppt: { label: "PPT", color: "#b7472a" },
  pptx: { label: "PPT", color: "#b7472a" },
  txt: { label: "TXT", color: "#6b7280" },
  md: { label: "MD", color: "#4b5563" },
  bib: { label: "BIB", color: "#8a6d1f" },
  png: { label: "IMG", color: "#7e57c2" },
  jpg: { label: "IMG", color: "#7e57c2" },
  jpeg: { label: "IMG", color: "#7e57c2" },
  svg: { label: "IMG", color: "#7e57c2" },
  webp: { label: "IMG", color: "#7e57c2" },
};

/** The icon for a file name, by extension (unknown extensions: grey, up to 4 letters). */
export function fileType(name: string): FileType {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  return TYPES[ext] ?? { label: ext ? ext.slice(0, 4).toUpperCase() : "FILE", color: "#9ca3af" };
}
