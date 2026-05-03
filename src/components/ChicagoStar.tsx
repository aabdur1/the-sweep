interface Props {
  size?: number;
  className?: string;
  title?: string;
  /** When true, renders as a stroke outline rather than a filled fill. */
  outlined?: boolean;
}

/**
 * Chicago flag's six-pointed star.
 * 12 vertices: 6 outer points at radius 1.0, 6 inner notches at radius ~0.38.
 * Outer points start at the top (-90°) and step every 60°.
 * Inner notches sit between, offset by 30°.
 */
const buildPath = (): string => {
  const outer = 1;
  const inner = 0.38;
  const points: Array<[number, number]> = [];
  for (let i = 0; i < 12; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (-90 + i * 30) * (Math.PI / 180);
    points.push([Math.cos(angle) * r, Math.sin(angle) * r]);
  }
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(4)},${y.toFixed(4)}`).join(' ') + ' Z';
};

/** Path string for a star centered at (0,0) with outer radius 1. Reusable in other SVGs. */
export const STAR_PATH_D = buildPath();

export const ChicagoStar = ({ size = 20, className, title, outlined = false }: Props) => (
  <svg
    width={size}
    height={size}
    viewBox="-1.1 -1.1 2.2 2.2"
    className={className}
    fill={outlined ? 'none' : 'currentColor'}
    stroke={outlined ? 'currentColor' : undefined}
    strokeWidth={outlined ? 0.24 : undefined}
    strokeLinejoin={outlined ? 'miter' : undefined}
    role={title ? 'img' : 'presentation'}
    aria-label={title}
  >
    <path d={STAR_PATH_D} />
  </svg>
);
