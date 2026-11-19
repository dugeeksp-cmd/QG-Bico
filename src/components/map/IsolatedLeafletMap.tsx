import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  MapOccurrence,
  StoreUnit,
} from '../../types/radar';
import {
  computeCircleBounds,
  computeProjectionArea,
  getCountdownStatus,
  getOccurrencePhase,
} from '../../utils/geo';
import {
  getOccurrenceInnerHtml,
  getOccurrencePinHtml,
  getStorePinHtml,
} from '../icons/VehicleSvg';

export type MapVisualStyle = 'standard' | 'dark';

export interface MapAddingStateRefValue {
  isAddingVehicle: boolean;
  hasSightingTarget: boolean;
}

export interface PhasedOccurrenceEntry {
  occ: MapOccurrence;
  phaseInfo: ReturnType<typeof getOccurrencePhase>;
}

export interface IsolatedMapImperativeHandle {
  map: L.Map;
  gpsLayer: L.LayerGroup;
  openOccurrencePopup: (occId: string) => void;
  getStyleButtonEl: () => HTMLButtonElement | null;
}

interface IsolatedLeafletMapProps {
  mapStyle: MapVisualStyle;
  initialCenter: [number, number];
  initialStoresForBounds: StoreUnit[];
  initialLinkedStore: StoreUnit | null;
  stores: StoreUnit[];
  storeAlertMap: Map<string, MapOccurrence[]>;
  vehicles: PhasedOccurrenceEntry[];
  matchedTagsSet: Set<string>;
  canComplete: boolean;
  canMark: boolean;
  addingStateRef: React.MutableRefObject<MapAddingStateRefValue>;
  onMapAddClickRef: React.MutableRefObject<(lat: number, lng: number) => void>;
  onSightingClickRef: React.MutableRefObject<(lat: number, lng: number) => void>;
  onSelectStoreRef: React.MutableRefObject<(storeId: string) => void>;
  onStartSightingFromPopupRef: React.MutableRefObject<(occ: MapOccurrence) => void>;
  onDeleteOccurrenceRef: React.MutableRefObject<(id: string) => Promise<void>>;
  onToggleStyleMenuRef: React.MutableRefObject<() => void>;
  onGpsLocatedRef: React.MutableRefObject<
    (lat: number, lng: number, accuracy: number) => void
  >;
  onMapReadyRef: React.MutableRefObject<
    (handle: IsolatedMapImperativeHandle | null) => void
  >;
}

