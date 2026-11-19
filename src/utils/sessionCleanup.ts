/**
 * Utilitário compartilhado de limpeza profunda de sessão, cookies e cache do navegador (v6.1.0).
 * Preserva dados estruturais locais (lojas, usuários, ocorrências e checklist de QA),
 * removendo apenas credenciais/sessão ativa, cookies acessíveis, sessionStorage e Cache Storage.
 */
export async function limparSessaoECacheNavegador(): Promise<void> {
  if (typeof window === 'undefined') return;

  // 1. Limpa sessionStorage completo
  try {
    window.sessionStorage.clear();
  } catch {
    // Ignora caso bloqueado pelo navegador
  }

  // 2. Remove chaves de autenticação/sessão/usuário logado do localStorage
  //    (preserva catálogo, lojas, histórico e saas_mapa_qa_changelog_v1)
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (key === 'saas_mapa_qa_changelog_v1') continue;
      const lower = key.toLowerCase();
      if (
        lower.includes('session') ||
        lower.includes('token') ||
        lower.includes('auth') ||
        lower.includes('active_user') ||
        lower.includes('current_user') ||
        lower === 'radar_v2_session_uid'
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Ignora caso bloqueado
  }

  // 3. Expira todos os cookies acessíveis pelo JavaScript
  try {
    if (typeof document !== 'undefined' && document.cookie) {
      const cookies = document.cookie.split(';');
      const currentPath = window.location.pathname || '/';
      for (const rawCookie of cookies) {
        const eqPos = rawCookie.indexOf('=');
        const name = (
          eqPos > -1 ? rawCookie.slice(0, eqPos) : rawCookie
        ).trim();
        if (!name) continue;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        if (currentPath && currentPath !== '/') {
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${currentPath}`;
        }
      }
    }
  } catch {
    // Ignora caso bloqueado
  }

  // 4. Limpa Cache Storage do navegador (Service Workers / caches HTTP locais)
  try {
    if ('caches' in window && typeof window.caches?.keys === 'function') {
      const cacheNames = await window.caches.keys();
      await Promise.all(cacheNames.map((name) => window.caches.delete(name)));
    }
  } catch {
    // Ignora caso Cache API esteja indisponível
  }
}
