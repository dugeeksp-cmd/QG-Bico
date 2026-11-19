import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Crosshair,
  ImagePlus,
  MapPin,
  Pencil,
  Plus,
  Power,
  Search,
  SlidersHorizontal,
  Star,
  Tag,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import {
  AdminFinanceAlert,
  AlertAuditEntry,
  AlertAuditStatus,
  CatalogCategory,
  CatalogSubcategory,
  CategoryIconType,
  ClosingAlertNotification,
  MapOccurrence,
  MasterProduct,
  ROLE_LABELS,
  STORE_REGIONS,
  StoreMerchandiseItem,
  StoreRegion,
  StoreUnit,
  SubcategoryVisualType,
  SymbolKey,
  UserAccount,
  UserPermissions,
  VehicleIconKey,
} from '../../types/radar';
import {
  computeCircleBounds,
  formatRelativeDateTime,
  formatTimeOfDay,
  getCountdownStatus,
  getDistanceMeters,
  resizeImageToDataUrl,
} from '../../utils/geo';
import {
  canManageCatalog,
  canManageGlobalOccurrences,
  canManageStore,
  canManageStoreOptions,
  canSetPrimaryCategory,
  canViewAuditHistory,
  canViewGlobalAuditHistory,
  canViewTargetUserHierarchy,
  hasPermission,
  ROLE_LEVEL,
} from '../../utils/rbac';
import {
  CategoryAvatar,
  OccurrenceAvatar,
  SYMBOL_OPTIONS,
  VEHICLE_ICON_OPTIONS,
  VehicleAvatar,
} from '../icons/VehicleSvg';
import { StoreManageOptionsModal } from './StoreManageOptionsModal';
import { AdminAlertsBanner } from './AdminAlertsBanner';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export type AdminSectionKey = 'stores' | 'catalog' | 'audit' | 'occurrences';

