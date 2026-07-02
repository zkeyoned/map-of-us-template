"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ImagePlus,
  Maximize2,
  Minimize2,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { chinaFeatures, makePath, makeProjectionForProvince, provinceIdOf } from "@/lib/geo";
import { cityFallbackSprite, getCitiesByProvince, type City } from "@/data/cities";
import { getLatestMemory, sortMemoriesByTime, type Memory } from "@/data/memories";
import { getLitCityIds, memoryStoreUpdatedEvent, type LocalMemoryStore } from "@/data/progress";
import { adminModeUpdatedEvent, readAdminMode } from "@/data/adminMode";
import type { Province } from "@/data/provinces";
import { LocalPrivacyImage, LocalPrivacyImg } from "@/components/LocalPrivacyImage";

interface ProvinceMapProps {
  province: Province;
  width?: number;
  height?: number;
}

type BrowserTimeout = ReturnType<Window["setTimeout"]>;
type PhotoDraft = {
  previewUrl: string;
  dataUrl: string | null;
  name: string;
};
type CardAnchor = {
  x: number;
  y: number;
  side: "left" | "right";
};
type MapCamera = {
  scale: number;
  x: number;
  y: number;
};
type DragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startCamera: MapCamera;
};
type TouchPoint = {
  clientX: number;
  clientY: number;
};
type PinchState = {
  startDistance: number;
  startMidpoint: TouchPoint;
  startCamera: MapCamera;
};
type MemoryPanelTab = "memory" | "gallery" | "history";
type CityAssetStore = Record<string, string>;

const colors = {
  cream: "#FAFBF7",
  dim: "#D8DDD8",
  ink: "#5A6670",
  sakura: "#F5DCE0",
  bloom: "#E8B8C2",
  mist: "#D6E8F0",
  sky: "#A8C8DC",
};

const spring = { type: "spring" as const, stiffness: 100, damping: 20 };
const memoryTextMaxLength = 80;
const maxPhotosPerMemory = 24;
const memoryPhotoMaxDimension = 900;
const memoryPhotoQuality = 0.52;
const landmarkPhotoMaxDimension = 1280;
const landmarkPhotoQuality = 0.76;
const memoryCardWidth = 292;
const memoryCardGap = 26;
const memoryCardMaxHeight = 620;
const cityListPanelWidth = 250;

const isObjectUrl = (url?: string | null): url is string =>
  typeof url === "string" && url.startsWith("blob:");

const revokeObjectUrl = (url?: string | null) => {
  if (isObjectUrl(url)) URL.revokeObjectURL(url);
};

const isDataImageUrl = (url?: string | null): url is string =>
  typeof url === "string" && url.startsWith("data:image/");

const isBrowserImageUrl = (url?: string | null): url is string =>
  typeof url === "string" && (url.startsWith("data:image/") || url.startsWith("https://"));

const useAdminMode = () => {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsAdmin(readAdminMode()), 0);
    const handleAdminMode = (event: Event) => {
      setIsAdmin(Boolean((event as CustomEvent<boolean>).detail));
    };

    window.addEventListener(adminModeUpdatedEvent, handleAdminMode);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(adminModeUpdatedEvent, handleAdminMode);
    };
  }, []);

  return isAdmin;
};

