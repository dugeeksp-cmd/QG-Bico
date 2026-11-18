import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  GitFork,
  MapPin,
  Power,
  QrCode,
  ShieldCheck,
  Store as StoreIcon,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import {
  AdminFinanceAlert,
  AlertAuditEntry,
  ClosingAlertNotification,
  MapOccurrence,
  ROLE_LABELS,
  STORE_REGIONS,
  StoreClosingRecord,
  StoreShiftLog,
  StoreUnit,
  UserAccount,
} from '../../types/radar';
import {
  formatCurrencyBRL,
  formatRelativeDateTime,
  formatTimeOfDay,
  getOccurrencePhase,
} from '../../utils/geo';
import {
  canManageStore,
  canViewGlobalAuditHistory,
  isUserLinkedToStore,
  ROLE_LEVEL,
} from '../../utils/rbac';
import { AdminAlertsBanner } from './AdminAlertsBanner';

interface DashboardViewProps {
  currentUser: UserAccount;
  users: UserAccount[];
  stores: StoreUnit[];
  storeClosings: StoreClosingRecord[];
  shiftLogs: StoreShiftLog[];
  occurrences: MapOccurrence[];
  alertAudit: AlertAuditEntry[];
  adminAlerts: AdminFinanceAlert[];
  closingAlerts: ClosingAlertNotification[];
  onResolveAdminAlert: (
    alertId: string,
    status: 'CONFIRMED' | 'DISCREPANCY',
    observation?: string
  ) => Promise<AdminFinanceAlert>;
  onOpenClosingsScreen: () => void;
  onFocusStoreOnMap: (storeId: string) => void;
}

const SHIFT_ACTION_META: Record<
  StoreShiftLog['action'] | 'REOPENED',
  { label: string; textClass: string; bgClass: string }
