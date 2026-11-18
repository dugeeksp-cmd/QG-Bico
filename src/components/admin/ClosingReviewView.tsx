import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Package,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import {
  AdminFinanceAlert,
  ClosingAlertNotification,
  ROLE_LABELS,
  StoreClosingRecord,
  StoreUnit,
  UserAccount,
} from '../../types/radar';
import { formatCurrencyBRL, formatRelativeDateTime } from '../../utils/geo';
import {
  canDecideClosingReview,
  canManageStore,
  canViewGlobalAuditHistory,
} from '../../utils/rbac';
import { AdminAlertsBanner } from './AdminAlertsBanner';

interface ClosingReviewViewProps {
  currentUser: UserAccount;
  users: UserAccount[];
  stores: StoreUnit[];
  storeClosings: StoreClosingRecord[];
  closingAlerts: ClosingAlertNotification[];
  adminAlerts: AdminFinanceAlert[];
  onReviewClosing: (
    closingId: string,
    decision: 'APPROVED' | 'REJECTED',
    observation?: string
  ) => Promise<StoreClosingRecord>;
  onMarkAlertRead: (alertId: string) => Promise<void>;
  onResolveAdminAlert: (
    alertId: string,
    status: 'CONFIRMED' | 'DISCREPANCY',
    observation?: string
  ) => Promise<AdminFinanceAlert>;
}

