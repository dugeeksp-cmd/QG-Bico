import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Layers,
  Lock,
  MapPin,
  Package,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  Warehouse,
  XCircle,
} from 'lucide-react';
import {
  CentralStockEntry,
  MasterProduct,
  OperatorShiftInventory,
  ROLE_LABELS,
  STORE_REGIONS,
  StoreClosingRecord,
  StoreMerchandiseItem,
  StoreRegion,
  StoreUnit,
  UserAccount,
} from '../../types/radar';
import { formatCurrencyBRL, resizeImageToDataUrl } from '../../utils/geo';
import {
  canCreateMasterProduct,
  canManageCentralStock,
  canManageStore,
} from '../../utils/rbac';

interface InventoryManagementViewProps {
  currentUser: UserAccount;
  users: UserAccount[];
  stores: StoreUnit[];
  storeClosings: StoreClosingRecord[];
  masterProducts: MasterProduct[];
  centralStock: CentralStockEntry[];
  merchandise: StoreMerchandiseItem[];
  operatorShifts: OperatorShiftInventory[];
  onAddMasterProduct: (input: {
    name: string;
    photoDataUrl?: string;
    unitPrice: number;
  }) => Promise<MasterProduct>;
  onUpdateMasterProduct: (
    productId: string,
    updates: Partial<Pick<MasterProduct, 'name' | 'photoDataUrl' | 'unitPrice'>>
  ) => Promise<MasterProduct>;
  onDeleteMasterProduct: (productId: string) => Promise<void>;
  onUpsertCentralStock: (
    masterProductId: string,
    quantity: number,
    mode: 'ADD' | 'SET'
  ) => Promise<CentralStockEntry>;
  onAllocateCentralStockToStore: (
    storeId: string,
    masterProductId: string,
    quantity: number
  ) => Promise<StoreMerchandiseItem>;
}

function parseBRLInput(raw: string): number {
  const normalized = raw
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.]/g, '');
  const val = normalized ? parseFloat(normalized) : 0;
  return Number.isNaN(val) ? 0 : Math.max(0, val);
}

const REGION_ZONE_LABELS: Record<StoreRegion, string> = {
  Norte: 'Zona Norte',
  Sul: 'Zona Sul',
  Leste: 'Zona Leste',
  Oeste: 'Zona Oeste',
  Centro: 'Centro',
};

interface StockTrafficLightStyle {
  level: 'healthy' | 'warning' | 'critical' | 'empty';
  label: string;
  cardClass: string;
  badgeClass: string;
  subTextClass: string;
  titleClass: string;
  icon: React.ReactNode;
}

function getStockTrafficLight(totalUnits: number): StockTrafficLightStyle {
  if (totalUnits === 0) {
    return {
      level: 'empty',
      label: 'Sem estoque',
      cardClass: 'bg-slate-950 border-slate-900 text-white hover:bg-slate-900',
      badgeClass: 'bg-slate-800 text-white border border-slate-600',
      subTextClass: 'text-slate-300',
      titleClass: 'text-white',
      icon: <XCircle className="w-3.5 h-3.5 shrink-0" />,
    };
  }
  if (totalUnits < 0 || totalUnits <= 3) {
    return {
      level: 'critical',
      label: totalUnits < 0 ? 'Negativo' : 'Crítico',
      cardClass: 'bg-red-50 border-red-300 text-red-950 hover:bg-red-100/70',
      badgeClass: 'bg-red-600 text-white',
      subTextClass: 'text-red-800',
      titleClass: 'text-red-950',
      icon: <AlertCircle className="w-3.5 h-3.5 shrink-0" />,
    };
  }
  if (totalUnits <= 10) {
    return {
      level: 'warning',
      label: 'Alerta / Baixo',
      cardClass:
        'bg-amber-50 border-amber-300 text-amber-950 hover:bg-amber-100/70',
      badgeClass: 'bg-amber-400 text-slate-950',
      subTextClass: 'text-amber-900',
      titleClass: 'text-amber-950',
      icon: <AlertTriangle className="w-3.5 h-3.5 shrink-0" />,
    };
  }
  return {
    level: 'healthy',
    label: 'Saudável',
    cardClass:
      'bg-emerald-50 border-emerald-300 text-emerald-950 hover:bg-emerald-100/70',
    badgeClass: 'bg-emerald-600 text-white',
    subTextClass: 'text-emerald-800',
    titleClass: 'text-emerald-950',
    icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />,
  };
}

export const InventoryManagementView: React.FC<
  InventoryManagementViewProps
