import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  Building2,
  Clock,
  Lock,
  Minus,
  Package,
  Plus,
  Power,
  QrCode,
  RefreshCw,
  ShoppingBag,
  Wallet,
  X,
} from 'lucide-react';
import {
  OperatorShiftInventory,
  StoreMerchandiseItem,
  StoreUnit,
  UserAccount,
} from '../../types/radar';
import { formatCurrencyBRL, formatTimeOfDay } from '../../utils/geo';
import {
  canManageStore,
  hasPermission,
  isUserLinkedToStore,
  ROLE_LEVEL,
} from '../../utils/rbac';

interface FinanceSalesViewProps {
  currentUser: UserAccount;
  users: UserAccount[];
  stores: StoreUnit[];
  activeLinkedStore: StoreUnit | null;
  merchandise: StoreMerchandiseItem[];
  operatorShifts: OperatorShiftInventory[];
  onSelectStore: (storeId: string) => void;
  onRequestOpenStore: (store: StoreUnit) => void;
  onRequestCloseStore: (store: StoreUnit) => void;
  onRecordSale: (
    storeId: string,
    storeItemId: string,
    quantity: number,
    paymentMethod: 'CASH' | 'PIX'
  ) => Promise<OperatorShiftInventory>;
  onRestockOperator: (
    storeId: string,
    additions: { storeItemId: string; quantity: number }[]
  ) => Promise<void>;
}

