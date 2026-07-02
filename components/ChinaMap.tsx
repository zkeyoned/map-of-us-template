"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Minus, Plus, RotateCcw } from "lucide-react";
import {
  chinaFeatures,
  dashLineFeature,
  makePath,
  makeProjection,
  makeProjectionForFeature,
  provinceIdOf,
} from "@/lib/geo";
import {
  getLitCityIds,
  getLitProvinceIds,
  memoryStoreUpdatedEvent,
  type LocalMemoryStore,
} from "@/data/progress";
import { provinces } from "@/data/provinces";

interface ChinaMapProps {
  width?: number;
  height?: number;
  className?: string;
}

const colors = {
  cream: "#FAFBF7",
  dim: "#D8DDD8",
  ink: "#5A6670",
  sakura: "#F5DCE0",
  bloom: "#E8B8C2",
  sky: "#A8C8DC",
};

const provinceById = new Map(provinces.map((province) => [province.id, province]));
const easyTapProvinceIds = new Set(["hongkong", "macau"]);
const maxZoom = 1.45;
const minZoom = 1;
const stableCoordinate = (value: number) => Number(value.toFixed(3));
type Pan = {
  x: number;
  y: number;
};
type DragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPan: Pan;
};

// The South China Sea ten-dash line, drawn as a small standalone inset box so it
// is always visible and never overlapped by floating cards on the main map.
export function SouthChinaSeaInset() {
  const inset = useMemo(() => {
    if (!dashLineFeature) return null;

    const insetWidth = 116;
    const insetHeight = 162;
    const projection = makeProjectionForFeature(dashLineFeature, insetWidth, insetHeight, 12);
    const path = makePath(projection);

    return { width: insetWidth, height: insetHeight, d: path(dashLineFeature as never) ?? "" };
  }, []);

  if (!inset || !inset.d) return null;

  return (
    <div className="w-fit rounded-[8px] border border-[#D8DDD8]/80 bg-[#FAFBF7]/70 p-1 shadow-[0_10px_28px_rgba(90,102,112,0.08)] backdrop-blur">
      <svg
        width={inset.width}
        height={inset.height}
        viewBox={`0 0 ${inset.width} ${inset.height}`}
        role="img"
        aria-label="南海诸岛"
      >
        <path
          d={inset.d}
          fill={colors.ink}
          fillOpacity="0.55"
          stroke={colors.ink}
          strokeOpacity="0.5"
          strokeWidth="0.8"
        />
        <text
          x={inset.width / 2}
          y={inset.height - 5}
          textAnchor="middle"
          fontSize="9"
          fontWeight="600"
          fill={colors.ink}
          fillOpacity="0.6"
        >
          南海诸岛
        </text>
      </svg>
    </div>
  );
}

