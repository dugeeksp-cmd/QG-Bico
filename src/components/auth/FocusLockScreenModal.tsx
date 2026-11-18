import React, { useMemo, useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  LogOut,
  ShieldAlert,
  Unlock,
} from 'lucide-react';
import { ROLE_LABELS, UserAccount } from '../../types/radar';

interface FocusLockScreenModalProps {
  isOpen: boolean;
  currentUser: UserAccount;
  isQuickTestSession: boolean;
  onVerifyPassword: (password: string) => Promise<boolean>;
  onUnlock: () => void;
  onLogout: () => Promise<void>;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

export const FocusLockScreenModal: React.FC<FocusLockScreenModalProps> = ({
  isOpen,
  currentUser,
  isQuickTestSession,
  onVerifyPassword,
  onUnlock,
  onLogout,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const randomSuffix = useMemo(
    () => Math.random().toString(36).slice(2, 9),
    [isOpen]
  );

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Digite sua senha para desbloquear a tela.');
      return;
    }
    setError(null);
    setChecking(true);
    try {
      const ok = await onVerifyPassword(password);
      if (!ok) {
        setError('Senha incorreta. Tente novamente.');
        return;
      }
      setPassword('');
      onUnlock();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2000] bg-slate-950 text-white flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="focus-lock-title"
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1
              id="focus-lock-title"
              className="text-lg font-extrabold text-white tracking-tight"
            >
              Sessão Bloqueada (Anti-Espião)
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 leading-snug">
              Proteção automática ativada por troca de guia, minimização ou
              perda de foco.
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center gap-3">
          {currentUser.avatarDataUrl ? (
            <img
              src={currentUser.avatarDataUrl}
              alt={currentUser.name}
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-xl object-cover border border-slate-700 shrink-0"
            />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-blue-700 text-white font-extrabold text-sm flex items-center justify-center shrink-0">
              {getInitials(currentUser.name)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-white truncate">
              {currentUser.name}
            </div>
            <div className="text-xs text-slate-400 font-mono-tabular truncate mt-0.5">
              {ROLE_LABELS[currentUser.role]} · {currentUser.userCode}
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          autoComplete="off"
          className="space-y-4"
        >
          {/* Campos ocultos anti-autocomplete */}
          <div
            aria-hidden="true"
            className="absolute -left-[9999px] w-px h-px overflow-hidden opacity-0 pointer-events-none"
          >
            <input type="text" name={`decoy_u_${randomSuffix}`} tabIndex={-1} />
            <input
              type="password"
              name={`decoy_p_${randomSuffix}`}
              tabIndex={-1}
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor={`lock_pwd_${randomSuffix}`}
              className="block text-xs font-bold text-slate-300"
            >
              Digite sua senha para retomar
            </label>
            <div className="relative">
              <input
                id={`lock_pwd_${randomSuffix}`}
                name={`lock_pwd_${randomSuffix}`}
                type="text"
                autoComplete="new-password"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha da sua conta"
                className={`${
                  showPassword ? '' : 'masked-secret-input '
                }w-full min-h-[48px] pl-3.5 pr-12 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
                className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-950/70 border border-red-700 text-red-200 text-xs font-bold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={checking}
            className="w-full min-h-[48px] px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-extrabold flex items-center justify-center gap-2 transition-colors"
          >
            <Unlock className="w-4 h-4" />
            <span>{checking ? 'Verificando...' : 'Desbloquear Tela'}</span>
          </button>
        </form>

        {isQuickTestSession && (
          <button
            type="button"
            onClick={() => {
              setPassword('');
              setError(null);
              onUnlock();
            }}
            className="w-full min-h-[44px] px-4 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-amber-200 text-xs font-extrabold flex items-center justify-center gap-2"
          >
            <Unlock className="w-4 h-4" />
            <span>Desbloquear (Modo Teste QA)</span>
          </button>
        )}

        <div className="pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => {
              setPassword('');
              setError(null);
              onUnlock();
              void onLogout();
            }}
            className="w-full min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Trocar Usuário / Sair da Conta</span>
          </button>
        </div>
      </div>
    </div>
  );
};
