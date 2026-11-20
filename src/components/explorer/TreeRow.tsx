import { memo } from "react";
import type { VisibleNode } from "../../lib/TreeModels";
import { thumbnailUrl } from "../../data/dataset";
import { TREE_CONFIG } from "./layout";
import { selectionStyle } from "./selectionStyle";
import type { MarkerKind } from "../../data/tasks";
import { Marker } from "./Marker";
import { FileTypeIcon } from "./FileTypeIcon";

interface Props {
  vNode: VisibleNode;
  /** Virtual offset (px) of this row. */
  top: number;
  selected: boolean;
  active: boolean;
  cursor: boolean;
  expanded: boolean;
  /** Folder has selected descendants (ancestor badge). */
  containsSelected: boolean;
  /** Task marker flag, if any. */
  marker?: MarkerKind;
}

export const TreeRow = memo(function TreeRow({ vNode, top, selected, active, cursor, expanded, containsSelected, marker }: Props) {
  const style = selectionStyle("tree", { selected, active, cursor });
  const hasChildren = !!vNode.node.children;
  const badge = containsSelected && hasChildren;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: TREE_CONFIG.itemHeight,
        transform: `translateY(${top}px)`,
        display: "flex",
        alignItems: "center",
        backgroundColor: style.background,
        border: style.border,
        boxSizing: "border-box",
        paddingLeft: vNode.depth * TREE_CONFIG.indentWidth,
      }}
    >
      <div
        style={{
          width: TREE_CONFIG.chevronWidth,
          display: "flex",
          justifyContent: "center",
          cursor: hasChildren ? "pointer" : "default",
          color: badge ? "#2684FF" : "#555",
          fontWeight: badge ? "bold" : "normal",
        }}
      >
        {hasChildren ? (
          expanded ? "▼" : "▶"
        ) : vNode.node.thumbnail ? (
          <img
            src={thumbnailUrl(vNode.node.thumbnail)}
            alt=""
            draggable={false}
            decoding="async"
            style={{ width: "24px", height: "18px", objectFit: "cover", borderRadius: "2px", pointerEvents: "none" }}
          />
        ) : (
          <FileTypeIcon name={vNode.node.name} size="small" />
        )}
      </div>
      <div
        style={{
          marginLeft: "8px",
          fontSize: "14px",
          color: badge ? "#2684FF" : "inherit",
        }}
      >
        {vNode.node.name}
      </div>
      {marker && <Marker kind={marker} style={{ marginLeft: "8px" }} />}
    </div>
  );
});
