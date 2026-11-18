import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Crosshair, Menu } from 'lucide-react';
import { useRadarData } from './hooks/useRadarData';
import { AppScreenKey, StoreUnit, UserAccount } from './types/radar';
import {
  canAccessClosingReview,
  canAccessFinanceSales,
  canManageCentralStock,
  canManageQaVersion,
  canManageStore,
  canManageStoreOptions,
  canPromptOpenStoreOnLogin,
  canViewGlobalAuditHistory,
  hasPermission,
  isUserLinkedToStore,
  ROLE_LEVEL,
} from './utils/rbac';
import { LoginView } from './components/auth/LoginView';
import { FocusLockScreenModal } from './components/auth/FocusLockScreenModal';
import { StoreOpenPromptModal } from './components/auth/StoreOpenPromptModal';
import { StoreOpeningWithdrawalModal } from './components/auth/StoreOpeningWithdrawalModal';
import { NavigationDrawer } from './components/layout/NavigationDrawer';
import { PanicFloatingButton } from './components/layout/PanicFloatingButton';
import { ExitConfirmModal } from './components/layout/ExitConfirmModal';
import { SharedRadarMapView } from './components/map/SharedRadarMapView';
import { MessagesModal } from './components/map/MessagesModal';
import { CloseStoreSalesModal } from './components/map/CloseStoreSalesModal';
import {
  AdminSectionKey,
  UnifiedAdminPanel,
} from './components/admin/UnifiedAdminPanel';
import { DashboardView } from './components/admin/DashboardView';
import { TeamDrillDownView } from './components/admin/TeamDrillDownView';
import { SystemHealthView } from './components/admin/SystemHealthView';
import { VersionQaModal } from './components/admin/VersionQaModal';
import { ClosingReviewView } from './components/admin/ClosingReviewView';
import { StoreManageOptionsModal } from './components/admin/StoreManageOptionsModal';
import { InventoryManagementView } from './components/admin/InventoryManagementView';
import { FinanceSalesView } from './components/finance/FinanceSalesView';

const SCREEN_TITLES: Record<AppScreenKey, string> = {
  map: 'Mapa ao Vivo',
  finance: 'Financeiro & Vendas',
  dashboard: 'Dashboard',
  closings: 'Conferência de Fechamentos',
  inventory: 'Produtos & Estoque',
  stores: 'Lojas & Unidades',
  team: 'Equipe & Hierarquia',
  catalog: 'Catálogo de Itens',
  audit: 'Histórico de Alertas',
  occurrences: 'Ocorrências Globais',
  health: 'Saúde & Auditoria de Logs',
};

function getDefaultScreenForUser(user: UserAccount): AppScreenKey {
  if (hasPermission(user, 'canViewMap')) return 'map';
  if (hasPermission(user, 'canViewDashboardAudit')) return 'dashboard';
  if (hasPermission(user, 'canManageStores')) return 'stores';
  if (hasPermission(user, 'canManageUsers')) return 'team';
  if (hasPermission(user, 'canManageCatalog')) return 'catalog';
  if (user.role === 'SUPER_ADMIN') return 'health';
  return 'map';
}

function isScreenAllowedForUser(
  user: UserAccount,
  screen: AppScreenKey,
  stores: StoreUnit[]
): boolean {
  switch (screen) {
    case 'map':
      return hasPermission(user, 'canViewMap');
    case 'finance':
      return canAccessFinanceSales(user, stores);
    case 'dashboard':
    case 'audit':
      return hasPermission(user, 'canViewDashboardAudit');
    case 'closings':
      return canAccessClosingReview(user.role);
    case 'inventory':
      return canManageCentralStock(user.role);
    case 'stores':
      return hasPermission(user, 'canManageStores');
    case 'team':
      return hasPermission(user, 'canManageUsers');
    case 'catalog':
      return hasPermission(user, 'canManageCatalog');
    case 'occurrences':
    case 'health':
      return user.role === 'SUPER_ADMIN';
    default:
      return false;
  }
}