const STANDARD_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const DARK_TILE_URL =
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildOccurrencePopupHtml(
  occ: MapOccurrence,
  isMatchedTarget: boolean,
  canComplete: boolean,
  canSightUpdate: boolean,
  nowMs: number
): string {
  const lastUpdated = occ.lastUpdatedAt || occ.createdAt;
  const phaseInfo = getOccurrencePhase(lastUpdated, nowMs);
  const countdown = getCountdownStatus(
    lastUpdated,
    occ.expiresAt,
    occ.durationMinutes,
    nowMs
  );
  const mediaHtml = getOccurrenceInnerHtml({
    visualType: occ.visualType,
    vehicleIconKey: occ.vehicleIconKey,
    symbolKey: occ.symbolKey,
    emoji: occ.emoji,
    customImageDataUrl: occ.customImageDataUrl,
    colorHex: occ.colorHex,
    pulseEffect: occ.pulseEffect,
  });

  const tagHtml = occ.tag
    ? `<div style="margin-top:4px;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:800;color:#0F172A;letter-spacing:0.03em;">
         ID: ${escapeHtml(occ.tag)}
       </div>`
    : '';

  const matchedHtml = isMatchedTarget
    ? `<div style="margin-top:8px;padding:6px 9px;border-radius:8px;background:#FFFBEB;border:1px solid #FCD34D;color:#92400E;font-size:11px;font-weight:800;">
         Mesmo veículo/alvo identificado
       </div>`
    : '';

  let phaseBannerHtml = '';
  if (phaseInfo.phase === 'active') {
    const timerColor = countdown.isUrgent ? '#B91C1C' : '#1D4ED8';
    const timerBg = countdown.isUrgent ? '#FEF2F2' : '#EFF6FF';
    const timerBorder = countdown.isUrgent ? '#FECACA' : '#BFDBFE';
    phaseBannerHtml = `
      <div style="margin-top:10px;padding:8px 10px;border-radius:10px;background:${timerBg};border:1px solid ${timerBorder};color:${timerColor};display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <span style="font-size:11px;font-weight:700;">Atualizado ${escapeHtml(
          phaseInfo.elapsedLabel
        )}</span>
        <span data-countdown-box="${occ.id}" style="font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;font-weight:800;font-size:14px;">${countdown.formatted}</span>
      </div>
    `;
  } else if (phaseInfo.phase === 'shadow') {
    phaseBannerHtml = `
      <div style="margin-top:10px;padding:8px 10px;border-radius:10px;background:#F1F5F9;border:1px solid #CBD5E1;color:#334155;font-size:12px;font-weight:700;">
        Há ${phaseInfo.elapsedMinutes} min atrás este veículo estava aqui
      </div>
    `;
  } else {
    phaseBannerHtml = `
      <div style="margin-top:10px;padding:8px 10px;border-radius:10px;background:#FFFBEB;border:1px solid #FDE68A;color:#92400E;font-size:12px;font-weight:700;">
        Projeção de área provável (mais de 30 min sem atualização)
      </div>
    `;
  }

  const sightButtonHtml = canSightUpdate
    ? `<button
        type="button"
        data-sight-occurrence="${occ.id}"
        style="margin-top:10px;width:100%;min-height:42px;padding:0 10px;border-radius:10px;border:none;background:#1D4ED8;color:#FFFFFF;font-size:12px;font-weight:800;cursor:pointer;"
      >
        👁️ Eu vi! Atualizar ponto na rua
      </button>`
    : '';

  const completeButtonHtml = canComplete
    ? `<button
        type="button"
        data-complete-occurrence="${occ.id}"
        style="margin-top:8px;width:100%;min-height:40px;padding:0 10px;border-radius:10px;border:1px solid #FECACA;background:#DC2626;color:#FFFFFF;font-size:12px;font-weight:700;cursor:pointer;"
      >
        Confirmar Conclusão / Excluir Alerta
      </button>`
    : '';

  return `
    <div style="padding:14px;min-width:244px;max-width:290px;font-family:'DM Sans',system-ui,sans-serif;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:52px;height:52px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;padding:6px;flex-shrink:0;overflow:hidden;">
          ${mediaHtml}
        </div>
        <div style="min-width:0;flex:1;">
          <div style="font-family:'Plus Jakarta Sans',system-ui,sans-serif;font-weight:800;font-size:15px;line-height:1.25;color:#0F172A;word-break:break-word;">
            ${escapeHtml(occ.subcategoryName)}
          </div>
          <div style="font-size:11px;color:#64748B;font-weight:600;margin-top:2px;">
            ${escapeHtml(occ.categoryName)} · ${escapeHtml(phaseInfo.elapsedLabel)}
          </div>
          ${tagHtml}
        </div>
      </div>

      ${matchedHtml}
      ${phaseBannerHtml}
      ${sightButtonHtml}
      ${completeButtonHtml}
    </div>
  `;
}

