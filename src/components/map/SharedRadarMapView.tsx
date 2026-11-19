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
  formatDistanceLabel,
  getCountdownStatus,
  getDistanceMeters,
  getOccurrencePhase,
} from '../../utils/geo';
import { hasPermission, isUserLinkedToStore } from '../../utils/rbac';
import { OccurrenceAvatar } from '../icons/VehicleSvg';
import { OccurrencePickerModal } from './OccurrencePickerModal';
import { StoreInfoCardModal } from './StoreInfoCardModal';
import { NearbyAlertItem, NearbyAlertsModal } from './NearbyAlertsModal';
import {
  IsolatedLeafletMap,
  IsolatedMapImperativeHandle,
  MapAddingStateRefValue,
  MapVisualStyle,
} from './IsolatedLeafletMap';

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

  const mapApiRef = useRef<IsolatedMapImperativeHandle | null>(null);
  const wasMapVisibleRef = useRef<boolean>(isMapVisible);
  const hasMountedMarkingRef = useRef(false);
  const stylePopoverRef = useRef<HTMLDivElement | null>(null);
  const occurrencesRef = useRef<MapOccurrence[]>(occurrences);
  const lastGpsCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  // Congela referência inicial do centro e lojas para não invalidar React.memo do mapa
  const initialCenterRef = useRef<[number, number]>(
    activeLinkedStore
      ? [activeLinkedStore.lat, activeLinkedStore.lng]
      : stores[0]
      ? [stores[0].lat, stores[0].lng]
      : DEFAULT_SP_CENTER
  );
  const initialStoresBoundsRef = useRef<StoreUnit[]>(stores);
  const initialLinkedStoreRef = useRef<StoreUnit | null>(activeLinkedStore);

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [mapStyle, setMapStyle] = useState<MapVisualStyle>('standard');
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const [quickBarOpen, setQuickBarOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [showLastHour, setShowLastHour] = useState(false);

  // Estado de marcação espelhado imediatamente em addingStateRef (evita re-renderizar o mapa)
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

  const addingStateRef = useRef<MapAddingStateRefValue>({
    isAddingVehicle: false,
    hasSightingTarget: false,
  });
  addingStateRef.current.isAddingVehicle = Boolean(pendingMapPointDraft);
  addingStateRef.current.hasSightingTarget = Boolean(sightingTargetOcc);

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
      if (mapApiRef.current?.getStyleButtonEl()?.contains(target)) return;
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

  // Janela discreta de 10s evita que o React.memo do mapa re-renderize a cada segundo
  const phaseBucket = Math.floor(nowMs / 10000);

  // Classifica ocorrências por fase (Ativo 0-20m, Sombra 20-30m, Projeção 30-60m)
  const phasedOccurrences = useMemo(() => {
    const refNow = phaseBucket * 10000;
    return occurrences
      .map((occ) => ({
        occ,
        phaseInfo: getOccurrencePhase(occ.lastUpdatedAt || occ.createdAt, refNow),
      }))
      .filter((item) => item.phaseInfo.phase !== 'expired');
  }, [occurrences, phaseBucket]);

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
    const boxes = document.querySelectorAll<HTMLElement>('[data-countdown-box]');
    if (boxes.length === 0) return;
    boxes.forEach((el) => {
      const occId = el.getAttribute('data-countdown-box');
      if (!occId) return;
      const occ = occurrencesRef.current.find((o) => o.id === occId);
      if (!occ) return;
      const countdown = getCountdownStatus(
        occ.lastUpdatedAt || occ.createdAt,
        occ.expiresAt,
        occ.durationMinutes,
        nowMs
      );
      el.textContent = countdown.formatted;
    });
  }, [nowMs]);

  const drawGpsMarker = useCallback(
    (lat: number, lng: number, accuracy: number) => {
      const gpsLayer = mapApiRef.current?.gpsLayer;
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
          const map = mapApiRef.current?.map;
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
        const map = mapApiRef.current?.map;
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
        mapApiRef.current?.map.setView([latitude, longitude], 16, {
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

  // Callbacks estáveis via useRef para o componente React.memo do mapa nunca re-renderizar ao marcar veículos
  const onMapAddClickRef = useRef<(lat: number, lng: number) => void>(() => {});
  onMapAddClickRef.current = (lat: number, lng: number) => {
    const draft = pendingMapPointDraftRef.current;
    if (!draft) return;
    setPendingMapPointDraft(null);
    void onAddOccurrence(
      draft.category,
      draft.subcategory,
      lat,
      lng,
      draft.tag
    ).then((created) => {
      notifyAfterCreate(created, draft.subcategory, lat, lng);
    });
  };

  const onSightingClickRef = useRef<(lat: number, lng: number) => void>(
    () => {}
  );
  onSightingClickRef.current = (lat: number, lng: number) => {
    const sightingTarget = sightingTargetOccRef.current;
    if (!sightingTarget) return;
    setSightingTargetOcc(null);
    void onUpdateOccurrenceSighting(sightingTarget.id, lat, lng).then(
      (updated) => {
        setToastMessage({
          text: `${updated.subcategoryName} atualizado na rua! Rastro traçado e cronômetro reiniciado (20 min).`,
          tone: 'info',
        });
      }
    );
  };

  const onSelectStoreRef = useRef<(storeId: string) => void>((storeId) => {
    setSelectedStoreId(storeId);
  });
  onSelectStoreRef.current = (storeId: string) => {
    setSelectedStoreId(storeId);
  };

  const onStartSightingFromPopupRef = useRef<(occ: MapOccurrence) => void>(
    () => {}
  );
  onStartSightingFromPopupRef.current = (occ: MapOccurrence) => {
    setSightingTargetOcc(occ);
  };

  const onDeleteOccurrenceRef = useRef<(id: string) => Promise<void>>(
    onDeleteOccurrence
  );
  onDeleteOccurrenceRef.current = onDeleteOccurrence;

  const onToggleStyleMenuRef = useRef<() => void>(() => {});
  onToggleStyleMenuRef.current = () => {
    setStyleMenuOpen((prev) => !prev);
  };

  const onGpsLocatedRef = useRef<
    (lat: number, lng: number, accuracy: number) => void
  >(() => {});
  onGpsLocatedRef.current = (lat: number, lng: number, accuracy: number) => {
    lastGpsCoordsRef.current = { lat, lng };
    drawGpsMarker(lat, lng, accuracy);
  };

  const onMapReadyRef = useRef<
    (handle: IsolatedMapImperativeHandle | null) => void
  >(() => {});
  onMapReadyRef.current = (handle) => {
    mapApiRef.current = handle;
  };

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

  const isCrosshairMode = Boolean(pendingMapPointDraft || sightingTargetOcc);

  // Atualiza cursor sem tocar na prop className do container Leaflet (preserva .leaflet-container!)
  useEffect(() => {
    const map = mapApiRef.current?.map;
    if (!map) return;
    map.getContainer().style.cursor = isCrosshairMode ? 'crosshair' : '';
  }, [isCrosshairMode]);

  // Garantia extra após ativar/desativar o modo de marcação
  useEffect(() => {
    if (!hasMountedMarkingRef.current) {
      hasMountedMarkingRef.current = true;
      return;
    }
    const timer = window.setTimeout(() => {
      mapApiRef.current?.map.invalidateSize({ pan: false, animate: false });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [isCrosshairMode]);

  // Atualiza estado visual do botão de camadas
  useEffect(() => {
    const btn = mapApiRef.current?.getStyleButtonEl();
    if (!btn) return;
    btn.classList.toggle('is-active', mapStyle === 'dark' || styleMenuOpen);
    btn.setAttribute('aria-expanded', String(styleMenuOpen));
  }, [mapStyle, styleMenuOpen]);

  // Recalcula dimensões SOMENTE quando a aba do mapa volta a ficar visível após ter estado oculta
  useEffect(() => {
    const prevVisible = wasMapVisibleRef.current;
    wasMapVisibleRef.current = isMapVisible;
    const map = mapApiRef.current?.map;
    if (!map || !isMapVisible || prevVisible) return;
    const raf = window.requestAnimationFrame(() => {
      map.invalidateSize({ pan: false, animate: false });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [isMapVisible]);

  // Responde ao botão de centralizar GPS da barra superior
  useEffect(() => {
    if (centerGpsSignal > 0 && canViewMap) {
      handleLocateMe(false);
    }
  }, [centerGpsSignal, canViewMap, handleLocateMe]);

  // Foco externo (ex: clicou em "Ver no mapa" no painel administrativo)
  useEffect(() => {
    const api = mapApiRef.current;
    if (!api) return;

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
        api.map.setView([targetOcc.lat, targetOcc.lng], 16, { animate: true });
        api.openOccurrencePopup(focusOccurrenceId);
        onFocusHandled();
      }
    } else if (focusStoreId) {
      const data = stores.find((s) => s.id === focusStoreId);
      if (data) {
        api.map.fitBounds(
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
    const map = mapApiRef.current?.map;
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
    const api = mapApiRef.current;
    if (api) {
      api.map.setView([occ.lat, occ.lng], 16, { animate: true });
      window.setTimeout(() => {
        api.openOccurrencePopup(occ.id);
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
      <div className="radar-map-stage relative flex-1 min-h-[240px] overflow-hidden">
        {/* Mapa Leaflet isolado em React.memo: div#map única com inset:0 e zero re-renderização ao marcar veículo */}
        <IsolatedLeafletMap
          mapStyle={mapStyle}
          initialCenter={initialCenterRef.current}
          initialStoresForBounds={initialStoresBoundsRef.current}
          initialLinkedStore={initialLinkedStoreRef.current}
          stores={stores}
          storeAlertMap={storeAlertMap}
          vehicles={visiblePhasedOccurrences}
          matchedTagsSet={matchedTagsSet}
          canComplete={canComplete}
          canMark={canMark}
          addingStateRef={addingStateRef}
          onMapAddClickRef={onMapAddClickRef}
          onSightingClickRef={onSightingClickRef}
          onSelectStoreRef={onSelectStoreRef}
          onStartSightingFromPopupRef={onStartSightingFromPopupRef}
          onDeleteOccurrenceRef={onDeleteOccurrenceRef}
          onToggleStyleMenuRef={onToggleStyleMenuRef}
          onGpsLocatedRef={onGpsLocatedRef}
          onMapReadyRef={onMapReadyRef}
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
              aria-checked={mapStyle === 'standard'}
              onClick={() => {
                setMapStyle('standard');
                setStyleMenuOpen(false);
              }}
              className={`w-full min-h-[42px] px-2.5 py-1.5 rounded-xl flex items-center justify-between gap-2 text-left transition-colors ${
                mapStyle === 'standard'
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
              {mapStyle === 'standard' && (
                <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
              )}
            </button>

            <button
              type="button"
              role="menuitemradio"
              aria-checked={mapStyle === 'dark'}
              onClick={() => {
                setMapStyle('dark');
                setStyleMenuOpen(false);
              }}
              className={`w-full min-h-[42px] px-2.5 py-1.5 rounded-xl flex items-center justify-between gap-2 text-left transition-colors ${
                mapStyle === 'dark'
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
                      mapStyle === 'dark' ? 'text-blue-200' : 'text-slate-500'
                    }`}
                  >
                    Noturno azul sem POIs
                  </span>
                </span>
              </span>
              {mapStyle === 'dark' && (
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
                  const map = mapApiRef.current?.map;
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

        {/* Dock Inferior Fixo Flutuante de Canto a Canto (3 Botões Grandes, não altera tamanho do mapa) */}
        <nav
          aria-label="Ações rápidas do mapa"
          className="absolute bottom-0 left-0 right-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-6px_24px_rgba(15,23,42,0.10)] z-[900] grid grid-cols-3 gap-2 px-2.5 py-2"
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