export const ClosingReviewView: React.FC<ClosingReviewViewProps> = ({
  currentUser,
  users,
  stores,
  storeClosings,
  closingAlerts,
  adminAlerts,
  onReviewClosing,
  onMarkAlertRead,
  onResolveAdminAlert,
}) => {
  const isGlobal = canViewGlobalAuditHistory(currentUser.role);
  const canDecide = canDecideClosingReview(currentUser.role);

  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'
  >('ALL');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const visibleStoreIds = useMemo(() => {
    if (isGlobal) return new Set(stores.map((s) => s.id));
    return new Set(
      stores
        .filter((s) => canManageStore(currentUser, s, users))
        .map((s) => s.id)
    );
  }, [isGlobal, stores, currentUser, users]);

  const scopedAlerts = useMemo(() => {
    return closingAlerts.filter((al) => {
      if (!visibleStoreIds.has(al.storeId)) return false;
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
    });
  }, [closingAlerts, visibleStoreIds, currentUser]);

  const unreadAlerts = scopedAlerts.filter(
    (al) => !al.readByUserIds.includes(currentUser.id)
  );

  const scopedClosings = useMemo(() => {
    const base = isGlobal
      ? storeClosings
      : storeClosings.filter((c) => visibleStoreIds.has(c.storeId));

    return base.filter((c) => {
      const st = c.reviewStatus || 'PENDING_GERENTE';
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'PENDING') {
        return st === 'PENDING_GERENTE' || st === 'PENDING_GOVERNADOR';
      }
      if (statusFilter === 'APPROVED') {
        return (
          st === 'APPROVED' ||
          (st === 'PENDING_GOVERNADOR' &&
            c.managerDecision?.decision === 'APPROVED')
        );
      }
      if (statusFilter === 'REJECTED') {
        return (
          st === 'REJECTED' ||
          (st === 'PENDING_GOVERNADOR' &&
            c.managerDecision?.decision === 'REJECTED')
        );
      }
      return true;
    });
  }, [isGlobal, storeClosings, visibleStoreIds, statusFilter]);

  const canActOnClosing = (closing: StoreClosingRecord): boolean => {
    if (!canDecide) return false;
    if (currentUser.role === 'GERENTE') {
      return !closing.managerDecision;
    }
    if (currentUser.role === 'GOVERNADOR') {
      return !closing.governorDecision;
    }
    if (currentUser.role === 'SUPER_ADMIN') {
      return !closing.managerDecision || !closing.governorDecision;
    }
    return false;
  };

  const handleApprove = async (closingId: string) => {
    setErrorMsg(null);
    setSubmittingId(closingId);
    try {
      await onReviewClosing(closingId, 'APPROVED');
      if (rejectingId === closingId) {
        setRejectingId(null);
        setRejectReason('');
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Erro ao aprovar fechamento.'
      );
    } finally {
      setSubmittingId(null);
    }
  };

  const handleConfirmReject = async (closingId: string) => {
    setErrorMsg(null);
    if (!rejectReason.trim()) {
      setErrorMsg(
        'Escreva a observação / motivo da reprovação antes de confirmar.'
      );
      return;
    }
    setSubmittingId(closingId);
    try {
      await onReviewClosing(closingId, 'REJECTED', rejectReason.trim());
      setRejectingId(null);
      setRejectReason('');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Erro ao reprovar fechamento.'
      );
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <ClipboardCheck className="w-6 h-6 text-blue-700" />
              <span>Conferência de Fechamentos</span>
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              {currentUser.role === 'PRESIDENTE'
                ? 'Visão consolidada e histórico das conferências de caixa da rede (somente leitura).'
                : 'Confira itens vendidos, Dinheiro + Pix e aprove ou reprove com observação para escalonar ao nível superior.'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl self-start">
            {(
              [
                ['ALL', 'Todos'],
                ['PENDING', 'Pendentes'],
                ['APPROVED', 'Aprovados'],
                ['REJECTED', 'Reprovados'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`min-h-[36px] px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  statusFilter === key
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Central de Alertas de Estoque, Abertura & Reposição */}
        <AdminAlertsBanner
          currentUser={currentUser}
          users={users}
          stores={stores}
          adminAlerts={adminAlerts}
          closingAlerts={closingAlerts}
          onResolveAdminAlert={onResolveAdminAlert}
        />

        {/* Alertas de Conferência Direcionados */}
        {scopedAlerts.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-600" />
                <span>
                  Alertas de Fechamento ({unreadAlerts.length} não{' '}
                  {unreadAlerts.length === 1 ? 'lido' : 'lidos'})
                </span>
              </h2>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
              {scopedAlerts.slice(0, 15).map((alert) => {
                const isUnread = !alert.readByUserIds.includes(currentUser.id);
                return (
                  <div
                    key={alert.id}
                    className={`p-3 flex flex-wrap items-center justify-between gap-2 ${
                      isUnread ? 'bg-amber-50/70' : 'bg-white'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-slate-900">
                        {alert.title}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        {alert.summary} ·{' '}
                        <span className="font-mono-tabular text-slate-500">
                          {formatRelativeDateTime(alert.createdAt)}
                        </span>
                      </div>
                    </div>
                    {isUnread ? (
                      <button
                        type="button"
                        onClick={() => onMarkAlertRead(alert.id)}
                        className="min-h-[34px] px-3 rounded-lg bg-slate-900 text-white text-[11px] font-bold flex items-center gap-1 shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Marcar lido</span>
                      </button>
                    ) : (
                      <span className="text-[11px] font-semibold text-slate-400 shrink-0">
                        Lido
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-800"
          >
            {errorMsg}
          </div>
        )}

        {/* Lista de Fechamentos para Conferência */}
        {scopedClosings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center space-y-1.5">
            <ClipboardCheck className="w-7 h-7 text-slate-400 mx-auto" />
            <p className="text-sm font-bold text-slate-700">
              Nenhum fechamento encontrado neste filtro
            </p>
            <p className="text-xs text-slate-500">
              Quando uma loja for fechada com a conferência do dia, os detalhes aparecerão aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {scopedClosings.map((closing) => {
              const expected = closing.expectedSalesAmount ?? 0;
              const cash = closing.cashReceived ?? 0;
              const pix = closing.pixReceived ?? 0;
              const received =
                closing.totalReceived ?? closing.dailySalesAmount ?? 0;
              const diff =
                closing.balanceDifference !== undefined
                  ? closing.balanceDifference
                  : Number((received - expected).toFixed(2));
              const balanceStatus =
                closing.balanceStatus ||
                (Math.abs(diff) < 0.01
                  ? 'MATCHED'
                  : diff > 0
                  ? 'SURPLUS'
                  : 'SHORTAGE');

              const status = closing.reviewStatus || 'PENDING_GERENTE';
              const showActions = canActOnClosing(closing);
              const isRejecting = rejectingId === closing.id;
              const isBusy = submittingId === closing.id;

              const statusLabel =
                status === 'APPROVED'
                  ? 'Aprovado (Final)'
                  : status === 'REJECTED'
                  ? 'Reprovado (Final)'
                  : status === 'PENDING_GOVERNADOR'
                  ? closing.managerDecision?.decision === 'REJECTED'
                    ? 'Reprovado pelo Gerente · Aguardando Governador'
                    : 'Aprovado pelo Gerente · Aguardando Governador'
                  : 'Aguardando Conferência do Gerente';

              const statusTone =
                status === 'APPROVED'
                  ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                  : status === 'REJECTED'
                  ? 'text-red-800 bg-red-50 border-red-200'
                  : status === 'PENDING_GOVERNADOR' &&
                    closing.managerDecision?.decision === 'REJECTED'
                  ? 'text-red-800 bg-amber-50 border-amber-300'
                  : 'text-amber-900 bg-amber-50 border-amber-200';

              return (
                <article
                  key={closing.id}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
                >
                  <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-base font-extrabold text-slate-900">
                        {closing.storeCode} · {closing.storeName}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        Região {closing.region} · Fechado por{' '}
                        <strong className="text-slate-900">
                          {closing.closedByName}
                        </strong>{' '}
                        ·{' '}
                        <span className="font-mono-tabular">
                          {formatRelativeDateTime(closing.closedAt)}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold ${statusTone}`}
                    >
                      {statusLabel}
                    </div>
                  </div>

                  <div className="p-4 sm:p-5 space-y-4">
                    {/* Resumo Financeiro */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[11px] font-semibold text-slate-500">
                          Esperado (Itens)
                        </div>
                        <div className="text-sm font-extrabold font-mono-tabular text-slate-900 mt-0.5">
                          {formatCurrencyBRL(expected)}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[11px] font-semibold text-slate-500">
                          Dinheiro
                        </div>
                        <div className="text-sm font-extrabold font-mono-tabular text-slate-900 mt-0.5">
                          {formatCurrencyBRL(cash)}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[11px] font-semibold text-slate-500">
                          Pix
                        </div>
                        <div className="text-sm font-extrabold font-mono-tabular text-slate-900 mt-0.5">
                          {formatCurrencyBRL(pix)}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-900 text-white">
                        <div className="text-[11px] font-semibold text-slate-300">
                          Total Recebido
                        </div>
                        <div className="text-sm font-extrabold font-mono-tabular mt-0.5">
                          {formatCurrencyBRL(received)}
                        </div>
                      </div>
                      <div
                        className={`p-3 rounded-xl border col-span-2 sm:col-span-1 ${
                          balanceStatus === 'MATCHED'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : balanceStatus === 'SURPLUS'
                            ? 'bg-blue-50 border-blue-200 text-blue-900'
                            : 'bg-red-50 border-red-200 text-red-900'
                        }`}
                      >
                        <div className="text-[11px] font-bold flex items-center gap-1">
                          {balanceStatus === 'MATCHED' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : balanceStatus === 'SURPLUS' ? (
                            <TrendingUp className="w-3.5 h-3.5" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {balanceStatus === 'MATCHED'
                              ? 'Saldo Bateu'
                              : balanceStatus === 'SURPLUS'
                              ? 'Sobra'
                              : 'Falta'}
                          </span>
                        </div>
                        <div className="text-sm font-extrabold font-mono-tabular mt-0.5">
                          {diff > 0 ? '+' : ''}
                          {formatCurrencyBRL(diff)}
                        </div>
                      </div>
                    </div>

                    {/* Itens Vendidos */}
                    {closing.soldItems && closing.soldItems.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                          Itens Vendidos ({closing.totalItemsSold || 0} un)
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {closing.soldItems.map((line) => (
                            <div
                              key={line.itemId}
                              className="p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2.5"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {line.photoDataUrl ? (
                                  <img
                                    src={line.photoDataUrl}
                                    alt={line.itemName}
                                    referrerPolicy="no-referrer"
                                    className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                                    <Package className="w-4 h-4" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-slate-900 truncate">
                                    {line.itemName}
                                  </div>
                                  <div className="text-[11px] font-mono-tabular text-slate-500">
                                    {line.quantitySold} ×{' '}
                                    {formatCurrencyBRL(line.unitPrice)}
                                  </div>
                                </div>
                              </div>
                              <span className="text-xs font-extrabold font-mono-tabular text-slate-900 shrink-0">
                                {formatCurrencyBRL(line.lineTotal)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Itens Devolvidos ao Estoque da Loja */}
                    {closing.returnedItems && closing.returnedItems.length > 0 && (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1.5">
                        <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-900">
                          Sobra Devolvida Automaticamente ao Estoque da Loja
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {closing.returnedItems.map((ret) => (
                            <span
                              key={ret.storeItemId}
                              className="px-2 py-0.5 rounded-lg bg-white border border-emerald-200 text-xs font-mono-tabular font-bold text-emerald-900"
                            >
                              +{ret.quantityReturned}× {ret.itemName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Trilha de Decisões Hierárquicas */}
                    {(closing.managerDecision || closing.governorDecision) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {closing.managerDecision && (
                          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                            <div className="text-xs font-extrabold text-slate-900">
                              Parecer do Gerente:{' '}
                              <span
                                className={
                                  closing.managerDecision.decision ===
                                  'APPROVED'
                                    ? 'text-emerald-700'
                                    : 'text-red-700'
                                }
                              >
                                {closing.managerDecision.decision === 'APPROVED'
                                  ? 'Aprovado'
                                  : 'Reprovado'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600">
                              {closing.managerDecision.reviewerName} (
                              {ROLE_LABELS[closing.managerDecision.reviewerRole]}
                              ) ·{' '}
                              {formatRelativeDateTime(
                                closing.managerDecision.decidedAt
                              )}
                            </div>
                            {closing.managerDecision.observation && (
                              <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg p-2 mt-1">
                                <strong>Observação:</strong>{' '}
                                {closing.managerDecision.observation}
                              </div>
                            )}
                          </div>
                        )}

                        {closing.governorDecision && (
                          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                            <div className="text-xs font-extrabold text-slate-900">
                              Parecer do Governador:{' '}
                              <span
                                className={
                                  closing.governorDecision.decision ===
                                  'APPROVED'
                                    ? 'text-emerald-700'
                                    : 'text-red-700'
                                }
                              >
                                {closing.governorDecision.decision ===
                                'APPROVED'
                                  ? 'Aprovado'
                                  : 'Reprovado'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600">
                              {closing.governorDecision.reviewerName} (
                              {
                                ROLE_LABELS[
                                  closing.governorDecision.reviewerRole
                                ]
                              }
                              ) ·{' '}
                              {formatRelativeDateTime(
                                closing.governorDecision.decidedAt
                              )}
                            </div>
                            {closing.governorDecision.observation && (
                              <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg p-2 mt-1">
                                <strong>Observação:</strong>{' '}
                                {closing.governorDecision.observation}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Ações de Aprovar / Reprovar (exclusivo Gerente e Governador, nunca Presidente) */}
                    {showActions && (
                      <div className="pt-2 border-t border-slate-100 space-y-3">
                        {!isRejecting ? (
                          <div className="flex flex-wrap items-center gap-2.5">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleApprove(closing.id)}
                              className="min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs sm:text-sm font-bold flex items-center gap-2"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Aprovar Fechamento</span>
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => {
                                setRejectingId(closing.id);
                                setRejectReason('');
                                setErrorMsg(null);
                              }}
                              className="min-h-[44px] px-4 rounded-xl bg-red-50 hover:bg-red-100 border border-red-300 text-red-700 text-xs sm:text-sm font-bold flex items-center gap-2"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Reprovar Fechamento</span>
                            </button>
                          </div>
                        ) : (
                          <div className="p-3.5 rounded-xl border border-red-200 bg-red-50/50 space-y-2.5">
                            <label className="block text-xs font-extrabold text-red-900">
                              Observação / Motivo da Reprovação (obrigatório)
                            </label>
                            <textarea
                              rows={2}
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Descreva a falta de valor, divergência no Pix/dinheiro ou erro na contagem..."
                              className="w-full p-3 rounded-xl border border-red-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600"
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                disabled={isBusy || !rejectReason.trim()}
                                onClick={() => handleConfirmReject(closing.id)}
                                className="min-h-[42px] px-4 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold"
                              >
                                {isBusy
                                  ? 'Salvando...'
                                  : 'Confirmar Reprovação'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectingId(null);
                                  setRejectReason('');
                                }}
                                className="min-h-[42px] px-3 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
