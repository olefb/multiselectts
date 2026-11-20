import { Fragment } from "react";
import type { TreeNode } from "../../lib/TreeModels";
import type { ExplorerText } from "./text";

interface Props {
  currentFolderId: string | null;
  /** Folders from the root down to the current folder. */
  trail: TreeNode[];
  /** Navigate to a folder (null = root), via the Up button or a crumb. */
  onNavigate: (folderId: string | null, via: "up" | "breadcrumb") => void;
  text: ExplorerText;
}

/** Grid-view folder path with an "Up" button. */
export function Breadcrumbs({ currentFolderId, trail, onNavigate, text }: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px",
        backgroundColor: "#f5f5f5",
        border: "1px solid #ccc",
        borderBottom: "none",
        fontSize: "13px",
        borderRadius: "4px 4px 0 0",
      }}
    >
      <button
        disabled={currentFolderId === null}
        onClick={() => onNavigate(trail.length > 1 ? trail[trail.length - 2].id : null, "up")}
        style={{ padding: "2px 6px", cursor: "pointer" }}
      >
        {text.up}
      </button>
      <span
        onClick={() => onNavigate(null, "breadcrumb")}
        style={{
          cursor: "pointer",
          color: currentFolderId === null ? "#000" : "#0078d7",
          fontWeight: currentFolderId === null ? "bold" : "normal",
        }}
      >
        {text.root}
      </span>
      {trail.map((folder, i) => {
        const isLast = i === trail.length - 1;
        return (
          <Fragment key={folder.id}>
            <span>&gt;</span>
            <span
              onClick={() => {
                if (!isLast) onNavigate(folder.id, "breadcrumb");
              }}
              style={{
                cursor: isLast ? "default" : "pointer",
                color: isLast ? "#000" : "#0078d7",
                fontWeight: isLast ? "bold" : "normal",
              }}
            >
              {folder.name}
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}
