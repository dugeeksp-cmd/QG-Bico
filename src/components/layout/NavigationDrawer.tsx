import React from 'react';
import {
  Activity,
  BarChart3,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Eye,
  EyeOff,
  Globe,
  History,
  Layers,
  LogOut,
  Map as MapIcon,
  MessageSquare,
  Radio,
  Users,
  Wallet,
  Warehouse,
  X,
} from 'lucide-react';
import {
  AppScreenKey,
  QaChangelogState,
  ROLE_LABELS,
  StoreUnit,
  UserAccount,
} from '../../types/radar';
import {
  canAccessClosingReview,
  canAccessFinanceSales,
  canManageCentralStock,
  hasPermission,
  isHighManagementInvisibleByDefault,
} from '../../utils/rbac';

interface NavigationDrawerProps {
  isOpen: boolean;
  currentUser: UserAccount;
  stores: StoreUnit[];
  activeScreen: AppScreenKey;
  isHighMgmtOnlineVisible: boolean;
  qaChangelog: QaChangelogState;
  counts: {
    stores: number;
    alerts: number;
    occurrences: number;
    closingAlerts?: number;
    adminFinancePending?: number;
    operatorHandUnits?: number;
    chatAuditLogs?: number;
    unreadChatCount?: number;
  };
  onSelectScreen: (screen: AppScreenKey) => void;
  onOpenChatModal: () => void;
  onToggleOnlineVisibility: (visible: boolean) => Promise<void>;
  onTogglePublicProfile: (isPublic: boolean) => Promise<void>;
  onOpenVersionQa: () => void;
  onRequestExit: () => void;
  onClose: () => void;
}

function getUserInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  isOpen,
  currentUser,
  stores,
  activeScreen,
  isHighMgmtOnlineVisible,
  qaChangelog,
  counts,
  onSelectScreen,
  onOpenChatModal,
  onToggleOnlineVisibility,
  onTogglePublicProfile,
  onOpenVersionQa,
  onRequestExit,
  onClose,
}) => {
  if (!isOpen) return null;

  const showMap = hasPermission(currentUser, 'canViewMap');
  const showFinance = canAccessFinanceSales(currentUser, stores);
  const showDashboard = hasPermission(currentUser, 'canViewDashboardAudit');
  const showInventory = canManageCentralStock(currentUser.role);
  const showStores = hasPermission(currentUser, 'canManageStores');
  const showTeam = hasPermission(currentUser, 'canManageUsers');
  const showCatalog = hasPermission(currentUser, 'canManageCatalog');
  const showAudit = hasPermission(currentUser, 'canViewDashboardAudit');
  const showClosings = canAccessClosingReview(currentUser.role);
  const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';
  const showQa = true;
  const showOnlineSwitch = isHighManagementInvisibleByDefault(currentUser.role);

  const pendingAdminStock = counts.adminFinancePending || 0;
  const pendingClosing = counts.closingAlerts || 0;
  const totalAdminAndClosingPending = pendingAdminStock + pendingClosing;
  const unreadChatCount = counts.unreadChatCount || 0;

  const handleNavigate = (screen: AppScreenKey) => {
    onSelectScreen(screen);
    onClose();
  };

  const renderNavItem = (
    screen: AppScreenKey,
    label: string,
    icon: React.ReactNode,
    badgeText?: string,
    isAlertBadge = false
  ) => {
    const active = activeScreen === screen;
    return (
      <button
        key={screen}
        type="button"
        onClick={() => handleNavigate(screen)}
        className={`w-full min-h-[46px] px-3.5 rounded-xl flex items-center justify-between gap-3 text-sm font-bold transition-colors ${
          active
            ? 'bg-slate-900 text-white shadow-xs'
            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <span className="flex items-center gap-3 min-w-0">
          <span className={active ? 'text-blue-400' : 'text-slate-500'}>
            {icon}
          </span>
          <span className="truncate">{label}</span>
        </span>
        {badgeText !== undefined && (
          <span
            className={`text-xs font-mono-tabular px-2 py-0.5 rounded-md font-extrabold ${
              isAlertBadge
                ? 'bg-red-600 text-white'
                : active
                ? 'bg-slate-800 text-slate-200'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {badgeText}
          </span>
        )}
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[1300] flex bg-slate-950/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Menu de navegação"
      onClick={onClose}
    >
      <aside
        className="w-[86vw] max-w-[330px] h-full bg-white flex flex-col shadow-2xl border-r border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho escuro elegante com Logo, Foto, Nome, Cargo e Região */}
        <div className="bg-slate-950 text-white px-4 pt-4 pb-5 shrink-0">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                <svg
                  viewBox="0 0 48 48"
                  width="22"
                  height="22"
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
              <div className="min-w-0">
                <div className="font-display font-extrabold text-base leading-tight tracking-tight truncate">
                  Radar da Caça
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenVersionQa();
                  }}
                  title="Abrir Painel de Controle de Versões e Checklist QA"
                  className="mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 hover:bg-blue-700 border border-slate-700 text-[11px] text-blue-200 hover:text-white font-mono-tabular font-bold transition-colors"
                >
                  <History className="w-3 h-3 shrink-0" />
                  <span>v{qaChangelog.version} · Checklist QA</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar menu"
              className="min-h-[42px] min-w-[42px] -mr-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800">
            {currentUser.avatarDataUrl ? (
              <img
                src={currentUser.avatarDataUrl}
                alt={currentUser.name}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-xl object-cover border border-slate-700 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-blue-700 text-white font-extrabold text-sm flex items-center justify-center shrink-0">
                {getUserInitials(currentUser.name)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-white truncate">
                {currentUser.name}
              </div>
              <div className="text-xs text-blue-300 font-semibold truncate mt-0.5">
                {ROLE_LABELS[currentUser.role]}
              </div>
              <div className="text-[11px] font-mono-tabular text-slate-400 truncate mt-0.5">
                {currentUser.userCode}
                {currentUser.region ? ` · Região ${currentUser.region}` : ''}
              </div>
            </div>
          </div>
        </div>

        {/* Lista de navegação filtrada por cargo e permissões */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {/* Operação */}
          <div className="space-y-1">
            <div className="px-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
              Operação
            </div>
            {showMap &&
              renderNavItem(
                'map',
                'Mapa ao Vivo',
                <MapIcon className="w-4 h-4" />,
                counts.occurrences > 0 ? String(counts.occurrences) : undefined
              )}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenChatModal();
              }}
              className="w-full min-h-[46px] px-3.5 rounded-xl flex items-center justify-between gap-3 text-sm font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <span className="flex items-center gap-3 min-w-0">
                <MessageSquare className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="truncate">Chat &amp; Mensagens</span>
              </span>
              {unreadChatCount > 0 && (
                <span className="text-xs font-mono-tabular px-2 py-0.5 rounded-md font-extrabold bg-blue-600 text-white">
                  {unreadChatCount}
                </span>
              )}
            </button>
            {showFinance &&
              renderNavItem(
                'finance',
                'Financeiro & Vendas',
                <Wallet className="w-4 h-4" />,
                counts.operatorHandUnits && counts.operatorHandUnits > 0
                  ? `${counts.operatorHandUnits} un`
                  : undefined
              )}
            {showDashboard &&
              renderNavItem(
                'dashboard',
                'Dashboard',
                <BarChart3 className="w-4 h-4" />,
                totalAdminAndClosingPending > 0
                  ? String(totalAdminAndClosingPending)
                  : undefined,
                totalAdminAndClosingPending > 0
              )}
          </div>

          {/* Gestão */}
          {(showClosings ||
            showInventory ||
            showStores ||
            showTeam ||
            showCatalog ||
            showAudit ||
            isSuperAdmin) && (
            <div className="space-y-1">
              <div className="px-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                Gestão
              </div>
              {showClosings &&
                renderNavItem(
                  'closings',
                  'Conferência de Fechamentos',
                  <ClipboardCheck className="w-4 h-4" />,
                  totalAdminAndClosingPending > 0
                    ? String(totalAdminAndClosingPending)
                    : undefined,
                  totalAdminAndClosingPending > 0
                )}
              {showInventory &&
                renderNavItem(
                  'inventory',
                  'Produtos & Estoque',
                  <Warehouse className="w-4 h-4" />
                )}
              {showStores &&
                renderNavItem(
                  'stores',
                  'Lojas & Unidades',
                  <Building2 className="w-4 h-4" />,
                  pendingAdminStock > 0
                    ? String(pendingAdminStock)
                    : String(counts.stores),
                  pendingAdminStock > 0
                )}
              {showTeam &&
                renderNavItem(
                  'team',
                  'Equipe & Hierarquia',
                  <Users className="w-4 h-4" />
                )}
              {showCatalog &&
                renderNavItem(
                  'catalog',
                  'Catálogo de Itens',
                  <Layers className="w-4 h-4" />
                )}
              {showAudit &&
                renderNavItem(
                  'audit',
                  'Histórico de Alertas',
                  <ClipboardList className="w-4 h-4" />,
                  counts.alerts > 0 ? String(counts.alerts) : undefined
                )}
              {isSuperAdmin &&
                renderNavItem(
                  'occurrences',
                  'Ocorrências Globais',
                  <Radio className="w-4 h-4" />,
                  String(counts.occurrences)
                )}
            </div>
          )}

          {/* Sistema & Versão QA */}
          <div className="space-y-1">
            <div className="px-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
              Sistema
            </div>
            {isSuperAdmin &&
              renderNavItem(
                'health',
                'Saúde & Auditoria de Logs',
                <Activity className="w-4 h-4" />,
                counts.chatAuditLogs && counts.chatAuditLogs > 0
                  ? `${counts.chatAuditLogs} .txt`
                  : undefined
              )}
            {showQa && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenVersionQa();
                }}
                className="w-full min-h-[46px] px-3.5 rounded-xl flex items-center justify-between gap-3 text-sm font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <History className="w-4 h-4 text-blue-600" />
                  <span className="truncate">
                    Versão {qaChangelog.version}
                  </span>
                </span>
                <span className="text-[11px] font-mono-tabular px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                  Checklist QA
                </span>
              </button>
            )}
          </div>
        </nav>

        {/* Rodapé do Menu Lateral: Presença Online, Perfil Público & Sair */}
        <div className="p-3.5 border-t border-slate-200 bg-slate-50 space-y-2.5 shrink-0">
          {showOnlineSwitch && (
            <label className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer">
              <span className="flex items-center gap-2.5 min-w-0">
                {isHighMgmtOnlineVisible ? (
                  <Eye className="w-4 h-4 text-blue-700 shrink-0" />
                ) : (
                  <EyeOff className="w-4 h-4 text-slate-500 shrink-0" />
                )}
                <span className="text-xs font-bold text-slate-800 leading-tight">
                  Aparecer online nas lojas
                </span>
              </span>
              <input
                type="checkbox"
                checked={isHighMgmtOnlineVisible}
                onChange={(e) => onToggleOnlineVisibility(e.target.checked)}
                className="w-4 h-4 accent-blue-700 shrink-0"
              />
            </label>
          )}

          <label className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer">
            <span className="flex items-start gap-2.5 min-w-0">
              <Globe
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  currentUser.isPublicProfile
                    ? 'text-emerald-700'
                    : 'text-slate-400'
                }`}
              />
              <span className="min-w-0">
                <span className="block text-xs font-bold text-slate-800 leading-tight">
                  Perfil Público
                </span>
                <span className="block text-[11px] text-slate-500 leading-tight mt-0.5">
                  Tornar meu perfil público para toda a rede
                </span>
              </span>
            </span>
            <input
              type="checkbox"
              checked={Boolean(currentUser.isPublicProfile)}
              onChange={(e) => onTogglePublicProfile(e.target.checked)}
              className="w-4 h-4 accent-emerald-600 shrink-0 mt-0.5"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              onClose();
              onRequestExit();
            }}
            className="w-full min-h-[46px] px-4 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-sm font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair do Sistema (Trocar Usuário)</span>
          </button>
        </div>
      </aside>
    </div>
  );
};