const IsolatedLeafletMapInner: React.FC<IsolatedLeafletMapProps> = ({
  mapStyle,
  initialCenter,
  initialStoresForBounds,
  initialLinkedStore,
  stores,
  storeAlertMap,
  vehicles,
  matchedTagsSet,
  canComplete,
  canMark,
  addingStateRef,
  onMapAddClickRef,
  onSightingClickRef,
  onSelectStoreRef,
  onStartSightingFromPopupRef,
  onDeleteOccurrenceRef,
  onToggleStyleMenuRef,
  onGpsLocatedRef,
  onMapReadyRef,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const activeStyleRef = useRef<MapVisualStyle>('standard');
  const styleBtnRef = useRef<HTMLButtonElement | null>(null);
  const storesLayerRef = useRef<L.LayerGroup | null>(null);
  const vehiclesLayerRef = useRef<L.LayerGroup | null>(null);
  const gpsLayerRef = useRef<L.LayerGroup | null>(null);
  const vehicleRefsById = useRef<Map<string, L.Marker>>(new Map());
  const openPopupOccIdRef = useRef<string | null>(null);
  const lastSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const tapTimerRef = useRef<number | null>(null);

  // Montagem única do mapa Leaflet + listener único via addingStateRef
  useEffect(() => {
    const containerEl = mapContainerRef.current;
    if (!containerEl || mapInstanceRef.current) return;

    const map = L.map(containerEl, {
      center: initialCenter,
      zoom: 14,
      minZoom: 4,
      maxZoom: 19,
      zoomControl: false,
      doubleClickZoom: false,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    const StyleToggleControl = L.Control.extend({
      options: { position: 'topright' as L.ControlPosition },
      onAdd: () => {
        const ctrlContainer = L.DomUtil.create(
          'div',
          'leaflet-bar leaflet-control radar-style-control'
        );
        const btn = L.DomUtil.create(
          'button',
          'radar-style-toggle-btn',
          ctrlContainer
        ) as HTMLButtonElement;
        btn.type = 'button';
        btn.title = 'Escolher estilo do mapa (Padrão / Escuro Limpo)';
        btn.setAttribute('aria-label', 'Escolher estilo do mapa');
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`;
        L.DomEvent.disableClickPropagation(ctrlContainer);
        L.DomEvent.disableScrollPropagation(ctrlContainer);
        btn.onclick = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          onToggleStyleMenuRef.current();
        };
        styleBtnRef.current = btn;
        return ctrlContainer;
      },
    });
    new StyleToggleControl().addTo(map);

    const tileLayer = L.tileLayer(STANDARD_TILE_URL, {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    tileLayerRef.current = tileLayer;
    activeStyleRef.current = 'standard';

    const storesLayer = L.layerGroup().addTo(map);
    const vehiclesLayer = L.layerGroup().addTo(map);
    const gpsLayer = L.layerGroup().addTo(map);

    if (initialStoresForBounds.length > 1 && !initialLinkedStore) {
      const groupBounds = L.latLngBounds(
        initialStoresForBounds.map((s) => L.latLng(s.lat, s.lng))
      ).pad(0.28);
      map.fitBounds(groupBounds, { padding: [32, 32], maxZoom: 14 });
    } else if (initialLinkedStore || initialStoresForBounds[0]) {
      const refStore = initialLinkedStore || initialStoresForBounds[0];
      map.fitBounds(
        computeCircleBounds(refStore.lat, refStore.lng, refStore.radiusKm),
        { padding: [24, 24], maxZoom: 15 }
      );
    }

    // Listener único: lê addingStateRef.current sem causar re-render do mapa
    map.on('click', (e: L.LeafletMouseEvent) => {
      const state = addingStateRef.current;

      if (state.hasSightingTarget) {
        if (tapTimerRef.current) {
          window.clearTimeout(tapTimerRef.current);
          tapTimerRef.current = null;
        }
        onSightingClickRef.current(e.latlng.lat, e.latlng.lng);
        return;
      }

      if (state.isAddingVehicle) {
        if (tapTimerRef.current) {
          window.clearTimeout(tapTimerRef.current);
          tapTimerRef.current = null;
        }
        onMapAddClickRef.current(e.latlng.lat, e.latlng.lng);
        return;
      }

      if (tapTimerRef.current) {
        window.clearTimeout(tapTimerRef.current);
      }
      const tapLatLng = e.latlng;
      tapTimerRef.current = window.setTimeout(() => {
        tapTimerRef.current = null;
        const nextZoom = Math.min(map.getMaxZoom(), map.getZoom() + 1);
        map.setZoomAround(tapLatLng, nextZoom, { animate: true });
      }, 240);
    });

    map.on('dblclick', (e: L.LeafletMouseEvent) => {
      if (tapTimerRef.current) {
        window.clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      const state = addingStateRef.current;
      if (state.hasSightingTarget || state.isAddingVehicle) {
        return;
      }
      const nextZoom = Math.max(map.getMinZoom(), map.getZoom() - 1);
      map.setZoomAround(e.latlng, nextZoom, { animate: true });
    });

    map.on('popupclose', () => {
      openPopupOccIdRef.current = null;
    });

    mapInstanceRef.current = map;
    storesLayerRef.current = storesLayer;
    vehiclesLayerRef.current = vehiclesLayer;
    gpsLayerRef.current = gpsLayer;

    onMapReadyRef.current({
      map,
      gpsLayer,
      openOccurrencePopup: (occId: string) => {
        const marker = vehicleRefsById.current.get(occId);
        marker?.openPopup();
      },
      getStyleButtonEl: () => styleBtnRef.current,
    });

    const invalidateIfChanged = () => {
      const el = mapContainerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w <= 0 || h <= 0) return;
      if (
        Math.abs(w - lastSizeRef.current.w) > 1 ||
        Math.abs(h - lastSizeRef.current.h) > 1
      ) {
        lastSizeRef.current = { w, h };
        map.invalidateSize({ pan: false, animate: false });
      }
    };

    invalidateIfChanged();
    window.addEventListener('resize', invalidateIfChanged);
    window.visualViewport?.addEventListener('resize', invalidateIfChanged);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        window.requestAnimationFrame(invalidateIfChanged);
      });
      resizeObserver.observe(containerEl);
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!mapInstanceRef.current) return;
          const { latitude, longitude, accuracy } = pos.coords;
          onGpsLocatedRef.current(latitude, longitude, accuracy);
          mapInstanceRef.current.setView([latitude, longitude], 15, {
            animate: true,
          });
        },
        () => {
          // Mantém centro padrão caso GPS indisponível
        },
        { enableHighAccuracy: true, timeout: 7000, maximumAge: 15000 }
      );
    }

    return () => {
      window.removeEventListener('resize', invalidateIfChanged);
      window.visualViewport?.removeEventListener('resize', invalidateIfChanged);
      resizeObserver?.disconnect();
      if (tapTimerRef.current) {
        window.clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      onMapReadyRef.current(null);
      map.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
      activeStyleRef.current = 'standard';
      lastSizeRef.current = { w: 0, h: 0 };
      styleBtnRef.current = null;
      storesLayerRef.current = null;
      vehiclesLayerRef.current = null;
      gpsLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atualização segura de estilo via tileLayerRef.current.setUrl (sem destruir camada nem tiles)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const tileLayer = tileLayerRef.current;
    if (!map || !tileLayer || activeStyleRef.current === mapStyle) return;

    const container = map.getContainer();
    if (mapStyle === 'dark') {
      tileLayer.options.subdomains = ['a', 'b', 'c', 'd'];
      tileLayer.setUrl(DARK_TILE_URL);
      container.classList.add('radar-map-clean-blue');
    } else {
      tileLayer.options.subdomains = ['a', 'b', 'c'];
      tileLayer.setUrl(STANDARD_TILE_URL);
      container.classList.remove('radar-map-clean-blue');
    }

    activeStyleRef.current = mapStyle;
  }, [mapStyle]);

  // Camada de Lojas Fixas + Perímetros (não toca no TileLayer)
  useEffect(() => {
    const layer = storesLayerRef.current;
    if (!layer) return;

    layer.clearLayers();

    stores.forEach((store) => {
      const insideList = storeAlertMap.get(store.id) || [];
      const isAlerting = insideList.length > 0;
      const isOpen = store.isOpen;

      const circleColor = isAlerting
        ? '#DC2626'
        : isOpen
        ? '#059669'
        : '#64748B';
      const circleFill = isAlerting
        ? '#EF4444'
        : isOpen
        ? '#10B981'
        : '#94A3B8';

      L.circle([store.lat, store.lng], {
        radius: store.radiusKm * 1000,
        color: circleColor,
        weight: isAlerting ? 3 : isOpen ? 2.2 : 1.5,
        dashArray: isAlerting ? '8 6' : isOpen ? '7 7' : '5 7',
        fillColor: circleFill,
        fillOpacity: isAlerting ? 0.16 : isOpen ? 0.09 : 0.04,
        className: isAlerting ? 'radar-circle-alert' : '',
        interactive: false,
      }).addTo(layer);

      const storeIcon = L.divIcon({
        className: 'radar-store-pin',
        html: getStorePinHtml(isAlerting, insideList.length, isOpen),
        iconSize: [44, 48],
        iconAnchor: [22, 46],
        popupAnchor: [0, -44],
      });

      const marker = L.marker([store.lat, store.lng], {
        icon: storeIcon,
        zIndexOffset: 300,
      });

      marker.on('click', () => {
        onSelectStoreRef.current(store.id);
      });

      marker.addTo(layer);
    });
  }, [stores, storeAlertMap, onSelectStoreRef]);

  // Camada de Veículos / Ocorrências (não toca no TileLayer)
  useEffect(() => {
    const layer = vehiclesLayerRef.current;
    if (!layer) return;

    const previouslyOpenId = openPopupOccIdRef.current;
    layer.clearLayers();
    vehicleRefsById.current.clear();

    const activeByTag = new Map<string, MapOccurrence[]>();
    vehicles.forEach(({ occ, phaseInfo }) => {
      if (phaseInfo.phase !== 'active') return;
      const norm = occ.tag?.trim().toUpperCase();
      if (!norm) return;
      const group = activeByTag.get(norm) || [];
      group.push(occ);
      activeByTag.set(norm, group);
    });

    activeByTag.forEach((group) => {
      if (group.length < 2) return;
      const sorted = [...group].sort((a, b) => a.createdAt - b.createdAt);
      L.polyline(
        sorted.map((o) => [o.lat, o.lng] as [number, number]),
        {
          color: '#D97706',
          weight: 2.5,
          dashArray: '6 6',
          opacity: 0.75,
          interactive: false,
        }
      ).addTo(layer);
    });

    vehicles.forEach(({ occ, phaseInfo }) => {
      const normTag = occ.tag?.trim().toUpperCase();
      const isMatchedTarget = Boolean(normTag && matchedTagsSet.has(normTag));

      if (occ.trailPoints && occ.trailPoints.length >= 2) {
        L.polyline(
          occ.trailPoints.map((pt) => [pt.lat, pt.lng] as [number, number]),
          {
            color: phaseInfo.phase === 'active' ? '#1D4ED8' : '#64748B',
            weight: 3.5,
            dashArray: '6 7',
            opacity: phaseInfo.phase === 'active' ? 0.9 : 0.55,
            interactive: false,
          }
        ).addTo(layer);

        occ.trailPoints.slice(0, -1).forEach((pt) => {
          L.circleMarker([pt.lat, pt.lng], {
            radius: 4.5,
            color: '#FFFFFF',
            weight: 2,
            fillColor: phaseInfo.phase === 'active' ? '#1D4ED8' : '#64748B',
            fillOpacity: 0.8,
            interactive: false,
          }).addTo(layer);
        });
      }

      if (phaseInfo.phase === 'projection') {
        const proj = computeProjectionArea(
          occ.lat,
          occ.lng,
          occ.trailPoints,
          phaseInfo.elapsedMinutes
        );

        L.circle([proj.centerLat, proj.centerLng], {
          radius: proj.radiusMeters,
          color: '#D97706',
          weight: 2,
          dashArray: '8 8',
          fillColor: '#F59E0B',
          fillOpacity: 0.1,
          interactive: false,
        }).addTo(layer);

        if (proj.centerLat !== occ.lat || proj.centerLng !== occ.lng) {
          L.polyline(
            [
              [occ.lat, occ.lng],
              [proj.centerLat, proj.centerLng],
            ],
            {
              color: '#D97706',
              weight: 2,
              dashArray: '4 6',
              opacity: 0.75,
              interactive: false,
            }
          ).addTo(layer);
        }

        const projIcon = L.divIcon({
          className: 'radar-vehicle-pin',
          html: getOccurrencePinHtml(
            {
              visualType: occ.visualType,
              vehicleIconKey: occ.vehicleIconKey,
              symbolKey: occ.symbolKey,
              emoji: occ.emoji,
              customImageDataUrl: occ.customImageDataUrl,
              colorHex: occ.colorHex,
              pulseEffect: false,
            },
            true,
            false,
            occ.tag,
            true
          ),
          iconSize: [46, 52],
          iconAnchor: [23, 50],
          popupAnchor: [0, -48],
        });

        const projMarker = L.marker([proj.centerLat, proj.centerLng], {
          icon: projIcon,
          zIndexOffset: 380,
        });

        projMarker.bindPopup(
          () =>
            buildOccurrencePopupHtml(
              occ,
              false,
              canComplete,
              canMark,
              Date.now()
            ),
          {
            closeButton: true,
            autoPanPadding: [24, 24],
          }
        );

        projMarker.on('popupopen', (e) => {
          openPopupOccIdRef.current = occ.id;
          const popupEl = e.popup.getElement();
          if (!popupEl) return;
          const sightBtn = popupEl.querySelector(
            `[data-sight-occurrence="${occ.id}"]`
          ) as HTMLButtonElement | null;
          if (sightBtn) {
            sightBtn.onclick = () => {
              projMarker.closePopup();
              onStartSightingFromPopupRef.current(occ);
            };
          }
          const completeBtn = popupEl.querySelector(
            `[data-complete-occurrence="${occ.id}"]`
          ) as HTMLButtonElement | null;
          if (completeBtn) {
            completeBtn.onclick = () => {
              void onDeleteOccurrenceRef.current(occ.id);
            };
          }
        });

        projMarker.addTo(layer);
        vehicleRefsById.current.set(occ.id, projMarker);
        return;
      }

      const isShadow = phaseInfo.phase === 'shadow';
      const icon = L.divIcon({
        className: 'radar-vehicle-pin',
        html: getOccurrencePinHtml(
          {
            visualType: occ.visualType,
            vehicleIconKey: occ.vehicleIconKey,
            symbolKey: occ.symbolKey,
            emoji: occ.emoji,
            customImageDataUrl: occ.customImageDataUrl,
            colorHex: occ.colorHex,
            pulseEffect: occ.pulseEffect,
          },
          isShadow,
          isMatchedTarget,
          occ.tag,
          isShadow
        ),
        iconSize: [46, 52],
        iconAnchor: [23, 50],
        popupAnchor: [0, -48],
      });

      const leafletMarker = L.marker([occ.lat, occ.lng], {
        icon,
        zIndexOffset: isShadow
          ? 390
          : occ.pulseEffect
          ? 600
          : isMatchedTarget
          ? 520
          : 450,
      });

      leafletMarker.bindPopup(
        () =>
          buildOccurrencePopupHtml(
            occ,
            isMatchedTarget,
            canComplete,
            canMark,
            Date.now()
          ),
        {
          closeButton: true,
          autoPanPadding: [24, 24],
        }
      );

      leafletMarker.on('popupopen', (e) => {
        openPopupOccIdRef.current = occ.id;
        const popupEl = e.popup.getElement();
        if (!popupEl) return;

        const sightBtn = popupEl.querySelector(
          `[data-sight-occurrence="${occ.id}"]`
        ) as HTMLButtonElement | null;
        if (sightBtn) {
          sightBtn.onclick = () => {
            leafletMarker.closePopup();
            onStartSightingFromPopupRef.current(occ);
          };
        }

        const completeBtn = popupEl.querySelector(
          `[data-complete-occurrence="${occ.id}"]`
        ) as HTMLButtonElement | null;
        if (completeBtn && canComplete) {
          completeBtn.onclick = () => {
            void onDeleteOccurrenceRef.current(occ.id);
          };
        }
      });

      leafletMarker.addTo(layer);
      vehicleRefsById.current.set(occ.id, leafletMarker);

      if (previouslyOpenId === occ.id) {
        leafletMarker.openPopup();
      }
    });
  }, [
    vehicles,
    matchedTagsSet,
    canComplete,
    canMark,
    onDeleteOccurrenceRef,
    onStartSightingFromPopupRef,
  ]);

  // Container único, nunca desmontado, nunca altera className/key/tamanho
  return (
    <div
      id="map"
      ref={mapContainerRef}
      className="radar-leaflet-root"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
      }}
      aria-label="Mapa compartilhado de unidades e ocorrências"
    />
  );
};

export const IsolatedLeafletMap = React.memo(IsolatedLeafletMapInner);
