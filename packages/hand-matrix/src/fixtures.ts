import { COMBOS } from "@spotlab/range";
import type { EditorCell } from "./editor/cells";
import { seedCells } from "./editor/cells";
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
const mockCappedIndex = COMBOS.indexOf(mockCappedCombo);

export const mockEditorCells: EditorCell[] = mockSeededCells.map((cell, i) =>
  i === mockCappedIndex ? { ...cell, avail: 0.5 } : cell,
);

/** The rendered `.spotlab-hm-cell` for `combo` under `root`. */
export const cellFor = (root: HTMLElement, combo: string): HTMLElement => {
  const cell = root.querySelector<HTMLElement>(
    `.spotlab-hm-cell[data-combo="${combo}"]`,
  );
  if (!cell) throw new Error(`expected a .spotlab-hm-cell for ${combo}`);
  return cell;
};

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
