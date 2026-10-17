import { type FC } from "react";
import { HandMatrix, type MatrixDisplayProps } from "./hand-matrix";

export type RangeMatrixProps = MatrixDisplayProps;

/**
 * A read-only 13x13 grid of several actions at once: each cell stacks its
 * actions' weights as colored bands in `order`, hatches dead cells (`avail`
 * 0), and marks capped cells (`avail` below 1) with a cap line and hatched
 * remainder. Draws exactly what `RangeMatrixEditor` does, without painting.
 */
export const RangeMatrix: FC<RangeMatrixProps> = HandMatrix;
