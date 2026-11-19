import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Building2,
  Crosshair,
  Eye,
  Ghost,
  Layers,
  ListFilter,
  Lock,
  Mail,
  MapPin,
  Navigation,
  Plus,
  Power,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import {
  AlertAuditEntry,
  CatalogCategory,
  CatalogSubcategory,
  MapOccurrence,
  StoreUnit,
  UserAccount,
} from '../../types/radar';
import {
  computeCircleBounds,
  computeProjectionArea,
  formatDistanceLabel,
  getCountdownStatus,
  getDistanceMeters,
  getOccurrencePhase,
} from '../../utils/geo';
import { hasPermission, isUserLinkedToStore } from '../../utils/rbac';
import {
  getOccurrenceInnerHtml,
  getOccurrencePinHtml,
  getStorePinHtml,
  OccurrenceAvatar,
} from '../icons/VehicleSvg';
import { OccurrencePickerModal } from './OccurrencePickerModal';
import { StoreInfoCardModal } from './StoreInfoCardModal';
import { NearbyAlertItem, NearbyAlertsModal } from './NearbyAlertsModal';

const DEFAULT_SP_CENTER: [number, number] = [-23.5878, -46.7525];

interface SharedRadarMapViewProps {
  isMapVisible?: boolean;
  currentUser: UserAccount;
  users: UserAccount[];
  stores: StoreUnit[];
  activeLinkedStore: StoreUnit | null;
  categories: CatalogCategory[];
  subcategories: CatalogSubcategory[];
  occurrences: MapOccurrence[];
  alertAudit: AlertAuditEntry[];
  unreadChatCount: number;
  focusOccurrenceId: string | null;
  focusStoreId: string | null;
  centerGpsSignal: number;
  onFocusHandled: () => void;
  onAddOccurrence: (
    category: CatalogCategory,
    subcategory: CatalogSubcategory,
    lat: number,
    lng: number,
    tag?: string
  ) => Promise<MapOccurrence>;
  onUpdateOccurrenceSighting: (
    occurrenceId: string,
    lat: number,
    lng: number
  ) => Promise<MapOccurrence>;
  onDismissOccurrenceAlert: (occurrenceId: string) => Promise<void>;
  onMarkBellAlertRead: (occurrenceId: string) => Promise<void>;
  onOpenChatModal: () => void;
  onDeleteOccurrence: (id: string) => Promise<void>;
  onToggleStoreOpen: (storeId: string, nextOpen: boolean) => Promise<void>;
  onRequestCloseStore: (store: StoreUnit) => void;
  onOpenStoreOptions?: (store: StoreUnit) => void;
}

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

