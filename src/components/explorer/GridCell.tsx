import { memo } from "react";
import type { TreeNode, VisibleNode } from "../../lib/TreeModels";
import { thumbnailUrl } from "../../data/dataset";
import { GRID_ITEM_HEIGHT, GRID_ITEM_WIDTH } from "./layout";
import { GLOW_SHADOW, selectionStyle } from "./selectionStyle";
import type { MarkerKind } from "../../data/tasks";
import { Marker } from "./Marker";
import { FileTypeIcon } from "./FileTypeIcon";

interface Props {
  vNode: VisibleNode;
  selected: boolean;
  active: boolean;
  cursor: boolean;
  /** Folder has selected descendants (blue dot badge). */
  containsSelected: boolean;
  /** Task marker flag, if any. */
  marker?: MarkerKind;
  onDoubleClick: (node: TreeNode) => void;
}

export const GridCell = memo(function GridCell({ vNode, selected, active, cursor, containsSelected, marker, onDoubleClick }: Props) {
  const style = selectionStyle("grid", { selected, active, cursor });
  const isFolder = !!vNode.node.children;

  return (
    <div
      onDoubleClick={() => onDoubleClick(vNode.node)}
      style={{
        width: GRID_ITEM_WIDTH,
        height: GRID_ITEM_HEIGHT,
        padding: "4px",
        boxSizing: "border-box",
        cursor: "pointer",
        flexShrink: 0, // keep cells from being squeezed horizontally
      }}
    >
      <div
        style={{
          height: "100%",
          border: style.border,
          borderRadius: "6px",
          backgroundColor: style.background,
          boxSizing: "border-box",
          boxShadow: style.glow ? GLOW_SHADOW : "none",
          transition: "all 0.1s ease",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          ...(marker ? { position: "relative" as const } : {}),
        }}
      >
        {marker && <Marker kind={marker} style={{ position: "absolute", top: "4px", right: "4px" }} />}
        {vNode.node.thumbnail ? (
          <img
            src={thumbnailUrl(vNode.node.thumbnail)}
            alt=""
            draggable={false}
            decoding="async"
            style={{
              width: "88px",
              height: "60px",
              objectFit: "cover",
              borderRadius: "4px",
              // Let the viewport handle the press (no native image drag / selection).
              pointerEvents: "none",
            }}
          />
        ) : !isFolder ? (
          <FileTypeIcon name={vNode.node.name} size="large" />
        ) : (
          <div style={{ fontSize: "24px", position: "relative" }}>
            📁
            {containsSelected && (
              <div
                style={{
                  position: "absolute",
                  bottom: -2,
                  right: -4,
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "#2684FF",
                  border: "1px solid white",
                }}
              />
            )}
          </div>
        )}
        <div
          style={{
            fontSize: "10px",
            marginTop: "4px",
            textAlign: "center",
            width: "90%",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {vNode.node.name}
        </div>
      </div>
    </div>
  );
});
