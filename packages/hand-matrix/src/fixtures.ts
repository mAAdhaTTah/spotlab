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
