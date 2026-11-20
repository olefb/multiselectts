// File: lib/LogicalGridGeometry.ts

import type { PathCache, SelectionGeometry, StrategyName } from "./multiselect";
import {
  type SelectionStrategy,
  RectangularStrategy,
  RowWiseStrategy,
  SnakeStrategy,
} from "./SelectionStrategies";

export interface GridConfig {
  itemWidth: number;
  itemHeight: number;
  containerWidth: number;
  totalItems: number;
  /** Rows moved by PageUp/PageDown (default 3). */
  pageRows?: number;
}

export type Point = { x: number; y: number };

const distance = (p1: Point, p2: Point) =>
  Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);

const getAngle = (a: Point, b: Point, c: Point) => {
  const v1 = { x: b.x - a.x, y: b.y - a.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };

  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

  if (mag1 === 0 || mag2 === 0) return Math.PI;
  return Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2))));
};

export type GridItem = { id: string };

export class LogicalGridGeometry implements SelectionGeometry<string, Point> {
  public readonly kind = "grid";
  private config: GridConfig;
  private items: GridItem[];
  private allNodesFlat: GridItem[]; // Global pool for predicate search
  private mode: StrategyName;
  private indexById: Map<string, number>;

  constructor(
    config: GridConfig,
    items: GridItem[],
    allNodesFlat: GridItem[],
    initialMode: StrategyName = "mixed",
  ) {
    this.config = config;
    this.items = items;
    this.allNodesFlat = allNodesFlat;
    this.mode = initialMode;
    this.indexById = new Map(items.map((it, i) => [it.id, i]));
  }

  public locate(id: string): Point | null {
    const index = this.indexById.get(id);
    return index === undefined ? null : this.getCenterOfItem(index);
  }

  public visibleIndices(): Iterable<string> {
    return this.indexById.keys();
  }

  public rowOf(id: string): number | null {
    const index = this.indexById.get(id);
    return index === undefined ? null : Math.floor(index / this.getColumnCount());
  }

  /**
   * Translates 2D Point -> Mathematical Index -> Stable String ID
   */
  public getPointMetadata(p: Point) {
    const cols = this.getColumnCount();

    const col = Math.floor(p.x / this.config.itemWidth);
    const row = Math.floor(p.y / this.config.itemHeight);
    const indexCandidate = row * cols + col;

    let finalIndex: number | null = indexCandidate;
    let finalId: string | null = null;

    if (col < 0 || col >= cols || p.x < 0) finalIndex = null;
    if (indexCandidate < 0 || indexCandidate >= this.config.totalItems)
      finalIndex = null;

    const padding = 8;
    const localX = p.x % this.config.itemWidth;
    const localY = p.y % this.config.itemHeight;

    if (
      localX < padding ||
      localX > this.config.itemWidth - padding ||
      localY < padding ||
      localY > this.config.itemHeight - padding
    ) {
      finalIndex = null;
    }

    // Map mathematical index to the Stable Algebraic ID
    if (finalIndex !== null && finalIndex < this.items.length) {
      finalId = this.items[finalIndex].id;
    }

    return { col, row, index: finalIndex, id: finalId };
  }

  private getColumnCount(): number {
    return Math.max(1, Math.floor(this.config.containerWidth / this.config.itemWidth));
  }

  // Engine uses this to translate a click point to an Identity
  public m2v(p: Point): string | null {
    return this.getPointMetadata(p).id;
  }

  public extendPath(path: Point[], newPoint: Point, cache?: PathCache): Point[] | null {
    if (this.mode !== "snake") {
      if (path.length === 0)
        return this.m2v(newPoint) !== null ? [newPoint] : null;
      return [path[0], newPoint];
    }

    if (!cache) return [...path, newPoint];

    // --- SNAKE LOGIC ---
    const lastPoint = path[path.length - 1];
    const distMove = lastPoint ? distance(newPoint, lastPoint) : 999;

    if (!cache.removing && distMove < 8) return null;

    if (path.length < 2) {
      cache.removing = false;
      return [...path, newPoint];
    }

    const last = path[path.length - 1];
    const prev = path[path.length - 2];
    const turnAngle = getAngle(prev, last, newPoint);

    if (cache.removing) {
      if (turnAngle > 1.8) {
        const newPath = [...path];
        while (newPath.length >= 2 && distance(newPoint, newPath[newPath.length - 1]) < 25) {
          newPath.pop();
        }
        cache.k = 0;
        return newPath;
      } else if (distMove > 15) {
        cache.removing = false;
        return [...path, newPoint];
      }
      return path;
    }

    if (turnAngle > 2.2) {
      cache.removing = true;
      return path;
    }

    return [...path, newPoint];
  }

