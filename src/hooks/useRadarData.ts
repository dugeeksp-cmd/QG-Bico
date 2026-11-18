import { useCallback, useEffect, useState } from 'react';
import { DataService } from '../services/DataService';
import { ChatAuditService } from '../services/ChatAuditService';
import {
  AdminFinanceAlert,
  AlertAuditEntry,
  CatalogCategory,
  CatalogSubcategory,
  CentralStockEntry,
  ChatAuditLogFile,
  ChatDeletionMode,
  ChatMessage,
  ChatRoom,
  ChatRoomType,
  ChatSavePolicy,
  ClosingAlertNotification,
  ClosingMerchandiseLine,
  MapOccurrence,
  MasterProduct,
  OperatorShiftInventory,
  QaChangelogState,
  StoreClosingRecord,
  StoreMerchandiseItem,
  StoreRegion,
  StoreShiftLog,
  StoreUnit,
  TeamMessage,
  UserAccount,
  UserPermissions,
  UserRole,
} from '../types/radar';
import { getDistanceMeters, OCCURRENCE_MAX_LIFE_MS } from '../utils/geo';

export function useRadarData() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isQuickTestSession, setIsQuickTestSession] = useState(false);
  const [isHighMgmtOnlineVisible, setIsHighMgmtOnlineVisible] = useState(false);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [stores, setStores] = useState<StoreUnit[]>([]);
  const [storeClosings, setStoreClosings] = useState<StoreClosingRecord[]>([]);
  const [closingAlerts, setClosingAlerts] = useState<
    ClosingAlertNotification[]
  >([]);
  const [merchandise, setMerchandise] = useState<StoreMerchandiseItem[]>([]);
  const [masterProducts, setMasterProducts] = useState<MasterProduct[]>([]);
  const [centralStock, setCentralStock] = useState<CentralStockEntry[]>([]);
  const [operatorShifts, setOperatorShifts] = useState<
    OperatorShiftInventory[]
  >([]);
  const [adminAlerts, setAdminAlerts] = useState<AdminFinanceAlert[]>([]);
  const [shiftLogs, setShiftLogs] = useState<StoreShiftLog[]>([]);
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatAuditLogs, setChatAuditLogs] = useState<ChatAuditLogFile[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [subcategories, setSubcategories] = useState<CatalogSubcategory[]>([]);
  const [occurrences, setOccurrences] = useState<MapOccurrence[]>([]);
  const [alertAudit, setAlertAudit] = useState<AlertAuditEntry[]>([]);
  const [qaChangelog, setQaChangelog] = useState<QaChangelogState>({
    version: '5.0',
    items: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubSession = DataService.subscribeToSession(setCurrentUser);
    const unsubQuickTest = DataService.subscribeToQuickTestMode(
      setIsQuickTestSession
    );
    const unsubVisibility = DataService.subscribeToOnlineVisibility(
      setIsHighMgmtOnlineVisible
    );
    const unsubUsers = DataService.subscribeToUsers(setUsers);
    const unsubStores = DataService.subscribeToStores(setStores);
    const unsubClosings =
      DataService.subscribeToStoreClosings(setStoreClosings);
    const unsubClosingAlerts =
      DataService.subscribeToClosingAlerts(setClosingAlerts);
    const unsubMerchandise = DataService.subscribeToMerchandise(setMerchandise);
    const unsubMasterProducts =
      DataService.subscribeToMasterProducts(setMasterProducts);
    const unsubCentralStock =
      DataService.subscribeToCentralStock(setCentralStock);
    const unsubOperatorShifts =
      DataService.subscribeToOperatorShifts(setOperatorShifts);
    const unsubAdminAlerts =
      DataService.subscribeToAdminAlerts(setAdminAlerts);
    const unsubShiftLogs = DataService.subscribeToStoreShiftLogs(setShiftLogs);
    const unsubMessages = DataService.subscribeToMessages(setMessages);
    const unsubChatRooms = DataService.subscribeToChatRooms(setChatRooms);
    const unsubChatMessages =
      DataService.subscribeToChatMessages(setChatMessages);
    const unsubChatAudit = ChatAuditService.subscribe(setChatAuditLogs);
    const unsubCats = DataService.subscribeToCategories(setCategories);
    const unsubSubs = DataService.subscribeToSubcategories(setSubcategories);
    const unsubOccs = DataService.subscribeToOccurrences(setOccurrences);
    const unsubAudit = DataService.subscribeToAlertAudit(setAlertAudit);
    const unsubQa = DataService.subscribeToQaChangelog(setQaChangelog);

    setLoading(false);

    return () => {
      unsubSession();
      unsubQuickTest();
      unsubVisibility();
      unsubUsers();
      unsubStores();
      unsubClosings();
      unsubClosingAlerts();
      unsubMerchandise();
      unsubMasterProducts();
      unsubCentralStock();
      unsubOperatorShifts();
      unsubAdminAlerts();
      unsubShiftLogs();
      unsubMessages();
      unsubChatRooms();
      unsubChatMessages();
      unsubChatAudit();
      unsubCats();
      unsubSubs();
      unsubOccs();
      unsubAudit();
      unsubQa();
    };
  }, []);

  // Varredura automática periódica para encerrar ocorrências após 60 minutos sem atualização
  useEffect(() => {
    if (occurrences.length === 0) return;
    const interval = window.setInterval(() => {
      const now = Date.now();
      if (
        occurrences.some(
          (occ) =>
            now >= (occ.lastUpdatedAt || occ.createdAt) + OCCURRENCE_MAX_LIFE_MS
        )
      ) {
        void DataService.sweepExpiredOccurrences();
      }
    }, 5000);
    return () => window.clearInterval(interval);
  }, [occurrences]);

  const login = useCallback(async (username: string, password: string) => {
    return DataService.login(username, password);
  }, []);

  const loginAsTestSuperAdmin = useCallback(async () => {
    return DataService.loginAsTestSuperAdmin();
  }, []);

  const verifySessionPassword = useCallback(async (password: string) => {
    return DataService.verifySessionPassword(password);
  }, []);

  const logout = useCallback(async () => {
    await DataService.logout();
  }, []);

  const destroySessionQuickExit = useCallback(() => {
    DataService.destroySessionQuickExit();
  }, []);

  const setHighManagementOnlineVisibility = useCallback(
    async (visible: boolean) => {
      await DataService.setHighManagementOnlineVisibility(visible);
    },
    []
  );

  const setUserPublicProfile = useCallback(async (isPublic: boolean) => {
    await DataService.setUserPublicProfile(isPublic);
  }, []);

  const createUserAndLinkStores = useCallback(
    async (input: {
      name: string;
      username: string;
      password: string;
      role: UserRole;
      permissions?: UserPermissions;
      region?: StoreRegion;
      avatarDataUrl?: string;
      storeIds?: string[];
    }) => {
      if (!currentUser) throw new Error('Sessão expirada.');
      return DataService.createUserAndLinkStores({
        ...input,
        createdByUserId: currentUser.id,
        actorRole: currentUser.role,
      });
    },
    [currentUser]
  );

  const updateManagedUser = useCallback(
    async (
      userId: string,
      updates: {
        name?: string;
        role?: UserRole;
        permissions?: UserPermissions;
        region?: StoreRegion;
        avatarDataUrl?: string;
        isBlocked?: boolean;
      }
    ) => {
      if (!currentUser) throw new Error('Sessão expirada.');
      return DataService.updateManagedUser(userId, updates, currentUser.role);
    },
    [currentUser]
  );

  const toggleUserBlocked = useCallback(
    async (userId: string, isBlocked: boolean) => {
      if (!currentUser) throw new Error('Sessão expirada.');
      return DataService.toggleUserBlocked(userId, isBlocked, currentUser);
    },
    [currentUser]
  );

  const deleteUser = useCallback(
    async (userId: string) => {
      if (!currentUser) throw new Error('Sessão expirada.');
      await DataService.deleteUser(userId, currentUser.role);
    },
    [currentUser]
  );

  const findUserForLinking = useCallback(
    async (query: string) => {
      if (!currentUser) throw new Error('Sessão expirada.');
      return DataService.findUserForLinking(query, currentUser);
    },
    [currentUser]
  );

  const setUserStoreLinks = useCallback(
    async (
      targetUserId: string,
      allowedManageableStoreIds: string[],
      selectedStoreIds: string[]
    ) => {
      await DataService.setUserStoreLinks(
        targetUserId,
        allowedManageableStoreIds,
        selectedStoreIds
      );
    },
    []
  );

  const resetUserPassword = useCallback(
    async (userId: string, newPassword: string) => {
      if (!currentUser) throw new Error('Sessão expirada.');
      await DataService.resetUserPassword(
        userId,
        newPassword,
        currentUser.role
      );
    },
    [currentUser]
  );

  const addStore = useCallback(
    async (
      input: Omit<
        StoreUnit,
        'id' | 'storeCode' | 'createdAt' | 'updatedAt' | 'onlineUserIds'
      >
    ) => {
      return DataService.addStore(input);
    },
    []
  );

  const updateStore = useCallback(
    async (
      id: string,
      updates: Partial<Omit<StoreUnit, 'id' | 'storeCode' | 'createdAt'>>
    ) => {
      return DataService.updateStore(id, updates);
    },
    []
  );

  const setStoreOpenStatus = useCallback(
    async (storeId: string, isOpen: boolean) => {
      await DataService.setStoreOpenStatus(storeId, isOpen);
    },
    []
  );

  const closeStoreWithSales = useCallback(
    async (
      storeId: string,
      payload?:
        | number
        | {
            soldItems: ClosingMerchandiseLine[];
            cashReceived: number;
            pixReceived: number;
          }
    ) => {
      return DataService.closeStoreWithSales(storeId, payload, currentUser);
    },
    [currentUser]
  );

  const reviewStoreClosing = useCallback(
    async (
      closingId: string,
      decision: 'APPROVED' | 'REJECTED',
      observation?: string
    ) => {
      if (!currentUser) throw new Error('Sessão expirada.');
      return DataService.reviewStoreClosing(
        closingId,
        decision,
        observation,
        currentUser
      );
    },
    [currentUser]
  );

  const markClosingAlertRead = useCallback(
    async (alertId: string) => {
      if (!currentUser) return;
      await DataService.markClosingAlertRead(alertId, currentUser.id);
    },
    [currentUser]
  );

  const addMerchandiseItem = useCallback(
    async (input: {
      storeId: string;
      masterProductId?: string;
      name: string;
      photoDataUrl?: string;
      stockQuantity: number;
      unitPrice: number;
    }) => {
      if (!currentUser) throw new Error('Sessão expirada.');
      return DataService.addMerchandiseItem(input, currentUser.role);
    },
    [currentUser]
  );

  const updateMerchandiseItem = useCallback(
    async (
      itemId: string,
      updates: Partial<
        Omit<StoreMerchandiseItem, 'id' | 'storeId' | 'createdAt'>
      >
    ) => {
      if (!currentUser) throw new Error('Sessão expirada.');
      return DataService.updateMerchandiseItem(
        itemId,
        updates,
        currentUser.role
      );
    },
    [currentUser]
  );

  const deleteMerchandiseItem = useCallback(
    async (itemId: string) => {
      if (!currentUser) throw new Error('Sessão expirada.');
      await DataService.deleteMerchandiseItem(itemId, currentUser.role);
    },
    [currentUser]
  );

  const addMasterProduct = useCallback(
    async (input: { name: string; photoDataUrl?: string; unitPrice: number }) => {
      if (!currentUser) throw new Error('Sessão expirada.');
      return DataService.addMasterProduct(input, currentUser);
    },
    [currentUser]
  );

  const updateMasterProduct = useCallback(
    async (
      productId: string,
      updates: Partial<Pick<MasterProduct, 'name' | 'photoDataUrl' | 'unitPrice'>>
    ) => {
      if (!currentUser) throw new Error('Sessão expirada.');
      return DataService.updateMasterProduct(
        productId,
        updates,
        currentUser.role
      );
    },
    [currentUser]
  );

  const deleteMasterProduct = useCallback(
    async (productId: string) => {
      if (!currentUser) throw new Error('Sessão expirada.');
      await DataService.deleteMasterProduct(productId, currentUser.role);
    },
    [currentUser]
  );

  const upsertCentralStock = useCallback(
    async (
      masterProductId: string,
      quantity: number,
      mode: 'ADD' | 'SET'
    ) => {
      if (!currentUser) throw new Error('Sessão expirada.');
      return DataService.upsertCentralStock(
        masterProductId,
        quantity,
        mode,
        currentUser
      );
    },
    [currentUser]
  );

  const allocateCentralStockToStore = useCallback(
    async (storeId: string, masterProductId: string, quantity: number) => {
      if (!currentUser) throw new Error('Sessão expirada.');
      return DataService.allocateCentralStockToStore(
        storeId,
        masterProductId,
        quantity,
        currentUser
      );
    },
    [currentUser]
  );

  const openStoreWithWithdrawal = useCallback(
    async (
      storeId: string,
      withdrawals: { storeItemId: string; quantity: number }[]
    ) => {
      if (!currentUser) throw new Error('Sessão expirada.');
      return DataService.openStoreWithWithdrawal(
        storeId,
        withdrawals,
        currentUser
      );
    },
    [currentUser]
  );

  const restockOperatorInventory = useCallback(
    async (
      storeId: string,
      additions: { storeItemId: string; quantity: number }[]
    ) => {
      if (!currentUser) throw new Error('Sessão expirada.');
      return DataService.restockOperatorInventory(
        storeId,
        additions,
        currentUser
      );
    },
    [currentUser]
  );

  const recordOperatorSale = useCallback(
    async (
      storeId: string,
      storeItemId: string,
      quantity: number,
      paymentMethod: 'CASH' | 'PIX'
    ) => {
      if (!currentUser) throw new Error('Sessão expirada.');
      return DataService.recordOperatorSale(
        storeId,
        storeItemId,
        quantity,
        paymentMethod,
        currentUser
      );
    },
    [currentUser]
  );

  const resolveAdminAlert = useCallback(
    async (
      alertId: string,
      status: 'CONFIRMED' | 'DISCREPANCY',
      observation?: string
    ) => {
      if (!currentUser) throw new Error('Sessão expirada.');
      return DataService.resolveAdminAlert(
        alertId,
        status,
        observation,
        currentUser
      );
    },
    [currentUser]
  );

  const openMultipleStores = useCallback(async (storeIds: string[]) => {
    await DataService.openMultipleStores(storeIds);
  }, []);

  const deleteStore = useCallback(async (id: string) => {
    await DataService.deleteStore(id);
  }, []);

  const addCategory = useCallback(
    async (
      input: Omit<CatalogCategory, 'id' | 'createdAt' | 'updatedAt' | 'order'>
    ) => {
      return DataService.addCategory(input);
    },
    []
  );

  const updateCategory = useCallback(
    async (
      id: string,
      updates: Partial<Omit<CatalogCategory, 'id' | 'createdAt'>>
    ) => {
      return DataService.updateCategory(id, updates);
    },
    []
  );

  const deleteCategory = useCallback(async (id: string) => {
    await DataService.deleteCategory(id);
  }, []);

  const setPrimaryCategory = useCallback(
    async (categoryId: string) => {
      if (!currentUser) throw new Error('Sessão expirada.');
      await DataService.setPrimaryCategory(categoryId, currentUser.role);
    },
    [currentUser]
  );

  const addSubcategory = useCallback(
    async (
      input: Omit<CatalogSubcategory, 'id' | 'createdAt' | 'updatedAt'>
    ) => {
      return DataService.addSubcategory(input);
    },
    []
  );

  const updateSubcategory = useCallback(
    async (
      id: string,
      updates: Partial<Omit<CatalogSubcategory, 'id' | 'createdAt'>>
    ) => {
      return DataService.updateSubcategory(id, updates);
    },
    []
  );

  const deleteSubcategory = useCallback(async (id: string) => {
    await DataService.deleteSubcategory(id);
  }, []);

  const addOccurrence = useCallback(
    async (
      category: CatalogCategory,
      subcategory: CatalogSubcategory,
      lat: number,
      lng: number,
      tag?: string
    ) => {
      if (!currentUser) throw new Error('Sessão expirada.');

      const containingStores = stores
        .map((s) => ({
          store: s,
          dist: getDistanceMeters(lat, lng, s.lat, s.lng),
        }))
        .filter((item) => item.dist <= item.store.radiusKm * 1000)
        .sort((a, b) => a.dist - b.dist);

      const primaryStore = containingStores[0]?.store;
      const durationMinutes = primaryStore?.alertDurationMinutes || 20;

      return DataService.addOccurrence({
        categoryId: category.id,
        categoryName: category.name,
        subcategoryId: subcategory.id,
        subcategoryName: subcategory.name,
        visualType: subcategory.visualType,
        vehicleIconKey: subcategory.vehicleIconKey,
        symbolKey: subcategory.symbolKey,
        emoji: subcategory.emoji,
        customImageDataUrl: subcategory.customImageDataUrl,
        colorHex: subcategory.colorHex,
        pulseEffect: subcategory.pulseEffect,
        tag: tag?.trim().slice(0, 10) || undefined,
        lat,
        lng,
        storeId: primaryStore?.id,
        storeCode: primaryStore?.storeCode,
        storeName: primaryStore?.name || 'Fora de perímetro',
        durationMinutes,
        createdByUserId: currentUser.id,
        createdByName: currentUser.name,
        createdByUsername: currentUser.username,
      });
    },
    [currentUser, stores]
  );

  const updateOccurrenceSighting = useCallback(
    async (occurrenceId: string, lat: number, lng: number) => {
      return DataService.updateOccurrenceSighting(
        occurrenceId,
        lat,
        lng,
        currentUser
      );
    },
    [currentUser]
  );

  const dismissOccurrenceAlert = useCallback(
    async (occurrenceId: string) => {
      if (!currentUser) return;
      await DataService.dismissOccurrenceAlert(occurrenceId, currentUser.id);
    },
    [currentUser]
  );

  const markOccurrenceBellRead = useCallback(
    async (occurrenceId: string) => {
      if (!currentUser) return;
      await DataService.markOccurrenceBellRead(occurrenceId, currentUser.id);
    },
    [currentUser]
  );

  const sendMessage = useCallback(
    async (content: string, storeId?: string) => {
      return DataService.sendMessage(content, storeId, currentUser);
    },
    [currentUser]
  );

  const createChatRoom = useCallback(
    async (input: {
      name: string;
      type: ChatRoomType;
      storeId?: string;
      deletionMode: ChatDeletionMode;
      savePolicy?: ChatSavePolicy;
      initialInviteQueries?: string[];
    }) => {
      return DataService.createChatRoom(input, currentUser);
    },
    [currentUser]
  );

  const joinChatRoomByCode = useCallback(
    async (roomCode: string) => {
      return DataService.joinChatRoomByCode(roomCode, currentUser);
    },
    [currentUser]
  );

  const inviteUserToChatRoomExact = useCallback(
    async (roomId: string, query: string) => {
      return DataService.inviteUserToChatRoomExact(roomId, query, currentUser);
    },
    [currentUser]
  );

  const toggleStoreRoomParticipant = useCallback(
    async (roomId: string, targetUserId: string, include: boolean) => {
      return DataService.toggleStoreRoomParticipant(
        roomId,
        targetUserId,
        include,
        currentUser
      );
    },
    [currentUser]
  );

  const sendChatMessage = useCallback(
    async (roomId: string, content: string) => {
      return DataService.sendChatMessage(roomId, content, currentUser);
    },
    [currentUser]
  );

  const markChatMessagesRead = useCallback(
    async (roomId: string, messageIds: string[]) => {
      await DataService.markChatMessagesRead(roomId, messageIds, currentUser);
    },
    [currentUser]
  );

  const panicDestroyChatRoom = useCallback(
    async (roomId: string) => {
      await DataService.panicDestroyChatRoom(roomId, currentUser);
    },
    [currentUser]
  );

  const closeChatRoom = useCallback(
    async (roomId: string) => {
      await DataService.closeChatRoom(roomId, currentUser);
    },
    [currentUser]
  );

  const downloadAuditLogTxt = useCallback((log: ChatAuditLogFile) => {
    ChatAuditService.downloadAuditLogTxt(log);
  }, []);

  const deleteOccurrence = useCallback(
    async (id: string) => {
      await DataService.deleteOccurrence(id, currentUser);
    },
    [currentUser]
  );

  const clearAllOccurrences = useCallback(async () => {
    await DataService.clearAllOccurrences(currentUser);
  }, [currentUser]);

  const saveQaChangelog = useCallback(async (nextState: QaChangelogState) => {
    return DataService.saveQaChangelog(nextState);
  }, []);

  return {
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
    logout,
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
    deleteOccurrence,
    clearAllOccurrences,
    saveQaChangelog,
  };
}
