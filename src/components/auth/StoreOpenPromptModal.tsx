import React, { useEffect, useState } from 'react';
import { Building2, Check, X } from 'lucide-react';
import { StoreUnit } from '../../types/radar';

interface StoreOpenPromptModalProps {
  isOpen: boolean;
  closedStores: StoreUnit[];
  onConfirmOpen: (storeIds: string[]) => Promise<void>;
  onDismiss: () => void;
}

export const StoreOpenPromptModal: React.FC<StoreOpenPromptModalProps> = ({
  isOpen,
  closedStores,
  onConfirmOpen,
  onDismiss,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(closedStores.map((s) => s.id));
    }
  }, [isOpen, closedStores]);

  if (!isOpen || closedStores.length === 0) return null;

  const toggleId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleConfirm = async () => {
    const targetIds =
      selectedIds.length > 0 ? selectedIds : closedStores.map((s) => s.id);
    setSubmitting(true);
    try {
      await onConfirmOpen(targetIds);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1400] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="store-open-prompt-title"
    >
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="p-6 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>

          <div className="space-y-1.5">
            <h2
              id="store-open-prompt-title"
              className="text-xl font-extrabold text-slate-900 tracking-tight"
            >
              Sua loja está fechada. Deseja abrir?
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              {closedStores.length === 1
                ? `A unidade ${closedStores[0].name} (${closedStores[0].storeCode}) está atualmente offline no mapa.`
                : 'Você possui unidades fechadas no momento. Selecione quais deseja abrir agora:'}
            </p>
          </div>

          {closedStores.length > 1 ? (
            <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
              {closedStores.map((s) => (
                <label
                  key={s.id}
                  className="p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(s.id)}
                    onChange={() => toggleId(s.id)}
                    className="w-4 h-4 accent-emerald-600"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {s.name}
                    </div>
                    <div className="text-xs font-mono-tabular text-slate-500">
                      {s.storeCode}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-sm font-bold text-slate-900">
                {closedStores[0].name}
              </div>
              <div className="text-xs font-mono-tabular text-slate-500 mt-0.5">
                {closedStores[0].storeCode} · Raio {closedStores[0].radiusKm} km
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={onDismiss}
              disabled={submitting}
              className="min-h-[48px] rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-sm font-bold flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              <span>Não</span>
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{submitting ? 'Abrindo...' : 'Sim'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
