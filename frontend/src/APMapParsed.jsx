import React, { useMemo, useState } from 'react';
import wifiSvgUrl from './assets/wifiSymbol.svg';

const VIEWBOX = { w: 1355, h: 1016 };
const COLORS = { low: '#2DD4BF', medium: '#F59E0B', high: '#EF4444' };
const getFill = (n) => (n >= 20 ? COLORS.high : n >= 10 ? COLORS.medium : COLORS.low);

export default function APMapParsed({ floorId, apCount = [], floorMapUrl }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const aps = useMemo(() => {
    return apCount.map((ap, i) => ({
      idx: i,
      id: ap.apId?.toString() ?? `${i}`,
      name: ap.title || `AP ${ap.apId ?? i + 1}`,
      cx: Number(ap.cx),
      cy: Number(ap.cy),
      deviceCount: Number(ap.deviceCount) || 0,
    }));
  }, [apCount]);

  const R = 14.5;

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
      className="ft-map-svg"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Base floorplan from DB */}
      {floorMapUrl && (
        <image
          href={floorMapUrl}
          x="0" y="0"
          width={VIEWBOX.w}
          height={VIEWBOX.h}
          opacity="0.95"
          preserveAspectRatio="xMidYMid meet"
        />
      )}

      {/* AP overlay */}
      <g className="ap-overlay">
        {aps.map((ap) => {
          const clients = ap.deviceCount;
          const fill = getFill(clients);
          const tier = clients >= 20 ? 3 : clients >= 10 ? 2 : 1;

          const iconSize = R * 1.5;
          const half = iconSize / 2;

          return (
            <g key={ap.id} transform={`translate(${ap.cx}, ${ap.cy})`}>
              {tier >= 1 && <circle r={R + 8}  fill={fill} opacity={0.18} />}
              {tier >= 1 && <circle r={R + 18} fill={fill} opacity={0.16} />}
              {tier >= 2 && <circle r={R + 28} fill={fill} opacity={0.14} />}
              {tier >= 2 && <circle r={R + 38} fill={fill} opacity={0.12} />}
              {tier >= 3 && <circle r={R + 48} fill={fill} opacity={0.10} />}
              {tier >= 3 && <circle r={R + 58} fill={fill} opacity={0.08} />}

              <circle
                r={R}
                fill={fill}
                opacity={0.98}
                onMouseEnter={() => setHoveredIdx(ap.idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                <title>{`${ap.name} • ${clients} devices`}</title>
              </circle>

              {hoveredIdx === ap.idx && (
                <g transform="translate(0, -40)">
                  <rect
                    x="-80" y="-24" width="160" height="24" rx="6"
                    fill="rgba(15, 20, 28, 0.95)" stroke="#1F2937" strokeWidth="1.5"
                  />
                  <text
                    x="0" y="-8" textAnchor="middle"
                    fill="#E6EDF3" fontSize="12" fontWeight="600"
                  >
                    {ap.name} • {clients}
                  </text>
                </g>
              )}

              <image
                href={wifiSvgUrl}
                x={-half} y={-half}
                width={iconSize} height={iconSize}
                style={{ pointerEvents: 'none' }}
                opacity="0.95"
                preserveAspectRatio="xMidYMid meet"
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
