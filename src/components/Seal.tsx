import { STAR_PATH_D } from './ChicagoStar';

interface Props {
  size?: number;
  className?: string;
}

/**
 * A round "CITY OF CHICAGO · DEPT OF STREETS" seal: four small stars in a row,
 * framed by curved mono text and concentric strokes. Reads as an official stamp.
 */
export const Seal = ({ size = 56, className }: Props) => {
  const id = `seal-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="presentation"
      aria-hidden
    >
      <defs>
        {/* Curved baselines */}
        <path id={`${id}-top`} d="M 50,50 m -38,0 a 38,38 0 0,1 76,0" fill="none" />
        <path id={`${id}-bot`} d="M 50,50 m -38,0 a 38,38 0 0,0 76,0" fill="none" />
      </defs>

      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="0.5" />

      <text
        fontFamily="'IBM Plex Mono', monospace"
        fontSize="7"
        letterSpacing="2"
        fill="currentColor"
        textAnchor="middle"
      >
        <textPath href={`#${id}-top`} startOffset="50%">CITY · OF · CHICAGO</textPath>
      </text>
      <text
        fontFamily="'IBM Plex Mono', monospace"
        fontSize="7"
        letterSpacing="2"
        fill="currentColor"
        textAnchor="middle"
      >
        <textPath href={`#${id}-bot`} startOffset="50%">DEPT · OF · STREETS</textPath>
      </text>

      {/* Four stars in a row, each ~3.5 viewBox units wide */}
      {[36, 45, 54, 63].map((x) => (
        <g key={x} transform={`translate(${x} 50) scale(3.5)`} fill="currentColor">
          <path d={STAR_PATH_D} />
        </g>
      ))}
    </svg>
  );
};
