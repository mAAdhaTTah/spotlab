import { expect, mocked } from "storybook/test";
import { COMBOS } from "@spotlab/range";
import type { EditorCell } from "./editor/cells";
import { seedCells, withCell } from "./editor/cells";
import type { EditorActionSpec } from "./editor/weights";

export const mockOopFlopRange = "AA,KK:1,AKs,AKo:0.5,QQ:0.25";

export const mockEditorActions: EditorActionSpec[] = [
  { id: "fold", label: "Fold", color: "#cbd5e1" },
  { id: "call", label: "Call", color: "#10b981" },
];

export const mockEditorOrder = [1, 0];

export const mockCappedCombo = "AKs";

const mockCallWeights = new Map(COMBOS.map((combo) => [combo, 0.4]));
const mockSeededCells = seedCells(null, [null, mockCallWeights], 0);

export const mockEditorCells: EditorCell[] = withCell(
  mockSeededCells,
  mockCappedCombo,
  { ...mockSeededCells[COMBOS.indexOf(mockCappedCombo)], avail: 0.5 },
);

export const mockDeadCombo = "72o";

/**
 * A grid for trying the editor by hand: call weights spread across 0–100% in
 * 5% steps so neighboring cells differ, plus the capped `mockCappedCombo` and
 * a dead `mockDeadCombo`. Weights are `[fold, call]`, matching
 * `mockEditorActions`, with fold as the remainder.
 */
export const mockVariedEditorCells: EditorCell[] = COMBOS.map((combo, i) => {
  if (combo === mockDeadCombo) return { avail: 0, weights: [100, 0] };
  const row = Math.floor(i / 13);
  const col = i % 13;
  const call = ((row * 5 + col * 3) % 21) * 5;
  return {
    avail: combo === mockCappedCombo ? 0.5 : 1,
    weights: [100 - call, call],
  };
});

/** `combo`'s weights in `cells`. */
export const weightsOf = (cells: EditorCell[], combo: string) =>
  cells[COMBOS.indexOf(combo)].weights;

/** Every combo at `fallback`, except the combos in `overrides`. */
export const cellsWith = (
  fallback: EditorCell,
  overrides: Record<string, EditorCell>,
): EditorCell[] => COMBOS.map((combo) => overrides[combo] ?? fallback);

/**
 * Band colors as Chromium computes them (`rgb()`), so the editor's rendered
 * gradients can be compared against them exactly.
 */
export const mockBandColors = {
  red: "rgb(255, 0, 0)",
  blue: "rgb(0, 0, 255)",
  clear: "rgba(0, 0, 0, 0)",
} as const;

export const mockBandActions: EditorActionSpec[] = [
  { id: "in", label: "In", color: mockBandColors.red },
  { id: "out", label: "Out", color: mockBandColors.blue },
];

/**
 * A cell band gradient as Chromium computes it, which expands a two-position
 * stop (`transparent 50% 100%`) into two stops.
 */
export const gradient = (...stops: string[]) =>
  `linear-gradient(to right, ${stops.join(", ")})`;

/** The brush and stroke the painting stories drag across the editor. */
export const mockPaintBrush = [0, 100];
export const mockStroke = ["AA", mockCappedCombo, "AQs", "KQs"];

/**
 * Assert a drag through `mockStroke` painted each of its cells with
 * `mockPaintBrush` in one change per cell, each building on the previous paint
 * even though the controlled `cells` prop never updates, and left the rest
 * untouched.
 */
export const expectStrokePainted = (onCellsChange: unknown) => {
  const calls = mocked(onCellsChange as (cells: EditorCell[]) => void).mock
    .calls;
  expect(calls).toHaveLength(mockStroke.length);
  const painted = calls.at(-1)![0];
  for (const combo of mockStroke)
    expect(weightsOf(painted, combo)).toEqual(mockPaintBrush);
  expect(weightsOf(painted, "AJs")).toEqual(weightsOf(mockEditorCells, "AJs"));
};

/** The rendered `.spotlab-hm-root` under a story's canvas. */
export const rootOf = (canvasElement: HTMLElement): HTMLElement => {
  const root = canvasElement.querySelector<HTMLElement>(".spotlab-hm-root");
  if (!root) throw new Error("expected a .spotlab-hm-root");
  return root;
};

/** The rendered `.spotlab-hm-cell` for `combo` under `root`. */
export const cellFor = (root: HTMLElement, combo: string): HTMLElement => {
  const cell = root.querySelector<HTMLElement>(
    `.spotlab-hm-cell[data-combo="${combo}"]`,
  );
  if (!cell) throw new Error(`expected a .spotlab-hm-cell for ${combo}`);
  return cell;
};

/**
 * `combo`'s computed `background-image`. An uncapped cell's is its band
 * gradient alone; a capped cell's has the cap border and hatching first and
 * the band gradient last.
 */
export const backgroundImageOf = (root: HTMLElement, combo: string) =>
  getComputedStyle(cellFor(root, combo)).backgroundImage;

/** The label element inside `combo`'s cell — the innermost element a pointer lands on. */
export const labelFor = (root: HTMLElement, combo: string): HTMLElement => {
  const label = cellFor(root, combo).querySelector<HTMLElement>(
    ".spotlab-hm-cell-inner > [data-combo]",
  );
  if (!label) throw new Error(`expected a label element for ${combo}`);
  return label;
};

const centerOf = (el: HTMLElement) => {
  const rect = el.getBoundingClientRect();
  return {
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  };
};

/**
 * Dispatch a synthetic pointer event of `type` on `target`, positioned at the
 * center of `at`.
 */
export const firePointer = (
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  target: HTMLElement,
  at: HTMLElement,
  pointerType: "mouse" | "touch",
) =>
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: pointerType === "touch" ? 2 : 1,
      pointerType,
      isPrimary: true,
      button: type === "pointermove" ? -1 : 0,
      buttons: type === "pointerdown" || type === "pointermove" ? 1 : 0,
      ...centerOf(at),
    }),
  );

/**
 * Drive a pointer drag through `combos` (the first is where it goes down) and
 * release it. With `pointerType: "touch"`, every event targets the starting
 * cell's label, as an implicitly captured touch does, so only hit-testing at
 * each event's coordinates can resolve the other cells. With `"mouse"`, each
 * move targets the label actually under the pointer.
 */
export const dragAcross = (
  root: HTMLElement,
  combos: string[],
  pointerType: "mouse" | "touch",
) => {
  const [first, ...rest] = combos;
  const start = labelFor(root, first);
  firePointer("pointerdown", start, start, pointerType);
  let last = start;
  for (const combo of rest) {
    const label = labelFor(root, combo);
    firePointer(
      "pointermove",
      pointerType === "touch" ? start : label,
      label,
      pointerType,
    );
    last = label;
  }
  firePointer(
    "pointerup",
    pointerType === "touch" ? start : last,
    last,
    pointerType,
  );
};