> = {
  OPENED: {
    label: 'Abertura da loja',
    textClass: 'text-emerald-800',
    bgClass: 'bg-emerald-50 border-emerald-200',
  },
  CLOSED: {
    label: 'Fechamento / Pausa',
    textClass: 'text-slate-800',
    bgClass: 'bg-slate-100 border-slate-300',
  },
  REOPENED: {
    label: 'Reabertura no mesmo dia',
    textClass: 'text-blue-800',
    bgClass: 'bg-blue-50 border-blue-200',
  },
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  users,
  stores,
  storeClosings,
  shiftLogs,
  occurrences,
  alertAudit,
  adminAlerts,
  closingAlerts,
  onResolveAdminAlert,
  onOpenClosingsScreen,
  onFocusStoreOnMap,
}) => {
  const isGlobal = canViewGlobalAuditHistory(currentUser.role);
  const [selectedStoreIdForTimeline, setSelectedStoreIdForTimeline] = useState<
    string | null
  >(null);

  // Estado dos nós expandidos da Árvore Hierárquica
  const [expandedRegionKeys, setExpandedRegionKeys] = useState<Set<string>>(
    () => new Set()
  );
  const [expandedPresKeys, setExpandedPresKeys] = useState<Set<string>>(
    () => new Set()
  );
  const [expandedGovKeys, setExpandedGovKeys] = useState<Set<string>>(
    () => new Set()
  );
  const [expandedGerenteKeys, setExpandedGerenteKeys] = useState<Set<string>>(
    () => new Set()
  );

  const visibleStores = useMemo(
    () =>
      isGlobal
        ? stores
        : stores.filter((s) => canManageStore(currentUser, s, users)),
    [isGlobal, stores, currentUser, users]
  );

  const visibleStoreIds = useMemo(
    () => new Set(visibleStores.map((s) => s.id)),
    [visibleStores]
  );

  const visibleClosings = useMemo(
    () =>
      isGlobal
        ? storeClosings
        : storeClosings.filter((c) => visibleStoreIds.has(c.storeId)),
    [isGlobal, storeClosings, visibleStoreIds]
  );

  const visibleShiftLogs = useMemo(
    () =>
      isGlobal
        ? shiftLogs
        : shiftLogs.filter((l) => visibleStoreIds.has(l.storeId)),
    [isGlobal, shiftLogs, visibleStoreIds]
  );

  const visibleAudits = useMemo(
    () =>
      isGlobal
        ? alertAudit
        : alertAudit.filter((a) => a.storeId && visibleStoreIds.has(a.storeId)),
    [isGlobal, alertAudit, visibleStoreIds]
  );

  const todayStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }, []);

  const todayClosings = useMemo(
    () => visibleClosings.filter((c) => c.closedAt >= todayStart),
    [visibleClosings, todayStart]
  );

  const todaySalesTotal = useMemo(
    () =>
      todayClosings.reduce(
        (acc, item) =>
          acc + (item.totalReceived ?? item.dailySalesAmount ?? 0),
        0
      ),
    [todayClosings]
  );

  const allTimeSalesTotal = useMemo(
    () =>
      visibleClosings.reduce(
        (acc, item) =>
          acc + (item.totalReceived ?? item.dailySalesAmount ?? 0),
        0
      ),
    [visibleClosings]
  );

  const financialBreakdown = useMemo(() => {
    let cashTotal = 0;
    let pixTotal = 0;
    let expectedTotal = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let pendingCount = 0;

    visibleClosings.forEach((c) => {
      const cash = c.cashReceived ?? 0;
      const pix = c.pixReceived ?? 0;
      const fallbackTotal = c.totalReceived ?? c.dailySalesAmount ?? 0;
      if (c.cashReceived !== undefined || c.pixReceived !== undefined) {
        cashTotal += cash;
        pixTotal += pix;
      } else {
        cashTotal += fallbackTotal;
      }
      expectedTotal += c.expectedSalesAmount ?? fallbackTotal;

      if (c.reviewStatus === 'APPROVED') approvedCount += 1;
      else if (c.reviewStatus === 'REJECTED') rejectedCount += 1;
      else pendingCount += 1;
    });

    const receivedTotal = cashTotal + pixTotal;
    const cashPct =
      receivedTotal > 0 ? Math.round((cashTotal / receivedTotal) * 100) : 0;
    const pixPct = receivedTotal > 0 ? 100 - cashPct : 0;
    const diffTotal = receivedTotal - expectedTotal;
    const totalReviews = approvedCount + rejectedCount + pendingCount;

    return {
      cashTotal,
      pixTotal,
      expectedTotal,
      receivedTotal,
      cashPct,
      pixPct,
      diffTotal,
      approvedCount,
      rejectedCount,
      pendingCount,
      totalReviews,
    };
  }, [visibleClosings]);

  const totalStoresCount = visibleStores.length;
  const openStoresCount = visibleStores.filter((s) => s.isOpen).length;
  const closedStoresCount = totalStoresCount - openStoresCount;
  const openStoresPercent =
    totalStoresCount > 0
      ? Math.round((openStoresCount / totalStoresCount) * 100)
      : 0;
  const closedStoresPercent =
    totalStoresCount > 0 ? 100 - openStoresPercent : 0;

  // Cálculo da equipe subordinada vinculada às lojas visíveis vs equipe online no momento
  const staffMetrics = useMemo(() => {
    const linkedIds = new Set<string>();
    const onlineIds = new Set<string>();

    visibleStores.forEach((store) => {
      if (store.managerId) linkedIds.add(store.managerId);
      (store.managerIds || []).forEach((uid) => linkedIds.add(uid));
      (store.employeeIds || []).forEach((uid) => linkedIds.add(uid));
      (store.onlineUserIds || []).forEach((uid) => onlineIds.add(uid));
    });

    const activeLinkedUsers = users.filter(
      (u) => !u.isBlocked && linkedIds.has(u.id)
    );
    const activeOnlineUsers = activeLinkedUsers.filter((u) =>
      onlineIds.has(u.id)
    );

    const total = activeLinkedUsers.length;
    const online = activeOnlineUsers.length;
    const percent = total > 0 ? Math.round((online / total) * 100) : 0;

    return { total, online, percent };
  }, [visibleStores, users]);

  const activePhaseAlertsCount = useMemo(() => {
    const now = Date.now();
    return occurrences.filter((occ) => {
      const inScope =
        isGlobal || (occ.storeId && visibleStoreIds.has(occ.storeId));
      if (!inScope) return false;
      return (
        getOccurrencePhase(occ.lastUpdatedAt || occ.createdAt, now).phase ===
        'active'
      );
    }).length;
  }, [occurrences, isGlobal, visibleStoreIds]);

  const totalScopedOccurrences = isGlobal
    ? occurrences.length
    : occurrences.filter((o) => o.storeId && visibleStoreIds.has(o.storeId))
        .length;

  const completedAuditsCount = visibleAudits.filter(
    (a) => a.status === 'COMPLETED'
  ).length;
  const expiredAuditsCount = visibleAudits.filter(
    (a) => a.status === 'EXPIRED'
  ).length;

  // Loja selecionada para exibir Linha do Tempo de Turnos do Dia
  const selectedStoreForTimeline = useMemo(
    () =>
      visibleStores.find((s) => s.id === selectedStoreIdForTimeline) || null,
    [visibleStores, selectedStoreIdForTimeline]
  );

  const selectedStoreTodayLogs = useMemo(() => {
    if (!selectedStoreForTimeline) return [];
    return visibleShiftLogs
      .filter(
        (l) =>
          l.storeId === selectedStoreForTimeline.id &&
          l.timestamp >= todayStart
      )
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [selectedStoreForTimeline, visibleShiftLogs, todayStart]);

  // =====================================================
  // ÁRVORE HIERÁRQUICA EXECUTIVA (4 NÍVEIS)
  // Nível 1: Região
  // Nível 2: Presidência / Diretoria Regional
  // Nível 3: Governador(es)
  // Nível 4: Gerente(s) -> ao clicar, expande TODAS as lojas + TODA equipe operacional
  // =====================================================
  const hierarchyTree = useMemo(() => {
    const presidentes = users.filter(
      (u) => u.role === 'PRESIDENTE' && !u.isBlocked
    );
    const governadores = users.filter(
      (u) => u.role === 'GOVERNADOR' && !u.isBlocked
    );
    const gerentes = users.filter((u) => u.role === 'GERENTE' && !u.isBlocked);

    const regionsWithStores = STORE_REGIONS.map((region) => {
      const regStores = visibleStores.filter((s) => s.region === region);
      return { region, stores: regStores };
    }).filter((r) => r.stores.length > 0);

    return regionsWithStores.map(({ region, stores: regStores }) => {
      const regPresidentes = presidentes.filter(
        (p) => !p.region || p.region === region
      );
      const presNodes =
        regPresidentes.length > 0
          ? regPresidentes.map((p) => ({
              key: `${region}__pres__${p.id}`,
              label: p.name,
              sublabel: `${ROLE_LABELS[p.role]} · ${p.userCode}`,
              user: p as UserAccount | null,
            }))
          : [
              {
                key: `${region}__pres__dir`,
                label: `Diretoria Regional ${region}`,
                sublabel: 'Presidência / Supervisão Geral',
                user: null as UserAccount | null,
              },
            ];

      const regGovs = governadores.filter(
        (g) =>
          g.region === region &&
          (currentUser.role !== 'GOVERNADOR' || g.id === currentUser.id)
      );

      const govNodes =
        regGovs.length > 0
          ? regGovs.map((gov) => {
              const govGerentes = gerentes.filter((ger) => {
                const managesVisibleStoreInRegion = regStores.some(
                  (st) => st.managerId === ger.id
                );
                return (
                  managesVisibleStoreInRegion &&
                  (currentUser.role !== 'GERENTE' || ger.id === currentUser.id)
                );
              });

              return {
                key: `${region}__gov__${gov.id}`,
                label: gov.name,
                sublabel: `${ROLE_LABELS[gov.role]} · ${gov.userCode}`,
                gov,
                gerentes: govGerentes,
              };
            })
          : [
              {
                key: `${region}__gov__unassigned`,
                label: `Supervisão Regional (${region})`,
                sublabel: 'Sem Governador exclusivo na região',
                gov: null as UserAccount | null,
                gerentes: gerentes.filter((ger) =>
                  regStores.some((st) => st.managerId === ger.id)
                ),
              },
            ];

      // Verifica se há lojas sem gerente na região
      const assignedGerenteIds = new Set(
        govNodes.flatMap((g) => g.gerentes.map((ger) => ger.id))
      );
      const orphanStores = regStores.filter(
        (st) => !st.managerId || !assignedGerenteIds.has(st.managerId)
      );

      return {
        region,
        stores: regStores,
        presNodes,
        govNodes,
        orphanStores,
      };
    });
  }, [users, visibleStores, currentUser]);

  const toggleSetKey = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    key: string
  ) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getOperationalTeamForStores = (targetStores: StoreUnit[]) => {
    const storeIds = new Set(targetStores.map((s) => s.id));
    const onlineSet = new Set<string>();
    targetStores.forEach((s) =>
      (s.onlineUserIds || []).forEach((uid) => onlineSet.add(uid))
    );

    return users
      .filter((u) => {
        if (u.isBlocked) return false;
        if (ROLE_LEVEL[u.role] < 5) return false; // Subgerente (5), Fiscal (6), Caixa (7)
        return targetStores.some((st) => isUserLinkedToStore(u.id, st));
      })
      .sort((a, b) => ROLE_LEVEL[a.role] - ROLE_LEVEL[b.role])
      .map((u) => ({
        user: u,
        isOnline: onlineSet.has(u.id),
        linkedStoreCodes: targetStores
          .filter((st) => storeIds.has(st.id) && isUserLinkedToStore(u.id, st))
          .map((st) => st.storeCode),
      }));
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Dashboard Operacional &amp; Vendas
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Visão executiva ({ROLE_LABELS[currentUser.role]}) ·{' '}
              {isGlobal
                ? 'Rede completa'
                : `${visibleStores.length} ${
                    visibleStores.length === 1
                      ? 'unidade sob sua gestão'
                      : 'unidades sob sua gestão'
                  }`}
            </p>
          </div>
        </div>

        {/* Central de Alertas Administrativos / Financeiros (isolada do mapa) */}
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

        {/* KPIs Principais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Status das Lojas</span>
              <Power className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-2xl font-extrabold font-mono-tabular text-slate-900">
              {openStoresPercent}%{' '}
              <span className="text-sm font-semibold text-emerald-700">
                abertas
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden flex">
              <div
                className="bg-emerald-600 transition-all"
                style={{ width: `${openStoresPercent}%` }}
              />
            </div>
            <div className="text-xs font-mono-tabular text-slate-600 flex justify-between">
              <span>
                {openStoresCount} abertas ({openStoresPercent}%)
              </span>
              <span>
                {closedStoresCount} fechadas ({closedStoresPercent}%)
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Equipe Online no Momento</span>
              <Users className="w-4 h-4 text-blue-700" />
            </div>
            <div className="text-2xl font-extrabold font-mono-tabular text-slate-900">
              {staffMetrics.percent}%{' '}
              <span className="text-sm font-semibold text-blue-700">
                online
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden flex">
              <div
                className="bg-blue-600 transition-all"
                style={{ width: `${staffMetrics.percent}%` }}
              />
            </div>
            <div className="text-xs font-mono-tabular text-slate-600">
              {staffMetrics.online} de {staffMetrics.total} colaboradores
              conectados
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Alertas Ativos no Radar</span>
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <div className="text-2xl font-extrabold font-mono-tabular text-slate-900">
              {activePhaseAlertsCount}
              <span className="text-sm font-semibold text-slate-500 ml-1.5">
                ({totalScopedOccurrences} até 1h)
              </span>
            </div>
            <div className="text-xs text-slate-500 font-mono-tabular">
              {completedAuditsCount} concluídos · {expiredAuditsCount} expirados
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Vendas Consolidadas Hoje</span>
              <Banknote className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-2xl font-extrabold font-mono-tabular text-slate-900">
              {formatCurrencyBRL(todaySalesTotal)}
            </div>
            <div className="text-xs text-slate-500 font-mono-tabular">
              {todayClosings.length}{' '}
              {todayClosings.length === 1
                ? 'fechamento hoje'
                : 'fechamentos hoje'}{' '}
              · Total: {formatCurrencyBRL(allTimeSalesTotal)}
            </div>
          </div>
        </div>

        {/* Gráfico Visual por Região */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-700" />
              <span>Operação por Região ({totalStoresCount} lojas)</span>
            </h2>
            <span className="text-xs font-mono-tabular text-slate-500">
              Verde = Abertas · Cinza = Fechadas
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {STORE_REGIONS.map((region) => {
              const regStores = visibleStores.filter(
                (s) => s.region === region
              );
              const regOpen = regStores.filter((s) => s.isOpen).length;
              const regPct =
                regStores.length > 0
                  ? Math.round((regOpen / regStores.length) * 100)
                  : 0;
              const regSales = todayClosings
                .filter((c) => c.region === region)
                .reduce(
                  (sum, c) =>
                    sum + (c.totalReceived ?? c.dailySalesAmount ?? 0),
                  0
                );

              return (
                <div
                  key={region}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                      Região {region}
                    </span>
                    <span className="text-xs font-mono-tabular font-bold text-slate-700">
                      {regPct}%
                    </span>
                  </div>
                  <div className="text-lg font-extrabold font-mono-tabular text-slate-900">
                    {regStores.length}{' '}
                    <span className="text-xs font-semibold text-slate-500">
                      {regStores.length === 1 ? 'loja' : 'lojas'}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-emerald-600"
                      style={{ width: `${regPct}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-600 font-mono-tabular">
                    {regOpen} abertas · {formatCurrencyBRL(regSales)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Consolidação Financeira (Dinheiro vs Pix) & Status de Conferências */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-700" />
                <span>Receita Consolidada: Dinheiro vs Pix</span>
              </h2>
              <span className="text-xs font-mono-tabular font-bold text-slate-500">
                {visibleClosings.length}{' '}
                {visibleClosings.length === 1 ? 'fechamento' : 'fechamentos'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Dinheiro</span>
                </div>
                <div className="text-lg font-extrabold font-mono-tabular text-emerald-950 mt-1">
                  {formatCurrencyBRL(financialBreakdown.cashTotal)}
                </div>
                <div className="text-[11px] font-mono-tabular text-emerald-700">
                  {financialBreakdown.cashPct}% do recebido
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200">
                <div className="text-xs font-bold text-blue-800 flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Pix</span>
                </div>
                <div className="text-lg font-extrabold font-mono-tabular text-blue-950 mt-1">
                  {formatCurrencyBRL(financialBreakdown.pixTotal)}
                </div>
                <div className="text-[11px] font-mono-tabular text-blue-700">
                  {financialBreakdown.pixPct}% do recebido
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden flex">
                {financialBreakdown.receivedTotal > 0 && (
                  <>
                    <div
                      className="bg-emerald-600 transition-all"
                      style={{ width: `${financialBreakdown.cashPct}%` }}
                    />
                    <div
                      className="bg-blue-600 transition-all"
                      style={{ width: `${financialBreakdown.pixPct}%` }}
                    />
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono-tabular text-slate-600">
                <span>
                  Esperado em itens:{' '}
                  {formatCurrencyBRL(financialBreakdown.expectedTotal)}
                </span>
                <span
                  className={`font-bold ${
                    Math.abs(financialBreakdown.diffTotal) < 0.01
                      ? 'text-emerald-700'
                      : financialBreakdown.diffTotal > 0
                      ? 'text-blue-700'
                      : 'text-red-700'
                  }`}
                >
                  Saldo acumulado:{' '}
                  {financialBreakdown.diffTotal > 0 ? '+' : ''}
                  {formatCurrencyBRL(financialBreakdown.diffTotal)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-700" />
                <span>Status das Conferências de Fechamento</span>
              </h2>
              <span className="text-xs font-mono-tabular font-bold text-slate-500">
                Auditoria Gerente → Governador
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Aprovados</span>
                </div>
                <div className="text-xl font-extrabold font-mono-tabular text-emerald-950 mt-1">
                  {financialBreakdown.approvedCount}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                <div className="text-[11px] font-bold text-red-800 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Reprovados</span>
                </div>
                <div className="text-xl font-extrabold font-mono-tabular text-red-950 mt-1">
                  {financialBreakdown.rejectedCount}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <div className="text-[11px] font-bold text-amber-800 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Em Conferência</span>
                </div>
                <div className="text-xl font-extrabold font-mono-tabular text-amber-950 mt-1">
                  {financialBreakdown.pendingCount}
                </div>
              </div>
            </div>

            <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden flex">
              {financialBreakdown.totalReviews > 0 && (
                <>
                  <div
                    className="bg-emerald-600 transition-all"
                    style={{
                      width: `${Math.round(
                        (financialBreakdown.approvedCount /
                          financialBreakdown.totalReviews) *
                          100
                      )}%`,
                    }}
                  />
                  <div
                    className="bg-red-600 transition-all"
                    style={{
                      width: `${Math.round(
                        (financialBreakdown.rejectedCount /
                          financialBreakdown.totalReviews) *
                          100
                      )}%`,
                    }}
                  />
                  <div
                    className="bg-amber-500 transition-all"
                    style={{
                      width: `${Math.round(
                        (financialBreakdown.pendingCount /
                          financialBreakdown.totalReviews) *
                          100
                      )}%`,
                    }}
                  />
                </>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Visualização consolidada para acompanhamento executivo. Aprovações e reprovações são realizadas exclusivamente por Gerentes e Governadores em Conferência de Fechamentos.
            </p>
          </div>
        </section>

        {/* Árvore Hierárquica Executiva (Drill-Down até 3º nível; 4º nível Gerente expande tudo) */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <GitFork className="w-4 h-4 text-blue-700" />
                <span>Árvore Hierárquica Executiva (Drill-Down)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Expanda nível a nível (Região → Presidência → Governador). Ao clicar no 4º nível (Gerente), todas as lojas e a equipe operacional aparecem de uma vez.
              </p>
            </div>
          </div>

          {hierarchyTree.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              Nenhuma ramificação visível no seu escopo atual.
            </p>
          ) : (
            <div className="space-y-2.5">
              {hierarchyTree.map((regNode) => {
                const regExpanded = expandedRegionKeys.has(regNode.region);
                const regOpenCount = regNode.stores.filter(
                  (s) => s.isOpen
                ).length;

                return (
                  <div
                    key={regNode.region}
                    className="rounded-xl border border-slate-200 overflow-hidden bg-white"
                  >
                    {/* Nível 1: Região */}
                    <button
                      type="button"
                      onClick={() =>
                        toggleSetKey(setExpandedRegionKeys, regNode.region)
                      }
                      className="w-full min-h-[48px] px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between gap-3 text-left"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {regExpanded ? (
                          <ChevronDown className="w-4 h-4 text-slate-600 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
                        )}
                        <span className="text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 text-slate-800 shrink-0">
                          Nível 1 · Região
                        </span>
                        <span className="text-sm font-extrabold text-slate-900 truncate">
                          Região {regNode.region}
                        </span>
                      </div>
                      <span className="text-xs font-mono-tabular font-bold text-slate-600 shrink-0">
                        {regOpenCount}/{regNode.stores.length} abertas
                      </span>
                    </button>

                    {regExpanded && (
                      <div className="p-3 pl-5 sm:pl-7 space-y-2 border-t border-slate-200 bg-white">
                        {regNode.presNodes.map((pres) => {
                          const presExpanded = expandedPresKeys.has(pres.key);
                          return (
                            <div
                              key={pres.key}
                              className="rounded-xl border border-slate-200 overflow-hidden"
                            >
                              {/* Nível 2: Presidência */}
                              <button
                                type="button"
                                onClick={() =>
                                  toggleSetKey(setExpandedPresKeys, pres.key)
                                }
                                className="w-full min-h-[44px] px-3.5 py-2.5 bg-slate-50/70 hover:bg-slate-100 flex items-center justify-between gap-2 text-left"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {presExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                                  )}
                                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800 shrink-0">
                                    Nível 2 · Presidência
                                  </span>
                                  <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                    {pres.label}
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-500 font-mono-tabular shrink-0 hidden sm:inline">
                                  {pres.sublabel}
                                </span>
                              </button>

                              {presExpanded && (
                                <div className="p-3 pl-5 sm:pl-7 space-y-2 border-t border-slate-200 bg-white">
                                  {regNode.govNodes.map((govNode) => {
                                    const govExpanded = expandedGovKeys.has(
                                      govNode.key
                                    );
                                    return (
                                      <div
                                        key={govNode.key}
                                        className="rounded-xl border border-slate-200 overflow-hidden"
                                      >
                                        {/* Nível 3: Governador */}
                                        <button
                                          type="button"
                                          onClick={() =>
                                            toggleSetKey(
                                              setExpandedGovKeys,
                                              govNode.key
                                            )
                                          }
                                          className="w-full min-h-[44px] px-3.5 py-2.5 bg-slate-50/50 hover:bg-slate-100 flex items-center justify-between gap-2 text-left"
                                        >
                                          <div className="flex items-center gap-2 min-w-0">
                                            {govExpanded ? (
                                              <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                                            ) : (
                                              <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                                            )}
                                            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-900 shrink-0">
                                              Nível 3 · Governador
                                            </span>
                                            <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                              {govNode.label}
                                            </span>
                                          </div>
                                          <span className="text-[11px] font-mono-tabular text-slate-600 shrink-0">
                                            {govNode.gerentes.length}{' '}
                                            {govNode.gerentes.length === 1
                                              ? 'gerente'
                                              : 'gerentes'}
                                          </span>
                                        </button>

                                        {govExpanded && (
                                          <div className="p-3 pl-5 sm:pl-7 space-y-2.5 border-t border-slate-200 bg-white">
                                            {govNode.gerentes.length === 0 &&
                                            regNode.orphanStores.length === 0 ? (
                                              <p className="text-xs text-slate-500 py-2">
                                                Nenhum gerente ou loja vinculada neste ramo.
                                              </p>
                                            ) : (
                                              <>
                                                {govNode.gerentes.map((ger) => {
                                                  const gerKey = `${govNode.key}__ger__${ger.id}`;
                                                  const gerExpanded =
                                                    expandedGerenteKeys.has(
                                                      gerKey
                                                    );
                                                  const gerStores =
                                                    regNode.stores.filter(
                                                      (st) =>
                                                        st.managerId === ger.id
                                                    );
                                                  const teamRows = gerExpanded
                                                    ? getOperationalTeamForStores(
                                                        gerStores
                                                      )
                                                    : [];

                                                  return (
                                                    <div
                                                      key={gerKey}
                                                      className="rounded-xl border border-slate-200 overflow-hidden"
                                                    >
                                                      {/* Nível 4: Gerente (ao clicar, expande TODAS as lojas e TODA a equipe operacional) */}
                                                      <button
                                                        type="button"
                                                        onClick={() =>
                                                          toggleSetKey(
                                                            setExpandedGerenteKeys,
                                                            gerKey
                                                          )
                                                        }
                                                        className="w-full min-h-[46px] px-3.5 py-2.5 bg-slate-900 text-white hover:bg-slate-800 flex items-center justify-between gap-2 text-left"
                                                      >
                                                        <div className="flex items-center gap-2 min-w-0">
                                                          {gerExpanded ? (
                                                            <ChevronDown className="w-4 h-4 text-blue-300 shrink-0" />
                                                          ) : (
                                                            <ChevronRight className="w-4 h-4 text-blue-300 shrink-0" />
                                                          )}
                                                          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-600 text-white shrink-0">
                                                            Nível 4 · Gerente
                                                          </span>
                                                          <span className="text-xs sm:text-sm font-bold truncate">
                                                            {ger.name}
                                                          </span>
                                                        </div>
                                                        <span className="text-[11px] font-mono-tabular text-slate-300 shrink-0">
                                                          {gerStores.length}{' '}
                                                          {gerStores.length === 1
                                                            ? 'loja'
                                                            : 'lojas'}
                                                        </span>
                                                      </button>

                                                      {gerExpanded && (
                                                        <div className="p-3.5 bg-slate-50 space-y-4">
                                                          {/* Todas as lojas do Gerente */}
                                                          <div className="space-y-2">
                                                            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                                                              Lojas gerenciadas ({gerStores.length})
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                              {gerStores.map(
                                                                (st) => (
                                                                  <div
                                                                    key={st.id}
                                                                    className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2"
                                                                  >
                                                                    <div className="min-w-0">
                                                                      <div className="text-xs font-bold text-slate-900 truncate">
                                                                        {st.storeCode}{' '}
                                                                        ·{' '}
                                                                        {st.name}
                                                                      </div>
                                                                      <div className="text-[11px] text-slate-500 font-mono-tabular">
                                                                        {st.isOpen
                                                                          ? 'Aberta'
                                                                          : 'Fechada'}{' '}
                                                                        ·{' '}
                                                                        {
                                                                          (
                                                                            st.onlineUserIds ||
                                                                            []
                                                                          )
                                                                            .length
                                                                        }{' '}
                                                                        online
                                                                      </div>
                                                                    </div>
                                                                    <button
                                                                      type="button"
                                                                      onClick={() =>
                                                                        onFocusStoreOnMap(
                                                                          st.id
                                                                        )
                                                                      }
                                                                      className="min-h-[34px] px-2.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-[11px] font-bold text-slate-800 shrink-0"
                                                                    >
                                                                      Mapa
                                                                    </button>
                                                                  </div>
                                                                )
                                                              )}
                                                            </div>
                                                          </div>

                                                          {/* Toda a equipe operacional (Subgerente, Fiscal, Caixa) */}
                                                          <div className="space-y-2">
                                                            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                                                              Equipe Operacional ({teamRows.length})
                                                            </div>
                                                            {teamRows.length ===
                                                            0 ? (
                                                              <p className="text-xs text-slate-500">
                                                                Nenhum Subgerente, Fiscal ou Caixa vinculado às lojas deste gerente.
                                                              </p>
                                                            ) : (
                                                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                                {teamRows.map(
                                                                  ({
                                                                    user,
                                                                    isOnline,
                                                                    linkedStoreCodes,
                                                                  }) => (
                                                                    <div
                                                                      key={
                                                                        user.id
                                                                      }
                                                                      className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2"
                                                                    >
                                                                      <div className="min-w-0">
                                                                        <div className="text-xs font-bold text-slate-900 truncate">
                                                                          {
                                                                            user.name
                                                                          }
                                                                        </div>
                                                                        <div className="text-[11px] text-slate-500 truncate">
                                                                          {
                                                                            ROLE_LABELS[
                                                                              user
                                                                                .role
                                                                            ]
                                                                          }{' '}
                                                                          ·{' '}
                                                                          {linkedStoreCodes.join(
                                                                            ', '
                                                                          )}
                                                                        </div>
                                                                      </div>
                                                                      <span
                                                                        className={`text-[11px] font-bold shrink-0 ${
                                                                          isOnline
                                                                            ? 'text-emerald-700'
                                                                            : 'text-slate-400'
                                                                        }`}
                                                                      >
                                                                        {isOnline
                                                                          ? 'Online'
                                                                          : 'Offline'}
                                                                      </span>
                                                                    </div>
                                                                  )
                                                                )}
                                                              </div>
                                                            )}
                                                          </div>
                                                        </div>
                                                      )}
                                                    </div>
                                                  );
                                                })}

                                                {regNode.orphanStores.length >
                                                  0 && (
                                                  <div className="p-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 space-y-2">
                                                    <div className="text-xs font-bold text-slate-700">
                                                      Lojas sem gerente atribuído ({regNode.orphanStores.length})
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                      {regNode.orphanStores.map(
                                                        (st) => (
                                                          <div
                                                            key={st.id}
                                                            className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2 text-xs"
                                                          >
                                                            <span className="font-bold text-slate-900 truncate">
                                                              {st.storeCode} ·{' '}
                                                              {st.name}
                                                            </span>
                                                            <button
                                                              type="button"
                                                              onClick={() =>
                                                                onFocusStoreOnMap(
                                                                  st.id
                                                                )
                                                              }
                                                              className="min-h-[32px] px-2.5 rounded border border-slate-200 font-bold text-slate-800"
                                                            >
                                                              Mapa
                                                            </button>
                                                          </div>
                                                        )
                                                      )}
                                                    </div>
                                                  </div>
                                                )}
                                              </>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Lojas (com Linha do Tempo de Turnos do Dia ao clicar) e Últimos Fechamentos de Caixa */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>Situação Atual &amp; Linha do Tempo das Lojas</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Toque em uma loja para inspecionar as aberturas, pausas e reaberturas do dia.
              </p>
            </div>

            {visibleStores.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                Nenhuma loja disponível para exibição.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {visibleStores.map((store) => {
                  const isSelected = selectedStoreIdForTimeline === store.id;
                  return (
                    <div key={store.id} className="bg-white">
                      <div
                        className={`p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-colors ${
                          isSelected ? 'bg-blue-50/70' : ''
                        }`}
                        onClick={() =>
                          setSelectedStoreIdForTimeline(
                            isSelected ? null : store.id
                          )
                        }
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 truncate flex items-center gap-1.5">
                            <StoreIcon className="w-4 h-4 text-slate-500 shrink-0" />
                            <span className="truncate">{store.name}</span>
                          </div>
                          <div className="text-xs font-mono-tabular text-slate-500 mt-0.5">
                            {store.storeCode} · Região {store.region} ·{' '}
                            {(store.onlineUserIds || []).length} online
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-xs font-bold ${
                              store.isOpen
                                ? 'text-emerald-700'
                                : 'text-slate-500'
                            }`}
                          >
                            {store.isOpen ? 'Aberta' : 'Fechada'}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onFocusStoreOnMap(store.id);
                            }}
                            className="min-h-[36px] px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold text-slate-800 flex items-center gap-1"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            <span>Mapa</span>
                          </button>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="px-4 py-3.5 bg-slate-50 border-t border-slate-200 space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-blue-700" />
                              <span>Linha do Tempo de Hoje ({store.storeCode})</span>
                            </span>
                            <span className="text-[11px] font-mono-tabular text-slate-500">
                              {selectedStoreTodayLogs.length}{' '}
                              {selectedStoreTodayLogs.length === 1
                                ? 'registro'
                                : 'registros'}
                            </span>
                          </div>

                          {selectedStoreTodayLogs.length === 0 ? (
                            <p className="text-xs text-slate-500 py-2">
                              Nenhuma abertura ou fechamento registrado hoje para esta loja.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {selectedStoreTodayLogs.map((log, idx) => {
                                const hasClosedBefore = selectedStoreTodayLogs
                                  .slice(0, idx)
                                  .some((prev) => prev.action === 'CLOSED');
                                const resolvedKey =
                                  log.action === 'OPENED' && hasClosedBefore
                                    ? 'REOPENED'
                                    : log.action;
                                const meta = SHIFT_ACTION_META[resolvedKey];
                                const actorUser = users.find(
                                  (u) => u.id === log.actorUserId
                                );

                                return (
                                  <div
                                    key={log.id}
                                    className={`p-2.5 rounded-xl border ${meta.bgClass} flex items-start justify-between gap-3`}
                                  >
                                    <div className="min-w-0">
                                      <div
                                        className={`text-xs font-extrabold ${meta.textClass}`}
                                      >
                                        {meta.label}
                                      </div>
                                      <div className="text-[11px] text-slate-700 mt-0.5 flex items-center gap-1 flex-wrap">
                                        <UserCheck className="w-3 h-3 shrink-0" />
                                        <span className="font-semibold">
                                          {log.actorName}
                                        </span>
                                        {actorUser && (
                                          <span className="text-slate-500">
                                            ({ROLE_LABELS[actorUser.role]})
                                          </span>
                                        )}
                                      </div>
                                      {log.note && (
                                        <div className="text-[11px] text-slate-600 mt-0.5">
                                          {log.note}
                                        </div>
                                      )}
                                    </div>
                                    <span className="text-xs font-mono-tabular font-extrabold text-slate-900 shrink-0">
                                      {formatTimeOfDay(log.timestamp)}
                                    </span>
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
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-blue-700" />
              <span>Histórico de Fechamentos &amp; Vendas</span>
            </h2>
            {visibleClosings.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center space-y-1">
                <Clock className="w-6 h-6 text-slate-400 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">
                  Nenhum fechamento registrado ainda
                </p>
                <p className="text-xs text-slate-500">
                  Ao clicar em &quot;Fechar Loja&quot; no mapa ou no card da unidade, o valor vendido no dia aparece aqui.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-[520px] overflow-y-auto">
                {visibleClosings.slice(0, 30).map((closing) => {
                  const totalVal =
                    closing.totalReceived ?? closing.dailySalesAmount ?? 0;
                  const reviewLabel =
                    closing.reviewStatus === 'APPROVED'
                      ? 'Aprovado'
                      : closing.reviewStatus === 'REJECTED'
                      ? 'Reprovado'
                      : 'Em conferência';
                  const reviewColor =
                    closing.reviewStatus === 'APPROVED'
                      ? 'text-emerald-700'
                      : closing.reviewStatus === 'REJECTED'
                      ? 'text-red-700'
                      : 'text-amber-700';

                  const latestNote =
                    closing.governorDecision?.observation ||
                    closing.managerDecision?.observation;

                  return (
                    <div
                      key={closing.id}
                      className="p-3.5 flex items-start justify-between gap-3 bg-white"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">
                          {closing.storeCode} · {closing.storeName}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Fechado por {closing.closedByName} · Região{' '}
                          {closing.region}
                        </div>
                        {(closing.cashReceived !== undefined ||
                          closing.pixReceived !== undefined) && (
                          <div className="text-[11px] font-mono-tabular text-slate-600 mt-1">
                            Dinheiro:{' '}
                            {formatCurrencyBRL(closing.cashReceived ?? 0)} · Pix:{' '}
                            {formatCurrencyBRL(closing.pixReceived ?? 0)}
                            {closing.expectedSalesAmount !== undefined && (
                              <>
                                {' '}
                                · Esperado:{' '}
                                {formatCurrencyBRL(closing.expectedSalesAmount)}
                              </>
                            )}
                          </div>
                        )}
                        {latestNote && (
                          <div className="text-[11px] text-red-700 font-semibold mt-1">
                            Obs. conferência: {latestNote}
                          </div>
                        )}
                        <div className="text-[11px] font-mono-tabular text-slate-400 mt-0.5">
                          {formatRelativeDateTime(closing.closedAt)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-extrabold font-mono-tabular text-emerald-700">
                          {closing.totalReceived !== undefined ||
                          closing.dailySalesAmount !== undefined
                            ? formatCurrencyBRL(totalVal)
                            : 'Não informado'}
                        </div>
                        <div className={`text-[11px] font-bold mt-0.5 ${reviewColor}`}>
                          {reviewLabel}
                        </div>
                        {closing.balanceStatus && (
                          <div className="text-[10px] font-mono-tabular text-slate-500">
                            {closing.balanceStatus === 'MATCHED'
                              ? 'Saldo Bateu'
                              : closing.balanceStatus === 'SURPLUS'
                              ? 'Sobra'
                              : 'Falta'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
