import React, { useEffect } from 'react';
import { LogOut, ShieldAlert, X } from 'lucide-react';

interface ExitConfirmModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirmExit: () => void;
}

export const ExitConfirmModal: React.FC<ExitConfirmModalProps> = ({
  isOpen,
  onCancel,
  onConfirmExit,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-confirm-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h2
              id="exit-confirm-title"
              className="text-base font-extrabold text-slate-900 tracking-tight truncate"
            >
              Encerrar Sessão
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fechar confirmação de saída"
            className="min-h-[40px] min-w-[40px] -mr-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
              Deseja realmente encerrar a sessão e sair do sistema?
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              Sua sessão ativa será limpa com segurança e o navegador será
              redirecionado para fora do sistema.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[48px] px-4 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 active:scale-[0.99] text-slate-800 text-sm font-bold transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirmExit}
              className="min-h-[48px] px-4 rounded-xl bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white text-sm font-extrabold flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Confirmar Saída</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