const normalizeMemoryDate = (value: string) => {
  const match = value.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
  if (!match) return null;

  const [, rawYear, rawMonth, rawDay] = match;
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  const date = new Date(Date.UTC(year, month - 1, day));

  const isValid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  if (!isValid) return null;

  return `${rawYear}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
};

const markerLayoutByCity: Record<
  string,
  {
    width: number;
    height: number;
    iconSize: number;
    iconX: number;
    iconY: number;
    labelX: number;
    labelY: number;
  }
> = {
  zhengzhou: {
    width: 214,
    height: 156,
    iconSize: 112,
    iconX: -56,
    iconY: -116,
    labelX: -34,
    labelY: -22,
  },
  jinan: {
    width: 208,
    height: 142,
    iconSize: 102,
    iconX: -52,
    iconY: -106,
    labelX: -28,
    labelY: -18,
  },
  qingdao: {
    width: 208,
    height: 142,
    iconSize: 102,
    iconX: -52,
    iconY: -106,
    labelX: -28,
    labelY: -18,
  },
  shanghai: {
    width: 214,
    height: 156,
    iconSize: 114,
    iconX: -57,
    iconY: -116,
    labelX: -34,
    labelY: -22,
  },
  hangzhou: {
    width: 208,
    height: 144,
    iconSize: 104,
    iconX: -52,
    iconY: -108,
    labelX: -30,
    labelY: -18,
  },
  guangzhou: {
    width: 214,
    height: 150,
    iconSize: 106,
    iconX: -42,
    iconY: -104,
    labelX: -16,
    labelY: -34,
  },
  zhuhai: {
    width: 214,
    height: 142,
    iconSize: 110,
    iconX: -48,
    iconY: -76,
    labelX: -6,
    labelY: 4,
  },
  hongkong: {
    width: 236,
    height: 142,
    iconSize: 124,
    iconX: -62,
    iconY: -94,
    labelX: -28,
    labelY: -10,
  },
  macau: {
    width: 214,
    height: 146,
    iconSize: 102,
    iconX: -51,
    iconY: -98,
    labelX: -26,
    labelY: -10,
  },
};

const defaultMarkerLayout = {
  width: 192,
  height: 140,
  iconSize: 96,
  iconX: -48,
  iconY: -104,
  labelX: -50,
  labelY: -18,
};

const compactMarkerLayout = {
  width: 86,
  height: 54,
  iconSize: 18,
  iconX: -9,
  iconY: -9,
  labelX: 8,
  labelY: -15,
};

const previewMarkerLayout = {
  width: 92,
  height: 86,
  iconSize: 46,
  iconX: -23,
  iconY: -43,
  labelX: -30,
  labelY: 12,
};

const getMarkerLayout = (city: City, selected: boolean) => {
  if (city.sprite === cityFallbackSprite) return compactMarkerLayout;
  if (!selected) return previewMarkerLayout;

  return markerLayoutByCity[city.id] ?? defaultMarkerLayout;
};

const stableCoordinate = (value: number) => Number(value.toFixed(3));

const clampZoom = (value: number) => Math.min(Math.max(value, 1), 2.4);

const getGestureDistance = (first: TouchPoint, second: TouchPoint) =>
  Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);

const getGestureMidpoint = (first: TouchPoint, second: TouchPoint): TouchPoint => ({
  clientX: (first.clientX + second.clientX) / 2,
  clientY: (first.clientY + second.clientY) / 2,
});

const readBlobAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Image read failed"));
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Image read failed")));
    reader.readAsDataURL(blob);
  });

const readFileAsDataUrl = (file: File) => readBlobAsDataUrl(file);

const loadImageFile = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new window.Image();

    image.addEventListener(
      "load",
      () => {
        URL.revokeObjectURL(imageUrl);
        resolve(image);
      },
      { once: true },
    );
    image.addEventListener(
      "error",
      () => {
        URL.revokeObjectURL(imageUrl);
        reject(new Error("Image load failed"));
      },
      { once: true },
    );
    image.src = imageUrl;
  });

async function readCompressedImageDataUrl(
  file: File,
  {
    maxDimension,
    quality,
  }: Readonly<{
    maxDimension: number;
    quality: number;
  }>,
) {
  if (file.type === "image/svg+xml") return readFileAsDataUrl(file);

  const image = await loadImageFile(file);
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) return readFileAsDataUrl(file);

  context.fillStyle = "#FAFBF7";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });

  if (!blob) return readFileAsDataUrl(file);

  return readBlobAsDataUrl(blob);
}

const revokePhotoDrafts = (photos: PhotoDraft[]) => {
  photos.forEach((photo) => revokeObjectUrl(photo.previewUrl));
};

const photosOfMemory = (memory?: Memory) => {
  if (!memory) return [];

  return memory.photos?.length ? memory.photos : [memory.image];
};

export default function ProvinceMap({ province, width = 1120, height = 760 }: ProvinceMapProps) {
  const isAdmin = useAdminMode();
  const frameRef = useRef<HTMLDivElement>(null);
  const nudgeTimeoutRef = useRef<BrowserTimeout | null>(null);
  const localMemoriesRef = useRef<LocalMemoryStore>({});
  const cameraRef = useRef<MapCamera>({ scale: 1, x: 0, y: 0 });
  const dragStateRef = useRef<DragState | null>(null);
  const activePointersRef = useRef<Map<number, TouchPoint>>(new Map());
  const pinchStateRef = useRef<PinchState | null>(null);
  const dragMovedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [nudgedCityId, setNudgedCityId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [frameScale, setFrameScale] = useState(1);
  const [localMemories, setLocalMemories] = useState<LocalMemoryStore>({});
  const [cityAssets, setCityAssets] = useState<CityAssetStore>({});
  const [camera, setCameraState] = useState<MapCamera>({ scale: 1, x: 0, y: 0 });
  const provinceCities = useMemo(() => getCitiesByProvince(province.id), [province.id]);
  const litCityIds = useMemo(() => getLitCityIds(localMemories), [localMemories]);
  const selectedCity = provinceCities.find((city) => city.id === selectedCityId) ?? null;
  const cityList = useMemo(
    () =>
      [...provinceCities].sort((a, b) => {
        const aLit = litCityIds.has(a.id);
        const bLit = litCityIds.has(b.id);
        if (aLit !== bLit) return aLit ? -1 : 1;

        return a.name.localeCompare(b.name, "zh-Hans-CN");
      }),
    [litCityIds, provinceCities],
  );

  const setCamera = (nextCamera: MapCamera | ((current: MapCamera) => MapCamera)) => {
    setCameraState((current) => {
      const resolved = typeof nextCamera === "function" ? nextCamera(current) : nextCamera;
      const clamped = {
        ...resolved,
        scale: clampZoom(resolved.scale),
      };
      cameraRef.current = clamped;

      return clamped;
    });
  };

  useEffect(() => {
    return () => {
      if (nudgeTimeoutRef.current) window.clearTimeout(nudgeTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    localMemoriesRef.current = localMemories;
  }, [localMemories]);

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  useEffect(() => {
    return () => {
      Object.values(localMemoriesRef.current).forEach((memories) => {
        memories.forEach((memory) => revokeObjectUrl(memory.image));
      });
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadLocalState() {
      const [memoryResponse, assetResponse] = await Promise.all([
        fetch("/api/memories", { cache: "no-store" }).catch(() => null),
        fetch("/api/city-assets", { cache: "no-store" }).catch(() => null),
      ]);

      const memoryData = (await memoryResponse?.json().catch(() => null)) as
        | { memories?: LocalMemoryStore }
        | null;
      const assetData = (await assetResponse?.json().catch(() => null)) as
        | { assets?: CityAssetStore }
        | null;

      if (cancelled) return;
      if (memoryData?.memories) setLocalMemories(memoryData.memories);
      if (assetData?.assets) setCityAssets(assetData.assets);
    }

    loadLocalState();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const updateScale = () => {
      const { width: renderedWidth } = frame.getBoundingClientRect();
      setFrameScale(renderedWidth / width);
    };

    updateScale();

    const observer = new ResizeObserver(updateScale);
    observer.observe(frame);
    window.addEventListener("resize", updateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, [width]);

  const mapData = useMemo(() => {
    const projection = makeProjectionForProvince(province.id, width, height, 88);
    const path = makePath(projection);
    const cityPoint = (city: Pick<City, "lng" | "lat">) => {
      const [x, y] = projection([city.lng, city.lat]) ?? [width / 2, height / 2];

      return [stableCoordinate(x), stableCoordinate(y)] as const;
    };

    return {
      paths: chinaFeatures.map((feature) => ({
        id: provinceIdOf(feature),
        d: path(feature as never) ?? "",
        active: provinceIdOf(feature) === province.id,
      })),
      cities: provinceCities.map((city) => {
        const [x, y] = cityPoint(city);
        const localMemory = localMemories[city.id]?.[0];
        const lit = litCityIds.has(city.id);
        const customSprite = cityAssets[city.id];

        return {
          ...city,
          sprite: customSprite ?? city.sprite,
          customSprite,
          x,
          y,
          lit,
          memory: localMemory ?? (lit ? getLatestMemory(city.id) : undefined),
        };
      }),
    };
  }, [cityAssets, height, litCityIds, localMemories, province.id, provinceCities, width]);

  const selectedPoint = mapData.cities.find((city) => city.id === selectedCityId);
  const cardAnchor = selectedPoint
    ? (() => {
        const renderedWidth = width * frameScale;
        const renderedHeight = height * frameScale;
        const rightLimit = Math.max(memoryCardWidth + 24, renderedWidth - cityListPanelWidth);
        const anchorX = (selectedPoint.x * camera.scale + camera.x) * frameScale;
        const anchorY = (selectedPoint.y * camera.scale + camera.y) * frameScale;
        const side = anchorX + memoryCardGap + memoryCardWidth > rightLimit ? "left" : "right";
        const x =
          side === "right"
            ? Math.min(anchorX + memoryCardGap, rightLimit - memoryCardWidth - 12)
            : Math.max(anchorX - memoryCardGap - memoryCardWidth, 12);
        const y = Math.min(
          Math.max(anchorY - 170, 82),
          Math.max(82, renderedHeight - memoryCardMaxHeight),
        );

        return { x, y, side } satisfies CardAnchor;
      })()
    : null;

  const handleSaveMemory = async (cityId: string, memory: Memory) => {
    if (!isAdmin) throw new Error("Admin mode required");

    const response = await fetch("/api/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memory }),
    });

    if (!response.ok) throw new Error("Failed to save memory");

    const data = (await response.json()) as { memory: Memory; memories: LocalMemoryStore };

    setLocalMemories(() => {
      localMemoriesRef.current = data.memories;

      return data.memories;
    });
    window.dispatchEvent(new CustomEvent(memoryStoreUpdatedEvent, { detail: data.memories }));
  };

  const handleSetMemoryCover = async (cityId: string, memoryId: string, coverImage: string) => {
    if (!isAdmin) throw new Error("Admin mode required");

    const response = await fetch("/api/memories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cityId, memoryId, coverImage }),
    });

    if (!response.ok) throw new Error("Failed to update memory cover");

    const data = (await response.json()) as { memory: Memory; memories: LocalMemoryStore };

    setLocalMemories(() => {
      localMemoriesRef.current = data.memories;

      return data.memories;
    });
    window.dispatchEvent(new CustomEvent(memoryStoreUpdatedEvent, { detail: data.memories }));
  };

  const handleUpdateMemory = async (cityId: string, memoryId: string, memory: Memory) => {
    if (!isAdmin) throw new Error("Admin mode required");

    const response = await fetch("/api/memories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cityId, memoryId, memory }),
    });

    if (!response.ok) throw new Error("Failed to update memory");

    const data = (await response.json()) as { memory: Memory; memories: LocalMemoryStore };

    setLocalMemories(() => {
      localMemoriesRef.current = data.memories;

      return data.memories;
    });
    window.dispatchEvent(new CustomEvent(memoryStoreUpdatedEvent, { detail: data.memories }));
  };

  const handleDeleteMemory = async (cityId: string, memoryId: string) => {
    if (!isAdmin) throw new Error("Admin mode required");

    const response = await fetch("/api/memories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cityId, memoryId }),
    });

    if (!response.ok) throw new Error("Failed to delete memory");

    const data = (await response.json()) as { memories: LocalMemoryStore };

    setLocalMemories(() => {
      localMemoriesRef.current = data.memories;

      return data.memories;
    });
    window.dispatchEvent(new CustomEvent(memoryStoreUpdatedEvent, { detail: data.memories }));
  };

  const handleSaveCityAsset = async (cityId: string, image: string) => {
    if (!isAdmin) throw new Error("Admin mode required");

    const response = await fetch("/api/city-assets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cityId, image }),
    });

    if (!response.ok) throw new Error("Failed to save city asset");

    const data = (await response.json()) as { assets: CityAssetStore };
    setCityAssets(data.assets);
  };

  const handleDeleteCityAsset = async (cityId: string) => {
    if (!isAdmin) throw new Error("Admin mode required");

    const response = await fetch("/api/city-assets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cityId }),
    });

    if (!response.ok) throw new Error("Failed to delete city asset");

    const data = (await response.json()) as { assets: CityAssetStore };
    setCityAssets(data.assets);
  };

  const focusCity = (city: Pick<City, "id" | "lng" | "lat">) => {
    const point = mapData.cities.find((candidate) => candidate.id === city.id);
    if (!point) return;

    const scale = clampZoom(Math.max(cameraRef.current.scale, 1.62));
    setCamera({
      scale,
      x: width / 2 - point.x * scale - 150,
      y: height / 2 - point.y * scale + 12,
    });
  };

  const handleSelectCity = (cityId: string, lit: boolean) => {
    const city = provinceCities.find((candidate) => candidate.id === cityId);
    setSelectedCityId(cityId);
    if (city) focusCity(city);
    if (!lit) {
      setNudgedCityId(cityId);
      if (nudgeTimeoutRef.current) window.clearTimeout(nudgeTimeoutRef.current);
      nudgeTimeoutRef.current = window.setTimeout(() => setNudgedCityId(null), 520);
    }
  };

  const resetCamera = () => {
    setSelectedCityId(null);
    setCamera({ scale: 1, x: 0, y: 0 });
  };

  useEffect(() => {
    const cityId = new URLSearchParams(window.location.search).get("city");
    const city = provinceCities.find((candidate) => candidate.id === cityId);
    if (!city) return;

    const timer = window.setTimeout(() => {
      setSelectedCityId(city.id);
      focusCity(city);
    }, 0);

    return () => window.clearTimeout(timer);
    // Run after city coordinates are projected so deep links can focus the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapData.cities, provinceCities]);

  const zoomAt = (clientX: number, clientY: number, delta: number) => {
    const frame = frameRef.current;
    if (!frame) return;

    const rect = frame.getBoundingClientRect();
    const pointerX = (clientX - rect.left) / frameScale;
    const pointerY = (clientY - rect.top) / frameScale;

    setCamera((current) => {
      const nextScale = clampZoom(current.scale * delta);
      const mapX = (pointerX - current.x) / current.scale;
      const mapY = (pointerY - current.y) / current.scale;

      return {
        scale: nextScale,
        x: pointerX - mapX * nextScale,
        y: pointerY - mapY * nextScale,
      };
    });
  };

  const zoomFromCenter = (delta: number) => {
    const frame = frameRef.current;
    const rect = frame?.getBoundingClientRect();
    const centerX = rect ? rect.left + rect.width / 2 : 0;
    const centerY = rect ? rect.top + rect.height / 2 : 0;

    zoomAt(centerX, centerY, delta);
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 1.12 : 0.88;
    zoomAt(event.clientX, event.clientY, delta);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const mapMarker = target.closest("[data-map-marker]");
    if (target.closest("article, aside") || (target.closest("button, input") && !mapMarker)) return;

    activePointersRef.current.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY,
    });
    dragMovedRef.current = false;
    suppressClickRef.current = false;
    if (activePointersRef.current.size === 2) {
      const points = [...activePointersRef.current.values()];
      const midpoint = getGestureMidpoint(points[0], points[1]);
      pinchStateRef.current = {
        startDistance: getGestureDistance(points[0], points[1]),
        startMidpoint: midpoint,
        startCamera: cameraRef.current,
      };
      dragStateRef.current = null;
    } else {
      dragStateRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startCamera: cameraRef.current,
      };
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(event.pointerId)) return;

    activePointersRef.current.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY,
    });

    if (pinchStateRef.current && activePointersRef.current.size >= 2) {
      const points = [...activePointersRef.current.values()];
      const nextDistance = getGestureDistance(points[0], points[1]);
      const nextMidpoint = getGestureMidpoint(points[0], points[1]);
      const startDistance = Math.max(1, pinchStateRef.current.startDistance);
      const nextScale = clampZoom(
        pinchStateRef.current.startCamera.scale * (nextDistance / startDistance),
      );
      const frame = frameRef.current;
      const rect = frame?.getBoundingClientRect();
      const midpointX = rect ? (nextMidpoint.clientX - rect.left) / frameScale : width / 2;
      const midpointY = rect ? (nextMidpoint.clientY - rect.top) / frameScale : height / 2;
      const startMidpointX = rect
        ? (pinchStateRef.current.startMidpoint.clientX - rect.left) / frameScale
        : midpointX;
      const startMidpointY = rect
        ? (pinchStateRef.current.startMidpoint.clientY - rect.top) / frameScale
        : midpointY;
      const mapX =
        (startMidpointX - pinchStateRef.current.startCamera.x) /
        pinchStateRef.current.startCamera.scale;
      const mapY =
        (startMidpointY - pinchStateRef.current.startCamera.y) /
        pinchStateRef.current.startCamera.scale;

      dragMovedRef.current = true;
      suppressClickRef.current = true;
      setCamera({
        scale: nextScale,
        x: midpointX - mapX * nextScale,
        y: midpointY - mapY * nextScale,
      });
      return;
    }

    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const dx = (event.clientX - dragState.startClientX) / frameScale;
    const dy = (event.clientY - dragState.startClientY) / frameScale;

    if (Math.abs(dx) + Math.abs(dy) > 6) {
      dragMovedRef.current = true;
      suppressClickRef.current = true;
    }

    setCamera({
      ...dragState.startCamera,
      x: dragState.startCamera.x + dx,
      y: dragState.startCamera.y + dy,
    });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(event.pointerId);
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null;
    }
    if (activePointersRef.current.size < 2) {
      pinchStateRef.current = null;
    }
    if (activePointersRef.current.size === 1) {
      const [remainingPointerId, point] = [...activePointersRef.current.entries()][0];
      dragStateRef.current = {
        pointerId: remainingPointerId,
        startClientX: point.clientX,
        startClientY: point.clientY,
        startCamera: cameraRef.current,
      };
    } else if (activePointersRef.current.size === 0) {
      setDragging(false);
    }
  };

  return (
    <div
      ref={frameRef}
      className={`relative mx-auto aspect-[1120/760] w-[min(100%,1120px)] touch-none overflow-visible ${
        dragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={(event) => {
        if (dragMovedRef.current || suppressClickRef.current) {
          dragMovedRef.current = false;
          suppressClickRef.current = false;
          return;
        }
        const target = event.target as HTMLElement;
        if (!target.closest("button, article")) setSelectedCityId(null);
      }}
    >
      <div
        className="absolute left-0 top-0 z-0 origin-top-left"
        style={{
          width,
          height,
          transformOrigin: "0 0",
          transform: `scale(${frameScale})`,
        }}
      >
        <motion.div
          className="absolute left-0 top-0 origin-top-left"
          animate={{ scale: camera.scale, x: camera.x, y: camera.y }}
          transition={spring}
          style={{
            width,
            height,
            transformOrigin: "0 0",
          }}
        >
          <svg
            className="h-full w-full overflow-visible drop-shadow-[0_18px_30px_rgba(168,200,220,0.16)]"
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`${province.name} province map`}
          >
            <defs>
              <filter id="provinceGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feFlood floodColor={colors.bloom} floodOpacity="0.36" />
                <feComposite in2="blur" operator="in" />
                <feMerge>
                  <feMergeNode />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {mapData.paths.map((path) => (
              <path
                key={path.id}
                d={path.d}
                fill={path.active ? colors.sakura : colors.dim}
                fillOpacity={path.active ? 0.44 : 0.12}
                stroke={path.active ? colors.bloom : colors.dim}
                strokeOpacity={path.active ? 0.86 : 0.45}
                strokeWidth={path.active ? 2.4 : 1.2}
                strokeLinejoin="round"
                filter={path.active ? "url(#provinceGlow)" : undefined}
              />
            ))}

          </svg>

          {mapData.cities.map((city) => {
            const selected = city.id === selectedCityId;
            const faded = selectedCityId && !selected;
            const nudged = nudgedCityId === city.id;
            const layout = getMarkerLayout(city, selected);

            return (
              <motion.button
                key={city.id}
                className="group absolute text-left transition duration-300"
                initial={false}
                animate={{
                  x: nudged ? [0, -3, 3, -2, 0] : 0,
                }}
                transition={{ duration: nudged ? 0.42 : 0.24 }}
                style={{
                  left: city.x - layout.width / 2,
                  top: city.y - layout.height / 2,
                  width: layout.width,
                  height: layout.height,
                  opacity: faded ? 0.28 : 1,
                }}
                data-map-marker
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  if (dragMovedRef.current || suppressClickRef.current) {
                    dragMovedRef.current = false;
                    suppressClickRef.current = false;
                    return;
                  }
                  handleSelectCity(city.id, city.lit);
                }}
                aria-label={`${city.lit ? "查看" : "添加"}${city.name}回忆`}
              >
                <CityMarker city={city} lit={city.lit} selected={selected} />
              </motion.button>
            );
          })}
        </motion.div>
      </div>

      <div
        className="absolute left-3 top-3 z-40 flex items-center gap-2 rounded-[8px] border border-[#D8DDD8]/85 bg-[#FAFBF7]/86 p-2 shadow-[0_10px_28px_rgba(90,102,112,0.08)] backdrop-blur"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="grid h-9 w-9 place-items-center rounded-[7px] text-[#5A6670] transition hover:bg-[#D6E8F0]/45"
          type="button"
          onClick={() => zoomFromCenter(0.88)}
          aria-label="缩小地图"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="min-w-12 text-center text-xs font-semibold text-[#5A6670]/70">
          {Math.round(camera.scale * 100)}%
        </span>
        <button
          className="grid h-9 w-9 place-items-center rounded-[7px] text-[#5A6670] transition hover:bg-[#F5DCE0]/55"
          type="button"
          onClick={() => zoomFromCenter(1.12)}
          aria-label="放大地图"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          className="grid h-9 w-9 place-items-center rounded-[7px] text-[#5A6670] transition hover:bg-[#D4E8D0]/55"
          type="button"
          onClick={resetCamera}
          aria-label="重置地图视角"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <aside
        className="absolute right-0 top-3 z-40 hidden w-[230px] rounded-[8px] border border-[#D8DDD8]/85 bg-[#FAFBF7]/90 p-3 shadow-[0_16px_34px_rgba(90,102,112,0.10)] backdrop-blur sm:block"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerMove={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
        aria-label={`${province.name}城市列表`}
      >
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#5A6670]">城市</h2>
          <span className="text-xs font-medium text-[#5A6670]/54">{provinceCities.length}</span>
        </div>
        <div className="max-h-[430px] space-y-1 overflow-y-auto pr-1">
          {cityList.map((city) => {
            const lit = litCityIds.has(city.id);
            const selected = city.id === selectedCityId;

            return (
              <button
                key={city.id}
                className={`flex w-full items-center justify-between gap-3 rounded-[7px] px-3 py-2 text-left text-sm transition ${
                  selected
                    ? "bg-[#F5DCE0] text-[#E8B8C2] shadow-[0_8px_18px_rgba(232,184,194,0.16)]"
                    : "text-[#5A6670]/78 hover:bg-[#D6E8F0]/34"
                }`}
                type="button"
                onClick={() => handleSelectCity(city.id, lit)}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full border-2 border-[#FAFBF7] ${
                      lit ? "bg-[#E8B8C2] shadow-[0_0_10px_rgba(232,184,194,0.55)]" : "bg-[#D8DDD8]"
                    }`}
                  />
                  <span className="truncate font-semibold">{city.name}</span>
                </span>
                <span className={`shrink-0 text-[11px] ${lit ? "text-[#E8B8C2]/80" : "text-[#5A6670]/40"}`}>
                  {lit ? "已去过" : "未去过"}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {selectedCity && (
        <MemoryCard
          key={selectedCity.id}
          city={selectedCity}
          localMemories={localMemories[selectedCity.id] ?? []}
          isLit={litCityIds.has(selectedCity.id)}
          anchor={cardAnchor}
          isAdmin={isAdmin}
          onClose={() => setSelectedCityId(null)}
          onSave={handleSaveMemory}
        onSetCover={handleSetMemoryCover}
        onUpdate={handleUpdateMemory}
        onDelete={handleDeleteMemory}
        landmarkImage={cityAssets[selectedCity.id] ?? selectedCity.sprite}
        hasCustomLandmark={Boolean(cityAssets[selectedCity.id])}
        onSaveLandmark={handleSaveCityAsset}
        onDeleteLandmark={handleDeleteCityAsset}
      />
      )}
    </div>
  );
}

function CityMarker({ city, lit, selected }: Readonly<{ city: City; lit: boolean; selected: boolean }>) {
  const isFallbackCity = city.sprite === cityFallbackSprite;
  const layout = getMarkerLayout(city, selected);

  if (isFallbackCity) {
    return (
      <span className="relative block h-full w-full">
        <span
          className={`absolute block rounded-full border-2 border-[#FAFBF7] transition duration-300 ${
            lit
              ? "bg-[#E8B8C2] shadow-[0_0_12px_rgba(232,184,194,0.7)]"
              : "bg-[#D8DDD8] shadow-[0_4px_10px_rgba(90,102,112,0.08)]"
          }`}
          style={{
            left: `calc(50% + ${layout.iconX}px)`,
            top: `calc(50% + ${layout.iconY}px)`,
            width: layout.iconSize,
            height: layout.iconSize,
          }}
        />
        <span
          className={`absolute flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#FAFBF7]/92 px-3 py-1.5 text-xs font-semibold shadow-[0_8px_18px_rgba(90,102,112,0.10)] backdrop-blur transition duration-200 ${
            lit
              ? "text-[#E8B8C2] opacity-100"
              : "text-[#5A6670]/62 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
          }`}
          style={{
            left: `calc(50% + ${layout.labelX}px)`,
            top: `calc(50% + ${layout.labelY}px)`,
          }}
        >
          {city.name}
        </span>
      </span>
    );
  }

  const compactLandmark = !selected;

  return (
    <span className="relative block h-full w-full">
      <span
        className="absolute block"
        style={{
          left: `calc(50% + ${layout.iconX}px)`,
          top: `calc(50% + ${layout.iconY}px)`,
          width: layout.iconSize,
          height: layout.iconSize,
        }}
      >
        <LandmarkSprite city={city} lit={lit} />
      </span>
      <span
        className={`absolute flex items-center whitespace-nowrap rounded-full bg-[#FAFBF7]/88 font-semibold shadow-[0_8px_18px_rgba(90,102,112,0.10)] backdrop-blur transition duration-200 ${
          compactLandmark ? "gap-1.5 px-3 py-1.5 text-xs" : "gap-2 px-4 py-2 text-sm"
        } ${
          compactLandmark && !lit ? "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" : "opacity-100"
        } ${lit ? "text-[#E8B8C2]" : "text-[#5A6670]/58"}
        }`}
        style={{
          left: `calc(50% + ${layout.labelX}px)`,
          top: `calc(50% + ${layout.labelY}px)`,
        }}
      >
        <span
          className={`rounded-full border-2 border-[#FAFBF7] ${
            compactLandmark ? "h-2 w-2" : "h-2.5 w-2.5"
          } ${
            lit
              ? "bg-[#E8B8C2] shadow-[0_0_10px_rgba(232,184,194,0.65)]"
              : "bg-[#D8DDD8]"
          }`}
        />
        {city.name}
        {city.nameEn !== city.name && (
          <span className={lit ? "font-normal text-[#E8B8C2]/80" : "font-normal text-[#5A6670]/42"}>
            {city.nameEn}
          </span>
        )}
      </span>
    </span>
  );
}

function MemoryCard({
  city,
  localMemories,
  isLit,
  anchor,
  isAdmin,
  onClose,
  onSave,
  onSetCover,
  onUpdate,
  onDelete,
  landmarkImage,
  hasCustomLandmark,
  onSaveLandmark,
  onDeleteLandmark,
}: Readonly<{
  city: City;
  localMemories: Memory[];
  isLit: boolean;
  anchor: CardAnchor | null;
  isAdmin: boolean;
  onClose: () => void;
  onSave: (cityId: string, memory: Memory) => Promise<void>;
  onSetCover: (cityId: string, memoryId: string, coverImage: string) => Promise<void>;
  onUpdate: (cityId: string, memoryId: string, memory: Memory) => Promise<void>;
  onDelete: (cityId: string, memoryId: string) => Promise<void>;
  landmarkImage: string;
  hasCustomLandmark: boolean;
  onSaveLandmark: (cityId: string, image: string) => Promise<void>;
  onDeleteLandmark: (cityId: string) => Promise<void>;
}>) {
  const defaultMemory = isLit ? getLatestMemory(city.id) : undefined;
  const memories = sortMemoriesByTime(
    [
      ...localMemories,
      ...(defaultMemory && !localMemories.some((item) => item.id === defaultMemory.id)
        ? [defaultMemory]
        : []),
    ],
  );
  const memory = memories[0];
  const memoryPhotos = photosOfMemory(memory);
  const galleryPhotos = Array.from(new Set(memories.flatMap((item) => photosOfMemory(item))));
  const localMemoryIds = useMemo(
    () => new Set(localMemories.map((item) => item.id)),
    [localMemories],
  );
  const [formOpen, setFormOpen] = useState(!isLit && isAdmin);
  const [date, setDate] = useState("");
  const [text, setText] = useState("");
  const [photoDrafts, setPhotoDrafts] = useState<PhotoDraft[]>([]);
  const [photoError, setPhotoError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [coverError, setCoverError] = useState("");
  const [settingCover, setSettingCover] = useState("");
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [deletingMemoryId, setDeletingMemoryId] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [landmarkError, setLandmarkError] = useState("");
  const [landmarkSaving, setLandmarkSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<MemoryPanelTab>("memory");
  const [isReadingPhoto, setIsReadingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const photoDraftsRef = useRef<PhotoDraft[]>([]);
  const photoReadTokenRef = useRef(0);
  const mountedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const landmarkInputRef = useRef<HTMLInputElement>(null);

  const trimmedDate = date.trim();
  const trimmedText = text.trim();
  const normalizedDate = normalizeMemoryDate(trimmedDate);
  const dateInvalid = trimmedDate.length > 0 && !normalizedDate;
  const canSave =
    isAdmin &&
    Boolean(normalizedDate) &&
    trimmedText.length > 0 &&
    !isReadingPhoto &&
    !photoError &&
    !isSaving;
  const isEditing = Boolean(editingMemory);
  const showMemory = !expanded || activeTab === "memory";
  const showGallery = expanded && activeTab === "gallery";
  const showHistory = (!expanded || activeTab === "history") && memories.length > 0;

  const resetForm = (revokePhoto: boolean) => {
    photoReadTokenRef.current += 1;
    setDate("");
    setText("");
    setPhotoError("");
    setSaveError("");
    setCoverError("");
    setDeleteError("");
    setIsReadingPhoto(false);
    setEditingMemory(null);
    if (revokePhoto) revokePhotoDrafts(photoDraftsRef.current);
    photoDraftsRef.current = [];
    setPhotoDrafts([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startEdit = (record: Memory) => {
    if (!isAdmin) return;

    photoReadTokenRef.current += 1;
    revokePhotoDrafts(photoDraftsRef.current);
    photoDraftsRef.current = [];
    setPhotoDrafts([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setDate(record.date);
    setText(record.text);
    setPhotoError("");
    setSaveError("");
    setCoverError("");
    setDeleteError("");
    setEditingMemory(record);
    setFormOpen(true);
    setActiveTab("memory");
  };

  const handleDelete = async (record: Memory) => {
    if (!isAdmin) {
      setDeleteError("请先进入管理员模式");
      return;
    }

    if (deletingMemoryId) return;
    const confirmed = window.confirm(`确定删除 ${record.city} ${record.date} 的这条回忆吗？`);
    if (!confirmed) return;

    setDeletingMemoryId(record.id);
    setDeleteError("");

    try {
      await onDelete(city.id, record.id);
      if (editingMemory?.id === record.id) resetForm(true);
    } catch {
      setDeleteError("删除失败，请稍后再试");
    } finally {
      if (mountedRef.current) setDeletingMemoryId("");
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      photoReadTokenRef.current += 1;
      revokePhotoDrafts(photoDraftsRef.current);
    };
  }, []);

  const handlePickFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) {
      event.target.value = "";
      setPhotoError("请先进入管理员模式");
      return;
    }

    const files = Array.from(event.target.files ?? [])
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, maxPhotosPerMemory);
    if (files.length === 0) return;

    const readToken = photoReadTokenRef.current + 1;
    photoReadTokenRef.current = readToken;
    revokePhotoDrafts(photoDraftsRef.current);
    const nextPhotoDrafts = files.map((file) => ({
      previewUrl: URL.createObjectURL(file),
      dataUrl: null,
      name: file.name,
    }));

    photoDraftsRef.current = nextPhotoDrafts;
    setPhotoDrafts(nextPhotoDrafts);
    setPhotoError("");
    setSaveError("");
    setIsReadingPhoto(true);

    try {
      const dataUrls = await Promise.all(
        files.map((file) =>
          readCompressedImageDataUrl(file, {
            maxDimension: memoryPhotoMaxDimension,
            quality: memoryPhotoQuality,
          }),
        ),
      );
      if (!mountedRef.current || photoReadTokenRef.current !== readToken) return;
      const nextReadyDrafts = nextPhotoDrafts.map((photo, index) => ({
        ...photo,
        dataUrl: dataUrls[index],
      }));
      photoDraftsRef.current = nextReadyDrafts;
      setPhotoDrafts(nextReadyDrafts);
    } catch {
      if (!mountedRef.current || photoReadTokenRef.current !== readToken) return;
      setPhotoError("图片读取失败，请重新选择");
    } finally {
      if (mountedRef.current && photoReadTokenRef.current === readToken) setIsReadingPhoto(false);
    }
  };

  const handlePickLandmark = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!isAdmin) {
      if (landmarkInputRef.current) landmarkInputRef.current.value = "";
      setLandmarkError("请先进入管理员模式");
      return;
    }
    if (!file || !file.type.startsWith("image/") || landmarkSaving) return;

    setLandmarkSaving(true);
    setLandmarkError("");

    try {
      await onSaveLandmark(
        city.id,
        await readCompressedImageDataUrl(file, {
          maxDimension: landmarkPhotoMaxDimension,
          quality: landmarkPhotoQuality,
        }),
      );
    } catch {
      setLandmarkError("地标图片保存失败，请重新选择");
    } finally {
      if (mountedRef.current) setLandmarkSaving(false);
      if (landmarkInputRef.current) landmarkInputRef.current.value = "";
    }
  };

  const handleDeleteLandmark = async () => {
    if (!isAdmin) {
      setLandmarkError("请先进入管理员模式");
      return;
    }

    if (!hasCustomLandmark || landmarkSaving) return;
    const confirmed = window.confirm(`确定删除 ${city.name} 的自定义地标图吗？`);
    if (!confirmed) return;

    setLandmarkSaving(true);
    setLandmarkError("");

    try {
      await onDeleteLandmark(city.id);
    } catch {
      setLandmarkError("地标图片删除失败，请稍后再试");
    } finally {
      if (mountedRef.current) setLandmarkSaving(false);
    }
  };

  const handleSave = async () => {
    if (!isAdmin) {
      setSaveError("请先进入管理员模式");
      return;
    }
    if (!canSave) return;
    if (!normalizedDate) return;
    setIsSaving(true);
    setSaveError("");

    try {
      const photos = photoDrafts.map((photo) => photo.dataUrl).filter((photo): photo is string => Boolean(photo));

      const nextPhotos = photos.length > 0 ? photos : editingMemory?.photos ?? [editingMemory?.image ?? landmarkImage];
      const nextMemory = {
        id: editingMemory?.id ?? `${city.id}-local`,
        cityId: city.id,
        city: city.name,
        cityEn: city.nameEn,
        date: normalizedDate,
        image: editingMemory && photos.length === 0 ? editingMemory.image : nextPhotos[0],
        photos: nextPhotos,
        text: trimmedText,
        createdAt: editingMemory?.createdAt,
      };

      if (editingMemory) await onUpdate(city.id, editingMemory.id, nextMemory);
      else await onSave(city.id, {
        id: `${city.id}-local`,
        cityId: city.id,
        city: city.name,
        cityEn: city.nameEn,
        date: normalizedDate,
        image: photos[0] ?? landmarkImage,
        photos: photos.length > 0 ? photos : [landmarkImage],
        text: trimmedText,
      });
      resetForm(true);
      setFormOpen(false);
    } catch {
      setSaveError("保存失败，请稍后再试");
    } finally {
      if (mountedRef.current) setIsSaving(false);
    }
  };

  const handleSetCover = async (photo: string) => {
    if (!isAdmin) {
      setCoverError("请先进入管理员模式");
      return;
    }

    if (!memory || memory.image === photo || settingCover) return;
    setSettingCover(photo);
    setCoverError("");

    try {
      await onSetCover(city.id, memory.id, photo);
    } catch {
      setCoverError("封面保存失败，请稍后再试");
    } finally {
      if (mountedRef.current) setSettingCover("");
    }
  };

  return (
    <motion.article
      className={`province-memory-card z-50 overflow-y-auto rounded-[8px] border border-[#D8DDD8] bg-[#FAFBF7]/94 text-[#5A6670] shadow-[0_18px_42px_rgba(90,102,112,0.18)] backdrop-blur ${
        expanded
          ? "is-expanded max-h-[min(720px,calc(100vh-92px))] w-[390px] p-6"
          : "max-h-[min(620px,calc(100vh-110px))] w-[292px] p-5"
      }`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring}
      style={
        expanded
          ? {
              "--memory-card-right": "0px",
              "--memory-card-top": "12px",
            } as CSSProperties
          : {
              "--memory-card-left": `${anchor ? anchor.x : 24}px`,
              "--memory-card-top": anchor ? `${anchor.y}px` : "50%",
            } as CSSProperties
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <span className={`h-3 w-3 rounded-sm ${isLit ? "bg-[#E8B8C2]" : "bg-[#D8DDD8]"}`} />
            {city.name}
            <span className="text-sm font-normal text-[#5A6670]/62">{city.nameEn}</span>
          </h2>
          <p className="mt-3 text-sm text-[#5A6670]/76">
            {memory?.date ?? "添加回忆后点亮"}
          </p>
          {!isAdmin && (
            <p className="mt-2 text-xs font-semibold text-[#5A6670]/42">管理员锁定，无法修改回忆</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            className="grid h-8 w-8 place-items-center rounded-[6px] text-[#5A6670]/62 transition hover:bg-[#D6E8F0]/32 hover:text-[#A8C8DC]"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? "收起城市记录面板" : "展开城市记录面板"}
            type="button"
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            className="grid h-8 w-8 place-items-center rounded-[6px] text-[#5A6670]/62 transition hover:bg-[#D8DDD8]/28 hover:text-[#5A6670]"
            onClick={onClose}
            aria-label="关闭回忆卡片"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 flex rounded-[8px] border border-[#D8DDD8]/72 bg-[#FAFBF7]/72 p-1 text-xs font-semibold text-[#5A6670]/58">
          {([
            ["memory", "回忆"],
            ["gallery", "相册"],
            ["history", "历史"],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              className={`flex-1 rounded-[7px] px-3 py-2 text-center transition ${
                activeTab === tab ? "bg-[#F5DCE0] text-[#E8B8C2]" : "hover:bg-[#D6E8F0]/30"
              }`}
              type="button"
              onClick={() => setActiveTab(tab)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {showMemory && (
        <>
          <div className="mt-4 rounded-[7px] border border-[#D8DDD8]/72 bg-[#FAFBF7]/72 p-3">
            <div className="flex items-center gap-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[6px] border border-[#D8DDD8] bg-[#D6E8F0]">
                <MemoryImage src={landmarkImage} alt={`${city.name} 地标图`} dim={!isLit} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#5A6670]/72">地图地标图</p>
                <p className="mt-1 text-[11px] leading-4 text-[#5A6670]/46">
                  上传后会显示在省份地图里，不需要先点亮城市。
                </p>
              </div>
            </div>
            <input
              ref={landmarkInputRef}
              className="hidden"
              type="file"
              accept="image/*"
              onChange={handlePickLandmark}
              disabled={!isAdmin}
            />
            <div className="mt-3 flex gap-2">
              <button
                className="flex flex-1 items-center justify-center gap-1.5 rounded-[6px] border border-[#A8C8DC] px-3 py-2 text-xs font-semibold text-[#A8C8DC] transition hover:bg-[#D6E8F0]/34 disabled:opacity-45"
                type="button"
                onClick={() => landmarkInputRef.current?.click()}
                disabled={landmarkSaving || !isAdmin}
              >
                <ImagePlus className="h-3.5 w-3.5" />
                {hasCustomLandmark ? "替换地标" : "上传地标"}
              </button>
              {hasCustomLandmark && (
                <button
                  className="grid h-8 w-8 place-items-center rounded-[6px] border border-[#F5DCE0] text-[#E8B8C2] transition hover:bg-[#F5DCE0]/45 disabled:opacity-45"
                  type="button"
                  onClick={handleDeleteLandmark}
                  disabled={landmarkSaving || !isAdmin}
                  aria-label="删除自定义地标图"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {landmarkError && <p className="mt-2 text-xs text-[#E8B8C2]">{landmarkError}</p>}
          </div>

          <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-[6px] border border-[#D8DDD8] bg-[#D6E8F0]">
            <MemoryImage
              src={memory?.image ?? landmarkImage}
              alt={`${city.name} memory`}
              dim={!isLit}
              fit={memory ? "cover" : "contain"}
            />
            {memoryPhotos.length > 1 && (
              <span className="absolute bottom-2 right-2 rounded-[6px] bg-[#FAFBF7]/86 px-2 py-1 text-xs font-medium text-[#5A6670]/78 shadow-[0_6px_14px_rgba(90,102,112,0.12)]">
                {memoryPhotos.length} photos
              </span>
            )}
          </div>

          {memoryPhotos.length > 1 && (
            <div className={`mt-3 grid gap-2 ${expanded ? "grid-cols-5" : "grid-cols-4"}`}>
              {memoryPhotos.map((photo, index) => {
                const isCover = memory?.image === photo;

                return (
                  <button
                    key={`${memory?.id ?? city.id}-photo-${index}`}
                    className={`group relative aspect-square overflow-hidden rounded-[4px] border bg-[#D6E8F0] transition ${
                      isCover
                        ? "border-[#E8B8C2] shadow-[0_0_0_2px_rgba(245,220,224,0.75)]"
                        : "border-[#D8DDD8] hover:border-[#E8B8C2]"
                    }`}
                    type="button"
                    onClick={() => handleSetCover(photo)}
                    aria-label={isCover ? "当前封面" : `将第 ${index + 1} 张照片设为封面`}
                    disabled={!isAdmin || isCover || Boolean(settingCover)}
                  >
                    <MemoryImage src={photo} alt={`${city.name} memory photo ${index + 1}`} fit="cover" />
                    <span
                      className={`absolute inset-x-1 bottom-1 rounded-[4px] bg-[#FAFBF7]/90 px-1.5 py-1 text-[10px] font-medium shadow-[0_4px_10px_rgba(90,102,112,0.10)] transition ${
                        isCover
                          ? "text-[#E8B8C2] opacity-100"
                          : "text-[#5A6670]/68 opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      {isCover ? "封面" : settingCover === photo ? "保存中" : "设封面"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {coverError && <p className="mt-2 text-xs text-[#E8B8C2]">{coverError}</p>}

          <p className="mt-4 text-sm leading-6 text-[#5A6670]/82">
            {memory?.text ?? "写下第一段回忆后，这座城市会被点亮。"}
          </p>
          {memory && localMemoryIds.has(memory.id) && (
            <div className="mt-4 flex gap-2">
              <button
                className="flex flex-1 items-center justify-center gap-1.5 rounded-[6px] border border-[#D8DDD8] px-3 py-2 text-xs font-medium text-[#5A6670]/70 transition hover:border-[#A8C8DC] hover:text-[#A8C8DC]"
                type="button"
                onClick={() => startEdit(memory)}
                disabled={!isAdmin}
              >
                <Pencil className="h-3.5 w-3.5" />
                编辑
              </button>
              <button
                className="flex flex-1 items-center justify-center gap-1.5 rounded-[6px] border border-[#F5DCE0] px-3 py-2 text-xs font-medium text-[#E8B8C2] transition hover:bg-[#F5DCE0]/55 disabled:opacity-45"
                type="button"
                onClick={() => handleDelete(memory)}
                disabled={!isAdmin || deletingMemoryId === memory.id}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deletingMemoryId === memory.id ? "删除中" : "删除"}
              </button>
            </div>
          )}
          {deleteError && <p className="mt-2 text-xs text-[#E8B8C2]">{deleteError}</p>}
        </>
      )}

      {showGallery && (
        <div className="mt-4">
          {galleryPhotos.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {galleryPhotos.map((photo, index) => (
                <span
                  key={`${city.id}-gallery-photo-${index}`}
                  className="relative aspect-square overflow-hidden rounded-[5px] border border-[#D8DDD8] bg-[#D6E8F0]"
                >
                  <MemoryImage src={photo} alt={`${city.name} gallery photo ${index + 1}`} fit="cover" />
                </span>
              ))}
            </div>
          ) : (
            <p className="rounded-[7px] border border-dashed border-[#D8DDD8] px-4 py-6 text-center text-sm text-[#5A6670]/56">
              还没有照片，添加第一段回忆后会出现在这里。
            </p>
          )}
        </div>
      )}

      {showHistory && (
        <div className="mt-4 border-t border-dashed border-[#D8DDD8] pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-semibold text-[#5A6670]/70">历史记录</p>
            <span className="text-[11px] text-[#5A6670]/42">{memories.length} 条</span>
          </div>
          <div className={`mt-3 ${expanded ? "space-y-4" : "space-y-3"}`}>
            {memories.map((record, recordIndex) => {
              const recordPhotos = photosOfMemory(record);
              const editable = localMemoryIds.has(record.id);

              return (
                <article
                  key={record.id}
                  className="rounded-[7px] border border-[#D8DDD8]/70 bg-[#FAFBF7]/72 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-[#5A6670]/70">{record.date}</p>
                    <div className="flex items-center gap-1.5">
                      {recordIndex === 0 && (
                        <span className="rounded-full bg-[#F5DCE0]/82 px-2 py-0.5 text-[10px] font-medium text-[#E8B8C2]">
                          最新
                        </span>
                      )}
                      {editable ? (
                        <>
                          <button
                            className="grid h-6 w-6 place-items-center rounded-[5px] text-[#5A6670]/46 transition hover:bg-[#D6E8F0]/34 hover:text-[#A8C8DC]"
                            type="button"
                            onClick={() => startEdit(record)}
                            disabled={!isAdmin}
                            aria-label={`编辑 ${record.city} ${record.date} 回忆`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            className="grid h-6 w-6 place-items-center rounded-[5px] text-[#5A6670]/46 transition hover:bg-[#F5DCE0]/46 hover:text-[#E8B8C2] disabled:opacity-40"
                            type="button"
                            onClick={() => handleDelete(record)}
                            disabled={!isAdmin || deletingMemoryId === record.id}
                            aria-label={`删除 ${record.city} ${record.date} 回忆`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] text-[#5A6670]/36">示例</span>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#5A6670]/72">{record.text}</p>
                  {recordPhotos.length > 0 && (
                    <div className={`mt-3 grid gap-1.5 ${expanded ? "grid-cols-6" : "grid-cols-5"}`}>
                      {recordPhotos.slice(0, expanded ? 12 : 10).map((photo, photoIndex) => (
                        <span
                          key={`${record.id}-timeline-photo-${photoIndex}`}
                          className="relative aspect-square overflow-hidden rounded-[4px] border border-[#D8DDD8] bg-[#D6E8F0]"
                        >
                          <MemoryImage
                            src={photo}
                            alt={`${city.name} history photo ${photoIndex + 1}`}
                            fit="cover"
                          />
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}

      {showMemory && !formOpen && (
        <button
          className="mt-4 flex w-full items-center gap-2 border-t border-dashed border-[#D8DDD8] pt-4 text-sm font-medium text-[#5A6670]/78 transition hover:text-[#A8C8DC]"
          type="button"
          onClick={() => setFormOpen(true)}
          disabled={!isAdmin}
        >
          <Plus className="h-4 w-4" />
          {isLit ? "Add memory" : "Add memory to light"}
        </button>
      )}

      <AnimatePresence initial={false}>
        {formOpen && (
          <motion.div
            key="memory-form"
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring}
          >
            <div className="mt-4 space-y-3 border-t border-dashed border-[#D8DDD8] pt-4">
              <label className="block">
                <span className="text-xs font-medium text-[#5A6670]/70">日期</span>
                <input
                  className="mt-1.5 w-full rounded-[6px] border border-[#D8DDD8] bg-[#FAFBF7] px-3 py-2 text-sm text-[#5A6670] placeholder:text-[#5A6670]/40 outline-none transition focus:border-[#E8B8C2]"
                  type="text"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  placeholder="2024.05.20"
                  inputMode="numeric"
                  maxLength={10}
                  aria-invalid={dateInvalid}
                  disabled={!isAdmin}
                />
                {dateInvalid && (
                  <span className="mt-1.5 block text-xs text-[#E8B8C2]">
                    请使用 2024.05.20 或 2024.5.20 格式
                  </span>
                )}
              </label>

              <label className="block">
                <span className="flex items-center justify-between gap-3 text-xs font-medium text-[#5A6670]/70">
                  一句话回忆
                  <span className="font-normal text-[#5A6670]/45">
                    {text.length}/{memoryTextMaxLength}
                  </span>
                </span>
                <textarea
                  className="mt-1.5 w-full resize-none rounded-[6px] border border-[#D8DDD8] bg-[#FAFBF7] px-3 py-2 text-sm leading-6 text-[#5A6670] placeholder:text-[#5A6670]/40 outline-none transition focus:border-[#E8B8C2]"
                  rows={3}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="写下这一刻……"
                  maxLength={memoryTextMaxLength}
                  disabled={!isAdmin}
                />
              </label>

              <div>
                <span className="text-xs font-medium text-[#5A6670]/70">照片</span>
                <input
                  ref={fileInputRef}
                  className="hidden"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePickFile}
                  disabled={!isAdmin}
                />
                <button
                  className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-[6px] border border-dashed border-[#D8DDD8] bg-[#FAFBF7] px-3 py-3 text-sm text-[#5A6670]/70 transition hover:border-[#E8B8C2] hover:text-[#E8B8C2]"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!isAdmin}
                >
                  {photoDrafts.length > 0 ? (
                    <span className="relative w-full">
                      <span className="grid grid-cols-4 gap-2">
                        {photoDrafts.slice(0, 8).map((photo, index) => (
                          <span
                            key={`${photo.previewUrl}-${index}`}
                            className="relative aspect-square overflow-hidden rounded-[4px] bg-[#D6E8F0]"
                          >
                            <LocalPrivacyImg
                              className="pixelated h-full w-full object-cover"
                              src={photo.previewUrl}
                              alt={photo.name || `照片预览 ${index + 1}`}
                            />
                          </span>
                        ))}
                      </span>
                      <span className="mt-2 block text-xs text-[#5A6670]/58">
                        已选择 {photoDrafts.length} 张
                      </span>
                      {isReadingPhoto && (
                        <span className="absolute inset-0 grid place-items-center bg-[#FAFBF7]/72 text-xs text-[#5A6670]/70">
                          读取中
                        </span>
                      )}
                    </span>
                  ) : (
                    <>
                      <ImagePlus className="h-4 w-4" />
                      选择本地图片，可多选
                    </>
                  )}
                </button>
                {photoError && (
                  <span className="mt-1.5 block text-xs text-[#E8B8C2]">{photoError}</span>
                )}
              </div>

              <div className="sticky bottom-0 -mx-5 flex items-center gap-2 border-t border-[#D8DDD8]/70 bg-[#FAFBF7]/96 px-5 pb-1 pt-3 shadow-[0_-10px_18px_rgba(250,251,247,0.88)] backdrop-blur">
                <button
                  className="flex-1 rounded-[6px] bg-[#F5DCE0] px-3 py-2 text-sm font-medium text-[#E8B8C2] transition hover:bg-[#E8B8C2] hover:text-[#FAFBF7] disabled:cursor-not-allowed disabled:opacity-45"
                  type="button"
                  onClick={handleSave}
                  disabled={!canSave}
                >
                  {isSaving ? "保存中" : isEditing ? "保存修改" : "保存回忆"}
                </button>
                <button
                  className="rounded-[6px] px-3 py-2 text-sm text-[#5A6670]/62 transition hover:bg-[#D8DDD8]/28 hover:text-[#5A6670]"
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    resetForm(true);
                    setFormOpen(false);
                  }}
                >
                  取消
                </button>
              </div>
              {saveError && <p className="text-xs text-[#E8B8C2]">{saveError}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

function MemoryImage({
  src,
  alt,
  dim = false,
  fit = "contain",
}: Readonly<{ src: string; alt: string; dim?: boolean; fit?: "contain" | "cover" }>) {
  const objectClass = fit === "cover" ? "object-cover" : "object-contain";
  const className = `pixelated h-full w-full ${objectClass} ${dim ? "opacity-50 grayscale" : ""}`;

  if (isBrowserImageUrl(src)) {
    return (
      <LocalPrivacyImg className={className} src={src} alt={alt} />
    );
  }

  return (
    <LocalPrivacyImage
      className={`pixelated ${objectClass} ${dim ? "opacity-50 grayscale" : ""}`}
      src={src}
      alt={alt}
      fill
      sizes="292px"
    />
  );
}

function LandmarkSprite({ city, lit }: Readonly<{ city: City; lit: boolean }>) {
  const className = `pixelated h-full w-full object-contain transition duration-500 ${
    lit
      ? "drop-shadow-[0_10px_18px_rgba(90,102,112,0.14)]"
      : "opacity-50 grayscale drop-shadow-[0_8px_14px_rgba(90,102,112,0.08)]"
  }`;

  if (isDataImageUrl(city.sprite)) {
    return (
      <LocalPrivacyImg className={className} src={city.sprite} alt={city.landmark} />
    );
  }

  return (
    <Image
      className={className}
      src={city.sprite}
      alt={city.landmark}
      fill
      loading="eager"
      sizes="112px"
      unoptimized
    />
  );
}