interface UnifiedAdminPanelProps {
  activeSection: AdminSectionKey;
  currentUser: UserAccount;
  users: UserAccount[];
  stores: StoreUnit[];
  categories: CatalogCategory[];
  subcategories: CatalogSubcategory[];
  occurrences: MapOccurrence[];
  alertAudit: AlertAuditEntry[];
  merchandise: StoreMerchandiseItem[];
  masterProducts: MasterProduct[];
  adminAlerts: AdminFinanceAlert[];
  closingAlerts: ClosingAlertNotification[];
  onUpdateManagedUser: (
    userId: string,
    updates: { permissions?: UserPermissions }
  ) => Promise<UserAccount>;
  onResolveAdminAlert: (
    alertId: string,
    status: 'CONFIRMED' | 'DISCREPANCY',
    observation?: string
  ) => Promise<AdminFinanceAlert>;
  onOpenClosingsScreen: () => void;
  onAddStore: (
    input: Omit<
      StoreUnit,
      'id' | 'storeCode' | 'createdAt' | 'updatedAt' | 'onlineUserIds'
    >
  ) => Promise<StoreUnit>;
  onUpdateStore: (
    id: string,
    updates: Partial<Omit<StoreUnit, 'id' | 'storeCode' | 'createdAt'>>
  ) => Promise<StoreUnit>;
  onToggleStoreOpen: (storeId: string, nextOpen: boolean) => Promise<void>;
  onRequestCloseStore: (store: StoreUnit) => void;
  onDeleteStore: (id: string) => Promise<void>;
  onAddMerchandise: (input: {
    storeId: string;
    masterProductId?: string;
    name: string;
    photoDataUrl?: string;
    stockQuantity: number;
    unitPrice: number;
  }) => Promise<StoreMerchandiseItem>;
  onUpdateMerchandise: (
    id: string,
    updates: Partial<
      Omit<StoreMerchandiseItem, 'id' | 'storeId' | 'createdAt'>
    >
  ) => Promise<StoreMerchandiseItem>;
  onDeleteMerchandise: (id: string) => Promise<void>;
  onAddCategory: (
    input: Omit<CatalogCategory, 'id' | 'createdAt' | 'updatedAt' | 'order'>
  ) => Promise<CatalogCategory>;
  onUpdateCategory: (
    id: string,
    updates: Partial<Omit<CatalogCategory, 'id' | 'createdAt'>>
  ) => Promise<CatalogCategory>;
  onSetPrimaryCategory: (categoryId: string) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onAddSubcategory: (
    input: Omit<CatalogSubcategory, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<CatalogSubcategory>;
  onUpdateSubcategory: (
    id: string,
    updates: Partial<Omit<CatalogSubcategory, 'id' | 'createdAt'>>
  ) => Promise<CatalogSubcategory>;
  onToggleQuickPinSubcategory: (
    subcategoryId: string
  ) => Promise<CatalogSubcategory[]>;
  onDeleteSubcategory: (id: string) => Promise<void>;
  onDeleteOccurrence: (id: string) => Promise<void>;
  onClearAllOccurrences: () => Promise<void>;
  onFocusOccurrenceOnMap: (occId: string) => void;
  onFocusStoreOnMap: (storeId: string) => void;
}

const COLOR_SWATCHES = [
  '#DC2626',
  '#EA580C',
  '#D97706',
  '#059669',
  '#0284C7',
  '#2563EB',
  '#7C3AED',
  '#1E293B',
];

export const UnifiedAdminPanel: React.FC<UnifiedAdminPanelProps> = ({
  activeSection,
  currentUser,
  users,
  stores,
  categories,
  subcategories,
  occurrences,
  alertAudit,
  merchandise,
  masterProducts,
  adminAlerts,
  closingAlerts,
  onUpdateManagedUser,
  onResolveAdminAlert,
  onOpenClosingsScreen,
  onAddStore,
  onUpdateStore,
  onToggleStoreOpen,
  onRequestCloseStore,
  onDeleteStore,
  onAddMerchandise,
  onUpdateMerchandise,
  onDeleteMerchandise,
  onAddCategory,
  onUpdateCategory,
  onSetPrimaryCategory,
  onDeleteCategory,
  onAddSubcategory,
  onUpdateSubcategory,
  onToggleQuickPinSubcategory,
  onDeleteSubcategory,
  onDeleteOccurrence,
  onClearAllOccurrences,
  onFocusOccurrenceOnMap,
  onFocusStoreOnMap,
}) => {
  const isStoresAllowed = hasPermission(currentUser, 'canManageStores');
  const isStoreOptionsAllowed = canManageStoreOptions(currentUser.role);
  const isCatalogAllowed = canManageCatalog(currentUser);
  const canDefinePrimaryCategory = canSetPrimaryCategory(currentUser.role);
  const isOccurrencesAllowed = canManageGlobalOccurrences(currentUser.role);
  const isAuditAllowed = canViewAuditHistory(currentUser);
  const isGlobalAuditAllowed = canViewGlobalAuditHistory(currentUser.role);

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Lojas que o usuário logado pode gerenciar
  const manageableStores = useMemo(
    () => stores.filter((s) => canManageStore(currentUser, s, users)),
    [stores, currentUser, users]
  );
  const manageableStoreIds = useMemo(
    () => manageableStores.map((s) => s.id),
    [manageableStores]
  );

  // =====================================================
  // AUDITORIA / HISTÓRICO DE ALERTAS
  // =====================================================
  const [auditStatusFilter, setAuditStatusFilter] = useState<
    'ALL' | AlertAuditStatus
  >('ALL');
  const [auditSearchQuery, setAuditSearchQuery] = useState('');

  const scopedAuditEntries = useMemo(() => {
    const base = isGlobalAuditAllowed
      ? alertAudit
      : alertAudit.filter(
          (entry) =>
            entry.storeId && manageableStoreIds.includes(entry.storeId)
        );
    const q = auditSearchQuery.trim().toLowerCase();
    return base.filter((entry) => {
      if (auditStatusFilter !== 'ALL' && entry.status !== auditStatusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        entry.storeName.toLowerCase().includes(q) ||
        (entry.storeCode && entry.storeCode.toLowerCase().includes(q)) ||
        entry.categoryName.toLowerCase().includes(q) ||
        entry.subcategoryName.toLowerCase().includes(q) ||
        (entry.tag && entry.tag.toLowerCase().includes(q)) ||
        entry.createdByName.toLowerCase().includes(q) ||
        entry.createdByUsername.toLowerCase().includes(q) ||
        (entry.closedByName && entry.closedByName.toLowerCase().includes(q))
      );
    });
  }, [
    alertAudit,
    isGlobalAuditAllowed,
    manageableStoreIds,
    auditStatusFilter,
    auditSearchQuery,
  ]);

  // =====================================================
  // LOJAS / UNIDADES FIXAS (COM RESPONSÁVEL OBRIGATÓRIO + REGIÃO + OSM)
  // =====================================================
  const [storeRegionFilter, setStoreRegionFilter] = useState<
    StoreRegion | 'ALL'
  >('ALL');
  const [storeModalOpen, setStoreModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreUnit | null>(null);
  const [storeName, setStoreName] = useState('');
  const [storeRegion, setStoreRegion] = useState<StoreRegion>('Centro');
  const [storeAddress, setStoreAddress] = useState('');
  const [storeLat, setStoreLat] = useState('-23.5878');
  const [storeLng, setStoreLng] = useState('-46.7525');
  const [storeRadius, setStoreRadius] = useState('2');
  const [storeMotto, setStoreMotto] = useState('');
  const [storePhotoDataUrl, setStorePhotoDataUrl] = useState<
    string | undefined
  >(undefined);
  const [storeAlertDuration, setStoreAlertDuration] = useState('20');
  const [noManagerForStore, setNoManagerForStore] = useState(false);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [superiorSearchQuery, setSuperiorSearchQuery] = useState('');
  const [storeFormError, setStoreFormError] = useState<string | null>(null);
  const [confirmDeleteStoreId, setConfirmDeleteStoreId] = useState<
    string | null
  >(null);
  const [optionsModalStoreId, setOptionsModalStoreId] = useState<string | null>(
    null
  );
  const optionsModalStore = useMemo(
    () => stores.find((s) => s.id === optionsModalStoreId) || null,
    [stores, optionsModalStoreId]
  );

  const [addrSearch, setAddrSearch] = useState('');
  const [addrResults, setAddrResults] = useState<NominatimResult[]>([]);
  const [searchingAddr, setSearchingAddr] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const miniMapRef = useRef<HTMLDivElement | null>(null);
  const miniMapInstance = useRef<L.Map | null>(null);
  const miniCircleRef = useRef<L.Circle | null>(null);
  const miniMarkerRef = useRef<L.CircleMarker | null>(null);

  // Candidatos a Gerente visíveis ao usuário atual
  const availableGerentes = useMemo(
    () =>
      users.filter(
        (u) =>
          u.role === 'GERENTE' &&
          !u.isBlocked &&
          canViewTargetUserHierarchy(currentUser, u)
      ),
    [users, currentUser]
  );

  // Candidatos Governador / Presidente quando "Não há gerente para esta loja" está marcado
  const availableSuperiors = useMemo(() => {
    const q = superiorSearchQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (u.role !== 'GOVERNADOR' && u.role !== 'PRESIDENTE') return false;
      if (u.isBlocked) return false;
      if (!canViewTargetUserHierarchy(currentUser, u)) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.userCode.toLowerCase().includes(q)
      );
    });
  }, [users, currentUser, superiorSearchQuery]);

  const openCreateStoreModal = () => {
    setEditingStore(null);
    setStoreName('');
    setStoreRegion(currentUser.region || 'Centro');
    setStoreAddress('');
    setStoreLat('-23.5878');
    setStoreLng('-46.7525');
    setStoreRadius('2');
    setStoreMotto('');
    setStorePhotoDataUrl(undefined);
    setStoreAlertDuration('20');
    setStoreFormError(null);
    setSuperiorSearchQuery('');

    if (currentUser.role === 'GERENTE') {
      setNoManagerForStore(false);
      setSelectedManagerId(currentUser.id);
    } else if (availableGerentes.length > 0) {
      setNoManagerForStore(false);
      setSelectedManagerId(availableGerentes[0].id);
    } else {
      setNoManagerForStore(true);
      setSelectedManagerId(availableSuperiors[0]?.id || '');
    }

    setAddrSearch('');
    setAddrResults([]);
    setStoreModalOpen(true);
  };

  const openEditStoreModal = (store: StoreUnit) => {
    setEditingStore(store);
    setStoreName(store.name);
    setStoreRegion(store.region || 'Centro');
    setStoreAddress(store.address);
    setStoreLat(store.lat.toFixed(6));
    setStoreLng(store.lng.toFixed(6));
    setStoreRadius(store.radiusKm.toString());
    setStoreMotto(store.motto || '');
    setStorePhotoDataUrl(store.photoDataUrl);
    setStoreAlertDuration((store.alertDurationMinutes || 20).toString());
    setStoreFormError(null);
    setSuperiorSearchQuery('');

    const currentOwner = users.find((u) => u.id === store.managerId);
    const isSuperiorOwner =
      currentOwner &&
      (currentOwner.role === 'GOVERNADOR' || currentOwner.role === 'PRESIDENTE');

    setNoManagerForStore(Boolean(isSuperiorOwner));
    setSelectedManagerId(store.managerId || availableGerentes[0]?.id || '');
    setAddrSearch('');
    setAddrResults([]);
    setStoreModalOpen(true);
  };

  useEffect(() => {
    if (!storeModalOpen) {
      if (miniMapInstance.current) {
        miniMapInstance.current.remove();
        miniMapInstance.current = null;
        miniCircleRef.current = null;
        miniMarkerRef.current = null;
      }
      return;
    }

    const timer = window.setTimeout(() => {
      if (!miniMapRef.current || miniMapInstance.current) return;
      const lat = parseFloat(storeLat) || -23.5878;
      const lng = parseFloat(storeLng) || -46.7525;
      const rad = parseFloat(storeRadius) || 2;

      const map = L.map(miniMapRef.current, {
        center: [lat, lng],
        zoom: 14,
      });

      // OpenStreetMap nativo e gratuito
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const circle = L.circle([lat, lng], {
        radius: rad * 1000,
        color: '#2563EB',
        weight: 2,
        dashArray: '6 6',
        fillColor: '#3B82F6',
        fillOpacity: 0.12,
      }).addTo(map);

      const marker = L.circleMarker([lat, lng], {
        radius: 7,
        color: '#FFFFFF',
        weight: 2.5,
        fillColor: '#0F172A',
        fillOpacity: 1,
      }).addTo(map);

      map.fitBounds(computeCircleBounds(lat, lng, rad), {
        padding: [16, 16],
        maxZoom: 15,
      });

      map.on('click', (e: L.LeafletMouseEvent) => {
        setStoreLat(e.latlng.lat.toFixed(6));
        setStoreLng(e.latlng.lng.toFixed(6));
      });

      miniMapInstance.current = map;
      miniCircleRef.current = circle;
      miniMarkerRef.current = marker;
    }, 60);

    return () => window.clearTimeout(timer);
  }, [storeModalOpen]);

  useEffect(() => {
    const map = miniMapInstance.current;
    const circle = miniCircleRef.current;
    const marker = miniMarkerRef.current;
    if (!map || !circle || !marker) return;
    const lat = parseFloat(storeLat.replace(',', '.'));
    const lng = parseFloat(storeLng.replace(',', '.'));
    const rad = Math.max(0.2, parseFloat(storeRadius.replace(',', '.')) || 2);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    const pos = L.latLng(lat, lng);
    circle.setLatLng(pos);
    circle.setRadius(rad * 1000);
    marker.setLatLng(pos);
    map.fitBounds(computeCircleBounds(lat, lng, rad), {
      padding: [16, 16],
      maxZoom: 15,
      animate: true,
    });
  }, [storeLat, storeLng, storeRadius]);

  const handleSearchAddress = async () => {
    const q = addrSearch.trim();
    if (!q) return;
    setSearchingAddr(true);
    setAddrResults([]);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          q
        )}&limit=5`
      );
      if (res.ok) {
        setAddrResults((await res.json()) as NominatimResult[]);
      }
    } finally {
      setSearchingAddr(false);
    }
  };

  const handleUseGpsForStore = () => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        setStoreLat(pos.coords.latitude.toFixed(6));
        setStoreLng(pos.coords.longitude.toFixed(6));
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleUploadStorePhoto = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await resizeImageToDataUrl(file, 480, 0.82);
    setStorePhotoDataUrl(compressed);
  };

  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setStoreFormError(null);
    const lat = parseFloat(storeLat.replace(',', '.'));
    const lng = parseFloat(storeLng.replace(',', '.'));
    const radiusKm = Math.min(
      50,
      Math.max(0.2, parseFloat(storeRadius.replace(',', '.')) || 2)
    );
    const alertDurationMinutes = Math.min(
      240,
      Math.max(1, parseInt(storeAlertDuration, 10) || 20)
    );
    if (!storeName.trim() || Number.isNaN(lat) || Number.isNaN(lng)) {
      setStoreFormError('Informe o nome e as coordenadas válidas da loja.');
      return;
    }

    if (!selectedManagerId) {
      setStoreFormError(
        noManagerForStore
          ? 'Selecione um Governador ou Presidente responsável pela loja.'
          : 'Vincule um Gerente responsável ou marque "Não há gerente para esta loja".'
      );
      return;
    }

    try {
      if (editingStore) {
        const mergedManagers = Array.from(
          new Set([...(editingStore.managerIds || []), selectedManagerId])
        );
        await onUpdateStore(editingStore.id, {
          name: storeName.trim(),
          region: storeRegion,
          address: storeAddress.trim(),
          lat,
          lng,
          radiusKm,
          motto: storeMotto.trim() || undefined,
          photoDataUrl: storePhotoDataUrl,
          alertDurationMinutes,
          managerId: selectedManagerId,
          managerIds: mergedManagers,
        });
      } else {
        await onAddStore({
          name: storeName.trim(),
          region: storeRegion,
          address: storeAddress.trim(),
          lat,
          lng,
          radiusKm,
          isOpen: false,
          motto: storeMotto.trim() || undefined,
          photoDataUrl: storePhotoDataUrl,
          alertDurationMinutes,
          managerId: selectedManagerId,
          managerIds: [selectedManagerId],
          employeeIds: [],
        });
      }
      setStoreModalOpen(false);
    } catch (err) {
      setStoreFormError(
        err instanceof Error ? err.message : 'Erro ao salvar loja.'
      );
    }
  };

  const filteredStores = useMemo(() => {
    if (storeRegionFilter === 'ALL') return manageableStores;
    return manageableStores.filter((s) => s.region === storeRegionFilter);
  }, [manageableStores, storeRegionFilter]);

  // =====================================================
  // CATÁLOGO (GOVERNADOR+)
  // =====================================================
  const [expandedCatId, setExpandedCatId] = useState<string | null>(
    categories[0]?.id || null
  );
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<CatalogCategory | null>(null);
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState('#2563EB');
  const [catIconType, setCatIconType] =
    useState<CategoryIconType>('package_out');
  const [catEmoji, setCatEmoji] = useState('📦');
  const [confirmDeleteCatId, setConfirmDeleteCatId] = useState<string | null>(
    null
  );
  const [quickPinError, setQuickPinError] = useState<string | null>(null);
  const quickPinSubcategories = useMemo(
    () =>
      subcategories
        .filter((s) => Boolean(s.isQuickPin))
        .sort((a, b) => (a.quickPinOrder || 99) - (b.quickPinOrder || 99)),
    [subcategories]
  );

  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subParentCatId, setSubParentCatId] = useState<string>('');
  const [editingSub, setEditingSub] = useState<CatalogSubcategory | null>(null);
  const [subName, setSubName] = useState('');
  const [subVisualType, setSubVisualType] =
    useState<SubcategoryVisualType>('symbol');
  const [subVehicleKey, setSubVehicleKey] =
    useState<VehicleIconKey>('carro_colorido');
  const [subSymbolKey, setSubSymbolKey] = useState<SymbolKey>('box_send');
  const [subEmoji, setSubEmoji] = useState('🚨');
  const [subPhotoDataUrl, setSubPhotoDataUrl] = useState<string | undefined>(
    undefined
  );
  const [subColor, setSubColor] = useState('#2563EB');
  const [subPulse, setSubPulse] = useState(false);
  const [confirmClearOccs, setConfirmClearOccs] = useState(false);

  const openCreateCategory = () => {
    setEditingCat(null);
    setCatName('');
    setCatColor('#2563EB');
    setCatIconType('package_out');
    setCatEmoji('📦');
    setCatModalOpen(true);
  };

  const openEditCategory = (cat: CatalogCategory) => {
    setEditingCat(cat);
    setCatName(cat.name);
    setCatColor(cat.colorHex);
    setCatIconType(cat.iconType);
    setCatEmoji(cat.emoji || '📦');
    setCatModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    const payload = {
      name: catName.trim(),
      colorHex: catColor,
      iconType: catIconType,
      emoji: catIconType === 'custom_emoji' ? catEmoji.trim() || '📍' : undefined,
    };
    if (editingCat) {
      await onUpdateCategory(editingCat.id, payload);
    } else {
      const created = await onAddCategory(payload);
      setExpandedCatId(created.id);
    }
    setCatModalOpen(false);
  };

  const openCreateSubcategory = (categoryId: string, defaultColor: string) => {
    setEditingSub(null);
    setSubParentCatId(categoryId);
    setSubName('');
    setSubVisualType('symbol');
    setSubVehicleKey('carro_colorido');
    setSubSymbolKey('box_send');
    setSubEmoji('🚨');
    setSubPhotoDataUrl(undefined);
    setSubColor(defaultColor);
    setSubPulse(false);
    setSubModalOpen(true);
  };

  const openEditSubcategory = (sub: CatalogSubcategory) => {
    setEditingSub(sub);
    setSubParentCatId(sub.categoryId);
    setSubName(sub.name);
    setSubVisualType(sub.visualType);
    setSubVehicleKey(sub.vehicleIconKey || 'carro_colorido');
    setSubSymbolKey(sub.symbolKey || 'box_send');
    setSubEmoji(sub.emoji || '🚨');
    setSubPhotoDataUrl(sub.customImageDataUrl);
    setSubColor(sub.colorHex);
    setSubPulse(Boolean(sub.pulseEffect));
    setSubModalOpen(true);
  };

  const handleSaveSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subName.trim() || !subParentCatId) return;
    const payload: Omit<CatalogSubcategory, 'id' | 'createdAt' | 'updatedAt'> =
      {
        categoryId: subParentCatId,
        name: subName.trim(),
        visualType: subVisualType,
        vehicleIconKey:
          subVisualType === 'vehicle_svg' ? subVehicleKey : undefined,
        symbolKey:
          subVisualType === 'symbol'
            ? subSymbolKey
            : subVisualType === 'alert_triangle'
            ? 'alert_triangle'
            : undefined,
        emoji: subVisualType === 'emoji' ? subEmoji.trim() || '📍' : undefined,
        customImageDataUrl:
          subVisualType === 'photo' ? subPhotoDataUrl : undefined,
        colorHex: subVisualType === 'alert_triangle' ? '#DC2626' : subColor,
        pulseEffect: subPulse,
      };
    if (editingSub) {
      await onUpdateSubcategory(editingSub.id, payload);
    } else {
      await onAddSubcategory(payload);
    }
    setSubModalOpen(false);
  };

  const handleUploadSubPhoto = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await resizeImageToDataUrl(file, 220, 0.82);
    setSubPhotoDataUrl(compressed);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ===================================================== */}
        {/* SEÇÃO 1: LOJAS / UNIDADES FIXAS */}
        {/* ===================================================== */}
        {activeSection === 'stores' && isStoresAllowed && (
          <>
            <AdminAlertsBanner
              currentUser={currentUser}
              users={users}
              stores={stores}
              adminAlerts={adminAlerts}
              closingAlerts={closingAlerts}
              onResolveAdminAlert={onResolveAdminAlert}
              onOpenClosingsScreen={onOpenClosingsScreen}
              compact
            />
            <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Lojas &amp; Unidades Fixas
                </h1>
                <p className="text-sm text-slate-600 mt-0.5">
                  Toda loja exige um responsável vinculado (Gerente, ou Governador/Presidente).
                </p>
              </div>
              <button
                type="button"
                onClick={openCreateStoreModal}
                className="min-h-[46px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold flex items-center gap-2 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Cadastrar loja</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setStoreRegionFilter('ALL')}
                className={`min-h-[36px] px-3 rounded-lg text-xs font-bold whitespace-nowrap ${
                  storeRegionFilter === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                Todas ({manageableStores.length})
              </button>
              {STORE_REGIONS.map((reg) => {
                const count = manageableStores.filter(
                  (s) => s.region === reg
                ).length;
                return (
                  <button
                    key={reg}
                    type="button"
                    onClick={() => setStoreRegionFilter(reg)}
                    className={`min-h-[36px] px-3 rounded-lg text-xs font-bold whitespace-nowrap ${
                      storeRegionFilter === reg
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {reg} ({count})
                  </button>
                );
              })}
            </div>

            {filteredStores.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center text-sm text-slate-500">
                Nenhuma loja disponível neste filtro.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {filteredStores.map((store) => {
                  const isDeleting = confirmDeleteStoreId === store.id;
                  const owner = users.find((u) => u.id === store.managerId);
                  return (
                    <div
                      key={store.id}
                      className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        {store.photoDataUrl ? (
                          <img
                            src={store.photoDataUrl}
                            alt={store.name}
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div
                            className={`w-12 h-12 rounded-xl text-white flex items-center justify-center shrink-0 ${
                              store.isOpen ? 'bg-emerald-600' : 'bg-slate-600'
                            }`}
                          >
                            <Building2 className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 truncate">
                              {store.name}
                            </span>
                            <span className="text-xs font-mono-tabular font-bold text-slate-600">
                              {store.storeCode} · Região {store.region}
                            </span>
                            <span
                              className={`text-xs font-bold ${
                                store.isOpen
                                  ? 'text-emerald-700'
                                  : 'text-slate-500'
                              }`}
                            >
                              · {store.isOpen ? 'Aberta' : 'Fechada'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5 truncate">
                            {store.address || 'Endereço não informado'}
                          </div>
                          <div className="text-xs font-mono-tabular text-slate-500 mt-1">
                            Raio {store.radiusKm} km · Alertas{' '}
                            {store.alertDurationMinutes || 20} min ·{' '}
                            {store.employeeIds.length} operacionais ·{' '}
                            {(store.onlineUserIds || []).length} online
                            {owner
                              ? ` · Resp.: ${owner.name} (${ROLE_LABELS[owner.role]})`
                              : ''}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {hasPermission(currentUser, 'canOpenCloseStore') && (
                          <button
                            type="button"
                            onClick={() => {
                              if (store.isOpen) {
                                onRequestCloseStore(store);
                              } else {
                                void onToggleStoreOpen(store.id, true);
                              }
                            }}
                            className={`min-h-[42px] px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap ${
                              store.isOpen
                                ? 'bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                                : 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                            <span>{store.isOpen ? 'Aberta' : 'Fechada'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onFocusStoreOnMap(store.id)}
                          className="min-h-[42px] px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-800 flex items-center gap-1.5"
                        >
                          <MapPin className="w-4 h-4 text-blue-700" />
                          <span>Ver no mapa</span>
                        </button>
                        {isStoreOptionsAllowed && (
                          <button
                            type="button"
                            onClick={() => setOptionsModalStoreId(store.id)}
                            className="min-h-[42px] px-3 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-xs font-bold text-blue-900 flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            <span>Opções / Gerenciar Loja</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditStoreModal(store)}
                          className="min-h-[42px] px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-800 flex items-center gap-1.5"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>
                        {!isDeleting ? (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteStoreId(store.id)}
                            aria-label={`Excluir ${store.name}`}
                            className="min-h-[42px] px-3 rounded-xl border border-red-200 bg-red-50/50 hover:bg-red-100 text-red-700 text-xs font-bold flex items-center gap-1.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={async () => {
                                await onDeleteStore(store.id);
                                setConfirmDeleteStoreId(null);
                              }}
                              className="min-h-[42px] px-3 rounded-xl bg-red-600 text-white text-xs font-bold"
                            >
                              Excluir
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteStoreId(null)}
                              className="min-h-[42px] px-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold"
                            >
                              Cancelar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          </>
        )}

        {/* ===================================================== */}
        {/* SEÇÃO 2: CATÁLOGO (GOVERNADOR+) */}
        {/* ===================================================== */}
        {activeSection === 'catalog' && isCatalogAllowed && (
          <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Catálogo de Itens do Mapa
                </h1>
                <p className="text-sm text-slate-600 mt-0.5">
                  Categorias e Subcategorias exibidas nos botões grandes ao marcar ocorrências.
                </p>
              </div>

              <button
                type="button"
                onClick={openCreateCategory}
                className="min-h-[46px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold flex items-center gap-2 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Nova categoria</span>
              </button>
            </div>

            {currentUser.role === 'SUPER_ADMIN' && (
              <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/80 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-amber-950">
                    <Star className="w-4 h-4 fill-amber-500 text-amber-600 shrink-0" />
                    <span>
                      Barra Rápida do Mapa ({quickPinSubcategories.length}/3 tipos principais)
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-amber-900">
                    Marque até 3 itens abaixo para aparecerem direto ao tocar em Marcar Carro
                  </span>
                </div>

                {quickPinSubcategories.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {quickPinSubcategories.map((qp, idx) => (
                      <button
                        key={qp.id}
                        type="button"
                        onClick={async () => {
                          setQuickPinError(null);
                          try {
                            await onToggleQuickPinSubcategory(qp.id);
                          } catch (err) {
                            setQuickPinError(
                              err instanceof Error
                                ? err.message
                                : 'Erro ao atualizar barra rápida.'
                            );
                          }
                        }}
                        title="Toque para remover da barra rápida"
                        className="min-h-[34px] px-3 rounded-xl bg-white border border-amber-300 text-slate-900 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-amber-100/60"
                      >
                        <span className="font-mono-tabular text-amber-700 font-extrabold">
                          #{idx + 1}
                        </span>
                        <span>{qp.name}</span>
                        <X className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    ))}
                  </div>
                )}

                {quickPinError && (
                  <div className="px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-center justify-between gap-2">
                    <span>{quickPinError}</span>
                    <button
                      type="button"
                      onClick={() => setQuickPinError(null)}
                      className="text-red-700 hover:text-red-900 font-extrabold"
                    >
                      OK
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              {categories.map((cat) => {
                const subs = subcategories.filter(
                  (s) => s.categoryId === cat.id
                );
                const isExpanded = expandedCatId === cat.id;
                const isDeletingCat = confirmDeleteCatId === cat.id;

                return (
                  <div
                    key={cat.id}
                    className="rounded-2xl border border-slate-200 overflow-hidden bg-white"
                  >
                    <div className="p-4 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedCatId(isExpanded ? null : cat.id)
                        }
                        className="flex items-center gap-3 min-w-0 flex-1 text-left"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                        )}
                        <CategoryAvatar
                          iconType={cat.iconType}
                          colorHex={cat.colorHex}
                          emoji={cat.emoji}
                          alt={cat.name}
                          className="w-11 h-11"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base font-bold text-slate-900 truncate">
                              {cat.name}
                            </span>
                            {cat.isPrimary && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[11px] font-extrabold">
                                <Star className="w-3 h-3 fill-blue-700 text-blue-700" />
                                <span>Principal (Dock)</span>
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">
                            {subs.length}{' '}
                            {subs.length === 1
                              ? 'subcategoria'
                              : 'subcategorias'}
                          </div>
                        </div>
                      </button>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {canDefinePrimaryCategory && !cat.isPrimary && (
                          <button
                            type="button"
                            onClick={() => onSetPrimaryCategory(cat.id)}
                            className="min-h-[42px] px-3 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold flex items-center gap-1.5"
                          >
                            <Star className="w-3.5 h-3.5" />
                            <span>Definir Principal</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            openCreateSubcategory(cat.id, cat.colorHex)
                          }
                          className="min-h-[42px] px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Adicionar subcategoria</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditCategory(cat)}
                          aria-label={`Editar categoria ${cat.name}`}
                          className="min-h-[42px] min-w-[42px] px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {!isDeletingCat ? (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteCatId(cat.id)}
                            aria-label={`Excluir categoria ${cat.name}`}
                            className="min-h-[42px] min-w-[42px] px-3 rounded-xl border border-red-200 bg-white hover:bg-red-50 text-red-700 text-xs font-semibold flex items-center justify-center"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={async () => {
                                await onDeleteCategory(cat.id);
                                setConfirmDeleteCatId(null);
                              }}
                              className="min-h-[42px] px-3 rounded-xl bg-red-600 text-white text-xs font-bold"
                            >
                              Excluir tudo
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteCatId(null)}
                              className="min-h-[42px] px-2.5 rounded-xl bg-slate-200 text-slate-700 text-xs font-semibold"
                            >
                              Cancelar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 border-t border-slate-200 bg-white">
                        {subs.length === 0 ? (
                          <p className="text-xs text-slate-500 py-4 text-center">
                            Nenhuma subcategoria nesta categoria ainda.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {subs.map((sub) => {
                              const isQuickPinned = Boolean(sub.isQuickPin);
                              return (
                                <div
                                  key={sub.id}
                                  className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                                    isQuickPinned
                                      ? 'border-amber-300 bg-amber-50/40'
                                      : 'border-slate-200'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <OccurrenceAvatar
                                      spec={{
                                        visualType: sub.visualType,
                                        vehicleIconKey: sub.vehicleIconKey,
                                        symbolKey: sub.symbolKey,
                                        emoji: sub.emoji,
                                        customImageDataUrl:
                                          sub.customImageDataUrl,
                                        colorHex: sub.colorHex,
                                        pulseEffect: sub.pulseEffect,
                                      }}
                                      alt={sub.name}
                                      className="w-10 h-10"
                                    />
                                    <div className="min-w-0">
                                      <div className="text-xs font-bold text-slate-900 truncate">
                                        {sub.name}
                                      </div>
                                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                                        <span>
                                          {sub.pulseEffect
                                            ? 'Piscante · Alerta'
                                            : 'Padrão'}
                                        </span>
                                        {isQuickPinned && (
                                          <span className="text-amber-700 font-extrabold">
                                            · Barra Rápida
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    {currentUser.role === 'SUPER_ADMIN' && (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          setQuickPinError(null);
                                          try {
                                            await onToggleQuickPinSubcategory(
                                              sub.id
                                            );
                                          } catch (err) {
                                            setQuickPinError(
                                              err instanceof Error
                                                ? err.message
                                                : 'Limite de 3 tipos principais atingido.'
                                            );
                                          }
                                        }}
                                        title={
                                          isQuickPinned
                                            ? 'Remover da barra rápida do mapa'
                                            : 'Fixar na barra rápida do mapa (máx. 3)'
                                        }
                                        aria-label={
                                          isQuickPinned
                                            ? `Remover ${sub.name} da barra rápida`
                                            : `Fixar ${sub.name} na barra rápida`
                                        }
                                        aria-pressed={isQuickPinned}
                                        className={`min-h-[38px] px-2.5 flex items-center justify-center gap-1 rounded-lg text-[11px] font-extrabold transition-colors ${
                                          isQuickPinned
                                            ? 'bg-amber-500 text-white hover:bg-amber-600'
                                            : 'border border-slate-200 bg-white text-slate-600 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300'
                                        }`}
                                      >
                                        <Star
                                          className={`w-3.5 h-3.5 ${
                                            isQuickPinned ? 'fill-white' : ''
                                          }`}
                                        />
                                        <span className="hidden sm:inline">
                                          {isQuickPinned ? 'Principal' : 'Fixar'}
                                        </span>
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => openEditSubcategory(sub)}
                                      aria-label={`Editar ${sub.name}`}
                                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onDeleteSubcategory(sub.id)}
                                      aria-label={`Excluir ${sub.name}`}
                                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ===================================================== */}
        {/* SEÇÃO 3: AUDITORIA / HISTÓRICO DE ALERTAS (HOJE / ONTEM / DATA) */}
        {/* ===================================================== */}
        {activeSection === 'audit' && isAuditAllowed && (
          <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-slate-700" />
                  <span>Histórico de Alertas (Auditoria)</span>
                </h1>
                <p className="text-sm text-slate-600 mt-0.5">
                  {isGlobalAuditAllowed
                    ? 'Auditoria global com identificação automática de loja no perímetro e datas inteligentes.'
                    : 'Auditoria filtrada pelas unidades sob sua responsabilidade.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { key: 'ALL', label: 'Todos' },
                    { key: 'ACTIVE', label: 'Ativo' },
                    { key: 'EXPIRED', label: 'Expirado por tempo' },
                    { key: 'COMPLETED', label: 'Concluído/Excluído' },
                  ] as const
                ).map((st) => (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => setAuditStatusFilter(st.key)}
                    className={`min-h-[36px] px-3 rounded-lg text-xs font-bold whitespace-nowrap ${
                      auditStatusFilter === st.key
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={auditSearchQuery}
                onChange={(e) => setAuditSearchQuery(e.target.value)}
                placeholder="Filtrar por loja, tag (placa), item ou usuário..."
                className="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400"
              />
            </div>

            {scopedAuditEntries.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center text-sm text-slate-500">
                Nenhuma movimentação registrada neste filtro ainda.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <th className="py-3 px-3.5 whitespace-nowrap">
                        Quando (Hoje / Ontem / Data)
                      </th>
                      <th className="py-3 px-3.5 whitespace-nowrap">Loja</th>
                      <th className="py-3 px-3.5 whitespace-nowrap">
                        Categoria / Item
                      </th>
                      <th className="py-3 px-3.5 whitespace-nowrap">Tag</th>
                      <th className="py-3 px-3.5 whitespace-nowrap">
                        Registrado por
                      </th>
                      <th className="py-3 px-3.5 whitespace-nowrap">Status</th>
                      <th className="py-3 px-3.5 whitespace-nowrap">
                        Baixa / Exclusão
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scopedAuditEntries.map((entry) => {
                      const statusLabel =
                        entry.status === 'ACTIVE'
                          ? 'Ativo'
                          : entry.status === 'EXPIRED'
                          ? 'Expirado por tempo'
                          : 'Concluído/Excluído';
                      const statusColor =
                        entry.status === 'ACTIVE'
                          ? 'text-blue-700'
                          : entry.status === 'EXPIRED'
                          ? 'text-amber-700'
                          : 'text-emerald-700';

                      const resolvedStore = entry.storeId
                        ? stores.find((s) => s.id === entry.storeId)
                        : undefined;
                      const displayStoreName =
                        resolvedStore?.name || entry.storeName;
                      const displayStoreCode =
                        resolvedStore?.storeCode || entry.storeCode;

                      return (
                        <tr key={entry.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-3.5 font-mono-tabular font-semibold text-slate-800 whitespace-nowrap">
                            {formatRelativeDateTime(entry.createdAt)}
                          </td>
                          <td className="py-3 px-3.5 text-slate-900 font-bold whitespace-nowrap">
                            {displayStoreCode ? `${displayStoreCode} · ` : ''}
                            {displayStoreName}
                          </td>
                          <td className="py-3 px-3.5 text-slate-800">
                            <span className="font-bold">
                              {entry.subcategoryName}
                            </span>
                            <span className="text-slate-500">
                              {' '}
                              · {entry.categoryName}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 font-mono-tabular font-bold text-slate-900 whitespace-nowrap">
                            {entry.tag || '—'}
                          </td>
                          <td className="py-3 px-3.5 text-slate-700 whitespace-nowrap">
                            <span className="font-semibold text-slate-900">
                              {entry.createdByName}
                            </span>{' '}
                            <span className="font-mono-tabular text-slate-500">
                              (@{entry.createdByUsername})
                            </span>
                          </td>
                          <td
                            className={`py-3 px-3.5 font-bold whitespace-nowrap ${statusColor}`}
                          >
                            {statusLabel}
                          </td>
                          <td className="py-3 px-3.5 text-slate-700 whitespace-nowrap">
                            {entry.status === 'ACTIVE' ? (
                              <span className="text-slate-400">Em aberto</span>
                            ) : entry.status === 'EXPIRED' ? (
                              <span className="font-mono-tabular text-amber-800">
                                Automática ·{' '}
                                {formatRelativeDateTime(
                                  entry.closedAt || entry.expiresAt
                                )}
                              </span>
                            ) : (
                              <span>
                                <strong className="text-slate-900">
                                  {entry.closedByName || 'Sistema'}
                                </strong>{' '}
                                {entry.closedByUsername
                                  ? `(@${entry.closedByUsername})`
                                  : ''}{' '}
                                ·{' '}
                                <span className="font-mono-tabular text-slate-500">
                                  {entry.closedAt
                                    ? formatRelativeDateTime(entry.closedAt)
                                    : '—'}
                                </span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ===================================================== */}
        {/* SEÇÃO 4: OCORRÊNCIAS GLOBAIS (EXCLUSIVO SUPER ADMIN) */}
        {/* ===================================================== */}
        {activeSection === 'occurrences' && isOccurrencesAllowed && (
          <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Ocorrências Ativas no Mapa ({occurrences.length})
                </h1>
                <p className="text-sm text-slate-600 mt-0.5">
                  Visão global de todos os pinos marcados no mapa compartilhado.
                </p>
              </div>

              {occurrences.length > 0 && (
                <div className="flex items-center gap-2">
                  {!confirmClearOccs ? (
                    <button
                      type="button"
                      onClick={() => setConfirmClearOccs(true)}
                      className="min-h-[44px] px-4 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-1.5"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Limpar todas as ocorrências</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await onClearAllOccurrences();
                          setConfirmClearOccs(false);
                        }}
                        className="min-h-[44px] px-4 rounded-xl bg-red-600 text-white text-xs font-bold"
                      >
                        Confirmar limpeza
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearOccs(false)}
                        className="min-h-[44px] px-3 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {occurrences.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center text-sm text-slate-500">
                Nenhuma ocorrência ativa no mapa compartilhado.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {occurrences.map((occ) => {
                  const countdown = getCountdownStatus(
                    occ.createdAt,
                    occ.expiresAt,
                    occ.durationMinutes,
                    nowMs
                  );
                  const hitStores = stores.filter(
                    (s) =>
                      getDistanceMeters(occ.lat, occ.lng, s.lat, s.lng) <=
                      s.radiusKm * 1000
                  );
                  return (
                    <div
                      key={occ.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <OccurrenceAvatar
                          spec={{
                            visualType: occ.visualType,
                            vehicleIconKey: occ.vehicleIconKey,
                            symbolKey: occ.symbolKey,
                            emoji: occ.emoji,
                            customImageDataUrl: occ.customImageDataUrl,
                            colorHex: occ.colorHex,
                            pulseEffect: occ.pulseEffect,
                          }}
                          alt={occ.subcategoryName}
                          className="w-12 h-12"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 truncate">
                              {occ.subcategoryName}
                            </span>
                            {occ.tag && (
                              <span className="text-xs font-mono-tabular font-bold text-slate-700 inline-flex items-center gap-1">
                                <Tag className="w-3 h-3 text-slate-500" />
                                {occ.tag}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5">
                            {occ.categoryName} · Por {occ.createdByName} (@
                            {occ.createdByUsername}) ·{' '}
                            {formatTimeOfDay(occ.createdAt)}
                          </div>
                          <div className="text-xs font-mono-tabular mt-1 flex flex-wrap items-center gap-2">
                            <span
                              className={`font-bold ${
                                countdown.isUrgent
                                  ? 'text-red-700'
                                  : 'text-blue-700'
                              }`}
                            >
                              Expira em {countdown.formatted}
                            </span>
                            {hitStores.length > 0 && (
                              <span className="text-red-700 font-bold">
                                · Alerta em:{' '}
                                {hitStores
                                  .map((s) => `${s.storeCode} (${s.name})`)
                                  .join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onFocusOccurrenceOnMap(occ.id)}
                          className="min-h-[42px] px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-800 flex items-center gap-1.5"
                        >
                          <MapPin className="w-4 h-4 text-blue-700" />
                          <span>Ver no mapa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteOccurrence(occ.id)}
                          className="min-h-[42px] px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Concluir / Excluir</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {/* ===================================================== */}
      {/* MODAL: CADASTRAR / EDITAR LOJA FIXA (COM RESPONSÁVEL OBRIGATÓRIO) */}
      {/* ===================================================== */}
      {storeModalOpen && (
        <div
          className="fixed inset-0 z-[1300] flex items-end md:items-center justify-center bg-slate-950/60 backdrop-blur-xs"
          onClick={() => setStoreModalOpen(false)}
        >
          <div
            className="w-full md:max-w-xl bg-white rounded-t-3xl md:rounded-2xl border border-slate-200 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingStore ? 'Editar Loja / Unidade' : 'Cadastrar Nova Loja'}
              </h3>
              <button
                type="button"
                onClick={() => setStoreModalOpen(false)}
                className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveStore}
              className="flex-1 overflow-y-auto p-5 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome da Loja / Unidade
                  </label>
                  <input
                    type="text"
                    required
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Ex: Unidade Vila Olímpia"
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Região da Loja
                  </label>
                  <select
                    value={storeRegion}
                    onChange={(e) =>
                      setStoreRegion(e.target.value as StoreRegion)
                    }
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-900"
                  >
                    {STORE_REGIONS.map((reg) => (
                      <option key={reg} value={reg}>
                        Zona {reg}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Responsável Obrigatório pela Loja (Gerente ou Governador/Presidente) */}
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-blue-700" />
                    <span>Responsável Obrigatório pela Loja</span>
                  </span>
                </div>

                {!noManagerForStore ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Gerente Responsável
                    </label>
                    <select
                      value={selectedManagerId}
                      onChange={(e) => setSelectedManagerId(e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900"
                    >
                      <option value="">Selecione um Gerente...</option>
                      {availableGerentes.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.userCode})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700">
                      Buscar Governador ou Presidente (nome ou USR-)
                    </label>
                    <input
                      type="text"
                      value={superiorSearchQuery}
                      onChange={(e) => setSuperiorSearchQuery(e.target.value)}
                      placeholder="Digite nome ou código USR-..."
                      className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 bg-white text-sm"
                    />
                    <select
                      value={selectedManagerId}
                      onChange={(e) => setSelectedManagerId(e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900"
                    >
                      <option value="">
                        Selecione um Governador ou Presidente...
                      </option>
                      {availableSuperiors.map((sup) => (
                        <option key={sup.id} value={sup.id}>
                          {sup.name} · {ROLE_LABELS[sup.role]} ({sup.userCode})
                        </option>
                      ))}
                    </select>
                    {availableSuperiors.length === 0 && (
                      <p className="text-[11px] text-amber-800 font-semibold">
                        Nenhum Governador ou Presidente visível para seu cargo. Peça a um superior com Perfil Público ou crie a loja por um nível acima.
                      </p>
                    )}
                  </div>
                )}

                <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={noManagerForStore}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setNoManagerForStore(checked);
                      if (checked) {
                        setSelectedManagerId(availableSuperiors[0]?.id || '');
                      } else {
                        setSelectedManagerId(availableGerentes[0]?.id || '');
                      }
                    }}
                    className="w-4 h-4 accent-slate-900"
                  />
                  <span>Não há gerente para esta loja</span>
                </label>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Buscar endereço no mapa (Nominatim)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={addrSearch}
                    onChange={(e) => setAddrSearch(e.target.value)}
                    placeholder="Rua, bairro ou ponto de referência"
                    className="flex-1 min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleSearchAddress}
                    disabled={searchingAddr}
                    className="min-h-[44px] px-4 rounded-xl bg-slate-900 text-white text-xs font-bold"
                  >
                    {searchingAddr ? '...' : 'Buscar'}
                  </button>
                </div>

                {addrResults.length > 0 && (
                  <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 bg-slate-50 overflow-hidden">
                    {addrResults.map((res) => (
                      <button
                        key={res.place_id}
                        type="button"
                        onClick={() => {
                          setStoreLat(parseFloat(res.lat).toFixed(6));
                          setStoreLng(parseFloat(res.lon).toFixed(6));
                          setStoreAddress(
                            res.display_name.split(',').slice(0, 3).join(', ')
                          );
                          setAddrResults([]);
                        }}
                        className="w-full p-2.5 text-left text-xs text-slate-800 hover:bg-blue-50"
                      >
                        {res.display_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Endereço completo (exibido no mapa)
                </label>
                <input
                  type="text"
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  placeholder="Ex: Av. Paulista, 1000 - São Paulo"
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Frase / Recado da Loja (exibido no card do mapa)
                </label>
                <input
                  type="text"
                  maxLength={140}
                  value={storeMotto}
                  onChange={(e) => setStoreMotto(e.target.value)}
                  placeholder="Ex: Equipe ativa em monitoramento preventivo"
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <span className="block text-xs font-bold text-slate-700">
                  Foto / Imagem da Loja (opcional)
                </span>
                <div className="p-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex flex-wrap items-center gap-3">
                  {storePhotoDataUrl ? (
                    <img
                      src={storePhotoDataUrl}
                      alt="Prévia da loja"
                      referrerPolicy="no-referrer"
                      className="w-16 h-12 rounded-lg object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-16 h-12 rounded-lg bg-slate-200 flex items-center justify-center text-slate-500">
                      <Building2 className="w-5 h-5" />
                    </div>
                  )}
                  <label className="min-h-[40px] px-3.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800 inline-flex items-center gap-1.5 cursor-pointer">
                    <ImagePlus className="w-4 h-4 text-blue-700" />
                    <span>
                      {storePhotoDataUrl ? 'Trocar foto' : 'Enviar foto'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadStorePhoto}
                      className="hidden"
                    />
                  </label>
                  {storePhotoDataUrl && (
                    <button
                      type="button"
                      onClick={() => setStorePhotoDataUrl(undefined)}
                      className="min-h-[40px] px-3 rounded-xl text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      Remover foto
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Latitude
                  </label>
                  <input
                    type="text"
                    value={storeLat}
                    onChange={(e) => setStoreLat(e.target.value)}
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 font-mono-tabular text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Longitude
                  </label>
                  <input
                    type="text"
                    value={storeLng}
                    onChange={(e) => setStoreLng(e.target.value)}
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 font-mono-tabular text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Raio (km)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.2"
                    max="50"
                    value={storeRadius}
                    onChange={(e) => setStoreRadius(e.target.value)}
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 font-mono-tabular text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>Alerta (min)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="240"
                    value={storeAlertDuration}
                    onChange={(e) => setStoreAlertDuration(e.target.value)}
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 font-mono-tabular text-xs"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleUseGpsForStore}
                disabled={gpsLoading}
                className="w-full min-h-[42px] rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold flex items-center justify-center gap-2"
              >
                <Crosshair className="w-4 h-4" />
                <span>
                  {gpsLoading
                    ? 'Obtendo GPS...'
                    : 'Usar meu GPS atual como localização da loja'}
                </span>
              </button>

              <div className="space-y-1">
                <span className="block text-xs font-semibold text-slate-500">
                  Clique no mini-mapa (OpenStreetMap) para ajustar a posição exata:
                </span>
                <div
                  ref={miniMapRef}
                  className="w-full h-44 rounded-xl border border-slate-300 overflow-hidden"
                />
              </div>

              {storeFormError && (
                <p className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-xl">
                  {storeFormError}
                </p>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setStoreModalOpen(false)}
                  className="flex-1 min-h-[46px] rounded-xl bg-slate-100 text-slate-900 text-sm font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-[46px] rounded-xl bg-blue-700 text-white text-sm font-bold"
                >
                  {editingStore ? 'Salvar alterações' : 'Salvar loja'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================== */}
      {/* MODAL: CRIAR / EDITAR CATEGORIA (GOVERNADOR+) */}
      {/* ===================================================== */}
      {catModalOpen && isCatalogAllowed && (
        <div
          className="fixed inset-0 z-[1300] flex items-end md:items-center justify-center bg-slate-950/60 backdrop-blur-xs"
          onClick={() => setCatModalOpen(false)}
        >
          <div
            className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingCat ? 'Editar Categoria' : 'Nova Categoria'}
              </h3>
              <button
                type="button"
                onClick={() => setCatModalOpen(false)}
                className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveCategory} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome da Categoria
                </label>
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="Ex: Manutenção, Entrega Envio..."
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Ícone da Categoria
                </label>
                <select
                  value={catIconType}
                  onChange={(e) =>
                    setCatIconType(e.target.value as CategoryIconType)
                  }
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 bg-white text-sm"
                >
                  <option value="package_out">Envio / Saída</option>
                  <option value="package_in">Recebimento / Entrada</option>
                  <option value="alert_triangle">Triângulo de Alerta</option>
                  <option value="car">Veículo / Frota</option>
                  <option value="custom_emoji">Emoji Personalizado</option>
                </select>
              </div>

              {catIconType === 'custom_emoji' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Emoji
                  </label>
                  <input
                    type="text"
                    value={catEmoji}
                    onChange={(e) => setCatEmoji(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-lg"
                  />
                </div>
              )}

              <div>
                <span className="block text-xs font-bold text-slate-700 mb-1.5">
                  Cor principal
                </span>
                <div className="flex flex-wrap gap-2">
                  {COLOR_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setCatColor(hex)}
                      style={{ backgroundColor: hex }}
                      className={`w-9 h-9 rounded-xl border-2 ${
                        catColor === hex
                          ? 'border-slate-900 scale-110'
                          : 'border-white'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setCatModalOpen(false)}
                  className="flex-1 min-h-[46px] rounded-xl bg-slate-100 text-slate-900 text-sm font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-[46px] rounded-xl bg-blue-700 text-white text-sm font-bold"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================== */}
      {/* MODAL: CRIAR / EDITAR SUBCATEGORIA (GOVERNADOR+) */}
      {/* ===================================================== */}
      {subModalOpen && isCatalogAllowed && (
        <div
          className="fixed inset-0 z-[1300] flex items-end md:items-center justify-center bg-slate-950/60 backdrop-blur-xs"
          onClick={() => setSubModalOpen(false)}
        >
          <div
            className="w-full md:max-w-lg bg-white rounded-t-3xl md:rounded-2xl border border-slate-200 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingSub ? 'Editar Subcategoria' : 'Nova Subcategoria'}
              </h3>
              <button
                type="button"
                onClick={() => setSubModalOpen(false)}
                className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveSubcategory}
              className="flex-1 overflow-y-auto p-5 space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome da Subcategoria
                </label>
                <input
                  type="text"
                  required
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder="Ex: Entrega Expressa, Viatura PM, Alerta Crítico..."
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tipo de Ícone / Visual no Mapa
                </label>
                <select
                  value={subVisualType}
                  onChange={(e) => {
                    const val = e.target.value as SubcategoryVisualType;
                    setSubVisualType(val);
                    if (val === 'alert_triangle') {
                      setSubColor('#DC2626');
                      setSubPulse(true);
                    }
                  }}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 bg-white text-sm"
                >
                  <option value="symbol">Símbolos Operacionais</option>
                  <option value="alert_triangle">
                    Triângulo Vermelho de Alerta (!)
                  </option>
                  <option value="vehicle_svg">
                    Ícones de Veículos (Frota)
                  </option>
                  <option value="emoji">Emoji Personalizado</option>
                  <option value="photo">Foto Real (Upload)</option>
                </select>
              </div>

              {subVisualType === 'vehicle_svg' && (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {VEHICLE_ICON_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setSubVehicleKey(opt.key)}
                      className={`p-2 rounded-xl border flex flex-col items-center gap-1 ${
                        subVehicleKey === opt.key
                          ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600/20'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <VehicleAvatar
                        iconKey={opt.key}
                        alt={opt.label}
                        className="w-10 h-10"
                      />
                      <span className="text-[10px] font-semibold text-slate-700 truncate w-full text-center">
                        {opt.label.split(' ')[0]}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {subVisualType === 'symbol' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SYMBOL_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setSubSymbolKey(opt.key)}
                      className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 ${
                        subSymbolKey === opt.key
                          ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600/20'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <OccurrenceAvatar
                        spec={{
                          visualType: 'symbol',
                          symbolKey: opt.key,
                          colorHex: subColor,
                        }}
                        alt={opt.label}
                        className="w-10 h-10"
                      />
                      <span className="text-[11px] font-semibold text-slate-700 text-center leading-tight">
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {subVisualType === 'emoji' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Emoji do Pino
                  </label>
                  <input
                    type="text"
                    value={subEmoji}
                    onChange={(e) => setSubEmoji(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-lg"
                  />
                </div>
              )}

              {subVisualType === 'photo' && (
                <div className="p-3.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center gap-3">
                  <OccurrenceAvatar
                    spec={{
                      visualType: 'photo',
                      customImageDataUrl: subPhotoDataUrl,
                      colorHex: subColor,
                    }}
                    alt="Prévia"
                    className="w-14 h-14"
                  />
                  <label className="min-h-[44px] px-4 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800 flex items-center gap-2 cursor-pointer">
                    <ImagePlus className="w-4 h-4 text-blue-700" />
                    <span>Escolher imagem</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadSubPhoto}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              <div>
                <span className="block text-xs font-bold text-slate-700 mb-1.5">
                  Cor da borda no mapa
                </span>
                <div className="flex flex-wrap gap-2">
                  {COLOR_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setSubColor(hex)}
                      style={{ backgroundColor: hex }}
                      className={`w-9 h-9 rounded-xl border-2 ${
                        subColor === hex
                          ? 'border-slate-900 scale-110'
                          : 'border-white'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={subPulse}
                  onChange={(e) => setSubPulse(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-xs font-bold text-slate-800">
                  Ativar efeito visual piscante no pino (destaque de alerta)
                </span>
              </label>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSubModalOpen(false)}
                  className="flex-1 min-h-[46px] rounded-xl bg-slate-100 text-slate-900 text-sm font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-[46px] rounded-xl bg-blue-700 text-white text-sm font-bold"
                >
                  Salvar subcategoria
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================== */}
      {/* MODAL: OPÇÕES / GERENCIAR LOJA (GERENTE+) */}
      {/* ===================================================== */}
      {isStoreOptionsAllowed && (
        <StoreManageOptionsModal
          store={optionsModalStore}
          currentUser={currentUser}
          users={users}
          merchandise={merchandise}
          masterProducts={masterProducts}
          onUpdateManagedUser={onUpdateManagedUser}
          onAddMerchandise={onAddMerchandise}
          onUpdateMerchandise={onUpdateMerchandise}
          onDeleteMerchandise={onDeleteMerchandise}
          onClose={() => setOptionsModalStoreId(null)}
        />
      )}
    </div>
  );
};
