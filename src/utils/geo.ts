import L from 'leaflet';

const EARTH_RADIUS_METERS = 6371000;
export const MAX_STOPWATCH_SECONDS = 1200; // 20 minutos

export function getDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

export function isInsidePerimeter(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  radiusKm: number
): boolean {
  const distanceMeters = getDistanceMeters(lat, lng, centerLat, centerLng);
  return distanceMeters <= radiusKm * 1000;
}

export function computeCircleBounds(
  centerLat: number,
  centerLng: number,
  radiusKm: number
): L.LatLngBounds {
  const radiusMeters = Math.max(radiusKm, 0.2) * 1000;
  const latDelta = (radiusMeters / EARTH_RADIUS_METERS) * (180 / Math.PI);
  const lngDelta =
    latDelta / Math.max(Math.cos((centerLat * Math.PI) / 180), 0.1);

  const southWest = L.latLng(centerLat - latDelta, centerLng - lngDelta);
  const northEast = L.latLng(centerLat + latDelta, centerLng + lngDelta);
  return L.latLngBounds(southWest, northEast);
}

export function computeMinZoomForRadius(radiusKm: number): number {
  if (radiusKm <= 1) return 13;
  if (radiusKm <= 2.5) return 12;
  if (radiusKm <= 6) return 11;
  if (radiusKm <= 15) return 10;
  return 9;
}

export interface StopwatchStatus {
  elapsedSeconds: number;
  isExpired: boolean;
  label: string;
  shortLabel: string;
}

export function getStopwatchStatus(
  createdAt: number,
  nowMs: number = Date.now()
): StopwatchStatus {
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - createdAt) / 1000));
  if (elapsedSeconds >= MAX_STOPWATCH_SECONDS) {
    return {
      elapsedSeconds: MAX_STOPWATCH_SECONDS,
      isExpired: true,
      label: '20 minutos +',
      shortLabel: '20m +',
    };
  }

  const mins = Math.floor(elapsedSeconds / 60);
  const secs = elapsedSeconds % 60;
  const paddedSecs = secs.toString().padStart(2, '0');

  return {
    elapsedSeconds,
    isExpired: false,
    label: `Encontrado há ${mins} min ${paddedSecs} seg`,
    shortLabel: `${mins}m ${paddedSecs}s`,
  };
}

export interface CountdownStatus {
  remainingSeconds: number;
  isExpired: boolean;
  isUrgent: boolean;
  formatted: string; // Ex: 20:00 -> 00:00
}

export const OCCURRENCE_ACTIVE_MS = 20 * 60 * 1000; // 20 minutos (Fase 1)
export const OCCURRENCE_SHADOW_MAX_MS = 30 * 60 * 1000; // 30 minutos (Fase 2)
export const OCCURRENCE_MAX_LIFE_MS = 60 * 60 * 1000; // 60 minutos (Fase 3 -> desaparece)

export type OccurrencePhase = 'active' | 'shadow' | 'projection' | 'expired';

export interface OccurrencePhaseInfo {
  phase: OccurrencePhase;
  elapsedMs: number;
  elapsedMinutes: number;
  elapsedLabel: string;
}

export function getOccurrencePhase(
  lastUpdatedAt: number,
  nowMs: number = Date.now()
): OccurrencePhaseInfo {
  const elapsedMs = Math.max(0, nowMs - lastUpdatedAt);
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  const elapsedLabel =
    elapsedMinutes < 1 ? 'agora' : `há ${elapsedMinutes} min`;

  if (elapsedMs < OCCURRENCE_ACTIVE_MS) {
    return { phase: 'active', elapsedMs, elapsedMinutes, elapsedLabel };
  }
  if (elapsedMs < OCCURRENCE_SHADOW_MAX_MS) {
    return { phase: 'shadow', elapsedMs, elapsedMinutes, elapsedLabel };
  }
  if (elapsedMs < OCCURRENCE_MAX_LIFE_MS) {
    return { phase: 'projection', elapsedMs, elapsedMinutes, elapsedLabel };
  }
  return { phase: 'expired', elapsedMs, elapsedMinutes, elapsedLabel };
}

export function computeProjectionArea(
  lat: number,
  lng: number,
  trailPoints?: Array<{ lat: number; lng: number }>,
  elapsedMinutes: number = 35
): { centerLat: number; centerLng: number; radiusMeters: number } {
  const extraMins = Math.max(0, Math.min(30, elapsedMinutes - 30));
  const radiusMeters = 380 + extraMins * 14; // 380m a 800m de raio suave

  if (!trailPoints || trailPoints.length < 2) {
    return { centerLat: lat, centerLng: lng, radiusMeters };
  }

  const prev = trailPoints[trailPoints.length - 2];
  const curr = trailPoints[trailPoints.length - 1];
  const dLat = curr.lat - prev.lat;
  const dLng = curr.lng - prev.lng;
  const mag = Math.sqrt(dLat * dLat + dLng * dLng);

  if (mag < 0.00005) {
    return { centerLat: lat, centerLng: lng, radiusMeters };
  }

  // Desloca levemente o centro da projeção na direção do último rastro conhecido (~220m a 420m)
  const shiftDegrees = 0.0022 + (extraMins / 30) * 0.0018;
  return {
    centerLat: curr.lat + (dLat / mag) * shiftDegrees,
    centerLng: curr.lng + (dLng / mag) * shiftDegrees,
    radiusMeters,
  };
}

export function getCountdownStatus(
  createdAt: number,
  expiresAt?: number,
  durationMinutes: number = 20,
  nowMs: number = Date.now()
): CountdownStatus {
  const totalSeconds = Math.max(60, Math.round(durationMinutes * 60));
  const targetEnd = expiresAt ?? createdAt + totalSeconds * 1000;
  const remainingMs = Math.max(0, targetEnd - nowMs);
  const remainingSeconds = Math.min(
    totalSeconds,
    Math.max(0, Math.ceil(remainingMs / 1000))
  );
  const isExpired = remainingMs <= 0;
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const formatted = `${mins.toString().padStart(2, '0')}:${secs
    .toString()
    .padStart(2, '0')}`;

  return {
    remainingSeconds,
    isExpired,
    isUrgent: remainingSeconds <= 120,
    formatted,
  };
}

export function formatTimeOfDay(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatRelativeDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const startOfTarget = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ).getTime();
  const diffDays = Math.round((startOfToday - startOfTarget) / 86400000);

  const timeStr = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  if (diffDays === 0) {
    return `Hoje · ${timeStr}`;
  }
  if (diffDays === 1) {
    return `Ontem · ${timeStr}`;
  }

  const dateStr = date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return `${dateStr} · ${timeStr}`;
}

export function formatCurrencyBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function formatDistanceLabel(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

export async function resizeImageToDataUrl(
  file: File,
  maxSize: number = 220,
  quality: number = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo de imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagem inválido.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Contexto Canvas indisponível.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