export const SharedRadarMapView: React.FC<SharedRadarMapViewProps> = ({
  isMapVisible = true,
  currentUser,
  users,
  stores,
  activeLinkedStore,
  categories,
  subcategories,
  occurrences,
  alertAudit,
  unreadChatCount,
  focusOccurrenceId,
  focusStoreId,
  centerGpsSignal,
  onFocusHandled,
  onAddOccurrence,
  onUpdateOccurrenceSighting,
  onDismissOccurrenceAlert,
  onMarkBellAlertRead,
  onOpenChatModal,
  onDeleteOccurrence,
  onToggleStoreOpen,
  onRequestCloseStore,
  onOpenStoreOptions,
}) => {
  const canViewMap = hasPermission(currentUser, 'canViewMap');
  const canMark = hasPermission(currentUser, 'canMarkOccurrences');
  const canComplete = hasPermission(currentUser, 'canCompleteOccurrences');
  const canOpenClose = hasPermission(currentUser, 'canOpenCloseStore');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const defaultTileLayerRef = useRef<L.TileLayer | null>(null);
  const cleanBlueTileLayerRef = useRef<L.TileLayer | null>(null);
  const activeStyleRef = useRef<'default' | 'clean_blue'>('default');
  const lastContainerSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const wasMapVisibleRef = useRef<boolean>(isMapVisible);
  const styleBtnRef = useRef<HTMLButtonElement | null>(null);
  const stylePopoverRef = useRef<HTMLDivElement | null>(null);
  const storesLayerRef = useRef<L.LayerGroup | null>(null);
  const occurrencesLayerRef = useRef<L.LayerGroup | null>(null);
  const occurrenceRefsById = useRef<Map<string, L.Marker>>(new Map());
  const storeRefsById = useRef<Map<string, L.Marker>>(new Map());
  const userGpsLayerRef = useRef<L.LayerGroup | null>(null);
  const occurrencesRef = useRef<MapOccurrence[]>(occurrences);
  const openPopupOccIdRef = useRef<string | null>(null);
  const lastGpsCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const tapTimerRef = useRef<number | null>(null);

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [mapStyle, setMapStyle] = useState<'default' | 'clean_blue'>('default');
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const [quickBarOpen, setQuickBarOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [showLastHour, setShowLastHour] = useState(false);

  // Modo direto no mapa: usuário escolheu um tipo na barra rápida ou em "Outros"
  const [pendingMapPointDraft, setPendingMapPointDraft] = useState<{
    category: CatalogCategory;
    subcategory: CatalogSubcategory;
    tag?: string;
  } | null>(null);

  // Modo controlado 2: usuário clicou em "👁️ Eu vi!" para atualizar ponto exato na rua
  const [sightingTargetOcc, setSightingTargetOcc] =
    useState<MapOccurrence | null>(null);

  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sidebarTab, setSidebarTab] = useState<'occurrences' | 'stores'>(
    'occurrences'
  );
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [openingStore, setOpeningStore] = useState(false);
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    tone: 'info' | 'warn';
  } | null>(null);

  const pendingMapPointDraftRef = useRef(pendingMapPointDraft);
  pendingMapPointDraftRef.current = pendingMapPointDraft;
  const sightingTargetOccRef = useRef(sightingTargetOcc);
  sightingTargetOccRef.current = sightingTargetOcc;

  occurrencesRef.current = occurrences;

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 4500);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  // Fecha o popover de seleção de estilo do mapa ao clicar fora
  useEffect(() => {
    if (!styleMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (stylePopoverRef.current?.contains(target)) return;
      if (styleBtnRef.current?.contains(target)) return;
      setStyleMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [styleMenuOpen]);

  // Categoria Principal definida por Super Admin / Presidente
  const primaryCategory = useMemo(
    () =>
      categories.find((c) => c.isPrimary) ||
      categories.find((c) => c.id === 'cat-carro') ||
      categories[0] ||
      null,
    [categories]
  );

  // Até 3 tipos principais fixados para a barra rápida do mapa (configurados pelo Super Admin)
  const quickPinSubcategories = useMemo(() => {
    const pinned = subcategories
      .filter((s) => Boolean(s.isQuickPin))
      .sort((a, b) => (a.quickPinOrder || 99) - (b.quickPinOrder || 99));
    if (pinned.length >= 3) return pinned.slice(0, 3);

    const pickedIds = new Set(pinned.map((s) => s.id));
    const fallbackOrder = ['sub-veh-pm', 'sub-veh-policia_civil', 'sub-veh-gcm'];
    const result = [...pinned];

    fallbackOrder.forEach((fid) => {
      if (result.length >= 3 || pickedIds.has(fid)) return;
      const found = subcategories.find((s) => s.id === fid);
      if (found) {
        result.push(found);
        pickedIds.add(found.id);
      }
    });

    if (result.length < 3 && primaryCategory) {
      subcategories
        .filter((s) => s.categoryId === primaryCategory.id && !pickedIds.has(s.id))
        .forEach((s) => {
          if (result.length < 3) {
            result.push(s);
            pickedIds.add(s.id);
          }
        });
    }

    if (result.length < 3) {
      subcategories
        .filter((s) => !pickedIds.has(s.id))
        .forEach((s) => {
          if (result.length < 3) {
            result.push(s);
            pickedIds.add(s.id);
          }
        });
    }

    return result.slice(0, 3);
  }, [subcategories, primaryCategory]);

  // Classifica ocorrências por fase (Ativo 0-20m, Sombra 20-30m, Projeção 30-60m)
  const phasedOccurrences = useMemo(() => {
    return occurrences
      .map((occ) => ({
        occ,
        phaseInfo: getOccurrencePhase(occ.lastUpdatedAt || occ.createdAt, nowMs),
      }))
      .filter((item) => item.phaseInfo.phase !== 'expired');
  }, [occurrences, nowMs]);

  const activePhaseOccurrences = useMemo(
    () =>
      phasedOccurrences
        .filter((i) => i.phaseInfo.phase === 'active')
        .map((i) => i.occ),
    [phasedOccurrences]
  );

  const lastHourArchiveCount = useMemo(
    () =>
      phasedOccurrences.filter(
        (i) =>
          i.phaseInfo.phase === 'shadow' || i.phaseInfo.phase === 'projection'
      ).length,
    [phasedOccurrences]
  );

  // Lojas diretamente vinculadas ao usuário logado (para pop-up persistente e campainha raio + 5km)
  const userLinkedStores = useMemo(
    () => stores.filter((s) => isUserLinkedToStore(currentUser.id, s)),
    [stores, currentUser.id]
  );

  // Notificações direcionadas na campainha: APENAS pinos ainda ativos/visíveis no mapa (0-60 min) dentro de (raio + 5 km) e NÃO marcados como lidos pelo usuário
  const nearbyAlerts: NearbyAlertItem[] = useMemo(() => {
    if (userLinkedStores.length === 0) return [];
    const results: NearbyAlertItem[] = [];
    phasedOccurrences.forEach(({ occ }) => {
      if (occ.bellReadByUserIds?.includes(currentUser.id)) return;
      let bestMatch: { store: StoreUnit; dist: number } | null = null;
      userLinkedStores.forEach((st) => {
        const dist = getDistanceMeters(occ.lat, occ.lng, st.lat, st.lng);
        const maxDistMeters = (st.radiusKm + 5) * 1000;
        if (dist <= maxDistMeters) {
          if (!bestMatch || dist < bestMatch.dist) {
            bestMatch = { store: st, dist };
          }
        }
      });
      if (bestMatch) {
        results.push({
          occurrence: occ,
          nearestStore: (bestMatch as { store: StoreUnit; dist: number }).store,
          distanceMeters: (bestMatch as { store: StoreUnit; dist: number }).dist,
        });
      }
    });
    return results.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }, [userLinkedStores, phasedOccurrences, currentUser.id]);

  // Pop-up persistente: ocorrências ativas DENTRO do raio da(s) loja(s) vinculada(s) e não dispensadas pelo usuário
  const pendingRadiusAlert = useMemo(() => {
    if (userLinkedStores.length === 0) return null;
    for (const occ of activePhaseOccurrences) {
      if (occ.dismissedByUserIds?.includes(currentUser.id)) continue;
      const hitStore = userLinkedStores.find(
        (st) =>
          getDistanceMeters(occ.lat, occ.lng, st.lat, st.lng) <=
          st.radiusKm * 1000
      );
      if (hitStore) {
        return { occ, store: hitStore };
      }
    }
    return null;
  }, [userLinkedStores, activePhaseOccurrences, currentUser.id]);

  // Atualiza cronômetro regressivo dentro do popup aberto em tempo real
  useEffect(() => {
    const openId = openPopupOccIdRef.current;
    if (!openId) return;
    const occ = occurrencesRef.current.find((o) => o.id === openId);
    if (!occ) return;
    const el = document.querySelector(
      `[data-countdown-box="${openId}"]`
    ) as HTMLElement | null;
    if (!el) return;
    const countdown = getCountdownStatus(
      occ.lastUpdatedAt || occ.createdAt,
      occ.expiresAt,
      occ.durationMinutes,
      nowMs
    );
    el.textContent = countdown.formatted;
  }, [nowMs]);

  const drawGpsMarker = useCallback(
    (lat: number, lng: number, accuracy: number) => {
      const gpsLayer = userGpsLayerRef.current;
      if (!gpsLayer) return;
      gpsLayer.clearLayers();
      L.circle([lat, lng], {
        radius: Math.min(accuracy || 60, 150),
        color: '#2563EB',
        weight: 1.5,
        fillColor: '#3B82F6',
        fillOpacity: 0.14,
        interactive: false,
      }).addTo(gpsLayer);

      L.circleMarker([lat, lng], {
        radius: 8,
        color: '#FFFFFF',
        weight: 3,
        fillColor: '#2563EB',
        fillOpacity: 1,
      })
        .bindPopup(
          '<div style="padding:10px 12px;font-weight:700;font-size:13px;">Sua localização GPS</div>'
        )
        .addTo(gpsLayer);
    },
    []
  );

  const handleLocateMe = useCallback(
    (silent = false) => {
      if (!navigator.geolocation) {
        if (!silent) {
          setToastMessage({
            text: 'GPS não suportado neste navegador.',
            tone: 'warn',
          });
        }
        return;
      }

      if (!silent) setGpsLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsLoading(false);
          const { latitude, longitude, accuracy } = pos.coords;
          lastGpsCoordsRef.current = { lat: latitude, lng: longitude };
          const map = mapInstanceRef.current;
          if (!map) return;

          drawGpsMarker(latitude, longitude, accuracy);
          map.setView([latitude, longitude], 16, { animate: true });

          if (!silent && stores.length > 0) {
            const nearest = stores
              .map((s) => ({
                store: s,
                dist: getDistanceMeters(latitude, longitude, s.lat, s.lng),
              }))
              .sort((a, b) => a.dist - b.dist)[0];

            setToastMessage({
              text: `GPS localizado · Unidade mais próxima: ${nearest.store.name} (${formatDistanceLabel(
                nearest.dist
              )})`,
              tone: 'info',
            });
          }
        },
        () => {
          setGpsLoading(false);
          if (!silent) {
            setToastMessage({
              text: 'Não foi possível obter sua localização GPS. Mantendo centro padrão.',
              tone: 'warn',
            });
          }
        },
        { enableHighAccuracy: true, timeout: 9000, maximumAge: 10000 }
      );
    },
    [drawGpsMarker, stores]
  );

  const notifyAfterCreate = useCallback(
    (
      created: MapOccurrence,
      subcategory: CatalogSubcategory,
      lat: number,
      lng: number
    ) => {
      const normTag = created.tag?.trim().toUpperCase();
      const isRepeatTarget =
        Boolean(normTag) &&
        (occurrencesRef.current.some(
          (o) => o.id !== created.id && o.tag?.trim().toUpperCase() === normTag
        ) ||
          alertAudit.some(
            (a) =>
              a.occurrenceId !== created.id &&
              a.tag?.trim().toUpperCase() === normTag
          ));

      const hitStores = stores.filter(
        (s) => getDistanceMeters(lat, lng, s.lat, s.lng) <= s.radiusKm * 1000
      );

      if (isRepeatTarget) {
        setToastMessage({
          text: `Mesmo veículo/alvo identificado (${created.tag})! Rastro atualizado no mapa.`,
          tone: 'warn',
        });
      } else if (hitStores.length > 0) {
        setToastMessage({
          text: `${subcategory.name} registrado! Alerta ativado em: ${hitStores
            .map((s) => s.name)
            .join(', ')}.`,
          tone: 'warn',
        });
      } else {
        setToastMessage({
          text: `${subcategory.name} marcado no mapa (ativo por 20 min).`,
          tone: 'info',
        });
      }
    },
    [alertAudit, stores]
  );

  // Marcação instantânea via GPS a partir do botão flutuante "📍 Onde eu estou"
  const handleConfirmHereFromDraft = async () => {
    const draft = pendingMapPointDraft;
    if (!draft || gpsLoading) return;

    const submitAtCoords = async (lat: number, lng: number) => {
      setPendingMapPointDraft(null);
      const created = await onAddOccurrence(
        draft.category,
        draft.subcategory,
        lat,
        lng,
        draft.tag
      );
      notifyAfterCreate(created, draft.subcategory, lat, lng);
    };

    if (!navigator.geolocation) {
      if (lastGpsCoordsRef.current) {
        await submitAtCoords(
          lastGpsCoordsRef.current.lat,
          lastGpsCoordsRef.current.lng
        );
      } else {
        const map = mapInstanceRef.current;
        const c = map ? map.getCenter() : L.latLng(DEFAULT_SP_CENTER);
        await submitAtCoords(c.lat, c.lng);
      }
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setGpsLoading(false);
        const { latitude, longitude, accuracy } = pos.coords;
        lastGpsCoordsRef.current = { lat: latitude, lng: longitude };
        drawGpsMarker(latitude, longitude, accuracy);
        mapInstanceRef.current?.setView([latitude, longitude], 16, {
          animate: true,
        });
        await submitAtCoords(latitude, longitude);
      },
      async () => {
        setGpsLoading(false);
        if (lastGpsCoordsRef.current) {
          await submitAtCoords(
            lastGpsCoordsRef.current.lat,
            lastGpsCoordsRef.current.lng
          );
        } else {
          const fallback = activeLinkedStore
            ? { lat: activeLinkedStore.lat, lng: activeLinkedStore.lng }
            : { lat: DEFAULT_SP_CENTER[0], lng: DEFAULT_SP_CENTER[1] };
          await submitAtCoords(fallback.lat, fallback.lng);
          setToastMessage({
            text: 'GPS indisponível: usando referência da região para marcar.',
            tone: 'warn',
          });
        }
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 10000 }
    );
  };

  // Refs de callbacks para os event listeners do Leaflet (evita re-instanciar o mapa)
  const onAddOccurrenceRef = useRef(onAddOccurrence);
  onAddOccurrenceRef.current = onAddOccurrence;
  const onUpdateSightingRef = useRef(onUpdateOccurrenceSighting);
  onUpdateSightingRef.current = onUpdateOccurrenceSighting;
  const notifyAfterCreateRef = useRef(notifyAfterCreate);
  notifyAfterCreateRef.current = notifyAfterCreate;

  // Identifica tags com correspondência (mesmo veículo/alvo ativo ou recente nas últimas 24h)
  const matchedTagsSet = useMemo(() => {
    const countsByTag = new Map<string, Set<string>>();
    occurrences.forEach((occ) => {
      const normalized = occ.tag?.trim().toUpperCase();
      if (!normalized) return;
      const set = countsByTag.get(normalized) || new Set<string>();
      set.add(occ.id);
      countsByTag.set(normalized, set);
    });

    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    alertAudit.forEach((entry) => {
      if (entry.createdAt < oneDayAgo) return;
      const normalized = entry.tag?.trim().toUpperCase();
      if (!normalized) return;
      const set = countsByTag.get(normalized) || new Set<string>();
      set.add(entry.occurrenceId);
      countsByTag.set(normalized, set);
    });

    const matched = new Set<string>();
    countsByTag.forEach((occIds, tagKey) => {
      if (occIds.size >= 2) {
        matched.add(tagKey);
      }
    });
    return matched;
  }, [occurrences, alertAudit]);

  // Alerta de perímetro das lojas (considera ocorrências ativas Fase 1)
  const storeAlertMap = useMemo(() => {
    const map = new Map<string, MapOccurrence[]>();
    stores.forEach((store) => {
      const inside = activePhaseOccurrences.filter(
        (occ) =>
          getDistanceMeters(occ.lat, occ.lng, store.lat, store.lng) <=
          store.radiusKm * 1000
      );
      map.set(store.id, inside);
    });
    return map;
  }, [stores, activePhaseOccurrences]);

  const alertingStoresCount = useMemo(() => {
    let count = 0;
    storeAlertMap.forEach((list) => {
      if (list.length > 0) count += 1;
    });
    return count;
  }, [storeAlertMap]);

  const visiblePhasedOccurrences = useMemo(() => {
    return phasedOccurrences.filter(({ occ, phaseInfo }) => {
      if (categoryFilter !== 'all' && occ.categoryId !== categoryFilter) {
        return false;
      }
      if (phaseInfo.phase === 'active') return true;
      return showLastHour;
    });
  }, [phasedOccurrences, categoryFilter, showLastHour]);

  const selectedStore = useMemo(
    () => stores.find((s) => s.id === selectedStoreId) || null,
    [stores, selectedStoreId]
  );

  // Inicialização do Mapa OpenStreetMap + Gestos v4.0 (1 toque zoomIn, 2 toques zoomOut, zero abertura acidental)
  useEffect(() => {
    if (!canViewMap || !mapContainerRef.current || mapInstanceRef.current) {
      return;
    }

    const initialCenter: [number, number] = activeLinkedStore
      ? [activeLinkedStore.lat, activeLinkedStore.lng]
      : stores[0]
      ? [stores[0].lat, stores[0].lng]
      : DEFAULT_SP_CENTER;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 14,
      minZoom: 4,
      maxZoom: 19,
      zoomControl: false,
      doubleClickZoom: false, // Desabilitado para usar 2 toques como zoomOut controlado
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Botão compacto de alternância de camada/tema do mapa logo abaixo do zoom (+/-)
    const StyleToggleControl = L.Control.extend({
      options: { position: 'topright' as L.ControlPosition },
      onAdd: () => {
        const container = L.DomUtil.create(
          'div',
          'leaflet-bar leaflet-control radar-style-control'
        );
        const btn = L.DomUtil.create(
          'button',
          'radar-style-toggle-btn',
          container
        ) as HTMLButtonElement;
        btn.type = 'button';
        btn.title = 'Escolher estilo do mapa (Padrão / Escuro Limpo)';
        btn.setAttribute('aria-label', 'Escolher estilo do mapa');
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`;
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        btn.onclick = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          setStyleMenuOpen((prev) => !prev);
        };
        styleBtnRef.current = btn;
        return container;
      },
    });
    new StyleToggleControl().addTo(map);

    const defaultTiles = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }
    ).addTo(map);
    defaultTileLayerRef.current = defaultTiles;
    activeStyleRef.current = 'default';

    const storesLayer = L.layerGroup().addTo(map);
    const occurrencesLayer = L.layerGroup().addTo(map);
    const gpsLayer = L.layerGroup().addTo(map);

    if (stores.length > 1 && !activeLinkedStore) {
      const groupBounds = L.latLngBounds(
        stores.map((s) => L.latLng(s.lat, s.lng))
      ).pad(0.28);
      map.fitBounds(groupBounds, { padding: [32, 32], maxZoom: 14 });
    } else if (activeLinkedStore || stores[0]) {
      const refStore = activeLinkedStore || stores[0];
      map.fitBounds(
        computeCircleBounds(refStore.lat, refStore.lng, refStore.radiusKm),
        { padding: [24, 24], maxZoom: 15 }
      );
    }

    // 1 toque = zoomIn (ou ação controlada se em modo "Eu vi!" / marcação direta na rua)
    map.on('click', (e: L.LeafletMouseEvent) => {
      const sightingTarget = sightingTargetOccRef.current;
      if (sightingTarget) {
        if (tapTimerRef.current) {
          window.clearTimeout(tapTimerRef.current);
          tapTimerRef.current = null;
        }
        setSightingTargetOcc(null);
        void onUpdateSightingRef
          .current(sightingTarget.id, e.latlng.lat, e.latlng.lng)
          .then((updated) => {
            setToastMessage({
              text: `${updated.subcategoryName} atualizado na rua! Rastro traçado e cronômetro reiniciado (20 min).`,
              tone: 'info',
            });
          });
        return;
      }

      const draft = pendingMapPointDraftRef.current;
      if (draft) {
        if (tapTimerRef.current) {
          window.clearTimeout(tapTimerRef.current);
          tapTimerRef.current = null;
        }
        setPendingMapPointDraft(null);
        void onAddOccurrenceRef
          .current(
            draft.category,
            draft.subcategory,
            e.latlng.lat,
            e.latlng.lng,
            draft.tag
          )
          .then((created) => {
            notifyAfterCreateRef.current(
              created,
              draft.subcategory,
              e.latlng.lat,
              e.latlng.lng
            );
          });
        return;
      }

      // Navegação segura sem abertura acidental: 1 toque aproxima zoom no ponto tocado
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

    // 2 toques = zoomOut no ponto tocado
    map.on('dblclick', (e: L.LeafletMouseEvent) => {
      if (tapTimerRef.current) {
        window.clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      if (sightingTargetOccRef.current || pendingMapPointDraftRef.current) {
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
    occurrencesLayerRef.current = occurrencesLayer;
    userGpsLayerRef.current = gpsLayer;

    // Garante recálculo apenas quando a dimensão real do container mudar (nunca ao marcar pinos)
    const invalidateIfSizeChanged = () => {
      const el = mapContainerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w <= 0 || h <= 0) return;
      if (
        Math.abs(w - lastContainerSizeRef.current.w) > 1 ||
        Math.abs(h - lastContainerSizeRef.current.h) > 1
      ) {
        lastContainerSizeRef.current = { w, h };
        map.invalidateSize({ pan: false, animate: false });
      }
    };

    invalidateIfSizeChanged();
    window.addEventListener('resize', invalidateIfSizeChanged);
    window.visualViewport?.addEventListener('resize', invalidateIfSizeChanged);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        window.requestAnimationFrame(invalidateIfSizeChanged);
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    // Auto-centraliza via GPS ao abrir o mapa
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!mapInstanceRef.current) return;
          const { latitude, longitude, accuracy } = pos.coords;
          lastGpsCoordsRef.current = { lat: latitude, lng: longitude };
          drawGpsMarker(latitude, longitude, accuracy);
          mapInstanceRef.current.setView([latitude, longitude], 15, {
            animate: true,
          });
        },
        () => {
          // Mantém centro padrão sem erro invasivo
        },
        { enableHighAccuracy: true, timeout: 7000, maximumAge: 15000 }
      );
    }

    return () => {
      window.removeEventListener('resize', invalidateIfSizeChanged);
      window.visualViewport?.removeEventListener(
        'resize',
        invalidateIfSizeChanged
      );
      resizeObserver?.disconnect();
      if (tapTimerRef.current) {
        window.clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      map.remove();
      mapInstanceRef.current = null;
      defaultTileLayerRef.current = null;
      cleanBlueTileLayerRef.current = null;
      activeStyleRef.current = 'default';
      lastContainerSizeRef.current = { w: 0, h: 0 };
      styleBtnRef.current = null;
      storesLayerRef.current = null;
      occurrencesLayerRef.current = null;
      userGpsLayerRef.current = null;
    };
  }, [canViewMap]);

  // Alterna camada de tiles entre Padrão (OSM) e Escuro Limpo (CARTO Basemaps sem API Key) somente quando o usuário muda o estilo
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || mapStyle === activeStyleRef.current) return;

    const container = map.getContainer();
    if (mapStyle === 'clean_blue') {
      if (defaultTileLayerRef.current && map.hasLayer(defaultTileLayerRef.current)) {
        map.removeLayer(defaultTileLayerRef.current);
      }
      if (!cleanBlueTileLayerRef.current) {
        cleanBlueTileLayerRef.current = L.tileLayer(
          'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
          {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 19,
          }
        );
      }
      cleanBlueTileLayerRef.current.addTo(map);
      container.classList.add('radar-map-clean-blue');
    } else {
      if (cleanBlueTileLayerRef.current && map.hasLayer(cleanBlueTileLayerRef.current)) {
        map.removeLayer(cleanBlueTileLayerRef.current);
      }
      if (!defaultTileLayerRef.current) {
        defaultTileLayerRef.current = L.tileLayer(
          'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19,
          }
        );
      }
      defaultTileLayerRef.current.addTo(map);
      container.classList.remove('radar-map-clean-blue');
    }

    activeStyleRef.current = mapStyle;
  }, [mapStyle, canViewMap]);

  // Atualiza estado visual do botão de camadas
  useEffect(() => {
    if (!styleBtnRef.current) return;
    styleBtnRef.current.classList.toggle(
      'is-active',
      mapStyle === 'clean_blue' || styleMenuOpen
    );
    styleBtnRef.current.setAttribute('aria-expanded', String(styleMenuOpen));
  }, [mapStyle, styleMenuOpen]);

  // Recalcula dimensões SOMENTE quando a aba do mapa volta a ficar visível após ter estado oculta
  useEffect(() => {
    const prevVisible = wasMapVisibleRef.current;
    wasMapVisibleRef.current = isMapVisible;
    const map = mapInstanceRef.current;
    if (!map || !isMapVisible || prevVisible) return;
    const raf = window.requestAnimationFrame(() => {
      const el = mapContainerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        lastContainerSizeRef.current = {
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        };
        map.invalidateSize({ pan: false, animate: false });
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, [isMapVisible]);

  // Responde ao botão de centralizar GPS da barra superior
  useEffect(() => {
    if (centerGpsSignal > 0 && canViewMap) {
      handleLocateMe(false);
    }
  }, [centerGpsSignal, canViewMap, handleLocateMe]);

  // Renderiza Lojas Fixas + Círculos de Perímetro
  useEffect(() => {
    const layer = storesLayerRef.current;
    if (!layer) return;

    layer.clearLayers();
    storeRefsById.current.clear();

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
        setSelectedStoreId(store.id);
      });

      marker.addTo(layer);
      storeRefsById.current.set(store.id, marker);
    });
  }, [stores, storeAlertMap]);

  // Renderiza Ocorrências em 3 Fases + Rastro Pontilhado + Projeção de Área
  useEffect(() => {
    const layer = occurrencesLayerRef.current;
    if (!layer) return;

    const previouslyOpenId = openPopupOccIdRef.current;
    layer.clearLayers();
    occurrenceRefsById.current.clear();

    // 1. Conexões por mesma tag ativa
    const activeByTag = new Map<string, MapOccurrence[]>();
    visiblePhasedOccurrences.forEach(({ occ, phaseInfo }) => {
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

    // 2. Renderiza cada ocorrência de acordo com sua Fase (Ativo / Sombra / Projeção)
    visiblePhasedOccurrences.forEach(({ occ, phaseInfo }) => {
      const normTag = occ.tag?.trim().toUpperCase();
      const isMatchedTarget = Boolean(normTag && matchedTagsSet.has(normTag));

      // Linha pontilhada direcional do rastro ("Eu vi!")
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

        // Pontos anteriores do rastro como pequenos marcadores discretos
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
        // Fase 3 (30–60 min): Círculo tracejado suave de projeção + selo
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
              setSightingTargetOcc(occ);
            };
          }
          const completeBtn = popupEl.querySelector(
            `[data-complete-occurrence="${occ.id}"]`
          ) as HTMLButtonElement | null;
          if (completeBtn) {
            completeBtn.onclick = () => {
              void onDeleteOccurrence(occ.id);
            };
          }
        });

        projMarker.addTo(layer);
        occurrenceRefsById.current.set(occ.id, projMarker);
        return;
      }

      // Fase 1 (Ativo 0–20m) ou Fase 2 (Sombra 20–30m)
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
            setSightingTargetOcc(occ);
          };
        }

        const completeBtn = popupEl.querySelector(
          `[data-complete-occurrence="${occ.id}"]`
        ) as HTMLButtonElement | null;
        if (completeBtn && canComplete) {
          completeBtn.onclick = () => {
            void onDeleteOccurrence(occ.id);
          };
        }
      });

      leafletMarker.addTo(layer);
      occurrenceRefsById.current.set(occ.id, leafletMarker);

      if (previouslyOpenId === occ.id) {
        leafletMarker.openPopup();
      }
    });
  }, [
    visiblePhasedOccurrences,
    matchedTagsSet,
    canComplete,
    canMark,
    onDeleteOccurrence,
  ]);

  // Foco externo (ex: clicou em "Ver no mapa" no painel administrativo)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (focusOccurrenceId) {
      const targetOcc = occurrences.find((o) => o.id === focusOccurrenceId);
      if (targetOcc) {
        const phase = getOccurrencePhase(
          targetOcc.lastUpdatedAt || targetOcc.createdAt,
          Date.now()
        ).phase;
        if (phase === 'shadow' || phase === 'projection') {
          setShowLastHour(true);
        }
        const target = occurrenceRefsById.current.get(focusOccurrenceId);
        map.setView([targetOcc.lat, targetOcc.lng], 16, { animate: true });
        if (target) {
          target.openPopup();
        }
        onFocusHandled();
      }
    } else if (focusStoreId) {
      const data = stores.find((s) => s.id === focusStoreId);
      if (data) {
        map.fitBounds(
          computeCircleBounds(data.lat, data.lng, data.radiusKm),
          { padding: [28, 28], maxZoom: 15, animate: true }
        );
        setSelectedStoreId(data.id);
        onFocusHandled();
      }
    }
  }, [focusOccurrenceId, focusStoreId, occurrences, stores, onFocusHandled]);

  const focusStoreOnMap = (store: StoreUnit) => {
    setMobileDrawerOpen(false);
    const map = mapInstanceRef.current;
    if (map) {
      map.fitBounds(
        computeCircleBounds(store.lat, store.lng, store.radiusKm),
        { padding: [28, 28], maxZoom: 15, animate: true }
      );
      setSelectedStoreId(store.id);
    }
  };

  const focusOccurrenceOnMap = (occ: MapOccurrence) => {
    setMobileDrawerOpen(false);
    const phase = getOccurrencePhase(
      occ.lastUpdatedAt || occ.createdAt,
      nowMs
    ).phase;
    if ((phase === 'shadow' || phase === 'projection') && !showLastHour) {
      setShowLastHour(true);
    }
    const map = mapInstanceRef.current;
    if (map) {
      map.setView([occ.lat, occ.lng], 16, { animate: true });
      window.setTimeout(() => {
        const marker = occurrenceRefsById.current.get(occ.id);
        marker?.openPopup();
      }, 120);
    }
  };

  if (!canViewMap) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-100">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-extrabold text-slate-900">
            Acesso ao Mapa Restrito
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Sua conta está sem permissão ativa para visualizar o mapa
            compartilhado. Solicite liberação ao seu Gerente ou Administrador.
          </p>
        </div>
      </div>
    );
  }

  const renderSidebarContent = () => (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="p-3.5 border-b border-slate-200 space-y-2.5">
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setSidebarTab('occurrences')}
            className={`min-h-[38px] rounded-lg text-xs font-bold transition-colors ${
              sidebarTab === 'occurrences'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Alertas ({visiblePhasedOccurrences.length})
          </button>
          <button
            type="button"
            onClick={() => setSidebarTab('stores')}
            className={`min-h-[38px] rounded-lg text-xs font-bold transition-colors ${
              sidebarTab === 'stores'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Lojas ({stores.length})
          </button>
        </div>

        {sidebarTab === 'occurrences' && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 ${
                categoryFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Todas
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 ${
                  categoryFilter === cat.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {sidebarTab === 'occurrences' ? (
          visiblePhasedOccurrences.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-semibold text-slate-700">
                Nenhum alerta ativo no momento
              </p>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Toque no botão principal do dock inferior para registrar uma
                ocorrência ou ative &quot;Última 1h&quot; para ver o histórico
                recente.
              </p>
            </div>
          ) : (
            visiblePhasedOccurrences.map(({ occ, phaseInfo }) => {
              const countdown = getCountdownStatus(
                occ.lastUpdatedAt || occ.createdAt,
                occ.expiresAt,
                occ.durationMinutes,
                nowMs
              );
              const normTag = occ.tag?.trim().toUpperCase();
              const isMatched = Boolean(
                normTag && matchedTagsSet.has(normTag)
              );

              return (
                <div
                  key={occ.id}
                  className="p-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => focusOccurrenceOnMap(occ)}
                    className="flex-1 min-w-0 flex items-center gap-3 text-left"
                  >
                    <OccurrenceAvatar
                      spec={{
                        visualType: occ.visualType,
                        vehicleIconKey: occ.vehicleIconKey,
                        symbolKey: occ.symbolKey,
                        emoji: occ.emoji,
                        customImageDataUrl: occ.customImageDataUrl,
                        colorHex: occ.colorHex,
                        pulseEffect:
                          phaseInfo.phase === 'active' && occ.pulseEffect,
                      }}
                      alt={occ.subcategoryName}
                      className={`w-11 h-11 ${
                        phaseInfo.phase !== 'active' ? 'opacity-65 grayscale' : ''
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-900 truncate">
                        {occ.subcategoryName}
                      </div>
                      {occ.tag && (
                        <div className="text-xs font-mono-tabular font-bold text-slate-700 flex items-center gap-1 mt-0.5">
                          <Tag className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{occ.tag}</span>
                        </div>
                      )}
                      {isMatched && phaseInfo.phase === 'active' && (
                        <div className="text-[11px] font-bold text-amber-800 flex items-center gap-1 mt-0.5">
                          <AlertCircle className="w-3 h-3 text-amber-700 shrink-0" />
                          <span>Mesmo veículo/alvo identificado</span>
                        </div>
                      )}
                      <div
                        className={`text-xs font-mono-tabular font-extrabold mt-0.5 ${
                          phaseInfo.phase === 'active'
                            ? countdown.isUrgent
                              ? 'text-red-700'
                              : 'text-blue-700'
                            : phaseInfo.phase === 'shadow'
                            ? 'text-slate-600'
                            : 'text-amber-700'
                        }`}
                      >
                        {phaseInfo.phase === 'active'
                          ? `${phaseInfo.elapsedLabel} · ${countdown.formatted}`
                          : phaseInfo.phase === 'shadow'
                          ? `Modo Sombra · ${phaseInfo.elapsedLabel}`
                          : `Projeção · ${phaseInfo.elapsedLabel}`}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    {canMark && (
                      <button
                        type="button"
                        onClick={() => {
                          setMobileDrawerOpen(false);
                          setSightingTargetOcc(occ);
                        }}
                        title="Eu vi! Atualizar ponto na rua"
                        aria-label={`Atualizar avistamento de ${occ.subcategoryName}`}
                        className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl text-blue-700 hover:bg-blue-50"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    {canComplete && (
                      <button
                        type="button"
                        onClick={() => onDeleteOccurrence(occ.id)}
                        aria-label={`Concluir ${occ.subcategoryName}`}
                        title="Confirmar Conclusão / Excluir Alerta"
                        className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )
        ) : stores.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Nenhuma unidade fixa cadastrada ainda.
          </div>
        ) : (
          stores.map((store) => {
            const insideCount = (storeAlertMap.get(store.id) || []).length;
            const isAlert = insideCount > 0;
            const onlineCount = (store.onlineUserIds || []).length;
            return (
              <button
                key={store.id}
                type="button"
                onClick={() => focusStoreOnMap(store)}
                className="w-full p-3.5 flex items-center gap-3 hover:bg-slate-50 text-left transition-colors"
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    isAlert
                      ? 'bg-red-600 text-white radar-pin-pulse'
                      : store.isOpen
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-500 text-white'
                  }`}
                >
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-900 truncate">
                    {store.name}
                  </div>
                  <div className="text-xs text-slate-500 truncate mt-0.5 font-mono-tabular">
                    {store.storeCode} · {store.region} ·{' '}
                    {store.isOpen ? 'Aberta' : 'Fechada'} · {onlineCount} online
                  </div>
                  <div className="text-xs text-slate-500 truncate mt-0.5">
                    Raio {store.radiusKm} km ·{' '}
                    {isAlert ? (
                      <span className="font-bold text-red-700">
                        {insideCount}{' '}
                        {insideCount === 1
                          ? 'alerta no perímetro'
                          : 'alertas no perímetro'}
                      </span>
                    ) : (
                      <span>Perímetro normal</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  const primaryButtonLabel = primaryCategory
    ? `Marcar ${primaryCategory.name}`
    : 'Marcar Ocorrência';

  return (
    <div className="relative flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden bg-slate-100">
      <div className="relative flex-1 min-h-[240px] flex flex-col">
        <div
          ref={mapContainerRef}
          className={`w-full flex-1 min-h-[240px] relative z-0 ${
            sightingTargetOcc || pendingMapPointDraft
              ? 'cursor-crosshair'
              : ''
          }`}
          aria-label="Mapa compartilhado de unidades e ocorrências"
        />

        {/* Popover flutuante de seleção de estilo do mapa (Padrão vs. Escuro Limpo) */}
        {styleMenuOpen && (
          <div
            ref={stylePopoverRef}
            role="menu"
            aria-label="Selecionar estilo do mapa"
            className="absolute top-[122px] right-2.5 z-[920] w-52 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl p-1.5 space-y-1"
          >
            <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Estilo do Mapa
            </div>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={mapStyle === 'default'}
              onClick={() => {
                setMapStyle('default');
                setStyleMenuOpen(false);
              }}
              className={`w-full min-h-[42px] px-2.5 py-1.5 rounded-xl flex items-center justify-between gap-2 text-left transition-colors ${
                mapStyle === 'default'
                  ? 'bg-blue-50 border border-blue-200 text-blue-900'
                  : 'hover:bg-slate-100 text-slate-800 border border-transparent'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <span className="w-5 h-5 rounded-md border border-slate-300 bg-slate-100 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-xs font-extrabold leading-tight">
                    Padrão
                  </span>
                  <span className="block text-[10px] text-slate-500 leading-tight">
                    Ruas tradicionais
                  </span>
                </span>
              </span>
              {mapStyle === 'default' && (
                <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
              )}
            </button>

            <button
              type="button"
              role="menuitemradio"
              aria-checked={mapStyle === 'clean_blue'}
              onClick={() => {
                setMapStyle('clean_blue');
                setStyleMenuOpen(false);
              }}
              className={`w-full min-h-[42px] px-2.5 py-1.5 rounded-xl flex items-center justify-between gap-2 text-left transition-colors ${
                mapStyle === 'clean_blue'
                  ? 'bg-slate-900 border border-blue-500 text-white'
                  : 'hover:bg-slate-100 text-slate-800 border border-transparent'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <span className="w-5 h-5 rounded-md border border-blue-800 bg-[#071329] shrink-0" />
                <span className="min-w-0">
                  <span className="block text-xs font-extrabold leading-tight">
                    Escuro Limpo
                  </span>
                  <span
                    className={`block text-[10px] leading-tight ${
                      mapStyle === 'clean_blue'
                        ? 'text-blue-200'
                        : 'text-slate-500'
                    }`}
                  >
                    Noturno azul sem POIs
                  </span>
                </span>
              </span>
              {mapStyle === 'clean_blue' && (
                <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
              )}
            </button>
          </div>
        )}

        {/* Banner superior de status + Abertura em 1 Toque + Botão Última 1h */}
        <div className="pointer-events-none absolute top-3 left-3 right-14 z-[800] flex flex-col items-start gap-2">
          {activeLinkedStore && !activeLinkedStore.isOpen && canOpenClose && (
            <button
              type="button"
              disabled={openingStore}
              onClick={async () => {
                setOpeningStore(true);
                try {
                  await onToggleStoreOpen(activeLinkedStore.id, true);
                  setToastMessage({
                    text: `${activeLinkedStore.name} aberta! Você está online no mapa.`,
                    tone: 'info',
                  });
                } finally {
                  setOpeningStore(false);
                }
              }}
              className="pointer-events-auto w-full sm:w-auto min-h-[46px] px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white shadow-lg border-2 border-emerald-300 text-xs sm:text-sm font-extrabold flex items-center justify-center sm:justify-start gap-2 transition-all"
            >
              <Power className="w-4 h-4 shrink-0" />
              <span>
                {openingStore
                  ? 'Abrindo loja...'
                  : 'Loja Fechada — Toque aqui para ABRIR A LOJA'}
              </span>
            </button>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <div className="pointer-events-auto inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/95 backdrop-blur-md border border-slate-300 shadow-sm text-xs font-semibold text-slate-900">
              <Building2 className="w-4 h-4 text-slate-800 shrink-0" />
              <span>{stores.length} lojas</span>
              <span className="text-slate-300" aria-hidden="true">
                ·
              </span>
              {alertingStoresCount > 0 ? (
                <span className="text-red-700 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {alertingStoresCount} em alerta
                </span>
              ) : (
                <span className="text-slate-600 font-mono-tabular">
                  {activePhaseOccurrences.length} ativos
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowLastHour((prev) => !prev)}
              aria-pressed={showLastHour}
              className={`pointer-events-auto min-h-[36px] px-3 rounded-xl border shadow-sm text-xs font-bold flex items-center gap-1.5 transition-colors ${
                showLastHour
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-white/95 hover:bg-slate-100 border-slate-300 text-slate-800'
              }`}
            >
              <Ghost className="w-3.5 h-3.5 shrink-0" />
              <span className="font-mono-tabular">
                👻 Última 1h ({lastHourArchiveCount})
              </span>
            </button>

            {activeLinkedStore && activeLinkedStore.isOpen && canOpenClose && (
              <button
                type="button"
                onClick={() => onRequestCloseStore(activeLinkedStore)}
                className="pointer-events-auto min-h-[36px] px-3 rounded-xl bg-white/95 hover:bg-slate-100 border border-slate-300 shadow-sm text-xs font-bold text-slate-700 flex items-center gap-1.5"
              >
                <Power className="w-3.5 h-3.5 text-slate-600" />
                <span>Fechar Loja</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="pointer-events-auto lg:hidden min-h-[36px] px-3 rounded-xl bg-white/95 border border-slate-300 shadow-sm text-xs font-bold text-slate-900 flex items-center gap-1.5"
            >
              <ListFilter className="w-3.5 h-3.5 text-blue-700" />
              <span>Lista ({visiblePhasedOccurrences.length})</span>
            </button>
          </div>
        </div>

        {/* Banner de modo controlado: "Toque na rua onde você viu" ("Eu vi!") */}
        {sightingTargetOcc && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[950] px-4 py-2.5 rounded-2xl bg-blue-900 text-white border border-blue-400 shadow-xl text-xs sm:text-sm font-bold flex items-center gap-2.5 max-w-[92vw]">
            <Eye className="w-4 h-4 text-blue-200 shrink-0" />
            <span>
              Toque na rua onde você viu ({sightingTargetOcc.subcategoryName})
            </span>
            <button
              type="button"
              onClick={() => setSightingTargetOcc(null)}
              className="min-h-[32px] px-2.5 rounded-lg bg-blue-800 hover:bg-blue-700 text-xs font-bold shrink-0"
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Barra Flutuante de Marcação Direta no Topo do Mapa (logo abaixo da barra superior) */}
        {pendingMapPointDraft && (
          <div className="absolute top-3 left-3 right-14 z-[960] flex flex-col items-start gap-2 pointer-events-none">
            <div className="pointer-events-auto w-full sm:w-auto max-w-xl px-3.5 py-2.5 rounded-2xl bg-slate-900/95 backdrop-blur-md text-white border border-slate-700 shadow-2xl flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="w-4 h-4 text-blue-300 shrink-0" />
                <span className="text-xs sm:text-sm font-extrabold truncate">
                  Toque na rua: {pendingMapPointDraft.subcategory.name}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={gpsLoading}
                  onClick={() => void handleConfirmHereFromDraft()}
                  className="min-h-[40px] px-3.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-70 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md active:scale-[0.98] transition-all"
                >
                  {gpsLoading ? (
                    <Navigation className="w-4 h-4 animate-spin shrink-0" />
                  ) : (
                    <Crosshair className="w-4 h-4 shrink-0" />
                  )}
                  <span>
                    {gpsLoading ? 'GPS...' : '📍 Onde eu estou'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPendingMapPointDraft(null)}
                  className="min-h-[40px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold shrink-0"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {toastMessage && (
          <div
            role="status"
            className={`absolute top-24 left-1/2 -translate-x-1/2 z-[1000] px-4 py-2.5 rounded-xl shadow-lg border text-xs sm:text-sm font-semibold max-w-[92vw] text-center ${
              toastMessage.tone === 'warn'
                ? 'bg-red-900 text-red-50 border-red-700'
                : 'bg-slate-900 text-white border-slate-700'
            }`}
          >
            {toastMessage.text}
          </div>
        )}

        {/* Pop-up Persistente dentro do Raio da Loja ("✕ Não vi" / "👁️ Eu vi!") */}
        {pendingRadiusAlert && !sightingTargetOcc && !pendingMapPointDraft && !quickBarOpen && (
          <div
            role="alertdialog"
            aria-label="Alerta próximo dentro do raio da loja"
            className="absolute bottom-[78px] left-3 right-3 sm:left-auto sm:right-4 sm:w-[380px] z-[880] bg-white rounded-2xl border-2 border-red-500 shadow-2xl p-4 space-y-3"
          >
            <div className="flex items-start gap-3">
              <OccurrenceAvatar
                spec={{
                  visualType: pendingRadiusAlert.occ.visualType,
                  vehicleIconKey: pendingRadiusAlert.occ.vehicleIconKey,
                  symbolKey: pendingRadiusAlert.occ.symbolKey,
                  emoji: pendingRadiusAlert.occ.emoji,
                  customImageDataUrl:
                    pendingRadiusAlert.occ.customImageDataUrl,
                  colorHex: pendingRadiusAlert.occ.colorHex,
                  pulseEffect: pendingRadiusAlert.occ.pulseEffect,
                }}
                alt={pendingRadiusAlert.occ.subcategoryName}
                className="w-12 h-12"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-extrabold uppercase tracking-wide text-red-700">
                  Alerta no raio de {pendingRadiusAlert.store.name}
                </div>
                <div className="text-base font-extrabold text-slate-900 truncate mt-0.5">
                  {pendingRadiusAlert.occ.subcategoryName}
                </div>
                <div className="text-xs font-mono-tabular text-slate-600 mt-0.5">
                  {
                    getOccurrencePhase(
                      pendingRadiusAlert.occ.lastUpdatedAt ||
                        pendingRadiusAlert.occ.createdAt,
                      nowMs
                    ).elapsedLabel
                  }
                  {pendingRadiusAlert.occ.tag
                    ? ` · ID: ${pendingRadiusAlert.occ.tag}`
                    : ''}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() =>
                  void onDismissOccurrenceAlert(pendingRadiusAlert.occ.id)
                }
                className="min-h-[46px] px-3 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-extrabold flex items-center justify-center gap-1.5"
              >
                <X className="w-4 h-4 shrink-0" />
                <span>Não vi</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const map = mapInstanceRef.current;
                  if (map) {
                    map.setView(
                      [
                        pendingRadiusAlert.occ.lat,
                        pendingRadiusAlert.occ.lng,
                      ],
                      16,
                      { animate: true }
                    );
                  }
                  setSightingTargetOcc(pendingRadiusAlert.occ);
                }}
                className="min-h-[46px] px-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Eye className="w-4 h-4 shrink-0" />
                <span>👁️ Eu vi!</span>
              </button>
            </div>
          </div>
        )}

        {/* Barra de Ação Rápida Flutuante sobre o Dock (não altera altura do mapa!) */}
        {quickBarOpen && (
          <div className="absolute bottom-[69px] left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-8px_28px_rgba(15,23,42,0.16)] z-[910] px-2.5 pt-2.5 pb-2.5 space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-600">
                Seleção rápida — Toque no veículo
              </span>
              <button
                type="button"
                onClick={() => setQuickBarOpen(false)}
                aria-label="Fechar barra rápida"
                className="min-h-[30px] px-2 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Fechar</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {quickPinSubcategories.map((sub) => {
                const subCategoryObj =
                  categories.find((c) => c.id === sub.categoryId) ||
                  primaryCategory ||
                  categories[0];
                return (
                  <button
                    key={sub.id}
                    type="button"
                    disabled={!subCategoryObj}
                    onClick={() => {
                      if (!subCategoryObj) return;
                      setQuickBarOpen(false);
                      setSightingTargetOcc(null);
                      setPendingMapPointDraft({
                        category: subCategoryObj,
                        subcategory: sub,
                      });
                    }}
                    className="min-h-[68px] p-2 rounded-2xl border-2 border-slate-200 bg-white hover:border-blue-600 hover:bg-blue-50/50 active:scale-[0.97] transition-all flex flex-col items-center justify-center gap-1 text-center shadow-xs"
                  >
                    <OccurrenceAvatar
                      spec={{
                        visualType: sub.visualType,
                        vehicleIconKey: sub.vehicleIconKey,
                        symbolKey: sub.symbolKey,
                        emoji: sub.emoji,
                        customImageDataUrl: sub.customImageDataUrl,
                        colorHex: sub.colorHex,
                        pulseEffect: sub.pulseEffect,
                      }}
                      alt={sub.name}
                      className="w-9 h-9"
                    />
                    <span className="text-[11px] sm:text-xs font-extrabold text-slate-900 leading-tight line-clamp-1">
                      {sub.name}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                setQuickBarOpen(false);
                setPickerOpen(true);
              }}
              className="w-full min-h-[44px] px-4 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-900 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Layers className="w-4 h-4 text-slate-700" />
              <span>Outros tipos e categorias</span>
            </button>
          </div>
        )}

        {/* Dock Inferior Fixo de Canto a Canto (3 Botões Grandes) */}
        <nav
          aria-label="Ações rápidas do mapa"
          className="shrink-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-6px_24px_rgba(15,23,42,0.10)] z-[900] grid grid-cols-3 gap-2 px-2.5 py-2"
        >
          {/* Botão 1: Categoria Principal (abre Barra Rápida com 3 principais + Outros) */}
          <button
            type="button"
            disabled={!canMark}
            aria-expanded={quickBarOpen}
            onClick={() => {
              setSightingTargetOcc(null);
              setPendingMapPointDraft(null);
              setQuickBarOpen((prev) => !prev);
            }}
            className={`min-h-[52px] px-2.5 rounded-2xl disabled:bg-slate-300 disabled:text-slate-600 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md active:scale-[0.98] transition-all ${
              quickBarOpen
                ? 'bg-red-800 ring-2 ring-red-300'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <span className="truncate">{primaryButtonLabel}</span>
          </button>

          {/* Botão 2: Mensagens / Salas de Chat */}
          <button
            type="button"
            onClick={onOpenChatModal}
            className="relative min-h-[52px] px-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all"
          >
            <span className="relative inline-flex items-center justify-center">
              <Mail className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-blue-300" />
              {unreadChatCount > 0 && (
                <span className="absolute -top-2 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-500 text-white text-[10px] font-mono-tabular font-extrabold flex items-center justify-center border border-slate-900">
                  {unreadChatCount}
                </span>
              )}
            </span>
            <span className="truncate">Mensagens</span>
          </button>

          {/* Botão 3: Campainha de Alertas da Região (Raio + 5 km) */}
          <button
            type="button"
            onClick={() => setBellOpen(true)}
            className="relative min-h-[52px] px-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-900 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all"
          >
            <span className="relative inline-flex items-center justify-center">
              <Bell
                className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 ${
                  nearbyAlerts.length > 0 ? 'text-red-600' : 'text-slate-700'
                }`}
              />
              {nearbyAlerts.length > 0 && (
                <span className="absolute -top-2 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-mono-tabular font-extrabold flex items-center justify-center border border-white">
                  {nearbyAlerts.length}
                </span>
              )}
            </span>
            <span className="truncate">Alertas</span>
          </button>
        </nav>
      </div>

      {/* Painel lateral Desktop */}
      <aside className="hidden lg:flex lg:w-96 flex-col border-l border-slate-200 bg-white min-h-0">
        {renderSidebarContent()}
      </aside>

      {/* Gaveta Mobile de Lista de Ocorrências / Lojas */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-[1150] lg:hidden flex items-end bg-slate-950/55 backdrop-blur-xs"
          onClick={() => setMobileDrawerOpen(false)}
        >
          <div
            className="w-full bg-white rounded-t-3xl h-[78vh] flex flex-col overflow-hidden border-t border-slate-200 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pt-3 pb-1 flex justify-center">
              <div className="w-10 h-1.5 bg-slate-300 rounded-full" />
            </div>
            <div className="px-5 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Radar Compartilhado
              </h3>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Fechar lista"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* Modal Botão "Outros": seleção de demais tipos e categorias direto para o mapa */}
      <OccurrencePickerModal
        isOpen={pickerOpen}
        primaryCategory={primaryCategory}
        categories={categories}
        subcategories={subcategories}
        activeOccurrences={activePhaseOccurrences}
        alertAudit={alertAudit}
        onSelectSubcategory={(category, subcategory, tag) => {
          setPickerOpen(false);
          setSightingTargetOcc(null);
          setPendingMapPointDraft({ category, subcategory, tag });
        }}
        onClose={() => setPickerOpen(false)}
      />

      {/* Modal Botão 3: Campainha de Alertas (Raio da loja + 5 km) */}
      <NearbyAlertsModal
        isOpen={bellOpen}
        nearbyAlerts={nearbyAlerts}
        hasLinkedStores={userLinkedStores.length > 0}
        nowMs={nowMs}
        onCenterOccurrence={focusOccurrenceOnMap}
        onStartSightingUpdate={(occ) => {
          focusOccurrenceOnMap(occ);
          setSightingTargetOcc(occ);
        }}
        onMarkBellAlertRead={onMarkBellAlertRead}
        onClose={() => setBellOpen(false)}
      />

      {/* Card Rico da Loja ao clicar no pino da unidade */}
      <StoreInfoCardModal
        store={selectedStore}
        users={users}
        currentUser={currentUser}
        insideAlertsCount={
          selectedStore ? (storeAlertMap.get(selectedStore.id) || []).length : 0
        }
        onToggleStoreOpen={onToggleStoreOpen}
        onRequestCloseStore={onRequestCloseStore}
        onOpenStoreOptions={onOpenStoreOptions}
        onClose={() => setSelectedStoreId(null)}
      />
    </div>
  );
};
