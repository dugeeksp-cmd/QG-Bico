import React, { useEffect, useMemo, useState } from 'react';
import { History, Lock, ShieldAlert, User as UserIcon } from 'lucide-react';

interface LoginViewProps {
  version?: string;
  onLogin: (username: string, password: string) => Promise<unknown>;
  onQuickTestLogin: () => Promise<unknown>;
  onOpenVersionQa?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  version = '6.1.1',
  onLogin,
  onQuickTestLogin,
  onOpenVersionQa,
}) => {
  const randomId = useMemo(
    () => Math.random().toString(36).slice(2, 10),
    []
  );
  const userFieldName = `usr_${randomId}`;
  const passFieldName = `pwd_${randomId}`;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Limpa estados imediatamente ao montar a tela para garantir campos 100% em branco
  useEffect(() => {
    setUsername('');
    setPassword('');
    setError(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const enteredUser = username;
    const enteredPass = password;

    // Limpa os campos no momento da submissão para bloquear prompt nativo de salvamento
    setUsername('');
    setPassword('');
    setError(null);
    setSubmitting(true);

    try {
      await onLogin(enteredUser, enteredPass);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível autenticar.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickTest = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await onQuickTestLogin();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível entrar no modo teste.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-slate-100 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8">
        {/* Logo no topo + título do sistema */}
        <div className="flex flex-col items-center text-center mb-7">
          <div
            className="w-16 h-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center mb-4 shadow-md"
            aria-label="Logotipo do sistema"
          >
            <svg
              viewBox="0 0 48 48"
              width="34"
              height="34"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="24"
                cy="24"
                r="18"
                stroke="#60A5FA"
                strokeWidth="2.5"
                strokeDasharray="4 4"
              />
              <circle cx="24" cy="24" r="10" stroke="#93C5FD" strokeWidth="2" />
              <circle cx="24" cy="24" r="3.5" fill="#F8FAFC" />
              <path
                d="M24 24L35 13"
                stroke="#FACC15"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight text-balance">
            Radar da Caça
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Frota Urbana &amp; Unidades Compartilhadas
          </p>
          <button
            type="button"
            onClick={() => onOpenVersionQa?.()}
            title="Abrir Painel de Controle de Versões e Checklist QA"
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-[11px] font-mono-tabular font-bold text-slate-700 hover:text-blue-800 transition-colors cursor-pointer"
          >
            <History className="w-3.5 h-3.5 shrink-0" />
            <span>Versão {version} · Checklist QA</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
          {/* Iscas ocultas (honeypot) fora da tela para neutralizar gerenciadores de senha */}
          <input
            type="text"
            name="fake_username_decoy"
            autoComplete="username"
            aria-hidden="true"
            tabIndex={-1}
            defaultValue=""
            className="fixed -left-[9999px] -top-[9999px] w-px h-px opacity-0 pointer-events-none"
          />
          <input
            type="password"
            name="fake_password_decoy"
            autoComplete="current-password"
            aria-hidden="true"
            tabIndex={-1}
            defaultValue=""
            className="fixed -left-[9999px] -top-[9999px] w-px h-px opacity-0 pointer-events-none"
          />

          <div>
            <label
              htmlFor={userFieldName}
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              Usuário
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id={userFieldName}
                name={userFieldName}
                type="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Seu nome de usuário"
                className="w-full min-h-[48px] pl-10 pr-4 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor={passFieldName}
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              Senha
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id={passFieldName}
                name={passFieldName}
                type="text"
                autoComplete="new-password"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                className="masked-secret-input w-full min-h-[48px] pl-10 pr-4 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800 flex items-start gap-2"
            >
              <ShieldAlert className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[50px] rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-bold transition-colors shadow-sm"
          >
            {submitting ? 'Verificando...' : 'Entrar'}
          </button>

          <button
            type="button"
            onClick={handleQuickTest}
            disabled={submitting}
            className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-60 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <span>Entrar sem senha</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold tracking-wide uppercase">
              Modo Teste
            </span>
          </button>
        </form>
      </div>

      <p className="mt-5 max-w-md text-[11px] text-slate-500 text-center font-mono-tabular leading-relaxed">
        Contas v{version} (senha 123): admin · presidente1 · governador1 · gerente1 · subgerente1 · fiscal1 · caixa1
      </p>
    </div>
  );
};