export const FinanceSalesView: React.FC<FinanceSalesViewProps> = ({
  currentUser,
  users,
  stores,
  activeLinkedStore,
  merchandise,
  operatorShifts,
  onSelectStore,
  onRequestOpenStore,
  onRequestCloseStore,
  onRecordSale,
  onRestockOperator,
}) => {
  const canViewStoreStock = hasPermission(currentUser, 'canViewStoreInventory');
  const canWithdrawRestock = hasPermission(
    currentUser,
    'canWithdrawRestockInventory'
  );
  const canOpenClose = hasPermission(currentUser, 'canOpenCloseStore');

  const availableStores = useMemo(() => {
    const direct = stores.filter((s) => isUserLinkedToStore(currentUser.id, s));
    if (direct.length > 0) return direct;
    if (ROLE_LEVEL[currentUser.role] <= 4) {
      return stores.filter((s) => canManageStore(currentUser, s, users));
    }
    return [];
  }, [stores, currentUser, users]);

  const selectedStore = useMemo(() => {
    if (
      activeLinkedStore &&
      availableStores.some((s) => s.id === activeLinkedStore.id)
    ) {
      return activeLinkedStore;
    }
    return availableStores[0] || null;
  }, [activeLinkedStore, availableStores]);

  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'PIX'>('CASH');
  const [customQtyByItem, setCustomQtyByItem] = useState<
    Record<string, string>
  >({});
  const [busySaleId, setBusySaleId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  // Modal de Reposição no meio do expediente
  const [restockModalOpen, setRestockModalOpen] = useState(false);
  const [restockQtyMap, setRestockQtyMap] = useState<Record<string, number>>(
    {}
  );
  const [restockError, setRestockError] = useState<string | null>(null);
  const [submittingRestock, setSubmittingRestock] = useState(false);

  const activeShift = useMemo(() => {
    if (!selectedStore) return null;
    return (
      operatorShifts.find(
        (sh) =>
          sh.storeId === selectedStore.id &&
          sh.userId === currentUser.id &&
          sh.status === 'ACTIVE'
      ) || null
    );
  }, [operatorShifts, selectedStore, currentUser.id]);

  const storeItems = useMemo(() => {
    if (!selectedStore) return [];
    return merchandise.filter((m) => m.storeId === selectedStore.id);
  }, [merchandise, selectedStore]);

  const shiftTotals = useMemo(() => {
    if (!activeShift) {
      return {
        handUnits: 0,
        soldUnits: 0,
        cashTotal: 0,
        pixTotal: 0,
        grandTotal: 0,
      };
    }
    const handUnits = activeShift.items.reduce(
      (acc, it) => acc + it.currentHandQty,
      0
    );
    const soldUnits = activeShift.items.reduce((acc, it) => acc + it.soldQty, 0);
    let cashTotal = 0;
    let pixTotal = 0;
    activeShift.realTimeSales.forEach((s) => {
      if (s.paymentMethod === 'CASH') cashTotal += s.totalAmount;
      else pixTotal += s.totalAmount;
    });
    return {
      handUnits,
      soldUnits,
      cashTotal: Number(cashTotal.toFixed(2)),
      pixTotal: Number(pixTotal.toFixed(2)),
      grandTotal: Number((cashTotal + pixTotal).toFixed(2)),
    };
  }, [activeShift]);

  const handleQuickSale = async (storeItemId: string, qty: number) => {
    if (!selectedStore) return;
    setFeedback(null);
    setBusySaleId(storeItemId);
    try {
      await onRecordSale(selectedStore.id, storeItemId, qty, paymentMethod);
      setCustomQtyByItem((prev) => ({ ...prev, [storeItemId]: '' }));
      setFeedback({
        type: 'ok',
        text: `Venda de ${qty} ${qty === 1 ? 'unidade' : 'unidades'} registrada (${
          paymentMethod === 'CASH' ? 'Dinheiro' : 'Pix'
        }).`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erro ao registrar venda.',
      });
    } finally {
      setBusySaleId(null);
    }
  };

  const setRestockQty = (item: StoreMerchandiseItem, rawNext: number) => {
    const clean = Math.max(0, Math.round(rawNext || 0));
    if (clean > item.stockQuantity) {
      setRestockError(
        `Limite atingido para "${item.name}": o estoque da loja possui apenas ${item.stockQuantity} un disponíveis.`
      );
      setRestockQtyMap((prev) => ({
        ...prev,
        [item.id]: item.stockQuantity,
      }));
      return;
    }
    setRestockError(null);
    setRestockQtyMap((prev) => ({
      ...prev,
      [item.id]: clean,
    }));
  };

  const handleConfirmRestock = async () => {
    if (!selectedStore) return;
    const additions = storeItems
      .map((it) => ({
        storeItemId: it.id,
        quantity: restockQtyMap[it.id] || 0,
      }))
      .filter((a) => a.quantity > 0);
    if (additions.length === 0) {
      setRestockError('Informe ao menos 1 unidade para reposição.');
      return;
    }
    setSubmittingRestock(true);
    try {
      await onRestockOperator(selectedStore.id, additions);
      setRestockModalOpen(false);
      setRestockQtyMap({});
      setFeedback({
        type: 'ok',
        text: 'Reposição adicionada à sua Carga em Mãos! Alerta enviado ao Gerente.',
      });
    } catch (err) {
      setRestockError(
        err instanceof Error ? err.message : 'Erro na reposição de estoque.'
      );
    } finally {
      setSubmittingRestock(false);
    }
  };

  if (!selectedStore) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-100 p-6 flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md text-center space-y-2">
          <Wallet className="w-8 h-8 text-slate-400 mx-auto" />
          <h2 className="text-base font-extrabold text-slate-900">
            Nenhuma unidade vinculada
          </h2>
          <p className="text-xs text-slate-600">
            Vincule seu usuário a uma loja para registrar vendas em tempo real e fechar o caixa.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Cabeçalho + Seletor de Loja + Ações Principais */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Wallet className="w-6 h-6 text-emerald-700 shrink-0" />
              <span>Financeiro &amp; Vendas do Turno</span>
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              {availableStores.length > 1 ? (
                <select
                  value={selectedStore.id}
                  onChange={(e) => onSelectStore(e.target.value)}
                  aria-label="Selecionar loja"
                  className="min-h-[38px] px-3 rounded-xl border border-slate-300 bg-slate-50 text-xs font-extrabold text-slate-900"
                >
                  {availableStores.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.storeCode} · {st.name} (
                      {st.isOpen ? 'Aberta' : 'Fechada'})
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs font-mono-tabular font-bold text-slate-600">
                  {selectedStore.storeCode} · {selectedStore.name}
                </span>
              )}
              <span
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold ${
                  selectedStore.isOpen
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {selectedStore.isOpen ? 'Loja Aberta' : 'Loja Fechada'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canWithdrawRestock && selectedStore.isOpen && (
              <button
                type="button"
                onClick={() => {
                  setRestockQtyMap({});
                  setRestockError(null);
                  setRestockModalOpen(true);
                }}
                className="min-h-[46px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-bold flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reposição de Estoque</span>
              </button>
            )}

            {canOpenClose &&
              (selectedStore.isOpen ? (
                <button
                  type="button"
                  onClick={() => onRequestCloseStore(selectedStore)}
                  className="min-h-[46px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold flex items-center gap-2"
                >
                  <Power className="w-4 h-4 text-amber-300" />
                  <span>Fechar Loja &amp; Acerto</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onRequestOpenStore(selectedStore)}
                  className="min-h-[46px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold flex items-center gap-2"
                >
                  <Power className="w-4 h-4" />
                  <span>Abrir Loja Agora</span>
                </button>
              ))}
          </div>
        </div>

        {/* Cartões de Resumo Parcial do Dia */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900 text-white rounded-2xl p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Vendido no Turno
            </div>
            <div className="text-xl font-extrabold font-mono-tabular mt-1">
              {formatCurrencyBRL(shiftTotals.grandTotal)}
            </div>
            <div className="text-[11px] font-mono-tabular text-slate-300 mt-0.5">
              {shiftTotals.soldUnits} un vendidas
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
              <Banknote className="w-3.5 h-3.5 text-emerald-700" />
              <span>Parcial Dinheiro</span>
            </div>
            <div className="text-lg font-extrabold font-mono-tabular text-slate-900 mt-1">
              {formatCurrencyBRL(shiftTotals.cashTotal)}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
              <QrCode className="w-3.5 h-3.5 text-blue-700" />
              <span>Parcial Pix</span>
            </div>
            <div className="text-lg font-extrabold font-mono-tabular text-slate-900 mt-1">
              {formatCurrencyBRL(shiftTotals.pixTotal)}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
              <ShoppingBag className="w-3.5 h-3.5 text-amber-700" />
              <span>Carga em Mãos</span>
            </div>
            <div className="text-lg font-extrabold font-mono-tabular text-slate-900 mt-1">
              {shiftTotals.handUnits} un
            </div>
          </div>
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
        {/* A. CARGA EM MÃOS + REGISTRO DE VENDAS EM TEMPO REAL */}
        {/* ======================================================= */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Minha Carga em Mãos &amp; Vendas em Tempo Real
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cada venda abatida aqui desconta imediatamente da sua carga pessoal (não duplica baixa no estoque da loja).
              </p>
            </div>

            {/* Seletor Dinheiro vs Pix */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                className={`min-h-[40px] px-3.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-colors ${
                  paymentMethod === 'CASH'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-white'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>Dinheiro</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('PIX')}
                className={`min-h-[40px] px-3.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-colors ${
                  paymentMethod === 'PIX'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-white'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>Pix</span>
              </button>
            </div>
          </div>

          {!activeShift || activeShift.items.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center space-y-2">
              <Package className="w-7 h-7 text-slate-400 mx-auto" />
              <div className="text-sm font-bold text-slate-800">
                Você ainda não possui carga em mãos nesta loja
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {canWithdrawRestock
                  ? selectedStore.isOpen
                    ? 'Toque em "Reposição de Estoque" acima para retirar produtos da loja para suas mãos, ou lance tudo direto no Fechamento.'
                    : 'Abra a loja para retirar sua carga inicial de produtos.'
                  : 'Seu perfil não possui permissão de retirada direta. Utilize o botão de Fechar Loja para registrar o acerto do dia.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {activeShift.items.map((item) => {
                const isBusy = busySaleId === item.storeItemId;
                const customVal = parseInt(
                  customQtyByItem[item.storeItemId] || '0',
                  10
                );
                return (
                  <div
                    key={item.storeItemId}
                    className="p-3.5 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {item.photoDataUrl ? (
                        <img
                          src={item.photoDataUrl}
                          alt={item.itemName}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                          <Package className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">
                          {item.itemName}
                        </div>
                        <div className="text-xs font-mono-tabular text-slate-600 mt-0.5">
                          {formatCurrencyBRL(item.unitPrice)} / un ·{' '}
                          <strong className="text-emerald-800">
                            {item.currentHandQty} em mãos
                          </strong>{' '}
                          · {item.soldQty} vendidas
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={isBusy || item.currentHandQty < 1}
                        onClick={() => handleQuickSale(item.storeItemId, 1)}
                        className="min-h-[44px] px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-extrabold"
                      >
                        +1 Venda
                      </button>
                      <button
                        type="button"
                        disabled={isBusy || item.currentHandQty < 2}
                        onClick={() => handleQuickSale(item.storeItemId, 2)}
                        className="min-h-[44px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-900 text-xs font-extrabold border border-slate-300"
                      >
                        +2
                      </button>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={1}
                          max={item.currentHandQty}
                          placeholder="Qtd"
                          value={customQtyByItem[item.storeItemId] || ''}
                          onChange={(e) =>
                            setCustomQtyByItem((prev) => ({
                              ...prev,
                              [item.storeItemId]: e.target.value,
                            }))
                          }
                          className="w-14 min-h-[44px] px-2 text-center rounded-xl border border-slate-300 font-mono-tabular text-xs font-bold"
                        />
                        <button
                          type="button"
                          disabled={
                            isBusy ||
                            !customVal ||
                            customVal <= 0 ||
                            customVal > item.currentHandQty
                          }
                          onClick={() =>
                            handleQuickSale(item.storeItemId, customVal)
                          }
                          className="min-h-[44px] px-3 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-40 text-white text-xs font-bold"
                        >
                          Vender
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Histórico de vendas do turno */}
          {activeShift && activeShift.realTimeSales.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  Lançamentos em Tempo Real ({activeShift.realTimeSales.length})
                </span>
              </div>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-56 overflow-y-auto">
                {activeShift.realTimeSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs bg-white"
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-slate-900">
                        {sale.quantity}× {sale.itemName}
                      </span>{' '}
                      <span
                        className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                          sale.paymentMethod === 'CASH'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {sale.paymentMethod === 'CASH' ? 'Dinheiro' : 'Pix'}
                      </span>
                      <span className="ml-2 font-mono-tabular text-slate-400">
                        {formatTimeOfDay(sale.createdAt)}
                      </span>
                    </div>
                    <span className="font-mono-tabular font-extrabold text-slate-900 shrink-0">
                      {formatCurrencyBRL(sale.totalAmount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ======================================================= */}
        {/* B. ESTOQUE GERAL DA LOJA (CONDICIONAL À PERMISSÃO canViewStoreInventory) */}
        {/* ======================================================= */}
        {canViewStoreStock ? (
          <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-700" />
                <span>Estoque Geral da Loja ({storeItems.length})</span>
              </h2>
              <span className="text-xs font-mono-tabular text-slate-500">
                Saldo disponível na unidade
              </span>
            </div>

            {storeItems.length === 0 ? (
              <p className="text-xs text-slate-500 py-3">
                Nenhum item alocado no estoque desta loja.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {storeItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {item.photoDataUrl ? (
                        <img
                          src={item.photoDataUrl}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-500 flex items-center justify-center shrink-0">
                          <Package className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {item.name}
                        </div>
                        <div className="text-[11px] font-mono-tabular text-slate-500">
                          {formatCurrencyBRL(item.unitPrice)}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-mono-tabular font-extrabold text-slate-900 shrink-0">
                      {item.stockQuantity} un
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : (
          <div className="p-3.5 rounded-xl bg-slate-200/70 border border-slate-300 text-xs font-semibold text-slate-700 flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-600 shrink-0" />
            <span>
              Visualização do estoque geral da unidade oculta para o seu perfil (exibindo apenas sua Carga em Mãos).
            </span>
          </div>
        )}
      </div>

      {/* Modal de Reposição de Estoque no Expediente */}
      {restockModalOpen && (
        <div
          className="fixed inset-0 z-[1420] flex items-end sm:items-center justify-center bg-slate-950/65 backdrop-blur-xs p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setRestockModalOpen(false)}
        >
          <div
            className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-2xl max-h-[88vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-slate-900">
                  Reposição de Estoque no Turno
                </h3>
                <p className="text-xs text-slate-500 truncate">
                  {selectedStore.storeCode} · {selectedStore.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRestockModalOpen(false)}
                aria-label="Fechar reposição"
                className="min-h-[40px] min-w-[40px] rounded-xl text-slate-500 hover:bg-slate-200 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {restockError && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-800 flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{restockError}</span>
                </div>
              )}

              {storeItems.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">
                  Nenhum item cadastrado no estoque desta loja.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {storeItems.map((item) => {
                    const qty = restockQtyMap[item.id] || 0;
                    const depleted = item.stockQuantity <= 0;
                    return (
                      <div
                        key={item.id}
                        className="p-3 bg-white flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {item.photoDataUrl ? (
                            <img
                              src={item.photoDataUrl}
                              alt={item.name}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                              <Package className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate">
                              {item.name}
                            </div>
                            <div className="text-[11px] font-mono-tabular text-slate-500">
                              {formatCurrencyBRL(item.unitPrice)}
                              {canViewStoreStock && (
                                <span className="ml-1.5 text-blue-800 font-bold">
                                  · Loja: {item.stockQuantity} un
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={depleted || qty <= 0}
                            onClick={() => setRestockQty(item, qty - 1)}
                            className="w-9 h-10 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <input
                            type="number"
                            min={0}
                            max={item.stockQuantity}
                            disabled={depleted}
                            value={qty}
                            onChange={(e) =>
                              setRestockQty(
                                item,
                                parseInt(e.target.value || '0', 10) || 0
                              )
                            }
                            className="w-12 h-10 text-center rounded-lg border border-slate-300 font-mono-tabular text-xs font-extrabold"
                          />
                          <button
                            type="button"
                            disabled={depleted}
                            onClick={() => setRestockQty(item, qty + 1)}
                            className="w-9 h-10 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-white grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setRestockModalOpen(false)}
                className="min-h-[46px] rounded-xl bg-slate-100 text-slate-900 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={submittingRestock}
                onClick={handleConfirmRestock}
                className="min-h-[46px] rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-extrabold"
              >
                {submittingRestock ? 'Transferindo...' : 'Confirmar Reposição'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
