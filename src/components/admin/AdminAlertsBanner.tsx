import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  Package,
  RefreshCw,
} from 'lucide-react';
import {
  AdminFinanceAlert,
  ClosingAlertNotification,
  ROLE_LABELS,
  StoreUnit,
  UserAccount,
} from '../../types/radar';
import { formatCurrencyBRL, formatRelativeDateTime } from '../../utils/geo';
import {
  canAccessClosingReview,
  canManageStore,
  canManageStoreOptions,
  canViewGlobalAuditHistory,
} from '../../utils/rbac';

interface AdminAlertsBannerProps {
  currentUser: UserAccount;
  users: UserAccount[];
  stores: StoreUnit[];
  adminAlerts: AdminFinanceAlert[];
  closingAlerts?: ClosingAlertNotification[];
  onResolveAdminAlert: (
    alertId: string,
    status: 'CONFIRMED' | 'DISCREPANCY',
    observation?: string
  ) => Promise<AdminFinanceAlert>;
  onOpenClosingsScreen?: () => void;
  compact?: boolean;
}

export const AdminAlertsBanner: React.FC<AdminAlertsBannerProps> = ({
  currentUser,
  users,
  stores,
  adminAlerts,
  closingAlerts = [],
  onResolveAdminAlert,
  onOpenClosingsScreen,
  compact = false,
}) => {
  const [discrepancyId, setDiscrepancyId] = useState<string | null>(null);
  const [observation, setObservation] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const canResolve = canManageStoreOptions(currentUser.role);
  const isGlobal = canViewGlobalAuditHistory(currentUser.role);

  const visibleStoreIds = useMemo(() => {
    if (isGlobal) return new Set(stores.map((s) => s.id));
    return new Set(
      stores
        .filter((s) => canManageStore(currentUser, s, users))
        .map((s) => s.id)
    );
  }, [isGlobal, stores, currentUser, users]);

  const scopedAdminAlerts = useMemo(() => {
    return adminAlerts.filter((al) => {
      if (!isGlobal && !visibleStoreIds.has(al.storeId)) return false;
      return true;
    });
  }, [adminAlerts, isGlobal, visibleStoreIds]);

  const pendingAlerts = useMemo(
    () => scopedAdminAlerts.filter((a) => a.status === 'PENDING'),
    [scopedAdminAlerts]
  );

  const resolvedAlerts = useMemo(
    () => scopedAdminAlerts.filter((a) => a.status !== 'PENDING'),
    [scopedAdminAlerts]
  );

  const unreadClosingCount = useMemo(() => {
    if (!canAccessClosingReview(currentUser.role)) return 0;
    return closingAlerts.filter((al) => {
      if (al.readByUserIds.includes(currentUser.id)) return false;
      if (!isGlobal && !visibleStoreIds.has(al.storeId)) return false;
      if (currentUser.role === 'SUPER_ADMIN') return true;
      if (currentUser.role === 'GERENTE') {
        return (
          al.targetRole === 'GERENTE' &&
          (!al.targetUserId || al.targetUserId === currentUser.id)
        );
      }
      if (currentUser.role === 'GOVERNADOR') {
        return al.targetRole === 'GOVERNADOR';
      }
      if (currentUser.role === 'PRESIDENTE') {
        return al.targetRole === 'PRESIDENTE';
      }
      return false;
    }).length;
  }, [closingAlerts, currentUser, isGlobal, visibleStoreIds]);

  if (
    pendingAlerts.length === 0 &&
    unreadClosingCount === 0 &&
    (!showResolved || resolvedAlerts.length === 0)
  ) {
    if (resolvedAlerts.length === 0) return null;
  }

  const handleConfirm = async (alertId: string) => {
    setErrorMsg(null);
    setBusyId(alertId);
    try {
      await onResolveAdminAlert(alertId, 'CONFIRMED');
      if (discrepancyId === alertId) {
        setDiscrepancyId(null);
        setObservation('');
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Erro ao confirmar retirada.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmDiscrepancy = async (alertId: string) => {
    setErrorMsg(null);
    if (!observation.trim()) {
      setErrorMsg('Informe a observação da divergência encontrada.');
      return;
    }
    setBusyId(alertId);
    try {
      await onResolveAdminAlert(alertId, 'DISCREPANCY', observation.trim());
      setDiscrepancyId(null);
      setObservation('');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Erro ao registrar divergência.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const alertsToRender = showResolved
    ? scopedAdminAlerts.slice(0, 12)
    : pendingAlerts;

  return (
    <section
      aria-label="Central de Alertas Administrativos e Financeiros"
      className="bg-white rounded-2xl border border-amber-300 shadow-xs overflow-hidden"
    >
      <div className="px-4 sm:px-5 py-3.5 bg-amber-50 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0">
            <BellRing className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <span>Central Administrativa &amp; Financeira</span>
              {pendingAlerts.length + unreadClosingCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-red-600 text-white text-xs font-mono-tabular font-extrabold">
                  {pendingAlerts.length + unreadClosingCount}
                </span>
              )}
            </h2>
            <p className="text-xs text-amber-900/90">
              Pendências de retirada na abertura, reposição de carga e fechamentos (isoladas da campainha do mapa).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {unreadClosingCount > 0 && onOpenClosingsScreen && (
            <button
              type="button"
              onClick={onOpenClosingsScreen}
              className="min-h-[38px] px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <ClipboardCheck className="w-3.5 h-3.5 text-amber-300" />
              <span>
                {unreadClosingCount}{' '}
                {unreadClosingCount === 1
                  ? 'fechamento pendente'
                  : 'fechamentos pendentes'}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          {resolvedAlerts.length > 0 && (
            <button
              type="button"
              onClick={() => setShowResolved((p) => !p)}
              className="min-h-[38px] px-3 rounded-xl bg-white border border-amber-300 text-amber-950 text-xs font-bold hover:bg-amber-100/70"
            >
              {showResolved
                ? 'Ver só pendentes'
                : `Histórico (${resolvedAlerts.length})`}
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="mx-4 mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-800"
        >
          {errorMsg}
        </div>
      )}

      {alertsToRender.length > 0 && (
        <div className="divide-y divide-slate-100">
          {(compact ? alertsToRender.slice(0, 5) : alertsToRender).map(
            (alert) => {
              const isPending = alert.status === 'PENDING';
              const isBusy = busyId === alert.id;
              const isDiscrepancyOpen = discrepancyId === alert.id;
              const totalValue = alert.items.reduce(
                (acc, it) => acc + it.quantity * it.unitPrice,
                0
              );

              return (
                <div key={alert.id} className="p-4 space-y-3 bg-white">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold ${
                            alert.type === 'RESTOCK'
                              ? 'bg-blue-100 text-blue-900'
                              : 'bg-emerald-100 text-emerald-900'
                          }`}
                        >
                          {alert.type === 'RESTOCK' ? (
                            <span className="inline-flex items-center gap-1">
                              <RefreshCw className="w-3 h-3" />
                              Reposição
                            </span>
                          ) : (
                            'Retirada na Abertura'
                          )}
                        </span>
                        <span className="text-xs font-extrabold text-slate-900">
                          {alert.storeCode} · {alert.storeName}
                        </span>
                        <span className="text-[11px] font-mono-tabular text-slate-500">
                          {formatRelativeDateTime(alert.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 mt-1">
                        {alert.summary} ({ROLE_LABELS[alert.actorRole]}) · Valor
                        estimado:{' '}
                        <strong className="font-mono-tabular text-slate-900">
                          {formatCurrencyBRL(totalValue)}
                        </strong>
                      </p>
                    </div>

                    {!isPending && (
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border ${
                          alert.status === 'CONFIRMED'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-red-50 border-red-200 text-red-800'
                        }`}
                      >
                        {alert.status === 'CONFIRMED'
                          ? `Confirmado por ${alert.resolvedByName}`
                          : `Divergência (${alert.resolvedByName})`}
                      </span>
                    )}
                  </div>

                  {/* Itens retirados */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {alert.items.map((it) => (
                      <div
                        key={it.storeItemId}
                        className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {it.photoDataUrl ? (
                            <img
                              src={it.photoDataUrl}
                              alt={it.itemName}
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                              <Package className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate">
                              {it.itemName}
                            </div>
                            <div className="text-[11px] font-mono-tabular text-slate-500">
                              {formatCurrencyBRL(it.unitPrice)} / un
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-mono-tabular font-extrabold text-slate-900 shrink-0">
                          {it.quantity} un
                        </span>
                      </div>
                    ))}
                  </div>

                  {alert.observation && (
                    <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900">
                      <strong>Observação da divergência:</strong>{' '}
                      {alert.observation}
                    </div>
                  )}

                  {isPending && canResolve && (
                    <div className="pt-1">
                      {!isDiscrepancyOpen ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleConfirm(alert.id)}
                            className="min-h-[42px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>
                              {alert.type === 'RESTOCK'
                                ? 'Confirmar Reposição'
                                : 'Confirmar Retirada'}
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => {
                              setDiscrepancyId(alert.id);
                              setObservation('');
                              setErrorMsg(null);
                            }}
                            className="min-h-[42px] px-4 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-1.5"
                          >
                            <AlertTriangle className="w-4 h-4" />
                            <span>Registrar Divergência</span>
                          </button>
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl border border-red-200 bg-red-50/60 space-y-2">
                          <label className="block text-xs font-extrabold text-red-900">
                            Descreva a divergência de quantidade ou produto:
                          </label>
                          <input
                            type="text"
                            value={observation}
                            onChange={(e) => setObservation(e.target.value)}
                            placeholder="Ex: Faltaram 2 unidades na contagem física..."
                            className="w-full min-h-[42px] px-3 rounded-xl border border-red-300 bg-white text-sm text-slate-900"
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={isBusy || !observation.trim()}
                              onClick={() => handleConfirmDiscrepancy(alert.id)}
                              className="min-h-[40px] px-4 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold"
                            >
                              {isBusy ? 'Salvando...' : 'Salvar Divergência'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDiscrepancyId(null);
                                setObservation('');
                              }}
                              className="min-h-[40px] px-3 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }
          )}
        </div>
      )}
    </section>
  );
};