export default function App() {
  const {
    currentUser,
    isQuickTestSession,
    isHighMgmtOnlineVisible,
    users,
    stores,
    storeClosings,
    closingAlerts,
    merchandise,
    masterProducts,
    centralStock,
    operatorShifts,
    adminAlerts,
    shiftLogs,
    messages,
    chatRooms,
    chatMessages,
    chatAuditLogs,
    categories,
    subcategories,
    occurrences,
    alertAudit,
    qaChangelog,
    loading,
    login,
    loginAsTestSuperAdmin,
    verifySessionPassword,
    destroySessionQuickExit,
    setHighManagementOnlineVisibility,
    setUserPublicProfile,
    createUserAndLinkStores,
    updateManagedUser,
    toggleUserBlocked,
    deleteUser,
    findUserForLinking,
    setUserStoreLinks,
    resetUserPassword,
    addStore,
    updateStore,
    setStoreOpenStatus,
    closeStoreWithSales,
    reviewStoreClosing,
    markClosingAlertRead,
    addMerchandiseItem,
    updateMerchandiseItem,
    deleteMerchandiseItem,
    addMasterProduct,
    updateMasterProduct,
    deleteMasterProduct,
    upsertCentralStock,
    allocateCentralStockToStore,
    openStoreWithWithdrawal,
    restockOperatorInventory,
    recordOperatorSale,
    resolveAdminAlert,
    openMultipleStores,
    deleteStore,
    addCategory,
    updateCategory,
    setPrimaryCategory,
    deleteCategory,
    addSubcategory,
    updateSubcategory,
    deleteSubcategory,
    addOccurrence,
    updateOccurrenceSighting,
    dismissOccurrenceAlert,
    markOccurrenceBellRead,
    deleteOccurrence,
    clearAllOccurrences,
    sendMessage,
    createChatRoom,
    joinChatRoomByCode,
    inviteUserToChatRoomExact,
    toggleStoreRoomParticipant,
    sendChatMessage,
    markChatMessagesRead,
    panicDestroyChatRoom,
    closeChatRoom,
    downloadAuditLogTxt,
    saveQaChangelog,
  } = useRadarData();

  const [activeScreen, setActiveScreen] = useState<AppScreenKey>('map');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [qaModalOpen, setQaModalOpen] = useState(false);
  const [isFocusLocked, setIsFocusLocked] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [isRedirectingOut, setIsRedirectingOut] = useState(false);
  const [closingModalStore, setClosingModalStore] =
    useState<StoreUnit | null>(null);
  const [openingWithdrawalStore, setOpeningWithdrawalStore] =
    useState<StoreUnit | null>(null);
  const [queuedOpenStoreIds, setQueuedOpenStoreIds] = useState<string[]>([]);
  const [mapOptionsStoreId, setMapOptionsStoreId] = useState<string | null>(
    null
  );
  const [selectedLinkedStoreId, setSelectedLinkedStoreId] = useState<
    string | null
  >(null);
  const [storeSwitchOpen, setStoreSwitchOpen] = useState(false);
  const storeSwitchRef = useRef<HTMLDivElement | null>(null);

  const [focusOccurrenceId, setFocusOccurrenceId] = useState<string | null>(
    null
  );
  const [focusStoreId, setFocusStoreId] = useState<string | null>(null);
  const [centerGpsSignal, setCenterGpsSignal] = useState(0);
  const [storePromptPendingForUserId, setStorePromptPendingForUserId] =
    useState<string | null>(null);

  // Bloqueio automático por perda de foco (Anti-Espião / Visibility API + window blur)
  useEffect(() => {
    if (!currentUser) {
      setIsFocusLocked(false);
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsFocusLocked(true);
      }
    };

    const handleWindowBlur = () => {
      setIsFocusLocked(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [currentUser?.id]);

  // Reinicia tela inicial, menus e avalia prompt automático de abertura de loja ao trocar usuário
  useEffect(() => {
    if (!currentUser) {
      setDrawerOpen(false);
      setChatModalOpen(false);
      setQaModalOpen(false);
      setExitConfirmOpen(false);
      setClosingModalStore(null);
      setOpeningWithdrawalStore(null);
      setQueuedOpenStoreIds([]);
      setMapOptionsStoreId(null);
      setStoreSwitchOpen(false);
      setSelectedLinkedStoreId(null);
      setStorePromptPendingForUserId(null);
      return;
    }

    setActiveScreen(getDefaultScreenForUser(currentUser));
    setDrawerOpen(false);
    setChatModalOpen(false);
    setQaModalOpen(false);
    setExitConfirmOpen(false);
    setClosingModalStore(null);
    setOpeningWithdrawalStore(null);
    setQueuedOpenStoreIds([]);
    setMapOptionsStoreId(null);
    setStoreSwitchOpen(false);
    setFocusOccurrenceId(null);
    setFocusStoreId(null);
    setSelectedLinkedStoreId(null);

    if (canPromptOpenStoreOnLogin(currentUser)) {
      setStorePromptPendingForUserId(currentUser.id);
    } else {
      setStorePromptPendingForUserId(null);
    }
  }, [currentUser?.id]);

  // Fecha seletor de loja ativa ao clicar fora
  useEffect(() => {
    if (!storeSwitchOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        storeSwitchRef.current &&
        !storeSwitchRef.current.contains(e.target as Node)
      ) {
        setStoreSwitchOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [storeSwitchOpen]);

  // Lojas vinculadas diretamente ao usuário (ou acessíveis pela gestão)
  const linkedStores = useMemo(() => {
    if (!currentUser) return [];
    const direct = stores.filter((s) => isUserLinkedToStore(currentUser.id, s));
    if (direct.length > 0) return direct;
    if (ROLE_LEVEL[currentUser.role] <= 3) return stores;
    return [];
  }, [currentUser, stores]);

  // Loja ativa exibida no topo e usada no banner rápido do mapa
  const activeLinkedStore = useMemo(() => {
    if (linkedStores.length === 0) return null;
    if (selectedLinkedStoreId) {
      const found = linkedStores.find((s) => s.id === selectedLinkedStoreId);
      if (found) return found;
    }
    return linkedStores[0];
  }, [linkedStores, selectedLinkedStoreId]);

  // Lojas fechadas vinculadas ao usuário (para modal de abertura no login)
  const closedLinkedStores = useMemo(() => {
    if (!currentUser) return [];
    return stores.filter(
      (s) => isUserLinkedToStore(currentUser.id, s) && !s.isOpen
    );
  }, [currentUser, stores]);

  // Contagem de alertas no escopo do usuário para badge no drawer
  const scopedAlertsCount = useMemo(() => {
    if (!currentUser) return 0;
    if (canViewGlobalAuditHistory(currentUser.role)) {
      return alertAudit.length;
    }
    const managedStoreIds = new Set(
      stores
        .filter((s) => canManageStore(currentUser, s, users))
        .map((s) => s.id)
    );
    return alertAudit.filter(
      (a) => a.storeId && managedStoreIds.has(a.storeId)
    ).length;
  }, [currentUser, alertAudit, stores, users]);

  const unreadClosingAlertsCount = useMemo(() => {
    if (!currentUser || !canAccessClosingReview(currentUser.role)) return 0;
    const isGlobal = canViewGlobalAuditHistory(currentUser.role);
    const managedIds = new Set(
      stores
        .filter((s) => canManageStore(currentUser, s, users))
        .map((s) => s.id)
    );
    return closingAlerts.filter((al) => {
      if (al.readByUserIds.includes(currentUser.id)) return false;
      if (!isGlobal && !managedIds.has(al.storeId)) return false;
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
    }).length;
  }, [currentUser, closingAlerts, stores, users]);

  // Alertas Administrativos/Financeiros pendentes (retiradas na abertura e reposições)
  const pendingAdminFinanceCount = useMemo(() => {
    if (!currentUser || !canManageStoreOptions(currentUser.role)) return 0;
    const isGlobal = canViewGlobalAuditHistory(currentUser.role);
    const managedIds = new Set(
      stores
        .filter((s) => canManageStore(currentUser, s, users))
        .map((s) => s.id)
    );
    return adminAlerts.filter((al) => {
      if (al.status !== 'PENDING') return false;
      if (!isGlobal && !managedIds.has(al.storeId)) return false;
      return true;
    }).length;
  }, [currentUser, adminAlerts, stores, users]);

  // Total de unidades em mãos do operador logado no turno
  const operatorHandUnits = useMemo(() => {
    if (!currentUser) return 0;
    return operatorShifts
      .filter((sh) => sh.userId === currentUser.id && sh.status === 'ACTIVE')
      .reduce(
        (acc, sh) =>
          acc + sh.items.reduce((sum, it) => sum + it.currentHandQty, 0),
        0
      );
  }, [currentUser, operatorShifts]);

  const mapOptionsStore = useMemo(
    () => stores.find((s) => s.id === mapOptionsStoreId) || null,
    [stores, mapOptionsStoreId]
  );

  // Mensagens de salas não lidas pelo usuário atual (sincronizado entre Drawer e Dock do Mapa)
  const unreadChatCount = useMemo(() => {
    if (!currentUser) return 0;
    const myRoomIds = new Set(
      chatRooms
        .filter((r) => r.participantIds.includes(currentUser.id))
        .map((r) => r.id)
    );
    return chatMessages.filter(
      (m) =>
        myRoomIds.has(m.roomId) &&
        m.senderId !== currentUser.id &&
        !m.deletedForUserIds.includes(currentUser.id) &&
        !m.readByUserIds.includes(currentUser.id)
    ).length;
  }, [currentUser, chatRooms, chatMessages]);

  if (isRedirectingOut) {
    return (
      <div className="h-dvh flex items-center justify-center bg-slate-950 text-white text-sm font-semibold px-4 text-center">
        Sessão encerrada. Saindo do sistema...
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-dvh flex items-center justify-center bg-slate-50 text-slate-700 text-sm font-semibold">
        Carregando Radar da Caça...
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginView
        version={qaChangelog.version}
        onLogin={login}
        onQuickTestLogin={loginAsTestSuperAdmin}
      />
    );
  }

  const handleConfirmExternalExit = () => {
    setExitConfirmOpen(false);
    setIsFocusLocked(false);
    setIsRedirectingOut(true);
    destroySessionQuickExit();
    try {
      window.location.replace('https://www.google.com');
    } catch {
      window.location.href = 'https://www.google.com';
    }
  };

  const resolvedScreen: AppScreenKey = isScreenAllowedForUser(
    currentUser,
    activeScreen,
    stores
  )
    ? activeScreen
    : getDefaultScreenForUser(currentUser);

  const shouldShowOpenPrompt =
    storePromptPendingForUserId === currentUser.id &&
    canPromptOpenStoreOnLogin(currentUser) &&
    closedLinkedStores.length > 0 &&
    !openingWithdrawalStore;

  const handleFocusOccurrenceOnMap = (occId: string) => {
    setFocusStoreId(null);
    setFocusOccurrenceId(occId);
    if (hasPermission(currentUser, 'canViewMap')) {
      setActiveScreen('map');
    }
  };

  const handleFocusStoreOnMap = (storeId: string) => {
    setFocusOccurrenceId(null);
    setFocusStoreId(storeId);
    if (linkedStores.some((s) => s.id === storeId)) {
      setSelectedLinkedStoreId(storeId);
    }
    if (hasPermission(currentUser, 'canViewMap')) {
      setActiveScreen('map');
    }
  };

  const handleCenterOnGps = () => {
    if (hasPermission(currentUser, 'canViewMap')) {
      setActiveScreen('map');
      setCenterGpsSignal((prev) => prev + 1);
    }
  };

  // Intercepta abertura de loja para exibir modal de retirada quando operador tem permissão
  const handleToggleStoreOpenWithCheck = async (
    storeId: string,
    nextOpen: boolean
  ) => {
    if (!nextOpen) {
      await setStoreOpenStatus(storeId, false);
      return;
    }
    const target = stores.find((s) => s.id === storeId);
    if (
      target &&
      hasPermission(currentUser, 'canWithdrawRestockInventory')
    ) {
      setOpeningWithdrawalStore(target);
      return;
    }
    await setStoreOpenStatus(storeId, true);
  };

  const handleConfirmPromptOpen = async (storeIds: string[]) => {
    setStorePromptPendingForUserId(null);
    if (storeIds.length === 0) return;

    if (hasPermission(currentUser, 'canWithdrawRestockInventory')) {
      const first = stores.find((s) => s.id === storeIds[0]) || null;
      if (first) {
        setQueuedOpenStoreIds(storeIds.slice(1));
        setOpeningWithdrawalStore(first);
        return;
      }
    }
    await openMultipleStores(storeIds);
  };

  const handleConfirmOpeningWithdrawal = async (
    storeId: string,
    withdrawals: { storeItemId: string; quantity: number }[]
  ) => {
    await openStoreWithWithdrawal(storeId, withdrawals);
    if (queuedOpenStoreIds.length > 0) {
      await openMultipleStores(queuedOpenStoreIds);
      setQueuedOpenStoreIds([]);
    }
  };

  const canViewMap = hasPermission(currentUser, 'canViewMap');

  return (
    <div className="h-dvh flex flex-col bg-slate-50 text-slate-900 overflow-hidden">
      {/* Barra superior enxuta Mobile-First: Hambúrguer à esquerda, Loja/Status ao centro, GPS à direita */}
      <header className="h-14 shrink-0 px-2 sm:px-4 bg-white border-b border-slate-200 flex items-center justify-between gap-2 z-[950]">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir menu lateral"
          className="min-h-[44px] min-w-[44px] rounded-xl text-slate-800 hover:bg-slate-100 active:bg-slate-200 flex items-center justify-center shrink-0 transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Centro: Nome e Status rápido da Loja ativa (ou título da seção) */}
        <div
          className="min-w-0 flex-1 flex justify-center relative"
          ref={storeSwitchRef}
        >
          {resolvedScreen === 'map' && activeLinkedStore ? (
            <>
              <button
                type="button"
                onClick={() => {
                  if (linkedStores.length > 1) {
                    setStoreSwitchOpen((prev) => !prev);
                  }
                }}
                aria-expanded={
                  linkedStores.length > 1 ? storeSwitchOpen : undefined
                }
                className={`min-h-[40px] max-w-full px-3 rounded-xl flex flex-col items-center justify-center text-center ${
                  linkedStores.length > 1
                    ? 'hover:bg-slate-100 active:bg-slate-200 cursor-pointer'
                    : 'cursor-default'
                }`}
              >
                <span className="flex items-center gap-1 max-w-full text-sm font-extrabold text-slate-900 tracking-tight truncate">
                  <span className="truncate">{activeLinkedStore.name}</span>
                  {linkedStores.length > 1 && (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  )}
                </span>
                <span
                  className={`text-[11px] font-bold font-mono-tabular leading-none mt-0.5 ${
                    activeLinkedStore.isOpen
                      ? 'text-emerald-700'
                      : 'text-slate-500'
                  }`}
                >
                  {activeLinkedStore.storeCode} ·{' '}
                  {activeLinkedStore.isOpen ? 'Aberta' : 'Fechada'}
                </span>
              </button>

              {storeSwitchOpen && linkedStores.length > 1 && (
                <div className="absolute top-full mt-1.5 w-72 max-w-[85vw] bg-white rounded-2xl border border-slate-200 shadow-2xl z-[1200] overflow-hidden">
                  <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-extrabold text-slate-700">
                    Selecionar Unidade Ativa ({linkedStores.length})
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {linkedStores.map((st) => {
                      const isSelected = st.id === activeLinkedStore.id;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => {
                            setSelectedLinkedStoreId(st.id);
                            setStoreSwitchOpen(false);
                            handleFocusStoreOnMap(st.id);
                          }}
                          className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-slate-50 ${
                            isSelected ? 'bg-blue-50/70' : ''
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate">
                              {st.name}
                            </div>
                            <div className="text-[11px] font-mono-tabular text-slate-500">
                              {st.storeCode} · Região {st.region}
                            </div>
                          </div>
                          <span
                            className={`text-[11px] font-bold shrink-0 ${
                              st.isOpen ? 'text-emerald-700' : 'text-slate-500'
                            }`}
                          >
                            {st.isOpen ? 'Aberta' : 'Fechada'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="min-w-0 flex flex-col items-center justify-center text-center px-2">
              <span className="text-sm font-extrabold text-slate-900 tracking-tight truncate max-w-full">
                {resolvedScreen === 'map'
                  ? 'Radar da Caça'
                  : SCREEN_TITLES[resolvedScreen]}
              </span>
              {activeLinkedStore && (
                <span className="text-[11px] font-semibold text-slate-500 truncate max-w-full">
                  {activeLinkedStore.name} ·{' '}
                  {activeLinkedStore.isOpen ? 'Aberta' : 'Fechada'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Direita: Botão de centralizar no meu GPS */}
        {canViewMap ? (
          <button
            type="button"
            onClick={handleCenterOnGps}
            aria-label="Centralizar no meu GPS"
            title="Centralizar no meu GPS"
            className="min-h-[44px] min-w-[44px] rounded-xl text-blue-700 hover:bg-blue-50 active:bg-blue-100 flex items-center justify-center shrink-0 transition-colors"
          >
            <Crosshair className="w-5 h-5" />
          </button>
        ) : (
          <div className="w-[44px] shrink-0" aria-hidden="true" />
        )}
      </header>

      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {resolvedScreen === 'map' && canViewMap && (
          <SharedRadarMapView
            currentUser={currentUser}
            users={users}
            stores={stores}
            activeLinkedStore={activeLinkedStore}
            categories={categories}
            subcategories={subcategories}
            occurrences={occurrences}
            alertAudit={alertAudit}
            unreadChatCount={unreadChatCount}
            focusOccurrenceId={focusOccurrenceId}
            focusStoreId={focusStoreId}
            centerGpsSignal={centerGpsSignal}
            onFocusHandled={() => {
              setFocusOccurrenceId(null);
              setFocusStoreId(null);
            }}
            onAddOccurrence={addOccurrence}
            onUpdateOccurrenceSighting={updateOccurrenceSighting}
            onDismissOccurrenceAlert={dismissOccurrenceAlert}
            onMarkBellAlertRead={markOccurrenceBellRead}
            onOpenChatModal={() => setChatModalOpen(true)}
            onDeleteOccurrence={deleteOccurrence}
            onToggleStoreOpen={handleToggleStoreOpenWithCheck}
            onRequestCloseStore={setClosingModalStore}
            onOpenStoreOptions={(store) => setMapOptionsStoreId(store.id)}
          />
        )}

        {resolvedScreen === 'finance' &&
          canAccessFinanceSales(currentUser, stores) && (
            <FinanceSalesView
              currentUser={currentUser}
              users={users}
              stores={stores}
              activeLinkedStore={activeLinkedStore}
              merchandise={merchandise}
              operatorShifts={operatorShifts}
              onSelectStore={(storeId) => setSelectedLinkedStoreId(storeId)}
              onRequestOpenStore={(store) =>
                void handleToggleStoreOpenWithCheck(store.id, true)
              }
              onRequestCloseStore={setClosingModalStore}
              onRecordSale={recordOperatorSale}
              onRestockOperator={restockOperatorInventory}
            />
          )}

        {resolvedScreen === 'dashboard' && (
          <DashboardView
            currentUser={currentUser}
            users={users}
            stores={stores}
            storeClosings={storeClosings}
            shiftLogs={shiftLogs}
            occurrences={occurrences}
            alertAudit={alertAudit}
            adminAlerts={adminAlerts}
            closingAlerts={closingAlerts}
            onResolveAdminAlert={resolveAdminAlert}
            onOpenClosingsScreen={() => setActiveScreen('closings')}
            onFocusStoreOnMap={handleFocusStoreOnMap}
          />
        )}

        {resolvedScreen === 'closings' &&
          canAccessClosingReview(currentUser.role) && (
            <ClosingReviewView
              currentUser={currentUser}
              users={users}
              stores={stores}
              storeClosings={storeClosings}
              closingAlerts={closingAlerts}
              adminAlerts={adminAlerts}
              onReviewClosing={reviewStoreClosing}
              onMarkAlertRead={markClosingAlertRead}
              onResolveAdminAlert={resolveAdminAlert}
            />
          )}

        {resolvedScreen === 'inventory' &&
          canManageCentralStock(currentUser.role) && (
            <InventoryManagementView
              currentUser={currentUser}
              users={users}
              stores={stores}
              storeClosings={storeClosings}
              masterProducts={masterProducts}
              centralStock={centralStock}
              merchandise={merchandise}
              operatorShifts={operatorShifts}
              onAddMasterProduct={addMasterProduct}
              onUpdateMasterProduct={updateMasterProduct}
              onDeleteMasterProduct={deleteMasterProduct}
              onUpsertCentralStock={upsertCentralStock}
              onAllocateCentralStockToStore={allocateCentralStockToStore}
            />
          )}

        {resolvedScreen === 'team' && (
          <TeamDrillDownView
            currentUser={currentUser}
            users={users}
            stores={stores}
            onCreateUserAndLinkStores={createUserAndLinkStores}
            onUpdateManagedUser={updateManagedUser}
            onToggleUserBlocked={toggleUserBlocked}
            onDeleteUser={deleteUser}
            onFindUserForLinking={findUserForLinking}
            onSetUserStoreLinks={setUserStoreLinks}
            onResetUserPassword={resetUserPassword}
          />
        )}

        {resolvedScreen === 'health' && currentUser.role === 'SUPER_ADMIN' && (
          <SystemHealthView
            users={users}
            stores={stores}
            storeClosings={storeClosings}
            occurrences={occurrences}
            alertAudit={alertAudit}
            chatAuditLogs={chatAuditLogs}
            qaChangelog={qaChangelog}
            onDownloadAuditLogTxt={downloadAuditLogTxt}
          />
        )}

        {(resolvedScreen === 'stores' ||
          resolvedScreen === 'catalog' ||
          resolvedScreen === 'audit' ||
          resolvedScreen === 'occurrences') && (
          <UnifiedAdminPanel
            activeSection={resolvedScreen as AdminSectionKey}
            currentUser={currentUser}
            users={users}
            stores={stores}
            categories={categories}
            subcategories={subcategories}
            occurrences={occurrences}
            alertAudit={alertAudit}
            merchandise={merchandise}
            masterProducts={masterProducts}
            adminAlerts={adminAlerts}
            closingAlerts={closingAlerts}
            onUpdateManagedUser={updateManagedUser}
            onResolveAdminAlert={resolveAdminAlert}
            onOpenClosingsScreen={() => setActiveScreen('closings')}
            onAddStore={addStore}
            onUpdateStore={updateStore}
            onToggleStoreOpen={handleToggleStoreOpenWithCheck}
            onRequestCloseStore={setClosingModalStore}
            onDeleteStore={deleteStore}
            onAddMerchandise={addMerchandiseItem}
            onUpdateMerchandise={updateMerchandiseItem}
            onDeleteMerchandise={deleteMerchandiseItem}
            onAddCategory={addCategory}
            onUpdateCategory={updateCategory}
            onSetPrimaryCategory={setPrimaryCategory}
            onDeleteCategory={deleteCategory}
            onAddSubcategory={addSubcategory}
            onUpdateSubcategory={updateSubcategory}
            onDeleteSubcategory={deleteSubcategory}
            onDeleteOccurrence={deleteOccurrence}
            onClearAllOccurrences={clearAllOccurrences}
            onFocusOccurrenceOnMap={handleFocusOccurrenceOnMap}
            onFocusStoreOnMap={handleFocusStoreOnMap}
          />
        )}
      </main>

      {/* Menu Lateral Deslizante (Drawer) */}
      <NavigationDrawer
        isOpen={drawerOpen}
        currentUser={currentUser}
        stores={stores}
        activeScreen={resolvedScreen}
        isHighMgmtOnlineVisible={isHighMgmtOnlineVisible}
        qaChangelog={qaChangelog}
        counts={{
          stores: stores.length,
          alerts: scopedAlertsCount,
          occurrences: occurrences.length,
          closingAlerts: unreadClosingAlertsCount,
          adminFinancePending: pendingAdminFinanceCount,
          operatorHandUnits,
          chatAuditLogs: chatAuditLogs.length,
          unreadChatCount,
        }}
        onSelectScreen={(screen) => setActiveScreen(screen)}
        onOpenChatModal={() => setChatModalOpen(true)}
        onToggleOnlineVisibility={setHighManagementOnlineVisibility}
        onTogglePublicProfile={setUserPublicProfile}
        onOpenVersionQa={() => setQaModalOpen(true)}
        onRequestExit={() => setExitConfirmOpen(true)}
        onClose={() => setDrawerOpen(false)}
      />

      {/* Modal Global Unificado de Chat & Mensagens (acessível pelo Drawer e pelo botão Mensagens do Mapa) */}
      <MessagesModal
        isOpen={chatModalOpen}
        currentUser={currentUser}
        users={users}
        stores={stores}
        messages={messages}
        chatRooms={chatRooms}
        chatMessages={chatMessages}
        onSendMessage={sendMessage}
        onCreateChatRoom={createChatRoom}
        onJoinChatRoomByCode={joinChatRoomByCode}
        onInviteUserToChatRoomExact={inviteUserToChatRoomExact}
        onToggleStoreRoomParticipant={toggleStoreRoomParticipant}
        onSendChatMessage={sendChatMessage}
        onMarkChatMessagesRead={markChatMessagesRead}
        onPanicDestroyChatRoom={panicDestroyChatRoom}
        onCloseChatRoom={closeChatRoom}
        onClose={() => setChatModalOpen(false)}
      />

      {/* Modal automático ao logar se loja vinculada estiver fechada */}
      <StoreOpenPromptModal
        isOpen={shouldShowOpenPrompt}
        closedStores={closedLinkedStores}
        onConfirmOpen={handleConfirmPromptOpen}
        onDismiss={() => setStorePromptPendingForUserId(null)}
      />

      {/* Modal de Retirada de Carga na Abertura da Loja (quando operador tem permissão) */}
      <StoreOpeningWithdrawalModal
        store={openingWithdrawalStore}
        currentUser={currentUser}
        merchandise={merchandise}
        onConfirmOpenWithWithdrawal={handleConfirmOpeningWithdrawal}
        onCancel={() => {
          setOpeningWithdrawalStore(null);
          setQueuedOpenStoreIds([]);
        }}
      />

      {/* Modal de confirmação de fechamento da loja com mercadorias, devolução automática e conferência Dinheiro/Pix */}
      <CloseStoreSalesModal
        store={closingModalStore}
        merchandise={merchandise}
        operatorShifts={operatorShifts}
        onConfirmClose={closeStoreWithSales}
        onCancel={() => setClosingModalStore(null)}
      />

      {/* Modal de Opções / Gerenciar Loja aberto diretamente do mapa (Gerente+) */}
      {canManageStoreOptions(currentUser.role) && (
        <StoreManageOptionsModal
          store={mapOptionsStore}
          currentUser={currentUser}
          users={users}
          merchandise={merchandise}
          masterProducts={masterProducts}
          onUpdateManagedUser={updateManagedUser}
          onAddMerchandise={addMerchandiseItem}
          onUpdateMerchandise={updateMerchandiseItem}
          onDeleteMerchandise={deleteMerchandiseItem}
          onClose={() => setMapOptionsStoreId(null)}
        />
      )}

      {/* Modal de Controle de Versão & QA exclusivo do Super Admin */}
      {canManageQaVersion(currentUser.role) && (
        <VersionQaModal
          isOpen={qaModalOpen}
          changelog={qaChangelog}
          onSave={saveQaChangelog}
          onClose={() => setQaModalOpen(false)}
        />
      )}

      {/* Botão Flutuante Arrastável do Cadeado (abre confirmação antes de sair) */}
      <PanicFloatingButton onRequestExit={() => setExitConfirmOpen(true)} />

      {/* Tela de Bloqueio Automático Anti-Espião (Perda de Foco / Minimização / Troca de Guia) */}
      <FocusLockScreenModal
        isOpen={isFocusLocked}
        currentUser={currentUser}
        isQuickTestSession={isQuickTestSession}
        onVerifyPassword={verifySessionPassword}
        onUnlock={() => setIsFocusLocked(false)}
        onRequestExit={() => setExitConfirmOpen(true)}
      />

      {/* Modal de Confirmação Obrigatória de Saída e Redirecionamento Externo */}
      <ExitConfirmModal
        isOpen={exitConfirmOpen}
        onCancel={() => setExitConfirmOpen(false)}
        onConfirmExit={handleConfirmExternalExit}
      />
    </div>
  );
}
