import {
  useCallback,
  useEffect,
  useRef,
  type ChangeEvent,
  type ComponentType,
  type FC,
  type ReactNode,
} from "react";
import { rebalance, type EditorActionSpec } from "./weights";

export type WeightInputProps = {
  value: number;
  "aria-label": string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

const DefaultWeightInput: FC<WeightInputProps> = (props) => (
  <input type="number" className="spotlab-hm-weight-input" {...props} />
);

const Slider: FC<{
  value: number;
  color: string;
  passive: boolean;
  onChange: (value: number) => void;
}> = ({ value, color, passive, onChange }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const setFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      onChange(((clientX - rect.left) / rect.width) * 100);
    },
    [onChange],
  );

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (draggingRef.current) setFromClientX(event.clientX);
    };
    const onUp = () => (draggingRef.current = false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [setFromClientX]);

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className="spotlab-hm-slider-track"
      style={{
        background: `linear-gradient(to right, ${color} 0 ${value}%, var(--spotlab-hm-track-bg) ${value}% 100%)`,
      }}
      onPointerDown={(event) => {
        draggingRef.current = true;
        setFromClientX(event.clientX);
      }}
    >
      <div
        className="spotlab-hm-slider-thumb"
        style={{
          left: `${value}%`,
          border: `2px solid ${passive ? "var(--spotlab-hm-muted-fg)" : color}`,
        }}
      />
    </div>
  );
};

const defaultActionLabel = (action: EditorActionSpec, isPassive: boolean) => (
  <span className="spotlab-hm-slider-label">
    {action.label}
    {isPassive && (
      <span className="spotlab-hm-slider-remainder"> · remainder</span>
    )}
  </span>
);

export type ActionWeightSlidersProps = {
  actions: EditorActionSpec[];
  /** Indices into `actions`/`weights`, in the order rows should render. */
  order: number[];
  /** Index-aligned with `actions`. */
  weights: number[];
  passive: number;
  onWeightsChange: (weights: number[]) => void;
  /**
   * Leading content for a row's header, replacing the default label — the
   * slot for a control that takes the label's own position (e.g. a
   * raise-size input) rather than trailing it. Defaults to the action's
   * label (plus a "· remainder" suffix on the passive row).
   */
  renderActionLabel?: (
    action: EditorActionSpec,
    index: number,
    isPassive: boolean,
  ) => ReactNode;
  /** Extra content rendered after an action's label — the slot for consumer-specific controls (a remove button). */
  renderActionExtra?: (action: EditorActionSpec, index: number) => ReactNode;
  components?: { WeightInput?: ComponentType<WeightInputProps> };
  className?: string;
};

/**
 * One pointer-driven weight slider per action, each paired with a numeric
 * input for keyboard entry. Adjusting one action rebalances the others
 * proportionally so the row's weights keep summing to 100.
 */
export const ActionWeightSliders: FC<ActionWeightSlidersProps> = ({
  actions,
  order,
  weights,
  passive,
  onWeightsChange,
  renderActionLabel,
  renderActionExtra,
  components,
  className,
}) => {
  const WeightInput = components?.WeightInput ?? DefaultWeightInput;

  const setWeight = (index: number, value: number) => {
    onWeightsChange(rebalance(weights, index, value, passive));
  };

  return (
    <div
      className={["spotlab-hm-root spotlab-hm-sliders", className]
        .filter(Boolean)
        .join(" ")}
    >
      {order.map((index) => {
        const action = actions[index];
        const isPassive = index === passive;
        return (
          <div
            key={action.id}
            className="spotlab-hm-slider-row"
            data-passive={isPassive}
          >
            <div className="spotlab-hm-slider-header">
              <span
                className="spotlab-hm-slider-swatch"
                style={{ background: action.color }}
              />
              {renderActionLabel?.(action, index, isPassive) ??
                defaultActionLabel(action, isPassive)}
              {renderActionExtra?.(action, index)}
            </div>
            <div className="spotlab-hm-slider-track-row">
              <Slider
                value={weights[index]}
                color={action.color}
                passive={isPassive}
                onChange={(value) => setWeight(index, value)}
              />
              <WeightInput
                value={weights[index]}
                aria-label={`${action.label} weight`}
                onChange={(event) =>
                  setWeight(index, parseInt(event.target.value || "0", 10))
                }
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