export default function ChinaMap({ width = 1100, height = 860, className }: ChinaMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [localMemories, setLocalMemories] = useState<LocalMemoryStore>({});
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const dragStateRef = useRef<DragState | null>(null);
  const dragMovedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const handleMemoryUpdate = (event: Event) => {
      const detail = (event as CustomEvent<LocalMemoryStore>).detail;
      if (detail) setLocalMemories(detail);
    };

    async function loadLocalMemories() {
      const response = await fetch("/api/memories", { cache: "no-store" }).catch(() => null);
      if (!response?.ok) return;

      const data = (await response.json().catch(() => null)) as
        | { memories?: LocalMemoryStore }
        | null;

      if (!cancelled && data?.memories) setLocalMemories(data.memories);
    }

    window.addEventListener(memoryStoreUpdatedEvent, handleMemoryUpdate);
    loadLocalMemories();

    return () => {
      cancelled = true;
      window.removeEventListener(memoryStoreUpdatedEvent, handleMemoryUpdate);
    };
  }, []);

  const litProvinceIds = useMemo(
    () => getLitProvinceIds(getLitCityIds(localMemories)),
    [localMemories],
  );

  const paths = useMemo(() => {
    const projection = makeProjection(width, height, 24);
    const path = makePath(projection);

    return chinaFeatures.map((feature) => {
      const id = provinceIdOf(feature);
      const [cx, cy] = path.centroid(feature as never);

      return {
        id,
        d: path(feature as never) ?? "",
        x: stableCoordinate(cx),
        y: stableCoordinate(cy),
        province: provinceById.get(id),
        lit: litProvinceIds.has(id),
      };
    });
  }, [height, litProvinceIds, width]);

  const hoveredPath = paths.find((path) => path.id === hoveredId);
  const zoomProgress = ((zoom - minZoom) / (maxZoom - minZoom)) * 100;
  const setClampedZoom = (nextZoom: number) => {
    const clamped = Math.min(Math.max(nextZoom, minZoom), maxZoom);
    setZoom(clamped);
    if (clamped === minZoom) setPan({ x: 0, y: 0 });
  };

  const goProvince = (id: string) => {
    if (dragMovedRef.current || suppressClickRef.current) {
      dragMovedRef.current = false;
      suppressClickRef.current = false;
      return;
    }
    router.push(`/province/${id}`);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, input")) return;

    dragMovedRef.current = false;
    suppressClickRef.current = false;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPan: pan,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId || zoom <= minZoom) return;

    const dx = event.clientX - dragState.startClientX;
    const dy = event.clientY - dragState.startClientY;
    if (Math.abs(dx) + Math.abs(dy) > 6) {
      dragMovedRef.current = true;
      suppressClickRef.current = true;
    }

    const maxPanX = width * (zoom - 1) * 0.24;
    const maxPanY = height * (zoom - 1) * 0.24;
    setPan({
      x: Math.min(Math.max(dragState.startPan.x + dx, -maxPanX), maxPanX),
      y: Math.min(Math.max(dragState.startPan.y + dy, -maxPanY), maxPanY),
    });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null;
    }
  };

  return (
    <motion.div
      className={`relative ${className ?? ""}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      style={{ aspectRatio: `${width} / ${height}` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="absolute left-3 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-2 rounded-full border border-[#D8DDD8]/85 bg-[#FAFBF7]/82 px-2 py-3 shadow-[0_12px_28px_rgba(90,102,112,0.1)] backdrop-blur sm:left-4">
        <button
          className="grid h-9 w-9 place-items-center rounded-full text-[#5A6670] transition hover:bg-[#D6E8F0]/42 disabled:opacity-35"
          type="button"
          onClick={() => setClampedZoom(zoom + 0.15)}
          disabled={zoom >= maxZoom}
          aria-label="放大中国地图"
        >
          <Plus className="h-4 w-4" />
        </button>
        <div className="flex min-h-28 w-9 flex-col items-center justify-center gap-2">
          <input
            className="map-zoom-slider"
            type="range"
            min={minZoom}
            max={maxZoom}
            step="0.01"
            value={zoom}
            onChange={(event) => setClampedZoom(Number(event.target.value))}
            aria-label="拖动缩放中国地图"
            style={{ "--zoom-progress": `${zoomProgress}%` } as CSSProperties}
          />
          <span className="text-[10px] font-semibold leading-none text-[#5A6670]/58">
            {Math.round(zoom * 100)}%
          </span>
        </div>
        <button
          className="grid h-9 w-9 place-items-center rounded-full text-[#5A6670] transition hover:bg-[#F5DCE0]/55 disabled:opacity-35"
          type="button"
          onClick={() => setClampedZoom(zoom - 0.15)}
          disabled={zoom <= minZoom}
          aria-label="缩小中国地图"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          className="grid h-9 w-9 place-items-center rounded-full text-[#5A6670] transition hover:bg-[#D4E8D0]/48 disabled:opacity-35"
          type="button"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          disabled={zoom === 1 && pan.x === 0 && pan.y === 0}
          aria-label="重置中国地图缩放"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <motion.div
        className="map-visual-scale relative h-full w-full touch-none overflow-visible"
        animate={{ scale: zoom, x: pan.x, y: pan.y }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        style={{ transformOrigin: "55% 58%" }}
      >
        <svg
          className="h-full w-full overflow-visible drop-shadow-[0_16px_26px_rgba(168,200,220,0.18)]"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="China map with visited provinces highlighted"
        >
          <defs>
            <filter id="visitedGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feFlood floodColor={colors.bloom} floodOpacity="0.42" />
              <feComposite in2="blur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <pattern id="softPixelTexture" width="8" height="8" patternUnits="userSpaceOnUse">
              <path d="M0 0h2v2H0z" fill={colors.cream} opacity="0.26" />
              <path d="M5 5h1.5v1.5H5z" fill={colors.sky} opacity="0.08" />
            </pattern>
          </defs>

          <g shapeRendering="geometricPrecision">
            {paths.map((path) => (
              <path
                key={`${path.id}-glow`}
                d={path.d}
                fill="none"
                stroke={path.lit ? colors.bloom : "transparent"}
                strokeWidth={path.lit ? 10 : 0}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={path.lit ? 0.18 : 0}
                filter={path.lit ? "url(#visitedGlow)" : undefined}
                pointerEvents="none"
              />
            ))}

            {paths.map((path) => {
              const isHovered = hoveredId === path.id;

              return (
                <path
                  key={path.id}
                  d={path.d}
                  fill={path.lit ? colors.sakura : colors.dim}
                  fillOpacity={path.lit ? 0.68 : 0.34}
                  stroke={path.lit ? colors.bloom : colors.ink}
                  strokeOpacity={path.lit ? 0.95 : 0.24}
                  strokeWidth={path.lit ? 2.2 : 1.25}
                  strokeLinejoin="round"
                  className="cursor-pointer transition-all duration-300"
                  filter={path.lit || isHovered ? "url(#visitedGlow)" : undefined}
                  onMouseEnter={() => setHoveredId(path.id)}
                  onMouseLeave={() =>
                    setHoveredId((current) => (current === path.id ? null : current))
                  }
                  onClick={() => goProvince(path.id)}
                />
              );
            })}

            {paths
              .filter((path) => easyTapProvinceIds.has(path.id))
              .map((path) => (
                <g key={`${path.id}-easy-tap`}>
                  <circle
                    cx={path.x}
                    cy={path.y}
                    r={path.id === "macau" ? 18 : 24}
                    fill={colors.sakura}
                    fillOpacity={hoveredId === path.id ? 0.22 : 0.08}
                    stroke={colors.bloom}
                    strokeOpacity={hoveredId === path.id ? 0.5 : 0.18}
                    strokeWidth="1.5"
                    className="cursor-pointer transition-all duration-300"
                    onMouseEnter={() => setHoveredId(path.id)}
                    onMouseLeave={() =>
                      setHoveredId((current) => (current === path.id ? null : current))
                    }
                    onClick={() => goProvince(path.id)}
                  />
                  <circle
                    cx={path.x}
                    cy={path.y}
                    r="3.5"
                    fill={colors.bloom}
                    opacity="0.55"
                    pointerEvents="none"
                  />
                </g>
              ))}

            {paths.map((path) =>
              path.lit ? (
                <path
                  key={`${path.id}-inner`}
                  d={path.d}
                  fill="url(#softPixelTexture)"
                  stroke={colors.cream}
                  strokeOpacity="0.9"
                  strokeWidth="1"
                  pointerEvents="none"
                />
              ) : null,
            )}
          </g>
        </svg>

        {hoveredPath?.province && (
          <motion.div
            className="pointer-events-none absolute rounded-[8px] border border-[#D8DDD8]/80 bg-[#FAFBF7]/90 px-3 py-2 text-sm text-[#5A6670] shadow-[0_10px_30px_rgba(90,102,112,0.12)] backdrop-blur"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              left: `${(hoveredPath.x / width) * 100}%`,
              top: `${(hoveredPath.y / height) * 100}%`,
              transform: "translate(14px, -50%)",
            }}
          >
            <span className="mr-2 inline-block h-2 w-2 rounded-sm bg-[#E8B8C2]" />
            {hoveredPath.province.name}
            <span className="ml-2 text-[#5A6670]/60">{hoveredPath.province.nameEn}</span>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
