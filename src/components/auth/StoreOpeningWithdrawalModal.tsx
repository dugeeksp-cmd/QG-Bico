import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Minus,
  Package,
  Plus,
  Power,
  X,
} from 'lucide-react';
import {
  StoreMerchandiseItem,
  StoreUnit,
  UserAccount,
} from '../../types/radar';
import { formatCurrencyBRL } from '../../utils/geo';
import { hasPermission } from '../../utils/rbac';

interface StoreOpeningWithdrawalModalProps {
  store: StoreUnit | null;
  currentUser: UserAccount;
  merchandise: StoreMerchandiseItem[];
  onConfirmOpenWithWithdrawal: (
    storeId: string,
    withdrawals: { storeItemId: string; quantity: number }[]
  ) => Promise<void>;
  onCancel: () => void;
}

export const StoreOpeningWithdrawalModal: React.FC<
  StoreOpeningWithdrawalModalProps
> = ({
  store,
  currentUser,
  merchandise,
  onConfirmOpenWithWithdrawal,
  onCancel,
}) => {
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [limitError, setLimitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canViewStoreStock = hasPermission(currentUser, 'canViewStoreInventory');

  const storeItems = useMemo(() => {
    if (!store) return [];
    return merchandise.filter((m) => m.storeId === store.id);
  }, [store, merchandise]);

  useEffect(() => {
    if (store) {
      setQtyMap({});
      setLimitError(null);
    }
  }, [store?.id]);

  if (!store) return null;

  const setItemQty = (item: StoreMerchandiseItem, rawNext: number) => {
    const clean = Math.max(0, Math.round(rawNext || 0));
    if (clean > item.stockQuantity) {
      setLimitError(
        `Limite atingido para "${item.name}": o estoque da loja possui apenas ${item.stockQuantity} ${
          item.stockQuantity === 1 ? 'unidade disponível' : 'unidades disponíveis'
        }.`
      );
      setQtyMap((prev) => ({
        ...prev,
        [item.id]: item.stockQuantity,
      }));
      return;
    }
    setLimitError(null);
    setQtyMap((prev) => ({
      ...prev,
      [item.id]: clean,
    }));
  };

  const totalUnits = storeItems.reduce(
    (acc, item) => acc + (qtyMap[item.id] || 0),
    0
  );
  const totalValue = storeItems.reduce(
    (acc, item) => acc + (qtyMap[item.id] || 0) * item.unitPrice,
    0
  );

  const handleConfirm = async (skipWithdrawal = false) => {
    setLimitError(null);
    const payload = skipWithdrawal
      ? []
      : storeItems
          .map((item) => ({
            storeItemId: item.id,
            quantity: qtyMap[item.id] || 0,
          }))
          .filter((w) => w.quantity > 0);

    setSubmitting(true);
    try {
      await onConfirmOpenWithWithdrawal(store.id, payload);
      onCancel();
    } catch (err) {
      setLimitError(
        err instanceof Error ? err.message : 'Erro ao abrir loja com retirada.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1420] flex items-end sm:items-center justify-center bg-slate-950/65 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="opening-withdrawal-title"
      onClick={onCancel}
    >
      <div
        className="w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-2xl h-[90vh] sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Power className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="opening-withdrawal-title"
                className="text-base font-extrabold text-slate-900 truncate"
              >
                Abertura de Loja · Retirada de Carga
              </h2>
              <p className="text-xs font-mono-tabular text-slate-600 truncate">
                {store.storeCode} · {store.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancelar abertura"
            className="min-h-[44px] min-w-[44px] -mr-2 rounded-xl text-slate-500 hover:bg-slate-200 flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Informe as quantidades de cada produto que você está retirando para trabalhar neste turno. Os itens serão abatidos do estoque da unidade e transferidos para sua <strong>Carga em Mãos</strong>, gerando conferência para o Gerente.
          </p>

          {limitError && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-800 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{limitError}</span>
            </div>
          )}

          {storeItems.length === 0 ? (
            <div className="p-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-xs text-slate-600">
              Esta loja ainda não possui produtos alocados no estoque. Você pode abrir a unidade normalmente.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {storeItems.map((item) => {
                const qty = qtyMap[item.id] || 0;
                const depleted = item.stockQuantity <= 0;
                return (
                  <div
                    key={item.id}
                    className="p-3.5 bg-white flex items-center justify-between gap-3"
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
                          {canViewStoreStock && (
                            <span className="ml-1.5 text-blue-800 font-bold">
                              · Estoque loja: {item.stockQuantity} un
                            </span>
                          )}
                        </div>
                        {depleted && (
                          <div className="text-[11px] font-bold text-red-700 mt-0.5">
                            Sem saldo na loja no momento
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={depleted || qty <= 0}
                        onClick={() => setItemQty(item, qty - 1)}
                        aria-label={`Diminuir retirada de ${item.name}`}
                        className="w-10 h-11 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-800 flex items-center justify-center"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={item.stockQuantity}
                        disabled={depleted}
                        aria-label={`Quantidade retirada de ${item.name}`}
                        value={qty}
                        onChange={(e) =>
                          setItemQty(
                            item,
                            parseInt(e.target.value || '0', 10) || 0
                          )
                        }
                        className="w-14 h-11 text-center rounded-xl border border-slate-300 font-mono-tabular text-sm font-extrabold text-slate-900 disabled:bg-slate-100"
                      />
                      <button
                        type="button"
                        disabled={depleted}
                        onClick={() => setItemQty(item, qty + 1)}
                        aria-label={`Aumentar retirada de ${item.name}`}
                        className="w-10 h-11 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-800 flex items-center justify-center"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-slate-900 text-white flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Resumo da Carga Retirada
              </div>
              <div className="text-xs font-mono-tabular text-slate-200">
                {totalUnits} {totalUnits === 1 ? 'unidade' : 'unidades'} para o
                turno
              </div>
            </div>
            <div className="text-lg font-extrabold font-mono-tabular">
              {formatCurrencyBRL(totalValue)}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleConfirm(true)}
            className="min-h-[48px] px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs sm:text-sm font-bold"
          >
            Abrir sem Retirar Carga
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleConfirm(false)}
            className="flex-1 min-h-[48px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2"
          >
            <Power className="w-4 h-4" />
            <span>
              {submitting
                ? 'Abrindo loja...'
                : totalUnits > 0
                ? 'Confirmar Retirada e Abrir Loja'
                : 'Abrir Loja Agora'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