> = ({
  currentUser,
  users,
  stores,
  storeClosings,
  masterProducts,
  centralStock,
  merchandise,
  operatorShifts,
  onAddMasterProduct,
  onUpdateMasterProduct,
  onDeleteMasterProduct,
  onUpsertCentralStock,
  onAllocateCentralStockToStore,
}) => {
  const isMasterCreator = canCreateMasterProduct(currentUser.role);
  const isCentralAllowed = canManageCentralStock(currentUser.role);

  // Camada 1: Catálogo Mestre (Exclusivo Super Admin e Presidente)
  const [masterFormOpen, setMasterFormOpen] = useState(false);
  const [editingMaster, setEditingMaster] = useState<MasterProduct | null>(
    null
  );
  const [mpName, setMpName] = useState('');
  const [mpPhotoUrl, setMpPhotoUrl] = useState('');
  const [mpPrice, setMpPrice] = useState('');
  const [savingMp, setSavingMp] = useState(false);

  // Camada 1.5: Estoque Central -> Abastecer e Alocar para Loja
  const [selectedMasterId, setSelectedMasterId] = useState<string>('');
  const [centralQtyInput, setCentralQtyInput] = useState('20');
  const [allocStoreId, setAllocStoreId] = useState<string>('');
  const [allocMasterId, setAllocMasterId] = useState<string>('');
  const [allocQtyInput, setAllocQtyInput] = useState('10');
  const [busyAction, setBusyAction] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  const manageableStores = useMemo(
    () => stores.filter((s) => canManageStore(currentUser, s, users)),
    [stores, currentUser, users]
  );

  // Navegação escalável por Zona de SP + Modo Lojas vs Gerentes/Governadores
  const [selectedRegion, setSelectedRegion] = useState<StoreRegion>(() => {
    const firstWithStores = STORE_REGIONS.find((reg) =>
      manageableStores.some((s) => s.region === reg)
    );
    return firstWithStores || 'Oeste';
  });
  const [unitBrowseMode, setUnitBrowseMode] = useState<'stores' | 'managers'>(
    'stores'
  );
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');
  const [expandedStoreIds, setExpandedStoreIds] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    if (
      manageableStores.length > 0 &&
      !manageableStores.some((s) => s.region === selectedRegion)
    ) {
      const firstPopulated = STORE_REGIONS.find((reg) =>
        manageableStores.some((s) => s.region === reg)
      );
      if (firstPopulated) {
        setSelectedRegion(firstPopulated);
      }
    }
  }, [manageableStores, selectedRegion]);

  // Calcula quantidade vendida e valor total vendido HOJE por loja e por produto
  const dailySalesByStore = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const startMs = todayStart.getTime();

    const result = new Map<
      string,
      {
        totalQty: number;
        totalRevenue: number;
        qtyByItemId: Record<string, number>;
      }
    >();

    manageableStores.forEach((store) => {
      const qtyByItemId: Record<string, number> = {};
      let totalQty = 0;
      let totalRevenue = 0;

      const closingsToday = storeClosings.filter(
        (c) => c.storeId === store.id && c.closedAt >= startMs
      );
      closingsToday.forEach((c) => {
        if (c.soldItems && c.soldItems.length > 0) {
          c.soldItems.forEach((line) => {
            qtyByItemId[line.itemId] =
              (qtyByItemId[line.itemId] || 0) + line.quantitySold;
            totalQty += line.quantitySold;
          });
        } else if (c.totalItemsSold) {
          totalQty += c.totalItemsSold;
        }
        totalRevenue +=
          c.totalReceived ?? c.expectedSalesAmount ?? c.dailySalesAmount ?? 0;
      });

      // Soma vendas em tempo real dos turnos ATIVOS hoje (ou turnos fechados caso não haja fechamento correspondente)
      const shiftsToCount = operatorShifts.filter(
        (sh) =>
          sh.storeId === store.id &&
          (sh.status === 'ACTIVE' || closingsToday.length === 0)
      );
      shiftsToCount.forEach((sh) => {
        (sh.realTimeSales || []).forEach((sale) => {
          if (sale.createdAt >= startMs) {
            qtyByItemId[sale.storeItemId] =
              (qtyByItemId[sale.storeItemId] || 0) + sale.quantity;
            totalQty += sale.quantity;
            totalRevenue += sale.totalAmount;
          }
        });
      });

      result.set(store.id, {
        totalQty,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        qtyByItemId,
      });
    });

    return result;
  }, [manageableStores, storeClosings, operatorShifts]);

  const storesByRegionCount = useMemo(() => {
    const counts: Record<StoreRegion, number> = {
      Norte: 0,
      Sul: 0,
      Leste: 0,
      Oeste: 0,
      Centro: 0,
    };
    manageableStores.forEach((st) => {
      counts[st.region] = (counts[st.region] || 0) + 1;
    });
    return counts;
  }, [manageableStores]);

  const storesInSelectedRegion = useMemo(
    () => manageableStores.filter((st) => st.region === selectedRegion),
    [manageableStores, selectedRegion]
  );

  // Gerentes e Governadores com atuação na Zona de SP selecionada
  const managersInSelectedRegion = useMemo(() => {
    return users
      .filter((u) => {
        if (u.role !== 'GERENTE' && u.role !== 'GOVERNADOR') return false;
        const overseesStoreInZone = storesInSelectedRegion.some(
          (st) =>
            st.managerId === u.id ||
            (st.managerIds && st.managerIds.includes(u.id)) ||
            (u.role === 'GOVERNADOR' && u.region === selectedRegion)
        );
        return overseesStoreInZone || u.region === selectedRegion;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [users, storesInSelectedRegion, selectedRegion]);

  useEffect(() => {
    if (managersInSelectedRegion.length === 0) {
      setSelectedManagerId('');
      return;
    }
    if (!managersInSelectedRegion.some((m) => m.id === selectedManagerId)) {
      setSelectedManagerId(managersInSelectedRegion[0].id);
    }
  }, [managersInSelectedRegion, selectedManagerId]);

  const selectedManager = useMemo(
    () =>
      managersInSelectedRegion.find((m) => m.id === selectedManagerId) || null,
    [managersInSelectedRegion, selectedManagerId]
  );

  const selectedManagerStores = useMemo(() => {
    if (!selectedManager) return [];
    return manageableStores.filter((st) => {
      if (
        st.managerId === selectedManager.id ||
        (st.managerIds && st.managerIds.includes(selectedManager.id))
      ) {
        return true;
      }
      if (
        selectedManager.role === 'GOVERNADOR' &&
        selectedManager.region === st.region
      ) {
        return true;
      }
      return false;
    });
  }, [selectedManager, manageableStores]);

  const selectedManagerConsolidatedSales = useMemo(() => {
    return selectedManagerStores.reduce(
      (acc, st) => {
        const sales = dailySalesByStore.get(st.id);
        return {
          totalQty: acc.totalQty + (sales?.totalQty || 0),
          totalRevenue: Number(
            (acc.totalRevenue + (sales?.totalRevenue || 0)).toFixed(2)
          ),
        };
      },
      { totalQty: 0, totalRevenue: 0 }
    );
  }, [selectedManagerStores, dailySalesByStore]);

  const toggleStoreExpanded = (storeId: string) => {
    setExpandedStoreIds((prev) => ({
      ...prev,
      [storeId]: !prev[storeId],
    }));
  };

  const myCentralEntries = useMemo(() => {
    const map = new Map<string, number>();
    centralStock
      .filter((c) => c.ownerUserId === currentUser.id)
      .forEach((c) => {
        map.set(c.masterProductId, c.quantity);
      });
    return map;
  }, [centralStock, currentUser.id]);

  const activeShifts = useMemo(() => {
    const storeIds = new Set(manageableStores.map((s) => s.id));
    return operatorShifts.filter(
      (sh) => sh.status === 'ACTIVE' && storeIds.has(sh.storeId)
    );
  }, [operatorShifts, manageableStores]);

  const openCreateMaster = () => {
    setEditingMaster(null);
    setMpName('');
    setMpPhotoUrl('');
    setMpPrice('');
    setFeedback(null);
    setMasterFormOpen(true);
  };

  const openEditMaster = (mp: MasterProduct) => {
    setEditingMaster(mp);
    setMpName(mp.name);
    setMpPhotoUrl(mp.photoDataUrl || '');
    setMpPrice(mp.unitPrice.toFixed(2).replace('.', ','));
    setFeedback(null);
    setMasterFormOpen(true);
  };

  const handleUploadMasterPhoto = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await resizeImageToDataUrl(file, 220, 0.82);
    setMpPhotoUrl(compressed);
  };

  const handleSaveMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!mpName.trim()) {
      setFeedback({ type: 'err', text: 'Informe o nome do produto.' });
      return;
    }
    const price = parseBRLInput(mpPrice);
    setSavingMp(true);
    try {
      if (editingMaster) {
        await onUpdateMasterProduct(editingMaster.id, {
          name: mpName.trim(),
          photoDataUrl: mpPhotoUrl.trim() || undefined,
          unitPrice: price,
        });
        setFeedback({
          type: 'ok',
          text: 'Produto atualizado no Catálogo Mestre e sincronizado nas lojas.',
        });
      } else {
        await onAddMasterProduct({
          name: mpName.trim(),
          photoDataUrl: mpPhotoUrl.trim() || undefined,
          unitPrice: price,
        });
        setFeedback({
          type: 'ok',
          text: 'Novo produto adicionado ao Catálogo Mestre Global.',
        });
      }
      setMasterFormOpen(false);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erro ao salvar produto.',
      });
    } finally {
      setSavingMp(false);
    }
  };

  const handleAddToCentral = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const targetMpId = selectedMasterId || masterProducts[0]?.id;
    if (!targetMpId) {
      setFeedback({
        type: 'err',
        text: 'Nenhum produto disponível no Catálogo Mestre.',
      });
      return;
    }
    const qty = Math.max(1, parseInt(centralQtyInput || '0', 10) || 0);
    setBusyAction(true);
    try {
      await onUpsertCentralStock(targetMpId, qty, 'ADD');
      setFeedback({
        type: 'ok',
        text: `+${qty} unidades adicionadas ao seu Estoque Central.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text:
          err instanceof Error
            ? err.message
            : 'Erro ao abastecer Estoque Central.',
      });
    } finally {
      setBusyAction(false);
    }
  };

  const handleAllocateToStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const targetStoreId = allocStoreId || manageableStores[0]?.id;
    const targetMpId = allocMasterId || masterProducts[0]?.id;
    if (!targetStoreId || !targetMpId) {
      setFeedback({
        type: 'err',
        text: 'Selecione a loja e o produto para alocar.',
      });
      return;
    }
    const qty = Math.max(1, parseInt(allocQtyInput || '0', 10) || 0);
    setBusyAction(true);
    try {
      await onAllocateCentralStockToStore(targetStoreId, targetMpId, qty);
      setFeedback({
        type: 'ok',
        text: `${qty} unidades transferidas do seu Estoque Central para a loja!`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erro ao alocar estoque.',
      });
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Warehouse className="w-6 h-6 text-blue-700" />
              <span>Produtos &amp; Estoque em 3 Camadas</span>
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Camada 1: Catálogo Mestre · Camada 2: Estoque Central &amp; Lojas · Camada 3: Carga em Mãos do Operador.
            </p>
          </div>
          {isMasterCreator && (
            <button
              type="button"
              onClick={openCreateMaster}
              className="min-h-[46px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold flex items-center gap-2 self-start"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Produto Mestre</span>
            </button>
          )}
        </div>

        {feedback && (
          <div
            role="status"
            className={`p-3.5 rounded-xl border text-xs font-bold ${
              feedback.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* ======================================================= */}
        {/* CAMADA 1: CATÁLOGO MESTRE GLOBAL (SUPER ADMIN / PRESIDENTE) */}
        {/* ======================================================= */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-700" />
                <span>1. Catálogo Mestre Global ({masterProducts.length})</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isMasterCreator
                  ? 'Como Super Admin / Presidente, você cria, precifica e gerencia os produtos oficiais de toda a rede.'
                  : 'Catálogo oficial definido pelo Super Admin / Presidente. Selecione produtos existentes para abastecer seu Estoque Central.'}
              </p>
            </div>
            {!isMasterCreator && (
              <span className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>Criação restrita a Presidente / Super Admin</span>
              </span>
            )}
          </div>

          {masterFormOpen && isMasterCreator && (
            <form
              onSubmit={handleSaveMaster}
              className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900">
                  {editingMaster
                    ? `Editar Produto: ${editingMaster.name}`
                    : 'Novo Produto no Catálogo Mestre'}
                </span>
                <button
                  type="button"
                  onClick={() => setMasterFormOpen(false)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  Cancelar
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {mpPhotoUrl ? (
                  <img
                    src={mpPhotoUrl}
                    alt={mpName || 'Prévia'}
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-full object-cover border-2 border-slate-300 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-slate-200 border-2 border-slate-300 text-slate-500 flex items-center justify-center shrink-0">
                    <Package className="w-6 h-6" />
                  </div>
                )}

                <div className="flex-1 min-w-[200px] space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="min-h-[38px] px-3 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800 inline-flex items-center gap-1.5 cursor-pointer hover:bg-slate-50">
                      <ImagePlus className="w-3.5 h-3.5 text-blue-700" />
                      <span>Foto do Produto</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadMasterPhoto}
                        className="hidden"
                      />
                    </label>
                    {mpPhotoUrl && (
                      <button
                        type="button"
                        onClick={() => setMpPhotoUrl('')}
                        className="text-xs font-semibold text-red-700 hover:underline"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                  <input
                    type="url"
                    value={mpPhotoUrl.startsWith('data:') ? '' : mpPhotoUrl}
                    onChange={(e) => setMpPhotoUrl(e.target.value)}
                    placeholder="Ou cole a URL da imagem (opcional)"
                    className="w-full min-h-[38px] px-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Nome do produto
                  </label>
                  <input
                    type="text"
                    required
                    value={mpName}
                    onChange={(e) => setMpName(e.target.value)}
                    placeholder="Ex: Água Mineral 500ml"
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Preço Unitário Padrão (R$)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={mpPrice}
                    onChange={(e) => setMpPrice(e.target.value)}
                    placeholder="0,00"
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white font-mono-tabular text-sm font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingMp}
                  className="min-h-[44px] px-5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-bold"
                >
                  {savingMp
                    ? 'Salvando...'
                    : editingMaster
                    ? 'Salvar Alterações'
                    : 'Criar no Catálogo Mestre'}
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {masterProducts.map((mp) => {
              const centralQty = myCentralEntries.get(mp.id) || 0;
              return (
                <div
                  key={mp.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {mp.photoDataUrl ? (
                      <img
                        src={mp.photoDataUrl}
                        alt={mp.name}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-full object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-white border border-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                        <Package className="w-5 h-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">
                        {mp.name}
                      </div>
                      <div className="text-xs font-mono-tabular font-extrabold text-blue-800 mt-0.5">
                        {formatCurrencyBRL(mp.unitPrice)}
                      </div>
                      {isCentralAllowed && (
                        <div className="text-[11px] font-mono-tabular text-slate-500 mt-0.5">
                          Seu Central: <strong>{centralQty} un</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  {isMasterCreator && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditMaster(mp)}
                        aria-label={`Editar ${mp.name}`}
                        className="min-h-[38px] min-w-[38px] rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 flex items-center justify-center"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteMasterProduct(mp.id)}
                        aria-label={`Excluir ${mp.name}`}
                        className="min-h-[38px] min-w-[38px] rounded-lg bg-white border border-red-200 hover:bg-red-50 text-red-700 flex items-center justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ======================================================= */}
        {/* CAMADA 1.5 & 2: MEU ESTOQUE CENTRAL + ALOCAÇÃO PARA LOJAS */}
        {/* ======================================================= */}
        {isCentralAllowed && (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Abastecer Meu Estoque Central */}
            <form
              onSubmit={handleAddToCentral}
              className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4"
            >
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>2A. Abastecer Meu Estoque Central</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Selecione um produto do Catálogo Mestre e adicione a quantidade desejada ao seu estoque ({ROLE_LABELS[currentUser.role]}).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Produto do Catálogo Mestre
                  </label>
                  <select
                    value={selectedMasterId || masterProducts[0]?.id || ''}
                    onChange={(e) => setSelectedMasterId(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold"
                  >
                    {masterProducts.map((mp) => (
                      <option key={mp.id} value={mp.id}>
                        {mp.name} ({formatCurrencyBRL(mp.unitPrice)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Qtd. a somar
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={centralQtyInput}
                    onChange={(e) => setCentralQtyInput(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 font-mono-tabular text-sm font-bold"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busyAction || masterProducts.length === 0}
                className="w-full min-h-[46px] rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar ao Meu Estoque Central</span>
              </button>
            </form>

            {/* Alocar do Meu Estoque Central para Loja */}
            <form
              onSubmit={handleAllocateToStore}
              className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4"
            >
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-blue-700" />
                  <span>2B. Alocar Carga do Central para Loja</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Transfere unidades do seu Estoque Central diretamente para o estoque da unidade selecionada.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Loja Destino
                  </label>
                  <select
                    value={allocStoreId || manageableStores[0]?.id || ''}
                    onChange={(e) => setAllocStoreId(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold"
                  >
                    {manageableStores.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.storeCode} · {st.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Produto
                  </label>
                  <select
                    value={allocMasterId || masterProducts[0]?.id || ''}
                    onChange={(e) => setAllocMasterId(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold"
                  >
                    {masterProducts.map((mp) => {
                      const avail = myCentralEntries.get(mp.id) || 0;
                      return (
                        <option key={mp.id} value={mp.id}>
                          {mp.name} (Central: {avail})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Qtd. transferir
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={allocQtyInput}
                    onChange={(e) => setAllocQtyInput(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 font-mono-tabular text-sm font-bold"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={
                  busyAction ||
                  manageableStores.length === 0 ||
                  masterProducts.length === 0
                }
                className="w-full min-h-[46px] rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>Transferir para Estoque da Loja</span>
              </button>
            </form>
          </section>
        )}

        {/* ======================================================= */}
        {/* VISÃO ESCALÁVEL POR ZONA DE SP + SEMÁFORO DE ESTOQUE + VENDAS */}
        {/* ======================================================= */}
        <section className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-700" />
                  <span>
                    Estoque Atual por Unidade ({manageableStores.length})
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Filtre por Zona de São Paulo, alterne entre Lojas ou Gerentes/Governadores e toque em uma unidade para ver produtos e vendas do dia.
                </p>
              </div>

              {/* Legenda explícita do semáforo (Cor + Rótulo) */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                <span className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Saudável (&gt;10)</span>
                </span>
                <span className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-950 inline-flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  <span>Alerta (4–10)</span>
                </span>
                <span className="px-2 py-1 rounded-lg bg-red-50 border border-red-200 text-red-900 inline-flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-red-600" />
                  <span>Crítico / Negativo (≤3)</span>
                </span>
                <span className="px-2 py-1 rounded-lg bg-slate-950 text-white inline-flex items-center gap-1">
                  <XCircle className="w-3 h-3 text-slate-300" />
                  <span>Sem estoque (0)</span>
                </span>
              </div>
            </div>

            {/* Passo 1: Filtro por Zona de São Paulo */}
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-700" />
                <span>1. Selecione a Zona de São Paulo</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {STORE_REGIONS.map((region) => {
                  const active = selectedRegion === region;
                  const count = storesByRegionCount[region] || 0;
                  return (
                    <button
                      key={region}
                      type="button"
                      onClick={() => setSelectedRegion(region)}
                      className={`min-h-[44px] px-3 rounded-xl border text-xs font-extrabold flex items-center justify-between gap-2 transition-colors ${
                        active
                          ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate">
                        {REGION_ZONE_LABELS[region]}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded-md font-mono-tabular text-[11px] ${
                          active
                            ? 'bg-slate-800 text-blue-300'
                            : 'bg-white border border-slate-200 text-slate-600'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Passo 2: Escolher modo de visualização (Lojas da Região vs Gerentes / Governadores) */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
              <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setUnitBrowseMode('stores')}
                  className={`min-h-[40px] px-3.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-colors ${
                    unitBrowseMode === 'stores'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>
                    Lojas da Região ({storesInSelectedRegion.length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setUnitBrowseMode('managers')}
                  className={`min-h-[40px] px-3.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-colors ${
                    unitBrowseMode === 'managers'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>
                    Gerentes / Governadores ({managersInSelectedRegion.length})
                  </span>
                </button>
              </div>
            </div>

            {/* Conteúdo do Modo 1: Lojas da Região */}
            {unitBrowseMode === 'stores' && (
              <div className="space-y-3">
                {storesInSelectedRegion.length === 0 ? (
                  <div className="p-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center space-y-1">
                    <p className="text-sm font-bold text-slate-700">
                      Nenhuma loja cadastrada em{' '}
                      {REGION_ZONE_LABELS[selectedRegion]}
                    </p>
                    <p className="text-xs text-slate-500">
                      Selecione outra zona de São Paulo acima ou cadastre novas unidades nesta região.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {storesInSelectedRegion.map((store) => {
                      const items = merchandise.filter(
                        (m) => m.storeId === store.id
                      );
                      const totalUnits = items.reduce(
                        (acc, it) => acc + it.stockQuantity,
                        0
                      );
                      const traffic = getStockTrafficLight(totalUnits);
                      const sales = dailySalesByStore.get(store.id) || {
                        totalQty: 0,
                        totalRevenue: 0,
                        qtyByItemId: {},
                      };
                      const isExpanded = Boolean(expandedStoreIds[store.id]);
                      const isDark = traffic.level === 'empty';

                      return (
                        <div
                          key={store.id}
                          className={`rounded-xl border transition-colors overflow-hidden ${traffic.cardClass}`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleStoreExpanded(store.id)}
                            aria-expanded={isExpanded}
                            className="w-full p-4 text-left space-y-2.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide inline-flex items-center gap-1 ${traffic.badgeClass}`}
                                  >
                                    {traffic.icon}
                                    <span>{traffic.label}</span>
                                  </span>
                                  <span
                                    className={`text-[11px] font-mono-tabular font-bold ${traffic.subTextClass}`}
                                  >
                                    {store.storeCode} ·{' '}
                                    {store.isOpen ? 'Aberta' : 'Fechada'}
                                  </span>
                                </div>
                                <div
                                  className={`text-sm font-extrabold truncate mt-1 ${traffic.titleClass}`}
                                >
                                  {store.name}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <div className="text-right font-mono-tabular">
                                  <div
                                    className={`text-sm font-extrabold ${traffic.titleClass}`}
                                  >
                                    {totalUnits} un
                                  </div>
                                  <div
                                    className={`text-[11px] font-semibold ${traffic.subTextClass}`}
                                  >
                                    em estoque
                                  </div>
                                </div>
                                {isExpanded ? (
                                  <ChevronUp
                                    className={`w-4 h-4 shrink-0 ${traffic.subTextClass}`}
                                  />
                                ) : (
                                  <ChevronDown
                                    className={`w-4 h-4 shrink-0 ${traffic.subTextClass}`}
                                  />
                                )}
                              </div>
                            </div>

                            <div
                              className={`pt-2 border-t flex flex-wrap items-center justify-between gap-2 text-xs font-mono-tabular ${
                                isDark
                                  ? 'border-slate-800 text-slate-200'
                                  : 'border-black/10 text-slate-800'
                              }`}
                            >
                              <span>
                                Vendido hoje:{' '}
                                <strong>{sales.totalQty} un</strong>
                              </span>
                              <span className="font-extrabold">
                                {formatCurrencyBRL(sales.totalRevenue)}
                              </span>
                            </div>
                          </button>

                          {isExpanded && (
                            <div
                              className={`px-4 pb-4 pt-2 border-t space-y-2.5 ${
                                isDark
                                  ? 'bg-slate-900/90 border-slate-800 text-slate-100'
                                  : 'bg-white border-slate-200 text-slate-900'
                              }`}
                            >
                              <div className="text-[11px] font-extrabold uppercase tracking-wider opacity-75">
                                Detalhamento de Produtos e Vendas do Dia
                              </div>
                              {items.length === 0 ? (
                                <p className="text-xs opacity-75">
                                  Sem produtos alocados nesta loja.
                                </p>
                              ) : (
                                <div className="space-y-1.5">
                                  {items.map((it) => {
                                    const soldToday =
                                      sales.qtyByItemId[it.id] || 0;
                                    const itemLight = getStockTrafficLight(
                                      it.stockQuantity
                                    );
                                    return (
                                      <div
                                        key={it.id}
                                        className={`px-3 py-2 rounded-lg border flex items-center justify-between gap-2 text-xs ${
                                          isDark
                                            ? 'bg-slate-950 border-slate-800'
                                            : 'bg-slate-50 border-slate-200'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          {it.photoDataUrl ? (
                                            <img
                                              src={it.photoDataUrl}
                                              alt={it.name}
                                              referrerPolicy="no-referrer"
                                              className="w-6 h-6 rounded-full object-cover shrink-0"
                                            />
                                          ) : (
                                            <Package className="w-4 h-4 opacity-60 shrink-0" />
                                          )}
                                          <span className="font-bold truncate">
                                            {it.name}
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-2.5 font-mono-tabular shrink-0">
                                          <span className="text-[11px] opacity-80">
                                            Vend. hoje:{' '}
                                            <strong>{soldToday} un</strong>
                                          </span>
                                          <span
                                            className={`px-2 py-0.5 rounded font-extrabold text-[11px] ${itemLight.badgeClass}`}
                                          >
                                            {it.stockQuantity} un
                                          </span>
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
                )}
              </div>
            )}

            {/* Conteúdo do Modo 2: Gerentes / Governadores da Região */}
            {unitBrowseMode === 'managers' && (
              <div className="space-y-4">
                {managersInSelectedRegion.length === 0 ? (
                  <div className="p-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center space-y-1">
                    <p className="text-sm font-bold text-slate-700">
                      Nenhum Gerente ou Governador vinculado em{' '}
                      {REGION_ZONE_LABELS[selectedRegion]}
                    </p>
                    <p className="text-xs text-slate-500">
                      Selecione outra zona de São Paulo acima ou vincule gestores às unidades desta região.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Lista de seleção do Gerente / Governador */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {managersInSelectedRegion.map((mgr) => {
                        const isSelected = mgr.id === selectedManager?.id;
                        const mgrStoresCount = manageableStores.filter(
                          (st) =>
                            st.managerId === mgr.id ||
                            (st.managerIds && st.managerIds.includes(mgr.id)) ||
                            (mgr.role === 'GOVERNADOR' &&
                              mgr.region === st.region)
                        ).length;
                        return (
                          <button
                            key={mgr.id}
                            type="button"
                            onClick={() => setSelectedManagerId(mgr.id)}
                            className={`p-3 rounded-xl border text-left transition-colors flex items-center justify-between gap-2 ${
                              isSelected
                                ? 'bg-blue-50 border-blue-600 text-slate-900 ring-1 ring-blue-600'
                                : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-extrabold truncate">
                                {mgr.name}
                              </div>
                              <div className="text-[11px] font-mono-tabular text-slate-600 truncate">
                                {ROLE_LABELS[mgr.role]} · {mgr.userCode}
                              </div>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-md font-mono-tabular text-[11px] font-extrabold shrink-0 ${
                                isSelected
                                  ? 'bg-blue-700 text-white'
                                  : 'bg-white border border-slate-200 text-slate-700'
                              }`}
                            >
                              {mgrStoresCount}{' '}
                              {mgrStoresCount === 1 ? 'loja' : 'lojas'}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Lojas sob responsabilidade do Gerente/Governador selecionado */}
                    {selectedManager && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                            Unidades sob responsabilidade de{' '}
                            <span className="text-slate-900">
                              {selectedManager.name}
                            </span>{' '}
                            ({selectedManagerStores.length})
                          </h3>
                        </div>

                        {selectedManagerStores.length === 0 ? (
                          <div className="p-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-500">
                            Este gestor ainda não possui lojas vinculadas.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {selectedManagerStores.map((store) => {
                              const items = merchandise.filter(
                                (m) => m.storeId === store.id
                              );
                              const totalUnits = items.reduce(
                                (acc, it) => acc + it.stockQuantity,
                                0
                              );
                              const traffic = getStockTrafficLight(totalUnits);
                              const sales = dailySalesByStore.get(store.id) || {
                                totalQty: 0,
                                totalRevenue: 0,
                                qtyByItemId: {},
                              };
                              const isExpanded = Boolean(
                                expandedStoreIds[store.id]
                              );
                              const isDark = traffic.level === 'empty';

                              return (
                                <div
                                  key={store.id}
                                  className={`rounded-xl border transition-colors overflow-hidden ${traffic.cardClass}`}
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleStoreExpanded(store.id)
                                    }
                                    aria-expanded={isExpanded}
                                    className="w-full p-4 text-left space-y-2.5"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span
                                            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide inline-flex items-center gap-1 ${traffic.badgeClass}`}
                                          >
                                            {traffic.icon}
                                            <span>{traffic.label}</span>
                                          </span>
                                          <span
                                            className={`text-[11px] font-mono-tabular font-bold ${traffic.subTextClass}`}
                                          >
                                            {store.storeCode} ·{' '}
                                            {REGION_ZONE_LABELS[store.region]}
                                          </span>
                                        </div>
                                        <div
                                          className={`text-sm font-extrabold truncate mt-1 ${traffic.titleClass}`}
                                        >
                                          {store.name}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0">
                                        <div className="text-right font-mono-tabular">
                                          <div
                                            className={`text-sm font-extrabold ${traffic.titleClass}`}
                                          >
                                            {totalUnits} un
                                          </div>
                                          <div
                                            className={`text-[11px] font-semibold ${traffic.subTextClass}`}
                                          >
                                            em estoque
                                          </div>
                                        </div>
                                        {isExpanded ? (
                                          <ChevronUp
                                            className={`w-4 h-4 shrink-0 ${traffic.subTextClass}`}
                                          />
                                        ) : (
                                          <ChevronDown
                                            className={`w-4 h-4 shrink-0 ${traffic.subTextClass}`}
                                          />
                                        )}
                                      </div>
                                    </div>

                                    <div
                                      className={`pt-2 border-t flex flex-wrap items-center justify-between gap-2 text-xs font-mono-tabular ${
                                        isDark
                                          ? 'border-slate-800 text-slate-200'
                                          : 'border-black/10 text-slate-800'
                                      }`}
                                    >
                                      <span>
                                        Vendido hoje:{' '}
                                        <strong>{sales.totalQty} un</strong>
                                      </span>
                                      <span className="font-extrabold">
                                        {formatCurrencyBRL(sales.totalRevenue)}
                                      </span>
                                    </div>
                                  </button>

                                  {isExpanded && (
                                    <div
                                      className={`px-4 pb-4 pt-2 border-t space-y-2 ${
                                        isDark
                                          ? 'bg-slate-900/90 border-slate-800 text-slate-100'
                                          : 'bg-white border-slate-200 text-slate-900'
                                      }`}
                                    >
                                      {items.length === 0 ? (
                                        <p className="text-xs opacity-75">
                                          Sem produtos alocados nesta loja.
                                        </p>
                                      ) : (
                                        items.map((it) => {
                                          const soldToday =
                                            sales.qtyByItemId[it.id] || 0;
                                          const itemLight =
                                            getStockTrafficLight(
                                              it.stockQuantity
                                            );
                                          return (
                                            <div
                                              key={it.id}
                                              className={`px-3 py-2 rounded-lg border flex items-center justify-between gap-2 text-xs ${
                                                isDark
                                                  ? 'bg-slate-950 border-slate-800'
                                                  : 'bg-slate-50 border-slate-200'
                                              }`}
                                            >
                                              <span className="font-bold truncate">
                                                {it.name}
                                              </span>
                                              <div className="flex items-center gap-2.5 font-mono-tabular shrink-0">
                                                <span className="text-[11px] opacity-80">
                                                  Vend. hoje:{' '}
                                                  <strong>
                                                    {soldToday} un
                                                  </strong>
                                                </span>
                                                <span
                                                  className={`px-2 py-0.5 rounded font-extrabold text-[11px] ${itemLight.badgeClass}`}
                                                >
                                                  {it.stockQuantity} un
                                                </span>
                                              </div>
                                            </div>
                                          );
                                        })
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Rodapé Consolidado de Vendas do Dia do Gestor */}
                        <div className="rounded-xl bg-slate-900 text-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="text-[11px] font-extrabold uppercase tracking-wider text-blue-300">
                              Soma Consolidada das Vendas do Dia
                            </div>
                            <div className="text-sm font-bold mt-0.5">
                              {selectedManager.name} (
                              {ROLE_LABELS[selectedManager.role]}) ·{' '}
                              {selectedManagerStores.length}{' '}
                              {selectedManagerStores.length === 1
                                ? 'unidade'
                                : 'unidades'}
                            </div>
                          </div>
                          <div className="flex items-center gap-5 font-mono-tabular">
                            <div>
                              <div className="text-[11px] text-slate-400">
                                Qtd. Vendida Hoje
                              </div>
                              <div className="text-lg font-extrabold text-white">
                                {selectedManagerConsolidatedSales.totalQty} un
                              </div>
                            </div>
                            <div>
                              <div className="text-[11px] text-slate-400">
                                Total Consolidado (R$)
                              </div>
                              <div className="text-lg font-extrabold text-emerald-400">
                                {formatCurrencyBRL(
                                  selectedManagerConsolidatedSales.totalRevenue
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-700" />
              <span>3. Cargas em Mãos no Turno ({activeShifts.length})</span>
            </h2>
            {activeShifts.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                Nenhum operador está com carga ativa em mãos neste momento.
              </div>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {activeShifts.map((sh) => {
                  const inHand = sh.items.reduce(
                    (acc, it) => acc + it.currentHandQty,
                    0
                  );
                  const sold = sh.items.reduce(
                    (acc, it) => acc + it.soldQty,
                    0
                  );
                  return (
                    <div
                      key={sh.id}
                      className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-slate-900 truncate">
                            {sh.userName} ({ROLE_LABELS[sh.userRole]})
                          </div>
                          <div className="text-[11px] font-mono-tabular text-slate-600">
                            {sh.storeCode} · {sh.storeName}
                          </div>
                        </div>
                        <div className="text-right font-mono-tabular text-xs">
                          <div className="font-extrabold text-emerald-800">
                            {inHand} em mãos
                          </div>
                          <div className="text-[11px] text-slate-600">
                            {sold} vendidos
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {sh.items.map((it) => (
                          <span
                            key={it.storeItemId}
                            className="px-2 py-1 rounded-lg bg-white border border-emerald-200 text-[11px] font-mono-tabular text-slate-800"
                          >
                            {it.itemName}: <strong>{it.currentHandQty}</strong>{' '}
                            rest. ({it.soldQty} vend.)
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