  public selectionDomain(
    path: Point[],
    J?: Set<string>,
    cache: PathCache = {},
    strategyOverride?: StrategyName,
  ): Set<string> {
    if (path.length === 0) return new Set();

    if (strategyOverride === "rowwise") {
      return RowWiseStrategy(
        path,
        this.getPointMetadata.bind(this),
        this.getColumnCount.bind(this),
        this.config.totalItems,
        this.config.itemWidth,
        this.config.itemHeight,
        8,
        (index) => this.items[index]?.id ?? null, // Inject ID Resolver
        J,
        cache,
      );
    }

    let activeStrategy: SelectionStrategy;
    if (this.mode === "snake") {
      activeStrategy = SnakeStrategy;
    } else if (this.mode === "mixed") {
      const anchorMeta = this.getPointMetadata(path[0]);
      activeStrategy = anchorMeta.index !== null ? RowWiseStrategy : RectangularStrategy;
    } else {
      activeStrategy = this.mode === "rowwise" ? RowWiseStrategy : RectangularStrategy;
    }

    if (this.mode === "mixed") {
      cache.activeStrategyName = this.getPointMetadata(path[0]).index !== null ? "rowwise" : "rectangular";
    } else cache.activeStrategyName = this.mode;

    return activeStrategy(
      path,
      this.getPointMetadata.bind(this),
      this.getColumnCount.bind(this),
      this.config.totalItems,
      this.config.itemWidth,
      this.config.itemHeight,
      8,
      (index) => this.items[index]?.id ?? null, // Inject ID Resolver
      J,
      cache,
    );
  }

  public step(direction: string, currentCursor: Point): Point {
    const cols = this.getColumnCount();
    const meta = this.getPointMetadata(currentCursor);

    let currentIndex = meta.index;
    if (currentIndex === null) {
      currentIndex =
        Math.floor(currentCursor.y / this.config.itemHeight) * cols +
        Math.floor(currentCursor.x / this.config.itemWidth);
    }

    let nextIndex = currentIndex;
    switch (direction.toUpperCase()) {
      case "UP": nextIndex -= cols; break;
      case "DOWN": nextIndex += cols; break;
      case "LEFT": nextIndex -= 1; break;
      case "RIGHT": nextIndex += 1; break;
      case "HOME": nextIndex = 0; break;
      case "END": nextIndex = this.config.totalItems - 1; break;
      case "PAGEUP": nextIndex -= cols * (this.config.pageRows ?? 3); break;
      case "PAGEDOWN": nextIndex += cols * (this.config.pageRows ?? 3); break;
    }

    nextIndex = Math.max(0, Math.min(this.config.totalItems - 1, nextIndex));
    return this.getCenterOfItem(nextIndex);
  }

  /** Keyboard cursor when there is none: the last item for Up and End, else the first; none in an empty grid. */
  public defaultCursor(direction: string): Point | undefined {
    if (this.config.totalItems === 0) return undefined;
    const toLast = ["UP", "END"].includes(direction.toUpperCase());
    return this.getCenterOfItem(toLast ? this.config.totalItems - 1 : 0);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public filter(predicate: (item: any) => boolean, candidates?: Set<string>): Set<string> {
    const result = new Set<string>();
    
    const source = candidates 
      ? this.allNodesFlat.filter(n => candidates.has(n.id))
      : this.allNodesFlat;

    for (const node of source) {
      if (predicate(node)) {
        result.add(node.id);
      }
    }
    return result;
  }


  private getCenterOfItem(index: number): Point {
    const cols = this.getColumnCount();
    const row = Math.floor(index / cols);
    const col = index % cols;
    return {
      x: col * this.config.itemWidth + this.config.itemWidth / 2,
      y: row * this.config.itemHeight + this.config.itemHeight / 2,
    };
  }
}