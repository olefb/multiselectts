import { fileType } from "./fileTypes";

/** Coloured file-type label (list and grid); sizes match the slots of the old 📄 icon. */
export function FileTypeIcon({ name, size }: { name: string; size: "small" | "large" }) {
  const { label, color } = fileType(name);
  const small = size === "small";
  return (
    <div
      aria-hidden
      data-filetype={label}
      style={{
        width: small ? "24px" : "40px",
        height: small ? "16px" : "30px",
        borderRadius: small ? "3px" : "4px",
        background: color,
        color: "#fff",
        fontSize: small ? "8.5px" : "12px",
        fontWeight: 700,
        letterSpacing: "0.02em",
        lineHeight: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        pointerEvents: "none", // the viewport handles presses
        userSelect: "none",
      }}
    >
      {label}
    </div>
  );
}
