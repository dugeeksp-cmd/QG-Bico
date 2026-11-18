import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Minus,
  Package,
  Plus,
  Power,
  QrCode,
  RotateCcw,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  ClosingMerchandiseLine,
  OperatorShiftInventory,
  StoreMerchandiseItem,
  StoreUnit,
} from '../../types/radar';
import { formatCurrencyBRL } from '../../utils/geo';

interface CloseStoreSalesModalProps {
  store: StoreUnit | null;
  merchandise: StoreMerchandiseItem[];
  operatorShifts?: OperatorShiftInventory[];
  onConfirmClose: (
    storeId: string,
    payload: {
      soldItems: ClosingMerchandiseLine[];
      cashReceived: number;
      pixReceived: number;
    }
  ) => Promise<unknown>;
  onCancel: () => void;
}

function parseBRLInput(raw: string): number {
  const normalized = raw
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.]/g, '');
  const val = normalized ? parseFloat(normalized) : 0;
  return Number.isNaN(val) ? 0 : Math.max(0, val);
}

export const CloseStoreSalesModal: React.FC<CloseStoreSalesModalProps> = ({
  store,
  merchandise,
  operatorShifts = [],
  onConfirmClose,
  onCancel,
}) => {
  const [soldQtyMap, setSoldQtyMap] = useState<Record<string, number>>({});
  const [cashInput, setCashInput] = useState('');
  const [pixInput, setPixInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const storeItems = useMemo(() => {
    if (!store) return [];
    return merchandise.filter((m) => m.storeId === store.id);
  }, [store, merchandise]);

  const activeStoreShifts = useMemo(() => {
    if (!store) return [];
    return operatorShifts.filter(
      (sh) => sh.storeId === store.id && sh.status === 'ACTIVE'
    );
  }, [store, operatorShifts]);

  // Soma o que foi retirado (abertura + reposições) e o que já foi vendido em tempo real
  const { takenByItem, prefillSoldByItem, prefillCash, prefillPix } =
    useMemo(() => {
      const takenMap = new Map<string, number>();
      const soldMap = new Map<string, number>();
      let cash = 0;
      let pix = 0;

      activeStoreShifts.forEach((sh) => {
        sh.items.forEach((it) => {
          const taken = it.initialWithdrawnQty + it.restockedQty;
          takenMap.set(
            it.storeItemId,
            (takenMap.get(it.storeItemId) || 0) + taken
          );
          soldMap.set(
            it.storeItemId,
            (soldMap.get(it.storeItemId) || 0) + it.soldQty
          );
        });
        sh.realTimeSales.forEach((sale) => {
          if (sale.paymentMethod === 'CASH') cash += sale.totalAmount;
          else pix += sale.totalAmount;
        });
      });

      return {
        takenByItem: takenMap,
        prefillSoldByItem: soldMap,
        prefillCash: Number(cash.toFixed(2)),
        prefillPix: Number(pix.toFixed(2)),
      };
    }, [activeStoreShifts]);

  useEffect(() => {
    if (store) {
      const initialSold: Record<string, number> = {};
      prefillSoldByItem.forEach((qty, itemId) => {
        if (qty > 0) initialSold[itemId] = qty;
      });
      setSoldQtyMap(initialSold);
      setCashInput(
        prefillCash > 0 ? prefillCash.toFixed(2).replace('.', ',') : ''
      );
      setPixInput(
        prefillPix > 0 ? prefillPix.toFixed(2).replace('.', ',') : ''
      );
    }
  }, [store?.id, prefillSoldByItem, prefillCash, prefillPix]);

  const { soldLines, totalItemsSold, expectedSalesAmount, leftoverReturns } =
    useMemo(() => {
      let totalItems = 0;
      let totalAmount = 0;
      const returns: { itemId: string; itemName: string; qty: number }[] = [];

      const lines: ClosingMerchandiseLine[] = storeItems.map((item) => {
        const qty = Math.max(0, soldQtyMap[item.id] || 0);
        const lineTotal = Number((qty * item.unitPrice).toFixed(2));
        totalItems += qty;
        totalAmount += lineTotal;

        const taken = takenByItem.get(item.id) || 0;
        const leftover = taken - qty;
        if (leftover > 0) {
          returns.push({
            itemId: item.id,
            itemName: item.name,
            qty: leftover,
          });
        }

        return {
          itemId: item.id,
          itemName: item.name,
          photoDataUrl: item.photoDataUrl,
          unitPrice: item.unitPrice,
          quantitySold: qty,
          lineTotal,
        };
      });
      return {
        soldLines: lines,
        totalItemsSold: totalItems,
        expectedSalesAmount: Number(totalAmount.toFixed(2)),
        leftoverReturns: returns,
      };
    }, [storeItems, soldQtyMap, takenByItem]);

  if (!store) return null;

  const cashReceived = parseBRLInput(cashInput);
  const pixReceived = parseBRLInput(pixInput);
  const totalReceived = Number((cashReceived + pixReceived).toFixed(2));
  const diff = Number((totalReceived - expectedSalesAmount).toFixed(2));

  const balanceState =
    Math.abs(diff) < 0.01
      ? 'MATCHED'
      : diff > 0
      ? 'SURPLUS'
      : 'SHORTAGE';

  const setItemQty = (itemId: string, nextVal: number) => {
    setSoldQtyMap((prev) => ({
      ...prev,
      [itemId]: Math.max(0, Math.round(nextVal)),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onConfirmClose(store.id, {
        soldItems: soldLines,
        cashReceived,
        pixReceived,
      });
      onCancel();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1400] flex items-end sm:items-center justify-center bg-slate-950/65 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="close-store-modal-title"
      onClick={onCancel}
    >
      <div
        className="w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-2xl h-[92vh] sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
              <Power className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="close-store-modal-title"
                className="text-base font-extrabold text-slate-900 truncate"
              >
                Fechamento do Dia · Conferência de Vendas
              </h2>
              <p className="text-xs font-mono-tabular text-slate-600 truncate">
                {store.storeCode} · {store.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancelar fechamento"
            className="min-h-[44px] min-w-[44px] -mr-2 rounded-xl text-slate-500 hover:bg-slate-200 flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-5 space-y-5"
        >
          {(prefillCash > 0 || prefillPix > 0) && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-950 font-semibold">
              Valores e quantidades pré-preenchidos automaticamente com suas vendas registradas em tempo real durante o turno. Você pode revisar ou ajustar abaixo antes de fechar.
            </div>
          )}

          {/* 1. Lista de Mercadorias da Loja */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                1. Mercadorias Vendidas Hoje ({storeItems.length})
              </h3>
              <span className="text-xs font-mono-tabular font-bold text-slate-900">
                {totalItemsSold}{' '}
                {totalItemsSold === 1 ? 'item vendido' : 'itens vendidos'}
              </span>
            </div>

            {storeItems.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-600 text-center">
                Nenhuma mercadoria cadastrada nesta unidade. Informe abaixo os recebimentos em Dinheiro e Pix.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {storeItems.map((item) => {
                  const qty = soldQtyMap[item.id] || 0;
                  const subTotal = qty * item.unitPrice;
                  const taken = takenByItem.get(item.id) || 0;
                  const leftover = Math.max(0, taken - qty);
                  return (
                    <div
                      key={item.id}
                      className="p-3 bg-white flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {item.photoDataUrl ? (
                          <img
                            src={item.photoDataUrl}
                            alt={item.name}
                            referrerPolicy="no-referrer"
                            className="w-11 h-11 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                            <Package className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 truncate">
                            {item.name}
                          </div>
                          <div className="text-xs font-mono-tabular text-slate-600">
                            {formatCurrencyBRL(item.unitPrice)} / un
                            {taken > 0 && (
                              <span className="ml-1.5 text-slate-700">
                                · Retirado no turno: <strong>{taken} un</strong>
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            {qty > 0 && (
                              <span className="text-xs font-mono-tabular font-bold text-blue-700">
                                Subtotal: {formatCurrencyBRL(subTotal)}
                              </span>
                            )}
                            {leftover > 0 && (
                              <span className="text-[11px] font-mono-tabular font-bold text-emerald-700">
                                · Devolve {leftover} un
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setItemQty(item.id, qty - 1)}
                          aria-label={`Diminuir ${item.name}`}
                          className="w-9 h-10 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 flex items-center justify-center"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <input
                          type="number"
                          min={0}
                          aria-label={`Quantidade vendida de ${item.name}`}
                          value={qty}
                          onChange={(e) =>
                            setItemQty(
                              item.id,
                              parseInt(e.target.value || '0', 10) || 0
                            )
                          }
                          className="w-14 h-10 text-center rounded-lg border border-slate-300 font-mono-tabular text-sm font-extrabold text-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => setItemQty(item.id, qty + 1)}
                          aria-label={`Aumentar ${item.name}`}
                          className="w-9 h-10 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 flex items-center justify-center"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Sobra Não Vendida -> Devolução Automática ao Estoque da Loja */}
            {leftoverReturns.length > 0 && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1.5">
                <div className="text-xs font-extrabold text-emerald-900 flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>
                    Sobra Não Vendida (Devolução Automática ao Estoque da Loja)
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {leftoverReturns.map((ret) => (
                    <span
                      key={ret.itemId}
                      className="px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-xs font-mono-tabular font-bold text-emerald-900"
                    >
                      +{ret.qty}× {ret.itemName}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Total Esperado */}
            <div className="p-3.5 rounded-xl bg-slate-900 text-white flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Valor Esperado das Vendas
                </div>
                <div className="text-xs font-mono-tabular text-slate-300">
                  {totalItemsSold}{' '}
                  {totalItemsSold === 1 ? 'unidade' : 'unidades'} somadas
                </div>
              </div>
              <div className="text-xl font-extrabold font-mono-tabular">
                {formatCurrencyBRL(expectedSalesAmount)}
              </div>
            </div>
          </div>

          {/* 2. Recebimentos em Dinheiro e Pix */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
              2. Conferência Financeira (Dinheiro + Pix)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="cash-received-input"
                  className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5"
                >
                  <Banknote className="w-4 h-4 text-emerald-700" />
                  <span>Total Recebido em Dinheiro (R$)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">
                    R$
                  </span>
                  <input
                    id="cash-received-input"
                    type="text"
                    inputMode="decimal"
                    value={cashInput}
                    onChange={(e) => setCashInput(e.target.value)}
                    placeholder="0,00"
                    className="w-full min-h-[48px] pl-11 pr-4 rounded-xl border border-slate-300 font-mono-tabular text-base font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="pix-received-input"
                  className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5"
                >
                  <QrCode className="w-4 h-4 text-blue-700" />
                  <span>Total Recebido em Pix (R$)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">
                    R$
                  </span>
                  <input
                    id="pix-received-input"
                    type="text"
                    inputMode="decimal"
                    value={pixInput}
                    onChange={(e) => setPixInput(e.target.value)}
                    placeholder="0,00"
                    className="w-full min-h-[48px] pl-11 pr-4 rounded-xl border border-slate-300 font-mono-tabular text-base font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* Indicador visual imediato de Saldo */}
            <div
              className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                balanceState === 'MATCHED'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : balanceState === 'SURPLUS'
                  ? 'bg-blue-50 border-blue-300 text-blue-950'
                  : 'bg-red-50 border-red-300 text-red-950'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {balanceState === 'MATCHED' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                ) : balanceState === 'SURPLUS' ? (
                  <TrendingUp className="w-5 h-5 text-blue-700 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-700 shrink-0" />
                )}
                <div>
                  <div className="text-sm font-extrabold">
                    {balanceState === 'MATCHED'
                      ? 'Saldo Bateu'
                      : balanceState === 'SURPLUS'
                      ? 'Saldo Positivo / Sobra'
                      : 'Saldo Negativo / Falta'}
                  </div>
                  <div className="text-xs font-mono-tabular opacity-90">
                    Dinheiro + Pix: {formatCurrencyBRL(totalReceived)}
                  </div>
                </div>
              </div>

              <div className="text-right font-mono-tabular">
                <div className="text-base font-extrabold">
                  {diff > 0 ? '+' : ''}
                  {formatCurrencyBRL(diff)}
                </div>
                <div className="text-[11px] opacity-80">Diferença</div>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            Ao salvar, a loja ficará Fechada (Offline) no mapa, a sobra não vendida retornará ao estoque da loja e o Gerente receberá o fechamento para conferência.
          </p>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="min-h-[48px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[48px] rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-bold"
            >
              {submitting ? 'Salvando...' : 'Salvar e Fechar Loja'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
