import {
  AdminAlertItemLine,
  AdminFinanceAlert,
  AlertAuditEntry,
  CatalogCategory,
  CatalogSubcategory,
  CentralStockEntry,
  ChatDeletionMode,
  ChatMessage,
  ChatRoom,
  ChatRoomType,
  ChatSavePolicy,
  ClosingAlertNotification,
  ClosingBalanceStatus,
  ClosingMerchandiseLine,
  ClosingReviewDecision,
  FormerStoreEmployee,
  MapOccurrence,
  MasterProduct,
  OperatorSaleEntry,
  OperatorShiftInventory,
  OperatorShiftItem,
  QaChangelogState,
  QaChecklistItem,
  ReturnedStockLine,
  ROLE_LABELS,
  StoreClosingRecord,
  StoreMerchandiseItem,
  StoreRegion,
  StoreShiftLog,
  StoreUnit,
  TeamMessage,
  UserAccount,
  UserPermissions,
  UserRole,
  VehicleIconKey,
} from '../types/radar';
import { VEHICLE_ICON_OPTIONS } from '../components/icons/VehicleSvg';
import {
  getDistanceMeters,
  OCCURRENCE_ACTIVE_MS,
  OCCURRENCE_MAX_LIFE_MS,
} from '../utils/geo';
import {
  canChooseSaveChatHistory,
  canCreateChatRoom,
  canCreateMasterProduct,
  canCreateSuperSecretChat,
  canDecideClosingReview,
  canManageCentralStock,
  canManageStoreOptions,
  canManageTargetUser,
  canPanicDestroyChat,
  canSetPrimaryCategory,
  canViewTargetUserHierarchy,
  getDefaultPermissionsForRole,
  getMaxChatRoomsForRole,
  hasPermission,
  isUserLinkedToStore,
  ROLE_LEVEL,
} from '../utils/rbac';
import { ChatAuditService } from './ChatAuditService';

const STORAGE_KEYS = {
  USERS: 'radar_v2_users',
  STORES: 'radar_v2_stores',
  CATEGORIES: 'radar_v2_categories',
  SUBCATEGORIES: 'radar_v2_subcategories',
  OCCURRENCES: 'radar_v2_occurrences',
  ALERT_AUDIT: 'radar_v3_alert_audit',
  STORE_CLOSINGS: 'radar_v31_store_closings',
  STORE_SHIFT_LOGS: 'radar_v4_shift_logs',
  MESSAGES: 'radar_v4_messages',
  MERCHANDISE: 'radar_v42_merchandise',
  CLOSING_ALERTS: 'radar_v42_closing_alerts',
  MASTER_PRODUCTS: 'radar_v43_master_products',
  CENTRAL_STOCK: 'radar_v43_central_stock',
  OPERATOR_SHIFTS: 'radar_v43_operator_shifts',
  ADMIN_ALERTS: 'radar_v43_admin_alerts',
  CHAT_ROOMS: 'radar_v44_chat_rooms',
  CHAT_MESSAGES: 'radar_v44_chat_messages',
  LEGACY_SESSION_KEY: 'radar_v2_session_uid',
  QA_CHANGELOG: 'saas_mapa_qa_changelog_v1',
} as const;

function normalizeLegacyRole(rawRole: string): UserRole {
  const upper = rawRole.toUpperCase();
  if (
    upper === 'SUPER_ADMIN' ||
    upper === 'PRESIDENTE' ||
    upper === 'GOVERNADOR' ||
    upper === 'GERENTE' ||
    upper === 'SUBGERENTE' ||
    upper === 'FISCAL_LOJA' ||
    upper === 'CAIXA'
  ) {
    return upper as UserRole;
  }
  if (rawRole === 'super_admin') return 'SUPER_ADMIN';
  if (rawRole === 'manager') return 'GERENTE';
  return 'CAIXA';
}

function createSeedUsers(): UserAccount[] {
  const now = Date.now();
  return [
    {
      id: 'user-admin',
      userCode: 'USR-0001',
      name: 'Administrador Geral',
      username: 'admin',
      password: '123',
      role: 'SUPER_ADMIN',
      permissions: getDefaultPermissionsForRole('SUPER_ADMIN'),
      isBlocked: false,
      isPublicProfile: false,
      region: 'Centro',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'user-presidente1',
      userCode: 'USR-0010',
      name: 'Roberto Almeida (Presidência)',
      username: 'presidente1',
      password: '123',
      role: 'PRESIDENTE',
      permissions: getDefaultPermissionsForRole('PRESIDENTE'),
      isBlocked: false,
      isPublicProfile: false,
      region: 'Centro',
      createdByUserId: 'user-admin',
      createdAt: now + 1,
      updatedAt: now + 1,
    },
    {
      id: 'user-governador1',
      userCode: 'USR-0020',
      name: 'Fernanda Moraes (Regional SP)',
      username: 'governador1',
      password: '123',
      role: 'GOVERNADOR',
      permissions: getDefaultPermissionsForRole('GOVERNADOR'),
      isBlocked: false,
      isPublicProfile: false,
      region: 'Centro',
      createdByUserId: 'user-presidente1',
      createdAt: now + 2,
      updatedAt: now + 2,
    },
    {
      id: 'user-gerente1',
      userCode: 'USR-0101',
      name: 'Carlos Mendes (Butantã)',
      username: 'gerente1',
      password: '123',
      role: 'GERENTE',
      permissions: getDefaultPermissionsForRole('GERENTE'),
      isBlocked: false,
      isPublicProfile: false,
      region: 'Oeste',
      createdByUserId: 'user-governador1',
      createdAt: now + 3,
      updatedAt: now + 3,
    },
    {
      id: 'user-gerente2',
      userCode: 'USR-0102',
      name: 'Ana Paula (Pinheiros)',
      username: 'gerente2',
      password: '123',
      role: 'GERENTE',
      permissions: getDefaultPermissionsForRole('GERENTE'),
      isBlocked: false,
      isPublicProfile: false,
      region: 'Oeste',
      createdByUserId: 'user-governador1',
      createdAt: now + 4,
      updatedAt: now + 4,
    },
    {
      id: 'user-subgerente1',
      userCode: 'USR-0201',
      name: 'Lucas Silva (Subgerência)',
      username: 'subgerente1',
      password: '123',
      role: 'SUBGERENTE',
      permissions: getDefaultPermissionsForRole('SUBGERENTE'),
      isBlocked: false,
      isPublicProfile: false,
      region: 'Oeste',
      createdByUserId: 'user-gerente1',
      createdAt: now + 5,
      updatedAt: now + 5,
    },
    {
      id: 'user-fiscal1',
      userCode: 'USR-0202',
      name: 'Mariana Costa (Fiscalização)',
      username: 'fiscal1',
      password: '123',
      role: 'FISCAL_LOJA',
      permissions: getDefaultPermissionsForRole('FISCAL_LOJA'),
      isBlocked: false,
      isPublicProfile: false,
      region: 'Oeste',
      createdByUserId: 'user-gerente1',
      createdAt: now + 6,
      updatedAt: now + 6,
    },
    {
      id: 'user-caixa1',
      userCode: 'USR-0203',
      name: 'Pedro Santos (Frente de Caixa)',
      username: 'caixa1',
      password: '123',
      role: 'CAIXA',
      permissions: getDefaultPermissionsForRole('CAIXA'),
      isBlocked: false,
      isPublicProfile: false,
      region: 'Oeste',
      createdByUserId: 'user-gerente1',
      createdAt: now + 7,
      updatedAt: now + 7,
    },
  ];
}

function createSeedStores(): StoreUnit[] {
  const now = Date.now();
  return [
    {
      id: 'store-butanta',
      storeCode: 'LJ-1001',
      name: 'Unidade CEU Butantã',
      region: 'Oeste',
      address: 'Av. Eng. Heitor Antônio Eiras Garcia, 1870 - Butantã, São Paulo',
      lat: -23.5878,
      lng: -46.7525,
      radiusKm: 2,
      isOpen: false,
      motto: 'Monitoramento preventivo e ágil na região do Butantã.',
      alertDurationMinutes: 20,
      managerId: 'user-gerente1',
      managerIds: ['user-gerente1'],
      employeeIds: ['user-subgerente1', 'user-fiscal1', 'user-caixa1'],
      formerEmployees: [
        {
          userId: 'ex-usr-0088',
          userCode: 'USR-0088',
          name: 'Ricardo Ferreira',
          unlinkedAt: now - 86400000 * 14,
        },
        {
          userId: 'ex-usr-0094',
          userCode: 'USR-0094',
          name: 'Juliana Nascimento',
          unlinkedAt: now - 86400000 * 6,
        },
      ],
      onlineUserIds: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'store-pinheiros',
      storeCode: 'LJ-1002',
      name: 'Unidade Central Pinheiros',
      region: 'Oeste',
      address: 'Av. Brigadeiro Faria Lima, 1200 - Pinheiros, São Paulo',
      lat: -23.5672,
      lng: -46.6952,
      radiusKm: 1.8,
      isOpen: false,
      motto: 'Equipe integrada 100% em alerta no eixo Faria Lima.',
      alertDurationMinutes: 20,
      managerId: 'user-gerente2',
      managerIds: ['user-gerente2'],
      employeeIds: ['user-subgerente1'],
      formerEmployees: [
        {
          userId: 'ex-usr-0071',
          userCode: 'USR-0071',
          name: 'Eduardo Lima',
          unlinkedAt: now - 86400000 * 21,
        },
      ],
      onlineUserIds: [],
      createdAt: now + 1,
      updatedAt: now + 1,
    },
  ];
}

function createSeedMasterProducts(): MasterProduct[] {
  const now = Date.now();
  return [
    {
      id: 'mp-kit-urbano',
      name: 'Kit Promocional Urbano',
      unitPrice: 25.0,
      createdByUserId: 'user-presidente1',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'mp-bebida-350',
      name: 'Bebida Gelada 350ml',
      unitPrice: 6.5,
      createdByUserId: 'user-presidente1',
      createdAt: now + 1,
      updatedAt: now + 1,
    },
    {
      id: 'mp-combo-lanche',
      name: 'Combo Lanche Rápido',
      unitPrice: 18.0,
      createdByUserId: 'user-presidente1',
      createdAt: now + 2,
      updatedAt: now + 2,
    },
    {
      id: 'mp-pack-expresso',
      name: 'Pack Expresso',
      unitPrice: 22.0,
      createdByUserId: 'user-admin',
      createdAt: now + 3,
      updatedAt: now + 3,
    },
    {
      id: 'mp-agua-500',
      name: 'Água Mineral 500ml',
      unitPrice: 4.5,
      createdByUserId: 'user-admin',
      createdAt: now + 4,
      updatedAt: now + 4,
    },
  ];
}

function createSeedCentralStock(): CentralStockEntry[] {
  const now = Date.now();
  return [
    {
      id: 'cs-ger1-kit',
      ownerUserId: 'user-gerente1',
      ownerName: 'Carlos Mendes (Butantã)',
      ownerRole: 'GERENTE',
      masterProductId: 'mp-kit-urbano',
      quantity: 120,
      updatedAt: now,
    },
    {
      id: 'cs-ger1-bebida',
      ownerUserId: 'user-gerente1',
      ownerName: 'Carlos Mendes (Butantã)',
      ownerRole: 'GERENTE',
      masterProductId: 'mp-bebida-350',
      quantity: 300,
      updatedAt: now,
    },
    {
      id: 'cs-ger1-agua',
      ownerUserId: 'user-gerente1',
      ownerName: 'Carlos Mendes (Butantã)',
      ownerRole: 'GERENTE',
      masterProductId: 'mp-agua-500',
      quantity: 200,
      updatedAt: now,
    },
    {
      id: 'cs-gov1-pack',
      ownerUserId: 'user-governador1',
      ownerName: 'Fernanda Moraes (Regional SP)',
      ownerRole: 'GOVERNADOR',
      masterProductId: 'mp-pack-expresso',
      quantity: 500,
      updatedAt: now,
    },
  ];
}

function createSeedMerchandise(): StoreMerchandiseItem[] {
  const now = Date.now();
  return [
    {
      id: 'merc-butanta-1',
      storeId: 'store-butanta',
      masterProductId: 'mp-kit-urbano',
      name: 'Kit Promocional Urbano',
      stockQuantity: 40,
      unitPrice: 25.0,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'merc-butanta-2',
      storeId: 'store-butanta',
      masterProductId: 'mp-bebida-350',
      name: 'Bebida Gelada 350ml',
      stockQuantity: 120,
      unitPrice: 6.5,
      createdAt: now + 1,
      updatedAt: now + 1,
    },
    {
      id: 'merc-butanta-3',
      storeId: 'store-butanta',
      masterProductId: 'mp-combo-lanche',
      name: 'Combo Lanche Rápido',
      stockQuantity: 35,
      unitPrice: 18.0,
      createdAt: now + 2,
      updatedAt: now + 2,
    },
    {
      id: 'merc-pinheiros-1',
      storeId: 'store-pinheiros',
      masterProductId: 'mp-pack-expresso',
      name: 'Pack Expresso',
      stockQuantity: 50,
      unitPrice: 22.0,
      createdAt: now + 3,
      updatedAt: now + 3,
    },
    {
      id: 'merc-pinheiros-2',
      storeId: 'store-pinheiros',
      masterProductId: 'mp-agua-500',
      name: 'Água Mineral 500ml',
      stockQuantity: 90,
      unitPrice: 4.5,
      createdAt: now + 4,
      updatedAt: now + 4,
    },
  ];
}

function createSeedCategories(): CatalogCategory[] {
  const now = Date.now();
  return [
    {
      id: 'cat-envio',
      name: 'Entrega Envio',
      colorHex: '#2563EB',
      iconType: 'package_out',
      order: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cat-recebimento',
      name: 'Entrega Recebimento',
      colorHex: '#059669',
      iconType: 'package_in',
      order: 2,
      createdAt: now + 1,
      updatedAt: now + 1,
    },
    {
      id: 'cat-alerta',
      name: 'Alerta',
      colorHex: '#DC2626',
      iconType: 'alert_triangle',
      order: 3,
      createdAt: now + 2,
      updatedAt: now + 2,
    },
    {
      id: 'cat-carro',
      name: 'Carro',
      colorHex: '#1E293B',
      iconType: 'car',
      isPrimary: true,
      order: 4,
      createdAt: now + 3,
      updatedAt: now + 3,
    },
  ];
}

function createSeedMessages(): TeamMessage[] {
  const now = Date.now();
  return [
    {
      id: 'msg-seed-1',
      senderId: 'user-admin',
      senderName: 'Administrador Geral',
      senderRole: 'SUPER_ADMIN',
      content:
        'Canal de comunicados ativo na Versão 4.0. Reportem avistamentos atualizando diretamente com "Eu vi!" no mapa.',
      createdAt: now - 1800000,
    },
    {
      id: 'msg-seed-2',
      senderId: 'user-gerente1',
      senderName: 'Carlos Mendes (Butantã)',
      senderRole: 'GERENTE',
      storeId: 'store-butanta',
      storeName: 'Unidade CEU Butantã',
      content:
        'Equipe Butantã: atenção redobrada no raio da loja e na Av. Heitor Antônio Eiras Garcia durante o turno.',
      createdAt: now - 900000,
    },
  ];
}

function getVehicleColor(key: VehicleIconKey): string {
  if (
    key === 'auto_bomba' ||
    key === 'resgate_bombeiros' ||
    key === 'auto_escada'
  ) {
    return '#DC2626';
  }
  if (key === 'samu' || key === 'uti_movel' || key === 'ambulancia_resgate') {
    return '#EA580C';
  }
  if (key === 'enel' || key === 'claro' || key === 'vivo') {
    return '#0284C7';
  }
  if (key === 'moto' || key === 'carro_prata' || key === 'carro_colorido') {
    return '#475569';
  }
  return '#1E293B';
}

function createSeedSubcategories(): CatalogSubcategory[] {
  const now = Date.now();
  const baseSubs: CatalogSubcategory[] = [
    {
      id: 'sub-saida-carga',
      categoryId: 'cat-envio',
      name: 'Saída de Carga',
      visualType: 'symbol',
      symbolKey: 'box_send',
      colorHex: '#2563EB',
      pulseEffect: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'sub-entrega-expressa',
      categoryId: 'cat-envio',
      name: 'Entrega Expressa',
      visualType: 'symbol',
      symbolKey: 'truck_fast',
      colorHex: '#1D4ED8',
      pulseEffect: false,
      createdAt: now + 1,
      updatedAt: now + 1,
    },
    {
      id: 'sub-envio-prioritario',
      categoryId: 'cat-envio',
      name: 'Envio Prioritário',
      visualType: 'symbol',
      symbolKey: 'clock_wait',
      colorHex: '#D97706',
      pulseEffect: false,
      createdAt: now + 2,
      updatedAt: now + 2,
    },
    {
      id: 'sub-receb-mercadoria',
      categoryId: 'cat-recebimento',
      name: 'Recebimento de Mercadoria',
      visualType: 'symbol',
      symbolKey: 'box_receive',
      colorHex: '#059669',
      pulseEffect: false,
      createdAt: now + 3,
      updatedAt: now + 3,
    },
    {
      id: 'sub-conferencia-ok',
      categoryId: 'cat-recebimento',
      name: 'Conferência Concluída',
      visualType: 'symbol',
      symbolKey: 'check_ok',
      colorHex: '#10B981',
      pulseEffect: false,
      createdAt: now + 4,
      updatedAt: now + 4,
    },
    {
      id: 'sub-alerta-critico',
      categoryId: 'cat-alerta',
      name: 'Alerta Crítico',
      visualType: 'alert_triangle',
      symbolKey: 'alert_triangle',
      colorHex: '#DC2626',
      pulseEffect: true,
      createdAt: now + 5,
      updatedAt: now + 5,
    },
    {
      id: 'sub-alerta-bloqueio',
      categoryId: 'cat-alerta',
      name: 'Ocorrência / Bloqueio na Via',
      visualType: 'alert_triangle',
      symbolKey: 'alert_triangle',
      colorHex: '#B91C1C',
      pulseEffect: true,
      createdAt: now + 6,
      updatedAt: now + 6,
    },
  ];

  const vehicleSubs: CatalogSubcategory[] = VEHICLE_ICON_OPTIONS.map(
    (opt, idx) => ({
      id: `sub-veh-${opt.key}`,
      categoryId: 'cat-carro',
      name: opt.label,
      visualType: 'vehicle_svg',
      vehicleIconKey: opt.key,
      colorHex: getVehicleColor(opt.key),
      pulseEffect: false,
      createdAt: now + 10 + idx,
      updatedAt: now + 10 + idx,
    })
  );

  return [...baseSubs, ...vehicleSubs];
}

function getV2QaItems(): QaChecklistItem[] {
  const now = Date.now();
  return [
    {
      id: 'qa-v2-1',
      section: 'features',
      title:
        '[v2.0] Login blindado contra salvamento automático e autocomplete de usuário/senha',
      done: true,
      qaStatus: 'pending',
      versionTag: '2.0',
      createdAt: now + 201,
    },
    {
      id: 'qa-v2-2',
      section: 'features',
      title:
        '[v2.0] Hierarquia corporativa de 7 níveis (Super Admin, Presidente, Governador, Gerente, Subgerente, Fiscal de Loja, Caixa)',
      done: true,
      qaStatus: 'pending',
      versionTag: '2.0',
      createdAt: now + 202,
    },
    {
      id: 'qa-v2-3',
      section: 'features',
      title:
        '[v2.0] Painel Administrativo único com renderização dinâmica baseada nas permissões do cargo',
      done: true,
      qaStatus: 'pending',
      versionTag: '2.0',
      createdAt: now + 203,
    },
    {
      id: 'qa-v2-4',
      section: 'features',
      title:
        '[v2.0] Controle de versionamento semântico (Major.Minor) com preservação de status de QA',
      done: true,
      qaStatus: 'pending',
      versionTag: '2.0',
      createdAt: now + 204,
    },
  ];
}

function getV3QaItems(): QaChecklistItem[] {
  const now = Date.now();
  return [
    {
      id: 'qa-v3-1',
      section: 'features',
      title:
        '[v3.0] ID único de loja (storeId) e vínculo de gestores a múltiplas unidades',
      done: true,
      qaStatus: 'pending',
      versionTag: '3.0',
      createdAt: now + 301,
    },
    {
      id: 'qa-v3-2',
      section: 'features',
      title:
        '[v3.0] Permissão de catálogo (Categorias/Subcategorias) liberada para Presidente e Governador',
      done: true,
      qaStatus: 'pending',
      versionTag: '3.0',
      createdAt: now + 302,
    },
    {
      id: 'qa-v3-3',
      section: 'features',
      title:
        '[v3.0] Fluxo de Loja Aberta/Fechada com alerta automático no login ("Deseja abrir?")',
      done: true,
      qaStatus: 'pending',
      versionTag: '3.0',
      createdAt: now + 303,
    },
    {
      id: 'qa-v3-4',
      section: 'features',
      title:
        '[v3.0] Card da loja com foto, recado e lista de equipe online (com modo invisível padrão para Gerente+)',
      done: true,
      qaStatus: 'pending',
      versionTag: '3.0',
      createdAt: now + 304,
    },
    {
      id: 'qa-v3-5',
      section: 'features',
      title:
        '[v3.0] Ocorrências no mapa sem nome do autor, com tag de 10 chars (identificação de mesmo alvo) e cronômetro regressivo configurável',
      done: true,
      qaStatus: 'pending',
      versionTag: '3.0',
      createdAt: now + 305,
    },
    {
      id: 'qa-v3-6',
      section: 'features',
      title:
        '[v3.0] Aba de Auditoria / Histórico completo de alertas (quem criou e quem excluiu)',
      done: true,
      qaStatus: 'pending',
      versionTag: '3.0',
      createdAt: now + 306,
    },
  ];
}

function getV31QaItems(): QaChecklistItem[] {
  const now = Date.now();
  const titles = [
    '[v3.1-UI] Botão temporário "Entrar sem senha" (Modo Teste) na tela de login',
    '[v3.1-UI] Novo layout Mobile-First com Menu Lateral (Drawer) filtrado por permissões',
    '[v3.1-UI] Mapa real OpenStreetMap + GPS automático e botões gigantes "+ MARCAR AQUI" / "+ MARCAR NO MAPA"',
    '[v3.1-UI] Cadastro de usuário sem obrigatoriedade de loja e permissões granulares por cargo/usuário',
    '[v3.1-UI] Regra de loja exigindo Gerente (ou Governador/Presidente se marcada ausência de gerente)',
    '[v3.1-UI] Regra de sigilo de 2 níveis acima com opção de Perfil Público no menu',
    '[v3.1-UI] Tela de Equipe escalável com filtro por Região/Loja e bloqueio de usuário',
    '[v3.1-UI] Dashboard de vendas/status, Histórico com Hoje/Ontem/Data e Saúde do Sistema (Super Admin)',
  ];
  return titles.map((title, i) => ({
    id: `qa-v31-${i + 1}`,
    section: 'features' as const,
    title,
    done: true,
    qaStatus: 'pending' as const,
    versionTag: '3.1-UI',
    createdAt: now + 310 + i,
  }));
}

function getV4QaItems(): QaChecklistItem[] {
  const now = Date.now();
  const titles = [
    '[v4.0] Mapa com zoom por toque (1 toque aproxima, 2 toques afasta) sem abertura acidental de cadastro',
    '[v4.0] Dock inferior fixo de canto a canto (Categoria Principal, Mensagens e Campainha de Alertas)',
    '[v4.0] Permissão granular "Enviar mensagens" no cadastro de usuários',
    '[v4.0] Notificações direcionadas na campainha apenas para lojas no raio + 5 km',
    '[v4.0] Balão persistente ("Eu vi!" / "Não vi") com atualização de coordenada exata na rua e rastro pontilhado',
    '[v4.0] Ciclo de vida em 3 fases (Ativo 0–20m, Sombra 20–30m e Projeção 30–60m via botão "Última 1h")',
    '[v4.0] Dashboard Executivo com KPIs, logs de turno da loja e árvore hierárquica (drill-down até 3º nível + expansão no 4º)',
  ];
  return titles.map((title, i) => ({
    id: `qa-v4-${i + 1}`,
    section: 'features' as const,
    title,
    done: true,
    qaStatus: 'pending' as const,
    versionTag: '4.0',
    createdAt: now + 410 + i,
  }));
}

function getV42QaItems(): QaChecklistItem[] {
  const now = Date.now();
  const titles = [
    '[v4.2-UI] Bolinha flutuante arrastável de saída rápida ("Destruir Sessão" + limpeza de cookies/histórico via location.replace)',
    '[v4.2-UI] Opções da Loja (Gerente+): equipe online/offline, gaveta de ex-funcionários (nome + ID) e cadastro de mercadorias com avatar circular',
    '[v4.2-UI] Fechamento de loja com cálculo automático de mercadorias vendidas vs. recebimentos em Dinheiro e Pix (saldo positivo/bateu/negativo)',
    '[v4.2-UI] Fluxo de aprovação/reprovação com observação (Gerente e Governador) e alerta automático para níveis superiores',
  ];
  return titles.map((title, i) => ({
    id: `qa-v42-${i + 1}`,
    section: 'features' as const,
    title,
    done: true,
    qaStatus: 'pending' as const,
    versionTag: '4.2-UI',
    createdAt: now + 420 + i,
  }));
}

function getV43QaItems(): QaChecklistItem[] {
  const now = Date.now();
  const titles = [
    '[v4.3-UI] Separação de alertas: campainha exclusiva do mapa vs. alertas financeiros/estoque no painel administrativo',
    '[v4.3-UI] Criação de produtos novos exclusiva do Super Admin/Presidente; livre abastecimento de estoque até Gerente',
    '[v4.3-UI] Permissões granulares por operador: "Visualizar estoque da loja" e "Realizar retirada/reposição"',
    '[v4.3-UI] Trava de retirada/reposição do vendedor limitada ao saldo disponível na loja',
    '[v4.3-UI] Tela Financeiro & Vendas: vendas em tempo real (abate do vendedor), reposição no expediente e devolução automática de sobra no fechamento',
  ];
  return titles.map((title, i) => ({
    id: `qa-v43-${i + 1}`,
    section: 'features' as const,
    title,
    done: true,
    qaStatus: 'pending' as const,
    versionTag: '4.3-UI',
    createdAt: now + 430 + i,
  }));
}

function getV44QaItems(): QaChecklistItem[] {
  const now = Date.now();
  const titles = [
    '[v4.4-Final] Bloqueio automático por perda de foco (Visibility API + blur) com Lock Screen e exigência de senha',
    '[v4.4-Final] Saneamento da campainha do mapa: botão "Marcar como lido" por usuário e expiração sincronizada em 60 min',
    '[v4.4-Final] Salas de Chat Inteligentes: Chat da Loja automático, Chat de Gestão por busca exata e limite de 3 salas para Gerente',
    '[v4.4-Final] Convite ao Presidente via código único da sala + opção de Salvar Histórico (Governador/Presidente)',
    '[v4.4-Final] Autodestruição pós-leitura individual, Botão de Pânico na sala e Chat Super Secreto em memória (Presidente)',
    '[v4.4-Final] Auditoria silenciosa em .TXT estilo WhatsApp exclusiva do Super Admin (exceto Chat Super Secreto)',
  ];
  return titles.map((title, i) => ({
    id: `qa-v44-${i + 1}`,
    section: 'features' as const,
    title,
    done: true,
    qaStatus: 'pending' as const,
    versionTag: '4.4-Final',
    createdAt: now + 440 + i,
  }));
}

function getV45QaItems(): QaChecklistItem[] {
  const now = Date.now();
  const titles = [
    '[v4.5-RC] Botão flutuante de pânico (cadeado): saída imediata em 1 toque sem modal de confirmação (limpa sessão/cookies e redireciona para google.com)',
    '[v4.5-RC] Acesso global ao "Chat & Mensagens" no Menu Lateral (Drawer) para todos os cargos + unificação com botão do mapa',
    '[v4.5-RC] Estoque Atual por Unidade escalável por Zona de SP (Norte, Sul, Leste, Oeste, Centro) e filtro por Lojas ou Gerentes/Governadores',
    '[v4.5-RC] Indicadores visuais tipo semáforo no estoque (Verde/Amarelo/Vermelho/Preto), detalhe de vendas do dia e soma consolidada por gestor',
  ];
  return titles.map((title, i) => ({
    id: `qa-v45-${i + 1}`,
    section: 'features' as const,
    title,
    done: true,
    qaStatus: 'pending' as const,
    versionTag: '4.5-RC',
    createdAt: now + 450 + i,
  }));
}

function getV50QaItems(): QaChecklistItem[] {
  const now = Date.now();
  const titles = [
    '[v5.0] Modal de confirmação obrigatório no botão do cadeado/saída, limpeza de sessão ativa e redirecionamento externo forçado para https://www.google.com',
    '[v5.0] Build estático Vite otimizado (base: "./" e outDir: "dist") para hospedagem na raiz ou subpastas',
    '[v5.0] Pipeline CI/CD via GitHub Actions (.github/workflows/deploy.yml) com deploy FTP automatizado',
  ];
  return titles.map((title, i) => ({
    id: `qa-v50-${i + 1}`,
    section: 'features' as const,
    title,
    done: true,
    qaStatus: 'pending' as const,
    versionTag: '5.0',
    createdAt: now + 480 + i,
  }));
}

function getRequiredRoadmapItems(): QaChecklistItem[] {
  const now = Date.now();
  const titles = [
    'Revisar/reforçar bloqueio total de salvamento de senha e autocomplete no navegador',
    'Conectar com a API do Telegram (alertas gratuitos para grupo/equipe da loja)',
    'Conectar com a API do WhatsApp (notificações via API oficial/integrada)',
    'Conectar banco de dados em tempo real com Firebase Firestore (onSnapshot)',
    'Configurar repositório no GitHub para versionamento contínuo',
    'Configurar GitHub Secrets e Action de deploy automático via FTP para a hospedagem (ValueHost)',
  ];
  return titles.map((title, i) => ({
    id: `qa-road-v3-${i + 1}`,
    section: 'roadmap' as const,
    title,
    done: false,
    qaStatus: 'pending' as const,
    createdAt: now + 500 + i,
  }));
}

function createSeedQaChangelog(): QaChangelogState {
  const now = Date.now();
  const v1Features: QaChecklistItem[] = [
    'Mapa interativo Leaflet com ícones personalizados de veículos/ocorrências',
    'Arquitetura modular desacoplada (DataService) preparada para Firebase',
    'Tela única de Login sem botão de recuperação de senha (redefinição apenas pelo nível superior)',
    'Hierarquia de 3 níveis: Super Admin, Gerente e Funcionário',
    'Identificação única de usuário (userId/username) permitindo vínculo em múltiplas lojas',
    'Painel Super Admin: gestão de Gerentes e catálogo aberto de Categorias e Subcategorias',
    'Painel Gerente: cadastro de lojas/unidades fixas e gestão de funcionários vinculados',
    'Mapa compartilhado global com círculo de perímetro (2 km) ao redor de cada loja',
    'Radar visual dinâmico: círculo da loja pisca em vermelho quando há ocorrência ativa dentro do raio',
    'Fluxo de inserção em 2 etapas (Categoria -> Subcategoria) e baixa/conclusão de alertas',
  ].map((title, i) => ({
    id: `qa-feat-${i + 1}`,
    section: 'features' as const,
    title,
    done: true,
    qaStatus: 'pending' as const,
    versionTag: '1.0',
    createdAt: now + i,
  }));

  return {
    version: '5.0',
    items: [
      ...v1Features,
      ...getV2QaItems(),
      ...getV3QaItems(),
      ...getV31QaItems(),
      ...getV4QaItems(),
      ...getV42QaItems(),
      ...getV43QaItems(),
      ...getV44QaItems(),
      ...getV45QaItems(),
      ...getV50QaItems(),
      ...getRequiredRoadmapItems(),
    ],
    releases: [
      {
        version: '1.0',
        releaseType: 'major',
        summary: 'MVP Multi-Organização, Mapa Compartilhado e Radar Piscante',
        releasedAt: now - 18000000,
      },
      {
        version: '2.0',
        releaseType: 'major',
        summary:
          'Login blindado em memória, RBAC de 7 cargos e Painel Administrativo Adaptativo',
        releasedAt: now - 14400000,
      },
      {
        version: '3.0',
        releaseType: 'major',
        summary:
          'StoreId único, Loja Aberta/Fechada, Card com Equipe Online, Tag 10 chars, Cronômetro Regressivo e Auditoria de Alertas',
        releasedAt: now - 10800000,
      },
      {
        version: '3.1-UI',
        releaseType: 'minor',
        summary:
          'Layout Mobile-First com Drawer, OpenStreetMap + GPS automático, Permissões Granulares, Drill-Down por Região, Dashboard de Vendas e Saúde do Sistema',
        releasedAt: now - 7200000,
      },
      {
        version: '4.0',
        releaseType: 'major',
        summary:
          'Dock Inferior Fixo, Zoom por Toque, Mensagens da Equipe, Campainha Raio+5km, Rastreamento Colaborativo em 3 Fases ("Eu vi!" / Sombra / Projeção 1h) e Árvore Hierárquica Executiva',
        releasedAt: now - 3600000,
      },
      {
        version: '4.2-UI',
        releaseType: 'minor',
        summary:
          'Bolinha flutuante de saída rápida (Destruir Sessão), Opções da Loja com equipe ativa/ex-funcionários e mercadorias, Fechamento Dinheiro+Pix e Conferência Gerente -> Governador -> Presidente',
        releasedAt: now - 1800000,
      },
      {
        version: '4.3-UI',
        releaseType: 'minor',
        summary:
          'Catálogo Mestre restrito (Super Admin/Presidente), Estoque em 3 Camadas, Permissões de Estoque por Operador, Abertura com Retirada de Carga e Painel Financeiro & Vendas em Tempo Real',
        releasedAt: now - 900000,
      },
      {
        version: '4.4-Final',
        releaseType: 'minor',
        summary:
          'Bloqueio Anti-Espião (Visibility API), Saneamento da Campainha do Mapa, Salas de Chat Hierárquicas/Autodestrutivas, Chat Super Secreto em Memória (Presidente) e Auditoria Silenciosa .TXT',
        releasedAt: now - 300000,
      },
      {
        version: '4.5-RC',
        releaseType: 'minor',
        summary:
          'Saída instantânea em 1 toque no cadeado flutuante, Chat & Mensagens global unificado no Drawer e Estoque Atual por Zona de SP com semáforo e vendas do dia',
        releasedAt: now - 60000,
      },
      {
        version: '5.0',
        releaseType: 'major',
        summary:
          'v5.0 (Major): Início da fase de Conectividade — Pipeline CI/CD via GitHub Actions com deploy FTP automatizado, build estático Vite otimizado e correção de segurança no botão de cadeado (modal de confirmação + redirecionamento externo para Google).',
        releasedAt: now,
      },
    ],
  };
}

type Listener<T> = (data: T) => void;

class MultiOrgDataService {
  // Sessão mantida EXCLUSIVAMENTE em memória React/JS (nunca em localStorage/sessionStorage)
  private currentSessionUserId: string | null = null;
  private isQuickTestSession: boolean = false;
  // Alta gestão (Gerente+) começa invisível ao logar
  private isHighMgmtOnlineVisible: boolean = false;

  // Chat Super Secreto (Presidente): 100% em memória, zero persistência, zero log .TXT
  private secretChatRooms = new Map<string, ChatRoom>();
  private secretChatMessages = new Map<string, ChatMessage[]>();

  private userListeners = new Set<Listener<UserAccount[]>>();
  private storeListeners = new Set<Listener<StoreUnit[]>>();
  private storeClosingListeners = new Set<Listener<StoreClosingRecord[]>>();
  private closingAlertListeners = new Set<
    Listener<ClosingAlertNotification[]>
  >();
  private merchandiseListeners = new Set<Listener<StoreMerchandiseItem[]>>();
  private masterProductListeners = new Set<Listener<MasterProduct[]>>();
  private centralStockListeners = new Set<Listener<CentralStockEntry[]>>();
  private operatorShiftListeners = new Set<
    Listener<OperatorShiftInventory[]>
  >();
  private adminAlertListeners = new Set<Listener<AdminFinanceAlert[]>>();
  private shiftLogListeners = new Set<Listener<StoreShiftLog[]>>();
  private messageListeners = new Set<Listener<TeamMessage[]>>();
  private chatRoomListeners = new Set<Listener<ChatRoom[]>>();
  private chatMessageListeners = new Set<Listener<ChatMessage[]>>();
  private categoryListeners = new Set<Listener<CatalogCategory[]>>();
  private subcategoryListeners = new Set<Listener<CatalogSubcategory[]>>();
  private occurrenceListeners = new Set<Listener<MapOccurrence[]>>();
  private alertAuditListeners = new Set<Listener<AlertAuditEntry[]>>();
  private sessionListeners = new Set<Listener<UserAccount | null>>();
  private quickTestListeners = new Set<Listener<boolean>>();
  private visibilityListeners = new Set<Listener<boolean>>();
  private qaListeners = new Set<Listener<QaChangelogState>>();

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEYS.LEGACY_SESSION_KEY);
        sessionStorage.removeItem(STORAGE_KEYS.LEGACY_SESSION_KEY);
      } catch {
        // Ignora
      }
      this.ensureSeededAndMigrated();
      window.addEventListener('storage', this.handleCrossTabStorage);
      window.addEventListener('beforeunload', this.handleBeforeUnload);
    }
  }

  private handleBeforeUnload = () => {
    if (this.currentSessionUserId) {
      this.removeUserFromAllStoresOnline(this.currentSessionUserId, false);
    }
  };

  private handleCrossTabStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEYS.USERS) this.emitUsers();
    if (event.key === STORAGE_KEYS.STORES) this.emitStores();
    if (event.key === STORAGE_KEYS.STORE_CLOSINGS) this.emitStoreClosings();
    if (event.key === STORAGE_KEYS.CLOSING_ALERTS) this.emitClosingAlerts();
    if (event.key === STORAGE_KEYS.MERCHANDISE) this.emitMerchandise();
    if (event.key === STORAGE_KEYS.MASTER_PRODUCTS) this.emitMasterProducts();
    if (event.key === STORAGE_KEYS.CENTRAL_STOCK) this.emitCentralStock();
    if (event.key === STORAGE_KEYS.OPERATOR_SHIFTS) this.emitOperatorShifts();
    if (event.key === STORAGE_KEYS.ADMIN_ALERTS) this.emitAdminAlerts();
    if (event.key === STORAGE_KEYS.STORE_SHIFT_LOGS) this.emitShiftLogs();
    if (event.key === STORAGE_KEYS.MESSAGES) this.emitMessages();
    if (event.key === STORAGE_KEYS.CHAT_ROOMS) this.emitChatRooms();
    if (event.key === STORAGE_KEYS.CHAT_MESSAGES) this.emitChatMessages();
    if (event.key === STORAGE_KEYS.CATEGORIES) this.emitCategories();
    if (event.key === STORAGE_KEYS.SUBCATEGORIES) this.emitSubcategories();
    if (event.key === STORAGE_KEYS.OCCURRENCES) this.emitOccurrences();
    if (event.key === STORAGE_KEYS.ALERT_AUDIT) this.emitAlertAudit();
    if (event.key === STORAGE_KEYS.QA_CHANGELOG) this.emitQaChangelog();
  };

  private generateStoreCode(existingStores: StoreUnit[]): string {
    let maxNum = 1000;
    existingStores.forEach((s) => {
      const match = s.storeCode?.match(/LJ-(\d+)/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (val > maxNum) maxNum = val;
      }
    });
    return `LJ-${maxNum + 1}`;
  }

  private ensureSeededAndMigrated(): void {
    try {
      // 1. Usuários (migra permissões granulares, isBlocked, isPublicProfile e region)
      const rawUsers = localStorage.getItem(STORAGE_KEYS.USERS);
      if (!rawUsers) {
        localStorage.setItem(
          STORAGE_KEYS.USERS,
          JSON.stringify(createSeedUsers())
        );
      } else {
        const parsed = JSON.parse(rawUsers) as Array<
          Omit<UserAccount, 'role' | 'permissions'> & {
            role: string;
            permissions?: Partial<UserPermissions>;
          }
        >;
        let changed = false;
        const migrated: UserAccount[] = parsed.map((u) => {
          const nextRole = normalizeLegacyRole(u.role);
          if (nextRole !== u.role) changed = true;

          const defaults = getDefaultPermissionsForRole(nextRole);
          const mergedPerms: UserPermissions = {
            ...defaults,
            ...(u.permissions || {}),
          };
          if (
            !u.permissions ||
            typeof u.permissions.canViewStoreInventory !== 'boolean' ||
            typeof u.permissions.canWithdrawRestockInventory !== 'boolean'
          ) {
            changed = true;
          }

          const isBlocked = typeof u.isBlocked === 'boolean' ? u.isBlocked : false;
          if (typeof u.isBlocked !== 'boolean') changed = true;

          const isPublicProfile =
            typeof u.isPublicProfile === 'boolean' ? u.isPublicProfile : false;
          if (typeof u.isPublicProfile !== 'boolean') changed = true;

          return {
            ...u,
            role: nextRole,
            permissions: mergedPerms,
            isBlocked,
            isPublicProfile,
          };
        });

        const seedUsers = createSeedUsers();
        seedUsers.forEach((seedUser) => {
          const exists = migrated.some(
            (u) =>
              u.username.toLowerCase() === seedUser.username.toLowerCase()
          );
          if (!exists) {
            migrated.push(seedUser);
            changed = true;
          }
        });

        if (changed) {
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(migrated));
        }
      }

      // 2. Lojas (migra campos v3.0 e region v3.1-UI sem apagar dados existentes)
      const rawStores = localStorage.getItem(STORAGE_KEYS.STORES);
      if (!rawStores) {
        localStorage.setItem(
          STORAGE_KEYS.STORES,
          JSON.stringify(createSeedStores())
        );
      } else {
        const parsedStores = JSON.parse(rawStores) as Array<Partial<StoreUnit>>;
        let storeChanged = false;
        let nextCodeNum = 1000;
        parsedStores.forEach((s) => {
          const match = s.storeCode?.match(/LJ-(\d+)/);
          if (match) {
            const val = parseInt(match[1], 10);
            if (val > nextCodeNum) nextCodeNum = val;
          }
        });

        const migratedStores: StoreUnit[] = parsedStores.map((s) => {
          let code = s.storeCode;
          if (!code) {
            nextCodeNum += 1;
            code = `LJ-${nextCodeNum}`;
            storeChanged = true;
          }
          const managerIds = Array.isArray(s.managerIds)
            ? s.managerIds
            : s.managerId
            ? [s.managerId]
            : [];
          if (!Array.isArray(s.managerIds)) storeChanged = true;

          const isOpen = typeof s.isOpen === 'boolean' ? s.isOpen : false;
          if (typeof s.isOpen !== 'boolean') storeChanged = true;

          const alertDurationMinutes =
            typeof s.alertDurationMinutes === 'number' &&
            s.alertDurationMinutes >= 1
              ? s.alertDurationMinutes
              : 20;
          if (typeof s.alertDurationMinutes !== 'number') storeChanged = true;

          const onlineUserIds = Array.isArray(s.onlineUserIds)
            ? s.onlineUserIds
            : [];
          if (!Array.isArray(s.onlineUserIds)) storeChanged = true;

          const validRegions: StoreRegion[] = [
            'Norte',
            'Sul',
            'Leste',
            'Oeste',
            'Centro',
          ];
          const region: StoreRegion =
            s.region && validRegions.includes(s.region)
              ? s.region
              : s.id === 'store-butanta' || s.id === 'store-pinheiros'
              ? 'Oeste'
              : 'Centro';
          if (!s.region) storeChanged = true;

          return {
            id: s.id || this.generateId('store'),
            storeCode: code,
            name: s.name || 'Unidade',
            region,
            address: s.address || '',
            lat: typeof s.lat === 'number' ? s.lat : -23.5878,
            lng: typeof s.lng === 'number' ? s.lng : -46.7525,
            radiusKm: typeof s.radiusKm === 'number' ? s.radiusKm : 2,
            isOpen,
            photoDataUrl: s.photoDataUrl,
            motto: s.motto,
            alertDurationMinutes,
            managerId: s.managerId || managerIds[0] || 'user-gerente1',
            managerIds,
            employeeIds: Array.isArray(s.employeeIds) ? s.employeeIds : [],
            formerEmployees: Array.isArray(s.formerEmployees)
              ? s.formerEmployees
              : [],
            onlineUserIds,
            createdAt: s.createdAt || Date.now(),
            updatedAt: s.updatedAt || Date.now(),
          };
        });

        if (storeChanged) {
          localStorage.setItem(
            STORAGE_KEYS.STORES,
            JSON.stringify(migratedStores)
          );
        }
      }

      // 2b. Fechamentos, Alertas, Catálogo Mestre & Estoque em 3 Camadas
      if (!localStorage.getItem(STORAGE_KEYS.STORE_CLOSINGS)) {
        localStorage.setItem(STORAGE_KEYS.STORE_CLOSINGS, JSON.stringify([]));
      }
      if (!localStorage.getItem(STORAGE_KEYS.CLOSING_ALERTS)) {
        localStorage.setItem(STORAGE_KEYS.CLOSING_ALERTS, JSON.stringify([]));
      }
      if (!localStorage.getItem(STORAGE_KEYS.MASTER_PRODUCTS)) {
        localStorage.setItem(
          STORAGE_KEYS.MASTER_PRODUCTS,
          JSON.stringify(createSeedMasterProducts())
        );
      }
      if (!localStorage.getItem(STORAGE_KEYS.CENTRAL_STOCK)) {
        localStorage.setItem(
          STORAGE_KEYS.CENTRAL_STOCK,
          JSON.stringify(createSeedCentralStock())
        );
      }
      if (!localStorage.getItem(STORAGE_KEYS.OPERATOR_SHIFTS)) {
        localStorage.setItem(STORAGE_KEYS.OPERATOR_SHIFTS, JSON.stringify([]));
      }
      if (!localStorage.getItem(STORAGE_KEYS.ADMIN_ALERTS)) {
        localStorage.setItem(STORAGE_KEYS.ADMIN_ALERTS, JSON.stringify([]));
      }
      if (!localStorage.getItem(STORAGE_KEYS.MERCHANDISE)) {
        localStorage.setItem(
          STORAGE_KEYS.MERCHANDISE,
          JSON.stringify(createSeedMerchandise())
        );
      } else {
        // Garante vínculo de itens v4.2-UI existentes ao Catálogo Mestre v4.3-UI sem apagar dados
        const existingMerch = this.readJson<StoreMerchandiseItem[]>(
          STORAGE_KEYS.MERCHANDISE,
          []
        );
        const masterList = this.readJson<MasterProduct[]>(
          STORAGE_KEYS.MASTER_PRODUCTS,
          createSeedMasterProducts()
        );
        let merchChanged = false;
        let masterChanged = false;
        const nextMerch = existingMerch.map((item) => {
          if (item.masterProductId) return item;
          const byName = masterList.find(
            (mp) =>
              mp.name.trim().toLowerCase() === item.name.trim().toLowerCase()
          );
          if (byName) {
            merchChanged = true;
            return { ...item, masterProductId: byName.id };
          }
          const createdMp: MasterProduct = {
            id: this.generateId('mp'),
            name: item.name,
            photoDataUrl: item.photoDataUrl,
            unitPrice: item.unitPrice,
            createdByUserId: 'user-admin',
            createdAt: item.createdAt || Date.now(),
            updatedAt: Date.now(),
          };
          masterList.push(createdMp);
          masterChanged = true;
          merchChanged = true;
          return { ...item, masterProductId: createdMp.id };
        });
        if (masterChanged) {
          localStorage.setItem(
            STORAGE_KEYS.MASTER_PRODUCTS,
            JSON.stringify(masterList)
          );
        }
        if (merchChanged) {
          localStorage.setItem(
            STORAGE_KEYS.MERCHANDISE,
            JSON.stringify(nextMerch)
          );
        }
      }
      if (!localStorage.getItem(STORAGE_KEYS.STORE_SHIFT_LOGS)) {
        localStorage.setItem(STORAGE_KEYS.STORE_SHIFT_LOGS, JSON.stringify([]));
      }
      if (!localStorage.getItem(STORAGE_KEYS.MESSAGES)) {
        localStorage.setItem(
          STORAGE_KEYS.MESSAGES,
          JSON.stringify(createSeedMessages())
        );
      }
      if (!localStorage.getItem(STORAGE_KEYS.CHAT_ROOMS)) {
        localStorage.setItem(STORAGE_KEYS.CHAT_ROOMS, JSON.stringify([]));
      }
      if (!localStorage.getItem(STORAGE_KEYS.CHAT_MESSAGES)) {
        localStorage.setItem(STORAGE_KEYS.CHAT_MESSAGES, JSON.stringify([]));
      }

      // 3. Categorias & Subcategorias (garante Categoria Principal v4.0)
      const rawCats = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (!rawCats) {
        localStorage.setItem(
          STORAGE_KEYS.CATEGORIES,
          JSON.stringify(createSeedCategories())
        );
      } else {
        const parsedCats = JSON.parse(rawCats) as CatalogCategory[];
        if (
          parsedCats.length > 0 &&
          !parsedCats.some((c) => Boolean(c.isPrimary))
        ) {
          const preferredIdx = parsedCats.findIndex((c) => c.id === 'cat-carro');
          const targetIdx = preferredIdx >= 0 ? preferredIdx : 0;
          const nextCats = parsedCats.map((c, idx) => ({
            ...c,
            isPrimary: idx === targetIdx,
          }));
          localStorage.setItem(
            STORAGE_KEYS.CATEGORIES,
            JSON.stringify(nextCats)
          );
        }
      }
      if (!localStorage.getItem(STORAGE_KEYS.SUBCATEGORIES)) {
        localStorage.setItem(
          STORAGE_KEYS.SUBCATEGORIES,
          JSON.stringify(createSeedSubcategories())
        );
      }

      // 4. Ocorrências (migra lastUpdatedAt, trailPoints e dismissedByUserIds v4.0)
      const rawOccs = localStorage.getItem(STORAGE_KEYS.OCCURRENCES);
      if (!rawOccs) {
        localStorage.setItem(STORAGE_KEYS.OCCURRENCES, JSON.stringify([]));
      } else {
        const parsedOccs = JSON.parse(rawOccs) as Array<Partial<MapOccurrence>>;
        let occChanged = false;
        const migratedOccs: MapOccurrence[] = parsedOccs.map((o) => {
          const durationMinutes =
            typeof o.durationMinutes === 'number' && o.durationMinutes >= 1
              ? o.durationMinutes
              : 20;
          const createdAt = o.createdAt || Date.now();
          const lastUpdatedAt = o.lastUpdatedAt || createdAt;
          const expiresAt =
            typeof o.expiresAt === 'number'
              ? o.expiresAt
              : lastUpdatedAt + durationMinutes * 60 * 1000;
          const trailPoints =
            Array.isArray(o.trailPoints) && o.trailPoints.length > 0
              ? o.trailPoints
              : [
                  {
                    lat: o.lat ?? -23.5878,
                    lng: o.lng ?? -46.7525,
                    timestamp: createdAt,
                  },
                ];
          if (
            typeof o.durationMinutes !== 'number' ||
            typeof o.expiresAt !== 'number' ||
            typeof o.lastUpdatedAt !== 'number' ||
            !Array.isArray(o.trailPoints)
          ) {
            occChanged = true;
          }
          return {
            ...(o as MapOccurrence),
            durationMinutes,
            lastUpdatedAt,
            expiresAt,
            trailPoints,
            dismissedByUserIds: Array.isArray(o.dismissedByUserIds)
              ? o.dismissedByUserIds
              : [],
            bellReadByUserIds: Array.isArray(o.bellReadByUserIds)
              ? o.bellReadByUserIds
              : [],
          };
        });
        if (occChanged) {
          localStorage.setItem(
            STORAGE_KEYS.OCCURRENCES,
            JSON.stringify(migratedOccs)
          );
        }
      }

      // 5. Auditoria de Alertas
      if (!localStorage.getItem(STORAGE_KEYS.ALERT_AUDIT)) {
        const activeOccs = this.readJson<MapOccurrence[]>(
          STORAGE_KEYS.OCCURRENCES,
          []
        );
        const backfillAudit: AlertAuditEntry[] = activeOccs.map((occ) => ({
          id: this.generateId('aud'),
          occurrenceId: occ.id,
          createdAt: occ.createdAt,
          expiresAt: occ.expiresAt,
          storeId: occ.storeId,
          storeName: occ.storeName || 'Área Externa',
          categoryName: occ.categoryName,
          subcategoryName: occ.subcategoryName,
          tag: occ.tag,
          createdByUserId: occ.createdByUserId,
          createdByName: occ.createdByName,
          createdByUsername: occ.createdByUsername,
          status:
            Date.now() >= occ.lastUpdatedAt + OCCURRENCE_MAX_LIFE_MS
              ? 'EXPIRED'
              : 'ACTIVE',
          closedAt:
            Date.now() >= occ.lastUpdatedAt + OCCURRENCE_MAX_LIFE_MS
              ? occ.lastUpdatedAt + OCCURRENCE_MAX_LIFE_MS
              : undefined,
        }));
        localStorage.setItem(
          STORAGE_KEYS.ALERT_AUDIT,
          JSON.stringify(backfillAudit)
        );
      }

      // 6. QA Changelog (saas_mapa_qa_changelog_v1): preserva status validados e incorpora v4.0 + roadmap
      const rawQa = localStorage.getItem(STORAGE_KEYS.QA_CHANGELOG);
      if (!rawQa) {
        localStorage.setItem(
          STORAGE_KEYS.QA_CHANGELOG,
          JSON.stringify(createSeedQaChangelog())
        );
      } else {
        const existingQa = JSON.parse(rawQa) as QaChangelogState;
        let qaChanged = false;
        const nextItems = [...(existingQa.items || [])];

        getV2QaItems().forEach((v2Item) => {
          if (!nextItems.some((item) => item.id === v2Item.id)) {
            nextItems.push(v2Item);
            qaChanged = true;
          }
        });

        getV3QaItems().forEach((v3Item) => {
          if (!nextItems.some((item) => item.id === v3Item.id)) {
            nextItems.push(v3Item);
            qaChanged = true;
          }
        });

        getV31QaItems().forEach((v31Item) => {
          if (!nextItems.some((item) => item.id === v31Item.id)) {
            nextItems.push(v31Item);
            qaChanged = true;
          }
        });

        getV4QaItems().forEach((v4Item) => {
          if (!nextItems.some((item) => item.id === v4Item.id)) {
            nextItems.push(v4Item);
            qaChanged = true;
          }
        });

        getV42QaItems().forEach((v42Item) => {
          if (!nextItems.some((item) => item.id === v42Item.id)) {
            nextItems.push(v42Item);
            qaChanged = true;
          }
        });

        getV43QaItems().forEach((v43Item) => {
          if (!nextItems.some((item) => item.id === v43Item.id)) {
            nextItems.push(v43Item);
            qaChanged = true;
          }
        });

        getV44QaItems().forEach((v44Item) => {
          if (!nextItems.some((item) => item.id === v44Item.id)) {
            nextItems.push(v44Item);
            qaChanged = true;
          }
        });

        getV45QaItems().forEach((v45Item) => {
          if (!nextItems.some((item) => item.id === v45Item.id)) {
            nextItems.push(v45Item);
            qaChanged = true;
          }
        });

        getV50QaItems().forEach((v50Item) => {
          if (!nextItems.some((item) => item.id === v50Item.id)) {
            nextItems.push(v50Item);
            qaChanged = true;
          }
        });

        getRequiredRoadmapItems().forEach((roadItem) => {
          const normalizedTitle = roadItem.title.toLowerCase();
          const alreadyExists = nextItems.some(
            (item) =>
              item.section === 'roadmap' &&
              (item.id === roadItem.id ||
                item.title.toLowerCase() === normalizedTitle ||
                (normalizedTitle.includes('telegram') &&
                  item.title.toLowerCase().includes('telegram')) ||
                (normalizedTitle.includes('whatsapp') &&
                  item.title.toLowerCase().includes('whatsapp')) ||
                (normalizedTitle.includes('firebase') &&
                  item.title.toLowerCase().includes('firebase')) ||
                (normalizedTitle.includes('repositório no github') &&
                  item.title.toLowerCase().includes('repositório no github')) ||
                (normalizedTitle.includes('valuehost') &&
                  item.title.toLowerCase().includes('valuehost')) ||
                (normalizedTitle.includes('salvamento de senha') &&
                  item.title.toLowerCase().includes('salvamento de senha')))
          );
          if (!alreadyExists) {
            nextItems.push(roadItem);
            qaChanged = true;
          }
        });

        let nextVersion = existingQa.version || '1.0';
        if (
          nextVersion === '1.0' ||
          nextVersion === '2.0' ||
          nextVersion === '3.0' ||
          nextVersion === '3.1-UI' ||
          nextVersion === '4.0' ||
          nextVersion === '4.2-UI' ||
          nextVersion === '4.3-UI' ||
          nextVersion === '4.4-Final' ||
          nextVersion === '4.5-RC'
        ) {
          nextVersion = '5.0';
          qaChanged = true;
        }

        const nextReleases = existingQa.releases
          ? [...existingQa.releases]
          : [
              {
                version: '1.0',
                releaseType: 'major' as const,
                summary:
                  'MVP Multi-Organização, Mapa Compartilhado e Radar Piscante',
                releasedAt: Date.now() - 18000000,
              },
            ];

        if (!nextReleases.some((r) => r.version === '2.0')) {
          nextReleases.push({
            version: '2.0',
            releaseType: 'major',
            summary:
              'Login blindado em memória, RBAC de 7 cargos e Painel Administrativo Adaptativo',
            releasedAt: Date.now() - 14400000,
          });
          qaChanged = true;
        }

        if (!nextReleases.some((r) => r.version === '3.0')) {
          nextReleases.push({
            version: '3.0',
            releaseType: 'major',
            summary:
              'StoreId único, Loja Aberta/Fechada, Card com Equipe Online, Tag 10 chars, Cronômetro Regressivo e Auditoria de Alertas',
            releasedAt: Date.now() - 10800000,
          });
          qaChanged = true;
        }

        if (!nextReleases.some((r) => r.version === '3.1-UI')) {
          nextReleases.push({
            version: '3.1-UI',
            releaseType: 'minor',
            summary:
              'Layout Mobile-First com Drawer, OpenStreetMap + GPS automático, Permissões Granulares, Drill-Down por Região, Dashboard de Vendas e Saúde do Sistema',
            releasedAt: Date.now() - 7200000,
          });
          qaChanged = true;
        }

        if (!nextReleases.some((r) => r.version === '4.0')) {
          nextReleases.push({
            version: '4.0',
            releaseType: 'major',
            summary:
              'Dock Inferior Fixo, Zoom por Toque, Mensagens da Equipe, Campainha Raio+5km, Rastreamento Colaborativo em 3 Fases ("Eu vi!" / Sombra / Projeção 1h) e Árvore Hierárquica Executiva',
            releasedAt: Date.now() - 3600000,
          });
          qaChanged = true;
        }

        if (!nextReleases.some((r) => r.version === '4.2-UI')) {
          nextReleases.push({
            version: '4.2-UI',
            releaseType: 'minor',
            summary:
              'Bolinha flutuante de saída rápida (Destruir Sessão), Opções da Loja com equipe ativa/ex-funcionários e mercadorias, Fechamento Dinheiro+Pix e Conferência Gerente -> Governador -> Presidente',
            releasedAt: Date.now() - 1800000,
          });
          qaChanged = true;
        }

        if (!nextReleases.some((r) => r.version === '4.3-UI')) {
          nextReleases.push({
            version: '4.3-UI',
            releaseType: 'minor',
            summary:
              'Catálogo Mestre restrito (Super Admin/Presidente), Estoque em 3 Camadas, Permissões de Estoque por Operador, Abertura com Retirada de Carga e Painel Financeiro & Vendas em Tempo Real',
            releasedAt: Date.now() - 900000,
          });
          qaChanged = true;
        }

        if (!nextReleases.some((r) => r.version === '4.4-Final')) {
          nextReleases.push({
            version: '4.4-Final',
            releaseType: 'minor',
            summary:
              'Bloqueio Anti-Espião (Visibility API), Saneamento da Campainha do Mapa, Salas de Chat Hierárquicas/Autodestrutivas, Chat Super Secreto em Memória (Presidente) e Auditoria Silenciosa .TXT',
            releasedAt: Date.now() - 300000,
          });
          qaChanged = true;
        }

        if (!nextReleases.some((r) => r.version === '4.5-RC')) {
          nextReleases.push({
            version: '4.5-RC',
            releaseType: 'minor',
            summary:
              'Saída instantânea em 1 toque no cadeado flutuante, Chat & Mensagens global unificado no Drawer e Estoque Atual por Zona de SP com semáforo e vendas do dia',
            releasedAt: Date.now() - 60000,
          });
          qaChanged = true;
        }

        if (!nextReleases.some((r) => r.version === '5.0')) {
          nextReleases.push({
            version: '5.0',
            releaseType: 'major',
            summary:
              'v5.0 (Major): Início da fase de Conectividade — Pipeline CI/CD via GitHub Actions com deploy FTP automatizado, build estático Vite otimizado e correção de segurança no botão de cadeado (modal de confirmação + redirecionamento externo para Google).',
            releasedAt: Date.now(),
          });
          qaChanged = true;
        }

        if (qaChanged) {
          localStorage.setItem(
            STORAGE_KEYS.QA_CHANGELOG,
            JSON.stringify({
              ...existingQa,
              version: nextVersion,
              items: nextItems,
              releases: nextReleases,
            })
          );
        }
      }
    } catch {
      // Ignora erro caso localStorage esteja indisponível
    }
  }

  private readJson<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private writeJson<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  private generateId(prefix: string): string {
    if (
      typeof crypto !== 'undefined' &&
      typeof crypto.randomUUID === 'function'
    ) {
      return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
    }
    return `${prefix}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
  }

  private generateUserCode(existingUsers: UserAccount[]): string {
    let maxNum = 300;
    existingUsers.forEach((u) => {
      const match = u.userCode.match(/USR-(\d+)/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (val > maxNum) maxNum = val;
      }
    });
    return `USR-${String(maxNum + 1).padStart(4, '0')}`;
  }

  private emitUsers(): void {
    const data = this.readJson<UserAccount[]>(
      STORAGE_KEYS.USERS,
      createSeedUsers()
    );
    this.userListeners.forEach((cb) => cb(data));
    this.emitSession();
  }

  private emitStores(): void {
    const data = this.readJson<StoreUnit[]>(
      STORAGE_KEYS.STORES,
      createSeedStores()
    );
    this.storeListeners.forEach((cb) => cb(data));
  }

  private emitStoreClosings(): void {
    const data = this.readJson<StoreClosingRecord[]>(
      STORAGE_KEYS.STORE_CLOSINGS,
      []
    );
    this.storeClosingListeners.forEach((cb) => cb(data));
  }

  private emitClosingAlerts(): void {
    const data = this.readJson<ClosingAlertNotification[]>(
      STORAGE_KEYS.CLOSING_ALERTS,
      []
    );
    this.closingAlertListeners.forEach((cb) => cb(data));
  }

  private emitMerchandise(): void {
    const data = this.readJson<StoreMerchandiseItem[]>(
      STORAGE_KEYS.MERCHANDISE,
      createSeedMerchandise()
    );
    this.merchandiseListeners.forEach((cb) => cb(data));
  }

  private emitMasterProducts(): void {
    const data = this.readJson<MasterProduct[]>(
      STORAGE_KEYS.MASTER_PRODUCTS,
      createSeedMasterProducts()
    );
    this.masterProductListeners.forEach((cb) => cb(data));
  }

  private emitCentralStock(): void {
    const data = this.readJson<CentralStockEntry[]>(
      STORAGE_KEYS.CENTRAL_STOCK,
      createSeedCentralStock()
    );
    this.centralStockListeners.forEach((cb) => cb(data));
  }

  private emitOperatorShifts(): void {
    const data = this.readJson<OperatorShiftInventory[]>(
      STORAGE_KEYS.OPERATOR_SHIFTS,
      []
    );
    this.operatorShiftListeners.forEach((cb) => cb(data));
  }

  private emitAdminAlerts(): void {
    const data = this.readJson<AdminFinanceAlert[]>(
      STORAGE_KEYS.ADMIN_ALERTS,
      []
    );
    this.adminAlertListeners.forEach((cb) => cb(data));
  }

  private emitShiftLogs(): void {
    const data = this.readJson<StoreShiftLog[]>(
      STORAGE_KEYS.STORE_SHIFT_LOGS,
      []
    );
    this.shiftLogListeners.forEach((cb) => cb(data));
  }

  private emitMessages(): void {
    const data = this.readJson<TeamMessage[]>(
      STORAGE_KEYS.MESSAGES,
      createSeedMessages()
    );
    this.messageListeners.forEach((cb) => cb(data));
  }

  private getAllChatRoomsSync(): ChatRoom[] {
    const persisted = this.readJson<ChatRoom[]>(STORAGE_KEYS.CHAT_ROOMS, []);
    const secret = Array.from(this.secretChatRooms.values());
    return [...secret, ...persisted].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  private getAllChatMessagesSync(): ChatMessage[] {
    const persisted = this.readJson<ChatMessage[]>(
      STORAGE_KEYS.CHAT_MESSAGES,
      []
    );
    const secret: ChatMessage[] = [];
    this.secretChatMessages.forEach((list) => {
      secret.push(...list);
    });
    return [...persisted, ...secret].sort((a, b) => a.createdAt - b.createdAt);
  }

  private emitChatRooms(): void {
    const data = this.getAllChatRoomsSync();
    this.chatRoomListeners.forEach((cb) => cb(data));
  }

  private emitChatMessages(): void {
    const data = this.getAllChatMessagesSync();
    this.chatMessageListeners.forEach((cb) => cb(data));
  }

  private emitCategories(): void {
    const data = this.readJson<CatalogCategory[]>(
      STORAGE_KEYS.CATEGORIES,
      createSeedCategories()
    );
    this.categoryListeners.forEach((cb) => cb(data));
  }

  private emitSubcategories(): void {
    const data = this.readJson<CatalogSubcategory[]>(
      STORAGE_KEYS.SUBCATEGORIES,
      createSeedSubcategories()
    );
    this.subcategoryListeners.forEach((cb) => cb(data));
  }

  private emitOccurrences(): void {
    const data = this.readJson<MapOccurrence[]>(STORAGE_KEYS.OCCURRENCES, []);
    this.occurrenceListeners.forEach((cb) => cb(data));
  }

  private emitAlertAudit(): void {
    const data = this.readJson<AlertAuditEntry[]>(
      STORAGE_KEYS.ALERT_AUDIT,
      []
    );
    this.alertAuditListeners.forEach((cb) => cb(data));
  }

  private emitSession(): void {
    const user = this.getSessionUserSync();
    this.sessionListeners.forEach((cb) => cb(user));
  }

  private emitQuickTestMode(): void {
    this.quickTestListeners.forEach((cb) => cb(this.isQuickTestSession));
  }

  private emitOnlineVisibility(): void {
    this.visibilityListeners.forEach((cb) => cb(this.isHighMgmtOnlineVisible));
  }

  private emitQaChangelog(): void {
    const data = this.readJson<QaChangelogState>(
      STORAGE_KEYS.QA_CHANGELOG,
      createSeedQaChangelog()
    );
    this.qaListeners.forEach((cb) => cb(data));
  }

  private getSessionUserSync(): UserAccount | null {
    if (!this.currentSessionUserId) return null;
    const users = this.readJson<UserAccount[]>(
      STORAGE_KEYS.USERS,
      createSeedUsers()
    );
    return users.find((u) => u.id === this.currentSessionUserId) || null;
  }

  private removeUserFromAllStoresOnline(userId: string, emit = true): void {
    const stores = this.readJson<StoreUnit[]>(
      STORAGE_KEYS.STORES,
      createSeedStores()
    );
    let changed = false;
    const next = stores.map((s) => {
      if (!s.onlineUserIds?.includes(userId)) return s;
      changed = true;
      return {
        ...s,
        onlineUserIds: s.onlineUserIds.filter((id) => id !== userId),
      };
    });
    if (changed) {
      this.writeJson(STORAGE_KEYS.STORES, next);
      if (emit) this.emitStores();
    }
  }

  private syncUserOnlinePresenceOnStores(
    user: UserAccount,
    visible: boolean
  ): void {
    const stores = this.readJson<StoreUnit[]>(
      STORAGE_KEYS.STORES,
      createSeedStores()
    );
    const hasExplicitLinks = stores.some((s) => isUserLinkedToStore(user.id, s));

    const next = stores.map((s) => {
      const currentOnline = s.onlineUserIds || [];
      const shouldAppear =
        visible &&
        (isUserLinkedToStore(user.id, s) ||
          (user.role === 'SUPER_ADMIN' && !hasExplicitLinks));

      if (shouldAppear && !currentOnline.includes(user.id)) {
        return { ...s, onlineUserIds: [...currentOnline, user.id] };
      }
      if (!shouldAppear && currentOnline.includes(user.id)) {
        return {
          ...s,
          onlineUserIds: currentOnline.filter((id) => id !== user.id),
        };
      }
      return s;
    });

    this.writeJson(STORAGE_KEYS.STORES, next);
    this.emitStores();
  }

  // ==========================================================
  // AUTENTICAÇÃO, SESSÃO & PRESENÇA ONLINE
  // ==========================================================

  async login(username: string, password: string): Promise<UserAccount> {
    this.ensureSeededAndMigrated();
    const normalized = username.trim().toLowerCase();
    const users = await this.getUsers();
    const found = users.find(
      (u) => u.username.toLowerCase() === normalized && u.password === password
    );
    if (!found) {
      throw new Error('Usuário ou senha inválidos.');
    }
    if (found.isBlocked) {
      throw new Error(
        'Usuário bloqueado pela administração. Procure seu gestor.'
      );
    }

    if (this.currentSessionUserId && this.currentSessionUserId !== found.id) {
      this.removeUserFromAllStoresOnline(this.currentSessionUserId, false);
    }

    this.currentSessionUserId = found.id;
    this.isQuickTestSession = false;

    // Regra v3.0/v3.1-UI: Gerente+ começa invisível; operacionais ficam online somente se vinculados a alguma loja
    if (ROLE_LEVEL[found.role] <= 4) {
      this.isHighMgmtOnlineVisible = false;
      this.syncUserOnlinePresenceOnStores(found, false);
    } else {
      this.isHighMgmtOnlineVisible = true;
      this.syncUserOnlinePresenceOnStores(found, true);
    }

    this.emitQuickTestMode();
    this.emitOnlineVisibility();
    this.emitSession();
    return found;
  }

  /**
   * Botão temporário de Teste (v3.1-UI): Login imediato como Super Admin sem digitar senha
   */
  async loginAsTestSuperAdmin(): Promise<UserAccount> {
    this.ensureSeededAndMigrated();
    const users = await this.getUsers();
    const admin =
      users.find((u) => u.id === 'user-admin') ||
      users.find((u) => u.role === 'SUPER_ADMIN');
    if (!admin) {
      throw new Error('Conta Super Admin não encontrada.');
    }

    if (this.currentSessionUserId && this.currentSessionUserId !== admin.id) {
      this.removeUserFromAllStoresOnline(this.currentSessionUserId, false);
    }

    this.currentSessionUserId = admin.id;
    this.isQuickTestSession = true;
    this.isHighMgmtOnlineVisible = false;
    this.syncUserOnlinePresenceOnStores(admin, false);
    this.emitQuickTestMode();
    this.emitOnlineVisibility();
    this.emitSession();
    return admin;
  }

  subscribeToQuickTestMode(callback: Listener<boolean>): () => void {
    this.quickTestListeners.add(callback);
    callback(this.isQuickTestSession);
    return () => {
      this.quickTestListeners.delete(callback);
    };
  }

  async verifySessionPassword(password: string): Promise<boolean> {
    const user = this.getSessionUserSync();
    if (!user) return false;
    return user.password === password;
  }

  async logout(): Promise<void> {
    if (this.currentSessionUserId) {
      this.removeUserFromAllStoresOnline(this.currentSessionUserId, true);
    }
    this.currentSessionUserId = null;
    this.isQuickTestSession = false;
    this.isHighMgmtOnlineVisible = false;
    this.secretChatRooms.clear();
    this.secretChatMessages.clear();
    this.emitChatRooms();
    this.emitChatMessages();
    this.emitQuickTestMode();
    this.emitOnlineVisibility();
    this.emitSession();
  }

  /**
   * v5.0: Saída segura com limpeza de sessão em memória, chaves de sessão no localStorage,
   * sessionStorage e cookies locais do domínio, preservando dados locais de lojas, veículos e configurações.
   */
  destroySessionQuickExit(): void {
    if (this.currentSessionUserId) {
      this.removeUserFromAllStoresOnline(this.currentSessionUserId, false);
    }
    this.currentSessionUserId = null;
    this.isQuickTestSession = false;
    this.isHighMgmtOnlineVisible = false;
    this.secretChatRooms.clear();
    this.secretChatMessages.clear();

    try {
      localStorage.removeItem(STORAGE_KEYS.LEGACY_SESSION_KEY);
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        const lower = key.toLowerCase();
        if (
          lower.includes('session') ||
          lower.includes('auth_token') ||
          lower.includes('active_user')
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch {
      // Ignora caso bloqueado
    }

    try {
      sessionStorage.clear();
    } catch {
      // Ignora caso bloqueado
    }

    try {
      if (typeof document !== 'undefined' && document.cookie) {
        const cookies = document.cookie.split(';');
        for (const rawCookie of cookies) {
          const eqPos = rawCookie.indexOf('=');
          const name = (
            eqPos > -1 ? rawCookie.slice(0, eqPos) : rawCookie
          ).trim();
          if (name) {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
          }
        }
      }
    } catch {
      // Ignora caso bloqueado
    }

    this.emitChatRooms();
    this.emitChatMessages();
    this.emitQuickTestMode();
    this.emitOnlineVisibility();
    this.emitSession();
  }

  async setHighManagementOnlineVisibility(visible: boolean): Promise<void> {
    const user = this.getSessionUserSync();
    if (!user) return;
    this.isHighMgmtOnlineVisible = visible;
    this.syncUserOnlinePresenceOnStores(user, visible);
    this.emitOnlineVisibility();
  }

  async setUserPublicProfile(isPublic: boolean): Promise<void> {
    const user = this.getSessionUserSync();
    if (!user) return;
    const users = await this.getUsers();
    const next = users.map((u) =>
      u.id === user.id
        ? { ...u, isPublicProfile: isPublic, updatedAt: Date.now() }
        : u
    );
    this.writeJson(STORAGE_KEYS.USERS, next);
    this.emitUsers();
  }

  subscribeToSession(callback: Listener<UserAccount | null>): () => void {
    this.ensureSeededAndMigrated();
    this.sessionListeners.add(callback);
    callback(this.getSessionUserSync());
    return () => {
      this.sessionListeners.delete(callback);
    };
  }

  subscribeToOnlineVisibility(callback: Listener<boolean>): () => void {
    this.visibilityListeners.add(callback);
    callback(this.isHighMgmtOnlineVisible);
    return () => {
      this.visibilityListeners.delete(callback);
    };
  }

  // ==========================================================
  // USUÁRIOS & RBAC (7 NÍVEIS, PERMISSÕES GRANULARES, CHAVE ÚNICA)
  // ==========================================================

  async getUsers(): Promise<UserAccount[]> {
    this.ensureSeededAndMigrated();
    return this.readJson<UserAccount[]>(
      STORAGE_KEYS.USERS,
      createSeedUsers()
    );
  }

  subscribeToUsers(callback: Listener<UserAccount[]>): () => void {
    this.ensureSeededAndMigrated();
    this.userListeners.add(callback);
    callback(this.readJson(STORAGE_KEYS.USERS, createSeedUsers()));
    return () => {
      this.userListeners.delete(callback);
    };
  }

  async findUserForLinking(
    query: string,
    actorUser: UserAccount
  ): Promise<UserAccount | null> {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const users = await this.getUsers();
    const match = users.find(
      (u) =>
        u.username.toLowerCase() === q ||
        u.userCode.toLowerCase() === q ||
        u.id.toLowerCase() === q
    );
    if (!match) return null;
    if (!canViewTargetUserHierarchy(actorUser, match)) {
      return null;
    }
    if (!canManageTargetUser(actorUser.role, match.role)) {
      throw new Error(
        'Você só pode vincular usuários do seu cargo ou inferiores.'
      );
    }
    return match;
  }

  async createUserAndLinkStores(input: {
    name: string;
    username: string;
    password: string;
    role: UserRole;
    permissions?: UserPermissions;
    region?: StoreRegion;
    avatarDataUrl?: string;
    createdByUserId: string;
    actorRole: UserRole;
    storeIds?: string[];
  }): Promise<UserAccount> {
    if (!canManageTargetUser(input.actorRole, input.role)) {
      throw new Error(
        'Permissão negada: escolha um cargo igual ou inferior ao seu.'
      );
    }

    const users = await this.getUsers();
    const normalizedUsername = input.username.trim().toLowerCase();
    if (!normalizedUsername || !input.name.trim() || !input.password) {
      throw new Error('Preencha nome, usuário e senha inicial.');
    }
    if (users.some((u) => u.username.toLowerCase() === normalizedUsername)) {
      throw new Error(
        'Usuário já existe na base global. Use "Vincular usuário existente".'
      );
    }

    const now = Date.now();
    const newUser: UserAccount = {
      id: this.generateId('usr'),
      userCode: this.generateUserCode(users),
      name: input.name.trim(),
      username: normalizedUsername,
      password: input.password,
      role: input.role,
      permissions: input.permissions || getDefaultPermissionsForRole(input.role),
      isBlocked: false,
      isPublicProfile: false,
      region: input.region,
      avatarDataUrl: input.avatarDataUrl,
      createdByUserId: input.createdByUserId,
      createdAt: now,
      updatedAt: now,
    };

    this.writeJson(STORAGE_KEYS.USERS, [...users, newUser]);

    const targetStoreIds = input.storeIds || [];
    if (targetStoreIds.length > 0) {
      const stores = await this.getStores();
      const isManagerLevel = ROLE_LEVEL[newUser.role] <= 4;
      const updatedStores = stores.map((store) => {
        if (!targetStoreIds.includes(store.id)) return store;
        if (isManagerLevel) {
          return {
            ...store,
            managerIds: Array.from(
              new Set([...(store.managerIds || []), newUser.id])
            ),
            updatedAt: Date.now(),
          };
        }
        return {
          ...store,
          employeeIds: Array.from(new Set([...store.employeeIds, newUser.id])),
          updatedAt: Date.now(),
        };
      });
      this.writeJson(STORAGE_KEYS.STORES, updatedStores);
      this.emitStores();
    }

    this.emitUsers();
    return newUser;
  }

  async updateManagedUser(
    userId: string,
    updates: {
      name?: string;
      role?: UserRole;
      permissions?: UserPermissions;
      region?: StoreRegion;
      avatarDataUrl?: string;
      isBlocked?: boolean;
    },
    actorRole: UserRole
  ): Promise<UserAccount> {
    const users = await this.getUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error('Usuário não encontrado.');
    const target = users[idx];

    if (!canManageTargetUser(actorRole, target.role)) {
      throw new Error('Sem permissão para editar este cargo.');
    }
    if (updates.role && !canManageTargetUser(actorRole, updates.role)) {
      throw new Error('Sem permissão para atribuir este cargo.');
    }

    const updated: UserAccount = {
      ...target,
      name: updates.name !== undefined ? updates.name.trim() : target.name,
      role: updates.role ?? target.role,
      permissions: updates.permissions ?? target.permissions,
      region: updates.region !== undefined ? updates.region : target.region,
      avatarDataUrl:
        updates.avatarDataUrl !== undefined
          ? updates.avatarDataUrl
          : target.avatarDataUrl,
      isBlocked:
        updates.isBlocked !== undefined ? updates.isBlocked : target.isBlocked,
      updatedAt: Date.now(),
    };
    const next = [...users];
    next[idx] = updated;
    this.writeJson(STORAGE_KEYS.USERS, next);

    if (updated.isBlocked) {
      this.removeUserFromAllStoresOnline(updated.id, true);
    }

    this.emitUsers();
    return updated;
  }

  async toggleUserBlocked(
    userId: string,
    isBlocked: boolean,
    actor: UserAccount
  ): Promise<UserAccount> {
    if (userId === actor.id) {
      throw new Error('Você não pode bloquear sua própria conta.');
    }
    return this.updateManagedUser(userId, { isBlocked }, actor.role);
  }

  async resetUserPassword(
    userId: string,
    newPassword: string,
    actorRole: UserRole
  ): Promise<void> {
    if (!newPassword.trim()) {
      throw new Error('Informe uma nova senha válida.');
    }
    const users = await this.getUsers();
    const target = users.find((u) => u.id === userId);
    if (!target) throw new Error('Usuário não encontrado.');
    if (!canManageTargetUser(actorRole, target.role)) {
      throw new Error(
        'Sem permissão para redefinir a senha deste usuário.'
      );
    }
    const next = users.map((u) =>
      u.id === userId
        ? { ...u, password: newPassword, updatedAt: Date.now() }
        : u
    );
    this.writeJson(STORAGE_KEYS.USERS, next);
    this.emitUsers();
  }

  async deleteUser(userId: string, actorRole: UserRole): Promise<void> {
    const users = await this.getUsers();
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    if (target.id === this.currentSessionUserId) {
      throw new Error('Você não pode excluir sua própria conta logada.');
    }
    if (!canManageTargetUser(actorRole, target.role)) {
      throw new Error('Sem permissão para excluir este usuário.');
    }
    this.writeJson(
      STORAGE_KEYS.USERS,
      users.filter((u) => u.id !== userId)
    );
    const stores = await this.getStores();
    const cleanedStores = stores.map((s) => {
      const wasLinked = isUserLinkedToStore(userId, s);
      const nextFormer = [...(s.formerEmployees || [])];
      if (wasLinked && !nextFormer.some((f) => f.userId === target.id)) {
        nextFormer.unshift({
          userId: target.id,
          userCode: target.userCode,
          name: target.name,
          unlinkedAt: Date.now(),
        });
      }
      return {
        ...s,
        managerIds: (s.managerIds || []).filter((mid) => mid !== userId),
        employeeIds: s.employeeIds.filter((eid) => eid !== userId),
        formerEmployees: nextFormer,
        onlineUserIds: (s.onlineUserIds || []).filter((oid) => oid !== userId),
      };
    });
    this.writeJson(STORAGE_KEYS.STORES, cleanedStores);
    this.emitUsers();
    this.emitStores();
  }

  // ==========================================================
  // LOJAS / UNIDADES FIXAS & FECHAMENTOS (VENDAS DO DIA)
  // ==========================================================

  async getStores(): Promise<StoreUnit[]> {
    this.ensureSeededAndMigrated();
    return this.readJson<StoreUnit[]>(STORAGE_KEYS.STORES, createSeedStores());
  }

  subscribeToStores(callback: Listener<StoreUnit[]>): () => void {
    this.ensureSeededAndMigrated();
    this.storeListeners.add(callback);
    callback(this.readJson(STORAGE_KEYS.STORES, createSeedStores()));
    return () => {
      this.storeListeners.delete(callback);
    };
  }

  async getStoreClosings(): Promise<StoreClosingRecord[]> {
    this.ensureSeededAndMigrated();
    return this.readJson<StoreClosingRecord[]>(
      STORAGE_KEYS.STORE_CLOSINGS,
      []
    );
  }

  subscribeToStoreClosings(
    callback: Listener<StoreClosingRecord[]>
  ): () => void {
    this.ensureSeededAndMigrated();
    this.storeClosingListeners.add(callback);
    callback(this.readJson(STORAGE_KEYS.STORE_CLOSINGS, []));
    return () => {
      this.storeClosingListeners.delete(callback);
    };
  }

  async getClosingAlerts(): Promise<ClosingAlertNotification[]> {
    this.ensureSeededAndMigrated();
    return this.readJson<ClosingAlertNotification[]>(
      STORAGE_KEYS.CLOSING_ALERTS,
      []
    );
  }

  subscribeToClosingAlerts(
    callback: Listener<ClosingAlertNotification[]>
  ): () => void {
    this.ensureSeededAndMigrated();
    this.closingAlertListeners.add(callback);
    callback(this.readJson(STORAGE_KEYS.CLOSING_ALERTS, []));
    return () => {
      this.closingAlertListeners.delete(callback);
    };
  }

  async markClosingAlertRead(alertId: string, userId: string): Promise<void> {
    const list = await this.getClosingAlerts();
    let changed = false;
    const next = list.map((al) => {
      if (al.id !== alertId) return al;
      if (al.readByUserIds.includes(userId)) return al;
      changed = true;
      return { ...al, readByUserIds: [...al.readByUserIds, userId] };
    });
    if (changed) {
      this.writeJson(STORAGE_KEYS.CLOSING_ALERTS, next);
      this.emitClosingAlerts();
    }
  }

  // ==========================================================
  // CATÁLOGO MESTRE DE PRODUTOS & ESTOQUE EM 3 CAMADAS (v4.3-UI)
  // ==========================================================

  async getMasterProducts(): Promise<MasterProduct[]> {
    this.ensureSeededAndMigrated();
    return this.readJson<MasterProduct[]>(
      STORAGE_KEYS.MASTER_PRODUCTS,
      createSeedMasterProducts()
    );
  }

  subscribeToMasterProducts(callback: Listener<MasterProduct[]>): () => void {
    this.ensureSeededAndMigrated();
    this.masterProductListeners.add(callback);
    callback(
      this.readJson<MasterProduct[]>(
        STORAGE_KEYS.MASTER_PRODUCTS,
        createSeedMasterProducts()
      )
    );
    return () => {
      this.masterProductListeners.delete(callback);
    };
  }

  async addMasterProduct(
    input: {
      name: string;
      photoDataUrl?: string;
      unitPrice: number;
    },
    actor: UserAccount
  ): Promise<MasterProduct> {
    if (!canCreateMasterProduct(actor.role)) {
      throw new Error(
        'Apenas Super Admin ou Presidente podem criar novos produtos no Catálogo Mestre.'
      );
    }
    const cleanName = input.name.trim();
    if (!cleanName) throw new Error('Informe o nome do produto.');
    const list = await this.getMasterProducts();
    const now = Date.now();
    const created: MasterProduct = {
      id: this.generateId('mp'),
      name: cleanName,
      photoDataUrl: input.photoDataUrl?.trim() || undefined,
      unitPrice: Math.max(0, Number(input.unitPrice || 0)),
      createdByUserId: actor.id,
      createdAt: now,
      updatedAt: now,
    };
    this.writeJson(STORAGE_KEYS.MASTER_PRODUCTS, [created, ...list]);
    this.emitMasterProducts();
    return created;
  }

  async updateMasterProduct(
    productId: string,
    updates: Partial<
      Omit<MasterProduct, 'id' | 'createdByUserId' | 'createdAt'>
    >,
    actorRole: UserRole
  ): Promise<MasterProduct> {
    if (!canCreateMasterProduct(actorRole)) {
      throw new Error(
        'Apenas Super Admin ou Presidente podem editar produtos do Catálogo Mestre.'
      );
    }
    const list = await this.getMasterProducts();
    const idx = list.findIndex((p) => p.id === productId);
    if (idx === -1) throw new Error('Produto mestre não encontrado.');

    const now = Date.now();
    const updated: MasterProduct = {
      ...list[idx],
      ...updates,
      name:
        updates.name !== undefined ? updates.name.trim() : list[idx].name,
      unitPrice:
        updates.unitPrice !== undefined
          ? Math.max(0, Number(updates.unitPrice))
          : list[idx].unitPrice,
      updatedAt: now,
    };
    const next = [...list];
    next[idx] = updated;
    this.writeJson(STORAGE_KEYS.MASTER_PRODUCTS, next);
    this.emitMasterProducts();

    // Sincroniza nome/foto/preço nos estoques das lojas que referenciam este produto mestre
    const merch = await this.getMerchandise();
    let merchChanged = false;
    const syncedMerch = merch.map((m) => {
      if (m.masterProductId !== productId) return m;
      merchChanged = true;
      return {
        ...m,
        name: updated.name,
        photoDataUrl: updated.photoDataUrl,
        unitPrice: updated.unitPrice,
        updatedAt: now,
      };
    });
    if (merchChanged) {
      this.writeJson(STORAGE_KEYS.MERCHANDISE, syncedMerch);
      this.emitMerchandise();
    }

    return updated;
  }

  async deleteMasterProduct(
    productId: string,
    actorRole: UserRole
  ): Promise<void> {
    if (!canCreateMasterProduct(actorRole)) {
      throw new Error(
        'Apenas Super Admin ou Presidente podem excluir produtos do Catálogo Mestre.'
      );
    }
    const list = await this.getMasterProducts();
    this.writeJson(
      STORAGE_KEYS.MASTER_PRODUCTS,
      list.filter((p) => p.id !== productId)
    );
    const central = await this.getCentralStock();
    this.writeJson(
      STORAGE_KEYS.CENTRAL_STOCK,
      central.filter((c) => c.masterProductId !== productId)
    );
    this.emitMasterProducts();
    this.emitCentralStock();
  }

  // Camada 1.5: Estoque Central (Governador e Gerente+)
  async getCentralStock(): Promise<CentralStockEntry[]> {
    this.ensureSeededAndMigrated();
    return this.readJson<CentralStockEntry[]>(
      STORAGE_KEYS.CENTRAL_STOCK,
      createSeedCentralStock()
    );
  }

  subscribeToCentralStock(
    callback: Listener<CentralStockEntry[]>
  ): () => void {
    this.ensureSeededAndMigrated();
    this.centralStockListeners.add(callback);
    callback(
      this.readJson<CentralStockEntry[]>(
        STORAGE_KEYS.CENTRAL_STOCK,
        createSeedCentralStock()
      )
    );
    return () => {
      this.centralStockListeners.delete(callback);
    };
  }

  async upsertCentralStock(
    masterProductId: string,
    quantity: number,
    mode: 'ADD' | 'SET',
    actor: UserAccount
  ): Promise<CentralStockEntry> {
    if (!canManageCentralStock(actor.role)) {
      throw new Error(
        'Apenas Gerente, Governador, Presidente ou Super Admin podem abastecer o Estoque Central.'
      );
    }
    const masters = await this.getMasterProducts();
    if (!masters.some((m) => m.id === masterProductId)) {
      throw new Error(
        'Produto não encontrado no Catálogo Mestre. Apenas Super Admin ou Presidente criam produtos novos.'
      );
    }
    const cleanQty = Math.max(0, Math.round(quantity || 0));
    const list = await this.getCentralStock();
    const idx = list.findIndex(
      (c) =>
        c.ownerUserId === actor.id && c.masterProductId === masterProductId
    );
    const now = Date.now();
    if (idx >= 0) {
      const nextQty =
        mode === 'ADD' ? list[idx].quantity + cleanQty : cleanQty;
      const updated: CentralStockEntry = {
        ...list[idx],
        ownerName: actor.name,
        ownerRole: actor.role,
        quantity: Math.max(0, nextQty),
        updatedAt: now,
      };
      const nextList = [...list];
      nextList[idx] = updated;
      this.writeJson(STORAGE_KEYS.CENTRAL_STOCK, nextList);
      this.emitCentralStock();
      return updated;
    }

    const created: CentralStockEntry = {
      id: this.generateId('cs'),
      ownerUserId: actor.id,
      ownerName: actor.name,
      ownerRole: actor.role,
      masterProductId,
      quantity: cleanQty,
      updatedAt: now,
    };
    this.writeJson(STORAGE_KEYS.CENTRAL_STOCK, [created, ...list]);
    this.emitCentralStock();
    return created;
  }

  async allocateCentralStockToStore(
    storeId: string,
    masterProductId: string,
    quantity: number,
    actor: UserAccount
  ): Promise<StoreMerchandiseItem> {
    if (!canManageCentralStock(actor.role)) {
      throw new Error(
        'Apenas Gerente ou cargos superiores podem alocar estoque para lojas.'
      );
    }
    const cleanQty = Math.round(quantity || 0);
    if (cleanQty <= 0) {
      throw new Error('Informe uma quantidade maior que zero para alocar.');
    }

    const masters = await this.getMasterProducts();
    const master = masters.find((m) => m.id === masterProductId);
    if (!master) {
      throw new Error(
        'Produto inexistente no Catálogo Mestre. Apenas Presidente/Super Admin podem criar produtos novos.'
      );
    }

    const central = await this.getCentralStock();
    const entryIdx = central.findIndex(
      (c) =>
        c.ownerUserId === actor.id && c.masterProductId === masterProductId
    );
    if (entryIdx === -1 || central[entryIdx].quantity < cleanQty) {
      throw new Error(
        'Saldo insuficiente no seu Estoque Central. Adicione mais unidades ao seu Estoque Central primeiro.'
      );
    }

    const now = Date.now();
    const nextCentral = [...central];
    nextCentral[entryIdx] = {
      ...nextCentral[entryIdx],
      quantity: nextCentral[entryIdx].quantity - cleanQty,
      updatedAt: now,
    };
    this.writeJson(STORAGE_KEYS.CENTRAL_STOCK, nextCentral);
    this.emitCentralStock();

    // Soma ou cria na Camada 2 (Estoque da Loja)
    const merch = await this.getMerchandise();
    const storeItemIdx = merch.findIndex(
      (m) => m.storeId === storeId && m.masterProductId === masterProductId
    );
    if (storeItemIdx >= 0) {
      const updatedItem: StoreMerchandiseItem = {
        ...merch[storeItemIdx],
        name: master.name,
        photoDataUrl: master.photoDataUrl,
        unitPrice: master.unitPrice,
        stockQuantity: merch[storeItemIdx].stockQuantity + cleanQty,
        updatedAt: now,
      };
      const nextMerch = [...merch];
      nextMerch[storeItemIdx] = updatedItem;
      this.writeJson(STORAGE_KEYS.MERCHANDISE, nextMerch);
      this.emitMerchandise();
      return updatedItem;
    }

    const createdItem: StoreMerchandiseItem = {
      id: this.generateId('merc'),
      storeId,
      masterProductId: master.id,
      name: master.name,
      photoDataUrl: master.photoDataUrl,
      stockQuantity: cleanQty,
      unitPrice: master.unitPrice,
      createdAt: now,
      updatedAt: now,
    };
    this.writeJson(STORAGE_KEYS.MERCHANDISE, [createdItem, ...merch]);
    this.emitMerchandise();
    return createdItem;
  }

  // ==========================================================
  // CATÁLOGO DE MERCADORIAS DA LOJA (CAMADA 2)
  // ==========================================================

  async getMerchandise(): Promise<StoreMerchandiseItem[]> {
    this.ensureSeededAndMigrated();
    return this.readJson<StoreMerchandiseItem[]>(
      STORAGE_KEYS.MERCHANDISE,
      createSeedMerchandise()
    );
  }

  subscribeToMerchandise(
    callback: Listener<StoreMerchandiseItem[]>
  ): () => void {
    this.ensureSeededAndMigrated();
    this.merchandiseListeners.add(callback);
    callback(
      this.readJson<StoreMerchandiseItem[]>(
        STORAGE_KEYS.MERCHANDISE,
        createSeedMerchandise()
      )
    );
    return () => {
      this.merchandiseListeners.delete(callback);
    };
  }

  async addMerchandiseItem(
    input: {
      storeId: string;
      masterProductId?: string;
      name: string;
      photoDataUrl?: string;
      stockQuantity: number;
      unitPrice: number;
    },
    actorRole: UserRole
  ): Promise<StoreMerchandiseItem> {
    if (!canManageStoreOptions(actorRole)) {
      throw new Error(
        'Apenas Gerente ou cargos superiores podem gerenciar o estoque da loja.'
      );
    }

    const masters = await this.getMasterProducts();
    const matchedMaster = input.masterProductId
      ? masters.find((m) => m.id === input.masterProductId)
      : undefined;

    if (!matchedMaster && !canCreateMasterProduct(actorRole)) {
      throw new Error(
        'Apenas Super Admin ou Presidente podem criar produtos novos. Selecione um produto já existente do Catálogo Mestre.'
      );
    }

    const resolvedName = (matchedMaster?.name || input.name).trim();
    if (!resolvedName) throw new Error('Informe o nome da mercadoria.');

    const items = await this.getMerchandise();
    const existingIdx = matchedMaster
      ? items.findIndex(
          (i) =>
            i.storeId === input.storeId &&
            i.masterProductId === matchedMaster.id
        )
      : -1;

    const now = Date.now();
    const qtyToAdd = Math.max(0, Math.round(input.stockQuantity || 0));

    if (existingIdx >= 0) {
      const updated: StoreMerchandiseItem = {
        ...items[existingIdx],
        name: matchedMaster!.name,
        photoDataUrl: matchedMaster!.photoDataUrl,
        unitPrice: matchedMaster!.unitPrice,
        stockQuantity: items[existingIdx].stockQuantity + qtyToAdd,
        updatedAt: now,
      };
      const next = [...items];
      next[existingIdx] = updated;
      this.writeJson(STORAGE_KEYS.MERCHANDISE, next);
      this.emitMerchandise();
      return updated;
    }

    const created: StoreMerchandiseItem = {
      id: this.generateId('merc'),
      storeId: input.storeId,
      masterProductId: matchedMaster?.id,
      name: resolvedName,
      photoDataUrl:
        matchedMaster?.photoDataUrl || input.photoDataUrl?.trim() || undefined,
      stockQuantity: qtyToAdd,
      unitPrice: matchedMaster
        ? matchedMaster.unitPrice
        : Math.max(0, Number(input.unitPrice || 0)),
      createdAt: now,
      updatedAt: now,
    };
    this.writeJson(STORAGE_KEYS.MERCHANDISE, [created, ...items]);
    this.emitMerchandise();
    return created;
  }

  async updateMerchandiseItem(
    itemId: string,
    updates: Partial<
      Omit<StoreMerchandiseItem, 'id' | 'storeId' | 'createdAt'>
    >,
    actorRole: UserRole
  ): Promise<StoreMerchandiseItem> {
    if (!canManageStoreOptions(actorRole)) {
      throw new Error(
        'Apenas Gerente ou cargos superiores podem ajustar o estoque da loja.'
      );
    }
    const items = await this.getMerchandise();
    const idx = items.findIndex((m) => m.id === itemId);
    if (idx === -1) throw new Error('Mercadoria não encontrada.');

    const allowMasterFields = canCreateMasterProduct(actorRole);
    const updated: StoreMerchandiseItem = {
      ...items[idx],
      stockQuantity:
        updates.stockQuantity !== undefined
          ? Math.max(0, Math.round(updates.stockQuantity))
          : items[idx].stockQuantity,
      name:
        allowMasterFields && updates.name !== undefined
          ? updates.name.trim()
          : items[idx].name,
      photoDataUrl:
        allowMasterFields && updates.photoDataUrl !== undefined
          ? updates.photoDataUrl
          : items[idx].photoDataUrl,
      unitPrice:
        allowMasterFields && updates.unitPrice !== undefined
          ? Math.max(0, Number(updates.unitPrice))
          : items[idx].unitPrice,
      updatedAt: Date.now(),
    };
    const next = [...items];
    next[idx] = updated;
    this.writeJson(STORAGE_KEYS.MERCHANDISE, next);
    this.emitMerchandise();
    return updated;
  }

  async deleteMerchandiseItem(
    itemId: string,
    actorRole: UserRole
  ): Promise<void> {
    if (!canManageStoreOptions(actorRole)) {
      throw new Error(
        'Apenas Gerente ou cargos superiores podem remover itens do estoque da loja.'
      );
    }
    const items = await this.getMerchandise();
    this.writeJson(
      STORAGE_KEYS.MERCHANDISE,
      items.filter((m) => m.id !== itemId)
    );
    this.emitMerchandise();
  }

  // ==========================================================
  // CAMADA 3: CARGA EM MÃOS DO OPERADOR, VENDAS EM TEMPO REAL, REPOSIÇÃO E ALERTAS ADMIN
  // ==========================================================

  async getOperatorShifts(): Promise<OperatorShiftInventory[]> {
    this.ensureSeededAndMigrated();
    return this.readJson<OperatorShiftInventory[]>(
      STORAGE_KEYS.OPERATOR_SHIFTS,
      []
    );
  }

  subscribeToOperatorShifts(
    callback: Listener<OperatorShiftInventory[]>
  ): () => void {
    this.ensureSeededAndMigrated();
    this.operatorShiftListeners.add(callback);
    callback(
      this.readJson<OperatorShiftInventory[]>(STORAGE_KEYS.OPERATOR_SHIFTS, [])
    );
    return () => {
      this.operatorShiftListeners.delete(callback);
    };
  }

  async getAdminAlerts(): Promise<AdminFinanceAlert[]> {
    this.ensureSeededAndMigrated();
    return this.readJson<AdminFinanceAlert[]>(STORAGE_KEYS.ADMIN_ALERTS, []);
  }

  subscribeToAdminAlerts(
    callback: Listener<AdminFinanceAlert[]>
  ): () => void {
    this.ensureSeededAndMigrated();
    this.adminAlertListeners.add(callback);
    callback(this.readJson<AdminFinanceAlert[]>(STORAGE_KEYS.ADMIN_ALERTS, []));
    return () => {
      this.adminAlertListeners.delete(callback);
    };
  }

  /**
   * v4.3-UI: Abertura de Loja com Retirada de Carga (desconta da loja -> vai para Carga em Mãos -> gera alerta para Gerente)
   */
  async openStoreWithWithdrawal(
    storeId: string,
    withdrawals: { storeItemId: string; quantity: number }[],
    actor: UserAccount
  ): Promise<void> {
    const stores = await this.getStores();
    const target = stores.find((s) => s.id === storeId);
    if (!target) throw new Error('Loja não encontrada.');

    const cleanWithdrawals = withdrawals
      .map((w) => ({
        storeItemId: w.storeItemId,
        quantity: Math.max(0, Math.round(w.quantity || 0)),
      }))
      .filter((w) => w.quantity > 0);

    const now = Date.now();
    const merch = await this.getMerchandise();
    const storeMerch = merch.filter((m) => m.storeId === storeId);

    if (cleanWithdrawals.length > 0) {
      if (!hasPermission(actor, 'canWithdrawRestockInventory')) {
        throw new Error(
          'Seu usuário não possui permissão para realizar retirada de estoque.'
        );
      }

      // Trava rigorosa: não permite retirar mais do que existe na loja
      for (const w of cleanWithdrawals) {
        const item = storeMerch.find((m) => m.id === w.storeItemId);
        if (!item) {
          throw new Error('Item de estoque não encontrado nesta loja.');
        }
        if (w.quantity > item.stockQuantity) {
          throw new Error(
            `Quantidade solicitada de "${item.name}" (${w.quantity}) excede o saldo disponível na loja (${item.stockQuantity}).`
          );
        }
      }

      // Desconta imediatamente do Estoque da Loja
      const wMap = new Map(
        cleanWithdrawals.map((w) => [w.storeItemId, w.quantity])
      );
      const nextMerch = merch.map((m) => {
        if (m.storeId !== storeId) return m;
        const qty = wMap.get(m.id);
        if (!qty) return m;
        return {
          ...m,
          stockQuantity: Math.max(0, m.stockQuantity - qty),
          updatedAt: now,
        };
      });
      this.writeJson(STORAGE_KEYS.MERCHANDISE, nextMerch);
      this.emitMerchandise();

      // Transfere para a "Carga em Mãos / Turno" do operador
      const shifts = await this.getOperatorShifts();
      const activeIdx = shifts.findIndex(
        (sh) =>
          sh.storeId === storeId &&
          sh.userId === actor.id &&
          sh.status === 'ACTIVE'
      );

      const alertLines: AdminAlertItemLine[] = [];
      const mergeItems = (existingItems: OperatorShiftItem[]) => {
        const map = new Map(existingItems.map((it) => [it.storeItemId, it]));
        cleanWithdrawals.forEach((w) => {
          const item = storeMerch.find((m) => m.id === w.storeItemId)!;
          alertLines.push({
            storeItemId: item.id,
            itemName: item.name,
            photoDataUrl: item.photoDataUrl,
            quantity: w.quantity,
            unitPrice: item.unitPrice,
          });
          const prev = map.get(item.id);
          if (prev) {
            map.set(item.id, {
              ...prev,
              initialWithdrawnQty: prev.initialWithdrawnQty + w.quantity,
              currentHandQty: prev.currentHandQty + w.quantity,
            });
          } else {
            map.set(item.id, {
              masterProductId: item.masterProductId || item.id,
              storeItemId: item.id,
              itemName: item.name,
              photoDataUrl: item.photoDataUrl,
              unitPrice: item.unitPrice,
              initialWithdrawnQty: w.quantity,
              restockedQty: 0,
              soldQty: 0,
              currentHandQty: w.quantity,
            });
          }
        });
        return Array.from(map.values());
      };

      let nextShifts: OperatorShiftInventory[];
      if (activeIdx >= 0) {
        nextShifts = [...shifts];
        nextShifts[activeIdx] = {
          ...nextShifts[activeIdx],
          items: mergeItems(nextShifts[activeIdx].items),
        };
      } else {
        const createdShift: OperatorShiftInventory = {
          id: this.generateId('shiftinv'),
          storeId: target.id,
          storeCode: target.storeCode,
          storeName: target.name,
          userId: actor.id,
          userName: actor.name,
          userRole: actor.role,
          items: mergeItems([]),
          realTimeSales: [],
          status: 'ACTIVE',
          openedAt: now,
        };
        nextShifts = [createdShift, ...shifts];
      }
      this.writeJson(STORAGE_KEYS.OPERATOR_SHIFTS, nextShifts);
      this.emitOperatorShifts();

      // Gera Alerta Administrativo exclusivo para o Gerente (NUNCA vai para campainha do mapa)
      const totalUnits = cleanWithdrawals.reduce(
        (acc, w) => acc + w.quantity,
        0
      );
      const alerts = await this.getAdminAlerts();
      const newAlert: AdminFinanceAlert = {
        id: this.generateId('admalert'),
        type: 'OPENING_WITHDRAWAL',
        storeId: target.id,
        storeCode: target.storeCode,
        storeName: target.name,
        region: target.region,
        actorUserId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        targetManagerId: target.managerId || target.managerIds?.[0],
        title: `Conferência de Abertura — Retirada de Estoque · ${target.storeCode}`,
        summary: `${actor.name} retirou ${totalUnits} ${
          totalUnits === 1 ? 'unidade' : 'unidades'
        } na abertura da unidade.`,
        items: alertLines,
        status: 'PENDING',
        createdAt: now,
      };
      this.writeJson(STORAGE_KEYS.ADMIN_ALERTS, [newAlert, ...alerts]);
      this.emitAdminAlerts();
    }

    // Abre a loja operacionalmente
    if (!target.isOpen) {
      await this.updateStore(storeId, { isOpen: true });
      this.appendShiftLogs([
        {
          id: this.generateId('shift'),
          storeId: target.id,
          storeCode: target.storeCode,
          storeName: target.name,
          action: 'OPENED',
          actorUserId: actor.id,
          actorName: actor.name,
          note:
            cleanWithdrawals.length > 0
              ? `Abertura com retirada de carga (${cleanWithdrawals.reduce(
                  (a, b) => a + b.quantity,
                  0
                )} un)`
              : 'Abertura operacional sem retirada de carga',
          timestamp: now,
        },
      ]);
    }
  }

  /**
   * v4.3-UI: Reposição de Estoque no meio do expediente
   */
  async restockOperatorInventory(
    storeId: string,
    additions: { storeItemId: string; quantity: number }[],
    actor: UserAccount
  ): Promise<void> {
    if (!hasPermission(actor, 'canWithdrawRestockInventory')) {
      throw new Error(
        'Sem permissão para realizar retirada ou reposição de estoque.'
      );
    }
    const stores = await this.getStores();
    const target = stores.find((s) => s.id === storeId);
    if (!target) throw new Error('Loja não encontrada.');

    const cleanAdditions = additions
      .map((a) => ({
        storeItemId: a.storeItemId,
        quantity: Math.max(0, Math.round(a.quantity || 0)),
      }))
      .filter((a) => a.quantity > 0);

    if (cleanAdditions.length === 0) {
      throw new Error('Informe ao menos 1 item para reposição.');
    }

    const merch = await this.getMerchandise();
    const storeMerch = merch.filter((m) => m.storeId === storeId);

    for (const add of cleanAdditions) {
      const item = storeMerch.find((m) => m.id === add.storeItemId);
      if (!item) throw new Error('Produto não encontrado na loja.');
      if (add.quantity > item.stockQuantity) {
        throw new Error(
          `Reposição de "${item.name}" (${add.quantity}) ultrapassa o saldo atual da loja (${item.stockQuantity}).`
        );
      }
    }

    const now = Date.now();
    const addMap = new Map(
      cleanAdditions.map((a) => [a.storeItemId, a.quantity])
    );
    const nextMerch = merch.map((m) => {
      if (m.storeId !== storeId) return m;
      const qty = addMap.get(m.id);
      if (!qty) return m;
      return {
        ...m,
        stockQuantity: Math.max(0, m.stockQuantity - qty),
        updatedAt: now,
      };
    });
    this.writeJson(STORAGE_KEYS.MERCHANDISE, nextMerch);
    this.emitMerchandise();

    const shifts = await this.getOperatorShifts();
    const activeIdx = shifts.findIndex(
      (sh) =>
        sh.storeId === storeId &&
        sh.userId === actor.id &&
        sh.status === 'ACTIVE'
    );

    const alertLines: AdminAlertItemLine[] = [];
    const applyRestock = (existingItems: OperatorShiftItem[]) => {
      const map = new Map(existingItems.map((it) => [it.storeItemId, it]));
      cleanAdditions.forEach((a) => {
        const item = storeMerch.find((m) => m.id === a.storeItemId)!;
        alertLines.push({
          storeItemId: item.id,
          itemName: item.name,
          photoDataUrl: item.photoDataUrl,
          quantity: a.quantity,
          unitPrice: item.unitPrice,
        });
        const prev = map.get(item.id);
        if (prev) {
          map.set(item.id, {
            ...prev,
            restockedQty: prev.restockedQty + a.quantity,
            currentHandQty: prev.currentHandQty + a.quantity,
          });
        } else {
          map.set(item.id, {
            masterProductId: item.masterProductId || item.id,
            storeItemId: item.id,
            itemName: item.name,
            photoDataUrl: item.photoDataUrl,
            unitPrice: item.unitPrice,
            initialWithdrawnQty: 0,
            restockedQty: a.quantity,
            soldQty: 0,
            currentHandQty: a.quantity,
          });
        }
      });
      return Array.from(map.values());
    };

    let nextShifts: OperatorShiftInventory[];
    if (activeIdx >= 0) {
      nextShifts = [...shifts];
      nextShifts[activeIdx] = {
        ...nextShifts[activeIdx],
        items: applyRestock(nextShifts[activeIdx].items),
      };
    } else {
      const createdShift: OperatorShiftInventory = {
        id: this.generateId('shiftinv'),
        storeId: target.id,
        storeCode: target.storeCode,
        storeName: target.name,
        userId: actor.id,
        userName: actor.name,
        userRole: actor.role,
        items: applyRestock([]),
        realTimeSales: [],
        status: 'ACTIVE',
        openedAt: now,
      };
      nextShifts = [createdShift, ...shifts];
    }
    this.writeJson(STORAGE_KEYS.OPERATOR_SHIFTS, nextShifts);
    this.emitOperatorShifts();

    const totalUnits = cleanAdditions.reduce((acc, a) => acc + a.quantity, 0);
    const alerts = await this.getAdminAlerts();
    const restockAlert: AdminFinanceAlert = {
      id: this.generateId('admalert'),
      type: 'RESTOCK',
      storeId: target.id,
      storeCode: target.storeCode,
      storeName: target.name,
      region: target.region,
      actorUserId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      targetManagerId: target.managerId || target.managerIds?.[0],
      title: `Reposição de Estoque no Expediente · ${target.storeCode}`,
      summary: `${actor.name} retirou +${totalUnits} ${
        totalUnits === 1 ? 'unidade' : 'unidades'
      } para reposição em mãos.`,
      items: alertLines,
      status: 'PENDING',
      createdAt: now,
    };
    this.writeJson(STORAGE_KEYS.ADMIN_ALERTS, [restockAlert, ...alerts]);
    this.emitAdminAlerts();
  }

  /**
   * v4.3-UI: Registro de Venda em Tempo Real (abate imediatamente apenas da Carga em Mãos do operador)
   */
  async recordOperatorSale(
    storeId: string,
    storeItemId: string,
    quantity: number,
    paymentMethod: 'CASH' | 'PIX',
    actor: UserAccount
  ): Promise<OperatorShiftInventory> {
    const cleanQty = Math.round(quantity || 0);
    if (cleanQty <= 0) {
      throw new Error('Informe uma quantidade vendida maior que zero.');
    }

    const shifts = await this.getOperatorShifts();
    const shiftIdx = shifts.findIndex(
      (sh) =>
        sh.storeId === storeId &&
        sh.userId === actor.id &&
        sh.status === 'ACTIVE'
    );
    if (shiftIdx === -1) {
      throw new Error(
        'Você não possui carga em mãos ativa nesta loja. Realize uma retirada ou reposição primeiro.'
      );
    }

    const shift = shifts[shiftIdx];
    const itemIdx = shift.items.findIndex(
      (it) => it.storeItemId === storeItemId
    );
    if (itemIdx === -1) {
      throw new Error('Este item não está na sua Carga em Mãos.');
    }

    const targetItem = shift.items[itemIdx];
    if (cleanQty > targetItem.currentHandQty) {
      throw new Error(
        `Saldo insuficiente na sua Carga em Mãos para "${targetItem.itemName}" (disponível: ${targetItem.currentHandQty} un).`
      );
    }

    const now = Date.now();
    const saleTotal = Number((cleanQty * targetItem.unitPrice).toFixed(2));
    const saleEntry: OperatorSaleEntry = {
      id: this.generateId('sale'),
      masterProductId: targetItem.masterProductId,
      storeItemId: targetItem.storeItemId,
      itemName: targetItem.itemName,
      photoDataUrl: targetItem.photoDataUrl,
      unitPrice: targetItem.unitPrice,
      quantity: cleanQty,
      totalAmount: saleTotal,
      paymentMethod,
      createdAt: now,
    };

    const nextItems = [...shift.items];
    nextItems[itemIdx] = {
      ...targetItem,
      soldQty: targetItem.soldQty + cleanQty,
      currentHandQty: targetItem.currentHandQty - cleanQty,
    };

    const updatedShift: OperatorShiftInventory = {
      ...shift,
      items: nextItems,
      realTimeSales: [saleEntry, ...shift.realTimeSales],
    };

    const nextShifts = [...shifts];
    nextShifts[shiftIdx] = updatedShift;
    this.writeJson(STORAGE_KEYS.OPERATOR_SHIFTS, nextShifts);
    this.emitOperatorShifts();
    return updatedShift;
  }

  async resolveAdminAlert(
    alertId: string,
    status: 'CONFIRMED' | 'DISCREPANCY',
    observation: string | undefined,
    actor: UserAccount
  ): Promise<AdminFinanceAlert> {
    if (!canManageStoreOptions(actor.role)) {
      throw new Error(
        'Apenas Gerente ou cargos superiores podem confirmar alertas de estoque.'
      );
    }
    const cleanObs = observation?.trim() || '';
    if (status === 'DISCREPANCY' && !cleanObs) {
      throw new Error(
        'Informe a observação da divergência antes de registrar.'
      );
    }

    const alerts = await this.getAdminAlerts();
    const idx = alerts.findIndex((a) => a.id === alertId);
    if (idx === -1) throw new Error('Alerta administrativo não encontrado.');

    const updated: AdminFinanceAlert = {
      ...alerts[idx],
      status,
      resolvedByUserId: actor.id,
      resolvedByName: actor.name,
      observation: cleanObs || undefined,
      resolvedAt: Date.now(),
    };
    const next = [...alerts];
    next[idx] = updated;
    this.writeJson(STORAGE_KEYS.ADMIN_ALERTS, next);
    this.emitAdminAlerts();
    return updated;
  }

  async addStore(
    input: Omit<
      StoreUnit,
      'id' | 'storeCode' | 'createdAt' | 'updatedAt' | 'onlineUserIds'
    >
  ): Promise<StoreUnit> {
    if (!input.managerId && (!input.managerIds || input.managerIds.length === 0)) {
      throw new Error(
        'É obrigatório vincular um responsável (Gerente, Governador ou Presidente) à loja.'
      );
    }
    const stores = await this.getStores();
    const now = Date.now();
    const newStore: StoreUnit = {
      ...input,
      id: this.generateId('store'),
      storeCode: this.generateStoreCode(stores),
      isOpen: input.isOpen ?? false,
      alertDurationMinutes: input.alertDurationMinutes || 20,
      managerIds: Array.from(
        new Set([...(input.managerIds || []), input.managerId].filter(Boolean))
      ),
      employeeIds: input.employeeIds || [],
      onlineUserIds: [],
      createdAt: now,
      updatedAt: now,
    };
    this.writeJson(STORAGE_KEYS.STORES, [...stores, newStore]);
    this.emitStores();
    return newStore;
  }

  async updateStore(
    id: string,
    updates: Partial<Omit<StoreUnit, 'id' | 'storeCode' | 'createdAt'>>
  ): Promise<StoreUnit> {
    const stores = await this.getStores();
    const idx = stores.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error('Unidade não encontrada.');
    const nextManagerId =
      updates.managerId !== undefined ? updates.managerId : stores[idx].managerId;
    const nextManagerIds =
      updates.managerIds !== undefined
        ? updates.managerIds
        : stores[idx].managerIds;
    if (!nextManagerId && (!nextManagerIds || nextManagerIds.length === 0)) {
      throw new Error(
        'A loja deve possuir um responsável (Gerente, Governador ou Presidente).'
      );
    }
    const updated: StoreUnit = {
      ...stores[idx],
      ...updates,
      managerId: nextManagerId || nextManagerIds[0],
      managerIds: Array.from(
        new Set([...(nextManagerIds || []), nextManagerId].filter(Boolean))
      ),
      updatedAt: Date.now(),
    };
    const next = [...stores];
    next[idx] = updated;
    this.writeJson(STORAGE_KEYS.STORES, next);
    this.emitStores();
    return updated;
  }

  private appendShiftLogs(newLogs: StoreShiftLog[]): void {
    if (newLogs.length === 0) return;
    const existing = this.readJson<StoreShiftLog[]>(
      STORAGE_KEYS.STORE_SHIFT_LOGS,
      []
    );
    this.writeJson(STORAGE_KEYS.STORE_SHIFT_LOGS, [...newLogs, ...existing]);
    this.emitShiftLogs();
  }

  async getStoreShiftLogs(): Promise<StoreShiftLog[]> {
    this.ensureSeededAndMigrated();
    return this.readJson<StoreShiftLog[]>(STORAGE_KEYS.STORE_SHIFT_LOGS, []);
  }

  subscribeToStoreShiftLogs(
    callback: Listener<StoreShiftLog[]>
  ): () => void {
    this.ensureSeededAndMigrated();
    this.shiftLogListeners.add(callback);
    callback(this.readJson(STORAGE_KEYS.STORE_SHIFT_LOGS, []));
    return () => {
      this.shiftLogListeners.delete(callback);
    };
  }

  async setStoreOpenStatus(storeId: string, isOpen: boolean): Promise<void> {
    const stores = await this.getStores();
    const target = stores.find((s) => s.id === storeId);
    const prevOpen = target?.isOpen;
    await this.updateStore(storeId, { isOpen });
    if (target && prevOpen !== isOpen) {
      const actor = this.getSessionUserSync();
      this.appendShiftLogs([
        {
          id: this.generateId('shift'),
          storeId: target.id,
          storeCode: target.storeCode,
          storeName: target.name,
          action: isOpen ? 'OPENED' : 'CLOSED',
          actorUserId: actor?.id || 'sistema',
          actorName: actor?.name || 'Sistema',
          note: isOpen
            ? 'Abertura / Reabertura de loja'
            : 'Pausa / Fechamento intermediário',
          timestamp: Date.now(),
        },
      ]);
    }
  }

  async closeStoreWithSales(
    storeId: string,
    payload?:
      | number
      | {
          soldItems: ClosingMerchandiseLine[];
          cashReceived: number;
          pixReceived: number;
        },
    actor?: UserAccount | null
  ): Promise<StoreClosingRecord> {
    const stores = await this.getStores();
    const target = stores.find((s) => s.id === storeId);
    if (!target) throw new Error('Loja não encontrada.');

    const wasOpen = target.isOpen;
    await this.updateStore(storeId, { isOpen: false });

    const now = Date.now();
    const effectiveActor = actor || this.getSessionUserSync();
    const closings = await this.getStoreClosings();

    let record: StoreClosingRecord;

    if (typeof payload === 'object' && payload !== null) {
      const soldItems = payload.soldItems.filter((l) => l.quantitySold > 0);
      const totalItemsSold = soldItems.reduce(
        (acc, l) => acc + l.quantitySold,
        0
      );
      const expectedSalesAmount = Number(
        soldItems.reduce((acc, l) => acc + l.lineTotal, 0).toFixed(2)
      );
      const cashReceived = Number(
        Math.max(0, payload.cashReceived || 0).toFixed(2)
      );
      const pixReceived = Number(
        Math.max(0, payload.pixReceived || 0).toFixed(2)
      );
      const totalReceived = Number((cashReceived + pixReceived).toFixed(2));
      const balanceDifference = Number(
        (totalReceived - expectedSalesAmount).toFixed(2)
      );
      const balanceStatus: ClosingBalanceStatus =
        Math.abs(balanceDifference) < 0.01
          ? 'MATCHED'
          : balanceDifference > 0
          ? 'SURPLUS'
          : 'SHORTAGE';

      // v4.3-UI: Calcula sobra não vendida na Carga em Mãos e devolve automaticamente para o Estoque da Loja
      const shifts = await this.getOperatorShifts();
      const activeStoreShifts = shifts.filter(
        (sh) => sh.storeId === storeId && sh.status === 'ACTIVE'
      );
      const soldMap = new Map(
        soldItems.map((l) => [l.itemId, l.quantitySold])
      );

      // Soma total retirado (abertura + reposição) por item nos turnos ativos da loja
      const withdrawnByItem = new Map<
        string,
        { itemName: string; totalTaken: number }
      >();
      activeStoreShifts.forEach((sh) => {
        sh.items.forEach((it) => {
          const taken = it.initialWithdrawnQty + it.restockedQty;
          const prev = withdrawnByItem.get(it.storeItemId);
          withdrawnByItem.set(it.storeItemId, {
            itemName: it.itemName,
            totalTaken: (prev?.totalTaken || 0) + taken,
          });
        });
      });

      const returnedItems: ReturnedStockLine[] = [];
      const allMerch = await this.getMerchandise();
      const nextMerch = allMerch.map((item) => {
        if (item.storeId !== storeId) return item;
        const soldQty = soldMap.get(item.id) || 0;
        const takenInfo = withdrawnByItem.get(item.id);

        if (takenInfo && takenInfo.totalTaken > 0) {
          // O estoque da loja já havia sido descontado na retirada!
          // Se vendeu menos do que retirou -> devolve sobra; se vendeu além do retirado -> desconta diferença.
          const leftover = takenInfo.totalTaken - soldQty;
          if (leftover > 0) {
            returnedItems.push({
              storeItemId: item.id,
              itemName: item.name,
              quantityReturned: leftover,
            });
            return {
              ...item,
              stockQuantity: item.stockQuantity + leftover,
              updatedAt: now,
            };
          } else if (leftover < 0) {
            return {
              ...item,
              stockQuantity: Math.max(0, item.stockQuantity + leftover),
              updatedAt: now,
            };
          }
          return item;
        }

        // Fallback quando fechamento registra venda direta sem turno de retirada prévio
        if (soldQty > 0) {
          return {
            ...item,
            stockQuantity: Math.max(0, item.stockQuantity - soldQty),
            updatedAt: now,
          };
        }
        return item;
      });

      this.writeJson(STORAGE_KEYS.MERCHANDISE, nextMerch);
      this.emitMerchandise();

      // Encerra turnos ativos da loja
      if (activeStoreShifts.length > 0) {
        const nextShifts = shifts.map((sh) =>
          sh.storeId === storeId && sh.status === 'ACTIVE'
            ? {
                ...sh,
                status: 'CLOSED' as const,
                closedAt: now,
              }
            : sh
        );
        this.writeJson(STORAGE_KEYS.OPERATOR_SHIFTS, nextShifts);
        this.emitOperatorShifts();
      }

      record = {
        id: this.generateId('close'),
        storeId: target.id,
        storeCode: target.storeCode,
        storeName: target.name,
        region: target.region,
        closedByUserId: effectiveActor?.id || 'sistema',
        closedByName: effectiveActor?.name || 'Sistema',
        dailySalesAmount: totalReceived,
        soldItems,
        returnedItems: returnedItems.length > 0 ? returnedItems : undefined,
        totalItemsSold,
        expectedSalesAmount,
        cashReceived,
        pixReceived,
        totalReceived,
        balanceDifference,
        balanceStatus,
        reviewStatus: 'PENDING_GERENTE',
        closedAt: now,
      };
    } else {
      const simpleVal =
        typeof payload === 'number' && !Number.isNaN(payload)
          ? Math.max(0, Number(payload.toFixed(2)))
          : undefined;
      record = {
        id: this.generateId('close'),
        storeId: target.id,
        storeCode: target.storeCode,
        storeName: target.name,
        region: target.region,
        closedByUserId: effectiveActor?.id || 'sistema',
        closedByName: effectiveActor?.name || 'Sistema',
        dailySalesAmount: simpleVal,
        expectedSalesAmount: simpleVal,
        totalReceived: simpleVal,
        balanceDifference: 0,
        balanceStatus: simpleVal !== undefined ? 'MATCHED' : undefined,
        reviewStatus: 'PENDING_GERENTE',
        closedAt: now,
      };
    }

    this.writeJson(STORAGE_KEYS.STORE_CLOSINGS, [record, ...closings]);
    this.emitStoreClosings();

    // Envia notificação/alerta exclusivo para o Gerente responsável pela loja
    const balanceLabel =
      record.balanceStatus === 'MATCHED'
        ? 'Saldo Bateu'
        : record.balanceStatus === 'SURPLUS'
        ? `Sobra +R$ ${(record.balanceDifference || 0)
            .toFixed(2)
            .replace('.', ',')}`
        : record.balanceStatus === 'SHORTAGE'
        ? `Falta -R$ ${Math.abs(record.balanceDifference || 0)
            .toFixed(2)
            .replace('.', ',')}`
        : 'Fechamento registrado';

    const alerts = await this.getClosingAlerts();
    const managerAlert: ClosingAlertNotification = {
      id: this.generateId('calert'),
      closingId: record.id,
      storeId: target.id,
      storeCode: target.storeCode,
      storeName: target.name,
      region: target.region,
      targetRole: 'GERENTE',
      targetUserId: target.managerId || target.managerIds?.[0],
      title: `Fechamento pendente · ${target.storeCode} (${target.name})`,
      summary: `Por ${record.closedByName} · Recebido R$ ${(
        record.totalReceived ??
        record.dailySalesAmount ??
        0
      )
        .toFixed(2)
        .replace('.', ',')} · ${balanceLabel}`,
      reviewStatus: 'PENDING_GERENTE',
      readByUserIds: [],
      createdAt: now,
    };
    this.writeJson(STORAGE_KEYS.CLOSING_ALERTS, [managerAlert, ...alerts]);
    this.emitClosingAlerts();

    if (wasOpen) {
      const formattedSales =
        record.dailySalesAmount !== undefined
          ? `Recebido: R$ ${record.dailySalesAmount.toFixed(2).replace('.', ',')} (${balanceLabel})`
          : 'Fechamento de turno / pausa';
      this.appendShiftLogs([
        {
          id: this.generateId('shift'),
          storeId: target.id,
          storeCode: target.storeCode,
          storeName: target.name,
          action: 'CLOSED',
          actorUserId: effectiveActor?.id || 'sistema',
          actorName: effectiveActor?.name || 'Sistema',
          note: formattedSales,
          timestamp: now,
        },
      ]);
    }

    return record;
  }

  /**
   * v4.2-UI: Conferência Hierárquica de Fechamento (Gerente -> Governador -> Presidente)
   */
  async reviewStoreClosing(
    closingId: string,
    decision: 'APPROVED' | 'REJECTED',
    observation: string | undefined,
    actor: UserAccount
  ): Promise<StoreClosingRecord> {
    if (!canDecideClosingReview(actor.role)) {
      throw new Error(
        'Apenas Gerente ou Governador podem aprovar ou reprovar fechamentos.'
      );
    }
    const cleanObs = observation?.trim() || '';
    if (decision === 'REJECTED' && !cleanObs) {
      throw new Error(
        'Informe a observação / motivo obrigatório ao reprovar o fechamento.'
      );
    }

    const closings = await this.getStoreClosings();
    const idx = closings.findIndex((c) => c.id === closingId);
    if (idx === -1) throw new Error('Registro de fechamento não encontrado.');

    const current = closings[idx];
    const now = Date.now();
    const reviewEntry: ClosingReviewDecision = {
      reviewerUserId: actor.id,
      reviewerName: actor.name,
      reviewerRole: actor.role,
      decision,
      observation: cleanObs || undefined,
      decidedAt: now,
    };

    const isGovernorStage =
      actor.role === 'GOVERNADOR' ||
      (actor.role === 'SUPER_ADMIN' && Boolean(current.managerDecision));

    const updated: StoreClosingRecord = isGovernorStage
      ? {
          ...current,
          governorDecision: reviewEntry,
          reviewStatus: decision,
        }
      : {
          ...current,
          managerDecision: reviewEntry,
          reviewStatus: 'PENDING_GOVERNADOR',
        };

    const nextClosings = [...closings];
    nextClosings[idx] = updated;
    this.writeJson(STORAGE_KEYS.STORE_CLOSINGS, nextClosings);
    this.emitStoreClosings();

    // Gera alerta automático para o nível superior (Gerente -> Governador; Governador -> Presidente)
    const nextTargetRole: 'GOVERNADOR' | 'PRESIDENTE' = isGovernorStage
      ? 'PRESIDENTE'
      : 'GOVERNADOR';
    const decisionWord = decision === 'APPROVED' ? 'Aprovado' : 'Reprovado';
    const roleWord = ROLE_LABELS[actor.role];

    const alerts = await this.getClosingAlerts();
    const escalatedAlert: ClosingAlertNotification = {
      id: this.generateId('calert'),
      closingId: updated.id,
      storeId: updated.storeId,
      storeCode: updated.storeCode,
      storeName: updated.storeName,
      region: updated.region,
      targetRole: nextTargetRole,
      title: `Conferência ${decisionWord} (${roleWord}) · ${updated.storeCode}`,
      summary: `${actor.name} marcou como ${decisionWord.toLowerCase()}${
        cleanObs ? `: "${cleanObs}"` : ''
      }`,
      reviewStatus: updated.reviewStatus || decision,
      readByUserIds: [],
      createdAt: now,
    };
    this.writeJson(STORAGE_KEYS.CLOSING_ALERTS, [escalatedAlert, ...alerts]);
    this.emitClosingAlerts();

    return updated;
  }

  async openMultipleStores(storeIds: string[]): Promise<void> {
    if (storeIds.length === 0) return;
    const stores = await this.getStores();
    const now = Date.now();
    const actor = this.getSessionUserSync();
    const logs: StoreShiftLog[] = [];
    const next = stores.map((s) => {
      if (storeIds.includes(s.id)) {
        if (!s.isOpen) {
          logs.push({
            id: this.generateId('shift'),
            storeId: s.id,
            storeCode: s.storeCode,
            storeName: s.name,
            action: 'OPENED',
            actorUserId: actor?.id || 'sistema',
            actorName: actor?.name || 'Sistema',
            note: 'Abertura ao iniciar sessão',
            timestamp: now,
          });
        }
        return { ...s, isOpen: true, updatedAt: now };
      }
      return s;
    });
    this.writeJson(STORAGE_KEYS.STORES, next);
    this.emitStores();
    this.appendShiftLogs(logs);
  }

  async deleteStore(id: string): Promise<void> {
    const stores = await this.getStores();
    this.writeJson(
      STORAGE_KEYS.STORES,
      stores.filter((s) => s.id !== id)
    );
    this.emitStores();
  }

  async setUserStoreLinks(
    targetUserId: string,
    allowedManageableStoreIds: string[],
    selectedStoreIds: string[]
  ): Promise<void> {
    const users = await this.getUsers();
    const targetUser = users.find((u) => u.id === targetUserId);
    const isManagerLevel = targetUser
      ? ROLE_LEVEL[targetUser.role] <= 4
      : false;

    const stores = await this.getStores();
    const now = Date.now();
    const next = stores.map((store) => {
      if (!allowedManageableStoreIds.includes(store.id)) return store;
      const shouldInclude = selectedStoreIds.includes(store.id);
      const wasLinked = isUserLinkedToStore(targetUserId, store);

      let nextFormer: FormerStoreEmployee[] = [...(store.formerEmployees || [])];
      if (!shouldInclude && wasLinked && targetUser) {
        if (!nextFormer.some((f) => f.userId === targetUser.id)) {
          nextFormer.unshift({
            userId: targetUser.id,
            userCode: targetUser.userCode,
            name: targetUser.name,
            unlinkedAt: now,
          });
        }
      } else if (shouldInclude) {
        nextFormer = nextFormer.filter((f) => f.userId !== targetUserId);
      }

      if (isManagerLevel) {
        const filteredManagers = (store.managerIds || []).filter(
          (mid) => mid !== targetUserId
        );
        const nextManagerIds = shouldInclude
          ? [...filteredManagers, targetUserId]
          : filteredManagers;
        const nextPrimaryManagerId =
          store.managerId === targetUserId && !shouldInclude
            ? nextManagerIds[0] || ''
            : store.managerId || (shouldInclude ? targetUserId : '');

        return {
          ...store,
          managerId: nextPrimaryManagerId,
          managerIds: nextManagerIds,
          employeeIds: store.employeeIds.filter((eid) => eid !== targetUserId),
          formerEmployees: nextFormer,
          updatedAt: now,
        };
      }

      const filteredEmployees = store.employeeIds.filter(
        (eid) => eid !== targetUserId
      );
      return {
        ...store,
        employeeIds: shouldInclude
          ? [...filteredEmployees, targetUserId]
          : filteredEmployees,
        formerEmployees: nextFormer,
        updatedAt: now,
      };
    });
    this.writeJson(STORAGE_KEYS.STORES, next);
    this.emitStores();
  }

  // ==========================================================
  // CATEGORIAS & SUBCATEGORIAS DINÂMICAS (Super Admin, Presidente, Governador)
  // ==========================================================

  async getCategories(): Promise<CatalogCategory[]> {
    this.ensureSeededAndMigrated();
    const list = this.readJson<CatalogCategory[]>(
      STORAGE_KEYS.CATEGORIES,
      createSeedCategories()
    );
    return [...list].sort((a, b) => a.order - b.order);
  }

  subscribeToCategories(callback: Listener<CatalogCategory[]>): () => void {
    this.ensureSeededAndMigrated();
    this.categoryListeners.add(callback);
    const list = this.readJson<CatalogCategory[]>(
      STORAGE_KEYS.CATEGORIES,
      createSeedCategories()
    );
    callback([...list].sort((a, b) => a.order - b.order));
    return () => {
      this.categoryListeners.delete(callback);
    };
  }

  async addCategory(
    input: Omit<CatalogCategory, 'id' | 'createdAt' | 'updatedAt' | 'order'>
  ): Promise<CatalogCategory> {
    const categories = await this.getCategories();
    const now = Date.now();
    const maxOrder = categories.reduce((acc, c) => Math.max(acc, c.order), 0);
    const created: CatalogCategory = {
      ...input,
      id: this.generateId('cat'),
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    };
    this.writeJson(STORAGE_KEYS.CATEGORIES, [...categories, created]);
    this.emitCategories();
    return created;
  }

  async updateCategory(
    id: string,
    updates: Partial<Omit<CatalogCategory, 'id' | 'createdAt'>>
  ): Promise<CatalogCategory> {
    const categories = await this.getCategories();
    const idx = categories.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Categoria não encontrada.');
    const updated: CatalogCategory = {
      ...categories[idx],
      ...updates,
      updatedAt: Date.now(),
    };
    const next = [...categories];
    next[idx] = updated;
    this.writeJson(STORAGE_KEYS.CATEGORIES, next);
    this.emitCategories();
    return updated;
  }

  async setPrimaryCategory(
    categoryId: string,
    actorRole: UserRole
  ): Promise<void> {
    if (!canSetPrimaryCategory(actorRole)) {
      throw new Error(
        'Apenas Super Admin ou Presidente podem definir a Categoria Principal.'
      );
    }
    const categories = await this.getCategories();
    const now = Date.now();
    const next = categories.map((c) => ({
      ...c,
      isPrimary: c.id === categoryId,
      updatedAt: c.id === categoryId ? now : c.updatedAt,
    }));
    this.writeJson(STORAGE_KEYS.CATEGORIES, next);
    this.emitCategories();
  }

  async deleteCategory(id: string): Promise<void> {
    const categories = await this.getCategories();
    const remaining = categories.filter((c) => c.id !== id);
    if (remaining.length > 0 && !remaining.some((c) => c.isPrimary)) {
      remaining[0] = { ...remaining[0], isPrimary: true };
    }
    this.writeJson(STORAGE_KEYS.CATEGORIES, remaining);
    const subs = await this.getSubcategories();
    this.writeJson(
      STORAGE_KEYS.SUBCATEGORIES,
      subs.filter((s) => s.categoryId !== id)
    );
    this.emitCategories();
    this.emitSubcategories();
  }

  async getSubcategories(): Promise<CatalogSubcategory[]> {
    this.ensureSeededAndMigrated();
    return this.readJson<CatalogSubcategory[]>(
      STORAGE_KEYS.SUBCATEGORIES,
      createSeedSubcategories()
    );
  }

  subscribeToSubcategories(
    callback: Listener<CatalogSubcategory[]>
  ): () => void {
    this.ensureSeededAndMigrated();
    this.subcategoryListeners.add(callback);
    callback(
      this.readJson(STORAGE_KEYS.SUBCATEGORIES, createSeedSubcategories())
    );
    return () => {
      this.subcategoryListeners.delete(callback);
    };
  }

  async addSubcategory(
    input: Omit<CatalogSubcategory, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<CatalogSubcategory> {
    const subs = await this.getSubcategories();
    const now = Date.now();
    const created: CatalogSubcategory = {
      ...input,
      id: this.generateId('sub'),
      createdAt: now,
      updatedAt: now,
    };
    this.writeJson(STORAGE_KEYS.SUBCATEGORIES, [...subs, created]);
    this.emitSubcategories();
    return created;
  }

  async updateSubcategory(
    id: string,
    updates: Partial<Omit<CatalogSubcategory, 'id' | 'createdAt'>>
  ): Promise<CatalogSubcategory> {
    const subs = await this.getSubcategories();
    const idx = subs.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error('Subcategoria não encontrada.');
    const updated: CatalogSubcategory = {
      ...subs[idx],
      ...updates,
      updatedAt: Date.now(),
    };
    const next = [...subs];
    next[idx] = updated;
    this.writeJson(STORAGE_KEYS.SUBCATEGORIES, next);
    this.emitSubcategories();
    return updated;
  }

  async deleteSubcategory(id: string): Promise<void> {
    const subs = await this.getSubcategories();
    this.writeJson(
      STORAGE_KEYS.SUBCATEGORIES,
      subs.filter((s) => s.id !== id)
    );
    this.emitSubcategories();
  }

  // ==========================================================
  // MENSAGENS & COMUNICADOS DA EQUIPE (v4.0)
  // ==========================================================

  async getMessages(): Promise<TeamMessage[]> {
    this.ensureSeededAndMigrated();
    return this.readJson<TeamMessage[]>(
      STORAGE_KEYS.MESSAGES,
      createSeedMessages()
    );
  }

  subscribeToMessages(callback: Listener<TeamMessage[]>): () => void {
    this.ensureSeededAndMigrated();
    this.messageListeners.add(callback);
    callback(
      this.readJson<TeamMessage[]>(STORAGE_KEYS.MESSAGES, createSeedMessages())
    );
    return () => {
      this.messageListeners.delete(callback);
    };
  }

  async sendMessage(
    content: string,
    storeId?: string,
    actor?: UserAccount | null
  ): Promise<TeamMessage> {
    const effectiveActor = actor || this.getSessionUserSync();
    if (!effectiveActor) throw new Error('Sessão expirada.');
    if (!hasPermission(effectiveActor, 'canSendMessages')) {
      throw new Error('Sua conta não tem permissão para enviar mensagens.');
    }
    const clean = content.trim();
    if (!clean) throw new Error('Digite uma mensagem antes de enviar.');

    const stores = await this.getStores();
    const targetStore = storeId
      ? stores.find((s) => s.id === storeId)
      : undefined;

    const msg: TeamMessage = {
      id: this.generateId('msg'),
      senderId: effectiveActor.id,
      senderName: effectiveActor.name,
      senderRole: effectiveActor.role,
      storeId: targetStore?.id,
      storeName: targetStore?.name,
      content: clean.slice(0, 500),
      createdAt: Date.now(),
    };

    const existing = await this.getMessages();
    this.writeJson(STORAGE_KEYS.MESSAGES, [msg, ...existing].slice(0, 200));
    this.emitMessages();
    return msg;
  }

  // ==========================================================
  // SALAS DE CHAT HIERÁRQUICAS, AUTODESTRUTIVAS & CONFIDENCIAIS (v4.4-Final)
  // ==========================================================

  subscribeToChatRooms(callback: Listener<ChatRoom[]>): () => void {
    this.ensureSeededAndMigrated();
    this.chatRoomListeners.add(callback);
    callback(this.getAllChatRoomsSync());
    return () => {
      this.chatRoomListeners.delete(callback);
    };
  }

  subscribeToChatMessages(callback: Listener<ChatMessage[]>): () => void {
    this.ensureSeededAndMigrated();
    this.chatMessageListeners.add(callback);
    callback(this.getAllChatMessagesSync());
    return () => {
      this.chatMessageListeners.delete(callback);
    };
  }

  private generateUniqueRoomCode(existingRooms: ChatRoom[]): string {
    const used = new Set(existingRooms.map((r) => r.roomCode.toUpperCase()));
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const code = `SALA-${1000 + Math.floor(Math.random() * 9000)}`;
      if (!used.has(code)) return code;
    }
    return `SALA-${Date.now().toString().slice(-4)}`;
  }

  private findExactUserByQuery(
    query: string,
    allUsers: UserAccount[]
  ): UserAccount | undefined {
    const clean = query.trim().toLowerCase();
    if (!clean) return undefined;
    return allUsers.find(
      (u) =>
        !u.isBlocked &&
        (u.userCode.toLowerCase() === clean ||
          u.username.toLowerCase() === clean ||
          u.name.trim().toLowerCase() === clean)
    );
  }

  async createChatRoom(
    input: {
      name: string;
      type: ChatRoomType;
      storeId?: string;
      deletionMode: ChatDeletionMode;
      savePolicy?: ChatSavePolicy;
      initialInviteQueries?: string[];
    },
    actor?: UserAccount | null
  ): Promise<ChatRoom> {
    const effectiveActor = actor || this.getSessionUserSync();
    if (!effectiveActor) throw new Error('Sessão expirada.');

    const isSuperSecret = input.type === 'SUPER_SECRET';

    if (isSuperSecret) {
      if (!canCreateSuperSecretChat(effectiveActor.role)) {
        throw new Error(
          'O Chat Super Secreto / Confidencial é exclusivo do Presidente.'
        );
      }
    } else if (!canCreateChatRoom(effectiveActor.role)) {
      throw new Error(
        'Apenas Gerentes, Governadores, Presidente ou Super Admin podem criar salas de chat.'
      );
    }

    const persistedRooms = this.readJson<ChatRoom[]>(
      STORAGE_KEYS.CHAT_ROOMS,
      []
    );
    const allRooms = this.getAllChatRoomsSync();

    // Limite máximo estrito de 3 salas para Gerente
    const maxRooms = getMaxChatRoomsForRole(effectiveActor.role);
    if (maxRooms !== null && !isSuperSecret) {
      const createdByGerenteCount = persistedRooms.filter(
        (r) => r.createdByUserId === effectiveActor.id
      ).length;
      if (createdByGerenteCount >= maxRooms) {
        throw new Error(
          `Limite máximo de ${maxRooms} salas criadas atingido para Gerente. Encerre ou destrua uma sala existente antes de abrir outra.`
        );
      }
    }

    const allUsers = await this.getUsers();
    const stores = await this.getStores();
    const participantSet = new Set<string>([effectiveActor.id]);

    let targetStore: StoreUnit | undefined;
    if (input.type === 'STORE') {
      if (!input.storeId) {
        throw new Error('Selecione a loja para criar o Chat da Loja.');
      }
      targetStore = stores.find((s) => s.id === input.storeId);
      if (!targetStore) {
        throw new Error('Loja não encontrada.');
      }
      // Adiciona automaticamente todos os funcionários ativos vinculados à loja
      targetStore.employeeIds.forEach((empId) => {
        const emp = allUsers.find((u) => u.id === empId && !u.isBlocked);
        if (emp) participantSet.add(emp.id);
      });
    } else if (input.initialInviteQueries && input.initialInviteQueries.length > 0) {
      for (const rawQuery of input.initialInviteQueries) {
        const trimmed = rawQuery.trim();
        if (!trimmed) continue;
        const matched = this.findExactUserByQuery(trimmed, allUsers);
        if (!matched) {
          throw new Error(
            `Usuário "${trimmed}" não encontrado ou bloqueado. Digite o Nome exato ou o ID único (ex: USR-0001).`
          );
        }
        if (
          effectiveActor.role === 'GERENTE' &&
          matched.role === 'PRESIDENTE'
        ) {
          throw new Error(
            'Gerente não pode convidar o Presidente diretamente. Crie a sala e compartilhe o Código Único da sala com ele.'
          );
        }
        participantSet.add(matched.id);
      }
    }

    const cleanName =
      input.name.trim() ||
      (isSuperSecret
        ? 'Sala Super Secreta (Memória)'
        : targetStore
        ? `Chat · ${targetStore.name}`
        : 'Chat de Gestão');

    const savePolicy: ChatSavePolicy =
      !isSuperSecret && canChooseSaveChatHistory(effectiveActor.role)
        ? input.savePolicy || 'DELETE_ON_CLOSE'
        : 'DELETE_ON_CLOSE';

    const now = Date.now();
    const room: ChatRoom = {
      id: this.generateId(isSuperSecret ? 'secroom' : 'room'),
      roomCode: this.generateUniqueRoomCode(allRooms),
      name: cleanName.slice(0, 60),
      type: input.type,
      storeId: targetStore?.id,
      storeCode: targetStore?.storeCode,
      storeName: targetStore?.name,
      deletionMode: input.deletionMode,
      savePolicy,
      isSuperSecret,
      createdByUserId: effectiveActor.id,
      createdByName: effectiveActor.name,
      createdByRole: effectiveActor.role,
      participantIds: Array.from(participantSet),
      removedEmployeeIds: [],
      createdAt: now,
      updatedAt: now,
    };

    if (isSuperSecret) {
      // Zero persistência: apenas em memória JS
      this.secretChatRooms.set(room.id, room);
      this.secretChatMessages.set(room.id, []);
    } else {
      this.writeJson(STORAGE_KEYS.CHAT_ROOMS, [room, ...persistedRooms]);
    }

    this.emitChatRooms();
    return room;
  }

  async joinChatRoomByCode(
    rawCode: string,
    actor?: UserAccount | null
  ): Promise<ChatRoom> {
    const effectiveActor = actor || this.getSessionUserSync();
    if (!effectiveActor) throw new Error('Sessão expirada.');

    const normalized = rawCode.trim().toUpperCase();
    if (!normalized) {
      throw new Error('Digite o código da sala (ex: SALA-1234).');
    }
    const targetCode = normalized.startsWith('SALA-')
      ? normalized
      : `SALA-${normalized}`;

    const secretMatch = Array.from(this.secretChatRooms.values()).find(
      (r) =>
        r.roomCode.toUpperCase() === normalized ||
        r.roomCode.toUpperCase() === targetCode
    );
    if (secretMatch) {
      const updated: ChatRoom = secretMatch.participantIds.includes(
        effectiveActor.id
      )
        ? secretMatch
        : {
            ...secretMatch,
            participantIds: [...secretMatch.participantIds, effectiveActor.id],
            removedEmployeeIds: (secretMatch.removedEmployeeIds || []).filter(
              (id) => id !== effectiveActor.id
            ),
            updatedAt: Date.now(),
          };
      this.secretChatRooms.set(updated.id, updated);
      this.emitChatRooms();
      return updated;
    }

    const persisted = this.readJson<ChatRoom[]>(STORAGE_KEYS.CHAT_ROOMS, []);
    const idx = persisted.findIndex(
      (r) =>
        r.roomCode.toUpperCase() === normalized ||
        r.roomCode.toUpperCase() === targetCode
    );
    if (idx === -1) {
      throw new Error(
        `Nenhuma sala ativa encontrada com o código "${normalized}".`
      );
    }

    const existing = persisted[idx];
    const updated: ChatRoom = existing.participantIds.includes(
      effectiveActor.id
    )
      ? existing
      : {
          ...existing,
          participantIds: [...existing.participantIds, effectiveActor.id],
          removedEmployeeIds: (existing.removedEmployeeIds || []).filter(
            (id) => id !== effectiveActor.id
          ),
          updatedAt: Date.now(),
        };

    const next = [...persisted];
    next[idx] = updated;
    this.writeJson(STORAGE_KEYS.CHAT_ROOMS, next);
    this.emitChatRooms();
    return updated;
  }

  async inviteUserToChatRoomExact(
    roomId: string,
    query: string,
    actor?: UserAccount | null
  ): Promise<ChatRoom> {
    const effectiveActor = actor || this.getSessionUserSync();
    if (!effectiveActor) throw new Error('Sessão expirada.');

    const allUsers = await this.getUsers();
    const matched = this.findExactUserByQuery(query, allUsers);
    if (!matched) {
      throw new Error(
        'Usuário não encontrado ou bloqueado. Informe exatamente o Nome completo ou o ID único (ex: USR-0001).'
      );
    }

    if (effectiveActor.role === 'GERENTE' && matched.role === 'PRESIDENTE') {
      throw new Error(
        'Gerente não pode convidar o Presidente diretamente. Compartilhe o Código Único da sala para que ele entre.'
      );
    }

    const secretRoom = this.secretChatRooms.get(roomId);
    if (secretRoom) {
      if (secretRoom.participantIds.includes(matched.id)) return secretRoom;
      const updated: ChatRoom = {
        ...secretRoom,
        participantIds: [...secretRoom.participantIds, matched.id],
        updatedAt: Date.now(),
      };
      this.secretChatRooms.set(roomId, updated);
      this.emitChatRooms();
      return updated;
    }

    const persisted = this.readJson<ChatRoom[]>(STORAGE_KEYS.CHAT_ROOMS, []);
    const idx = persisted.findIndex((r) => r.id === roomId);
    if (idx === -1) throw new Error('Sala de chat não encontrada.');

    const existing = persisted[idx];
    if (existing.participantIds.includes(matched.id)) return existing;

    const updated: ChatRoom = {
      ...existing,
      participantIds: [...existing.participantIds, matched.id],
      removedEmployeeIds: (existing.removedEmployeeIds || []).filter(
        (id) => id !== matched.id
      ),
      updatedAt: Date.now(),
    };
    const next = [...persisted];
    next[idx] = updated;
    this.writeJson(STORAGE_KEYS.CHAT_ROOMS, next);
    this.emitChatRooms();
    return updated;
  }

  async toggleStoreRoomParticipant(
    roomId: string,
    targetUserId: string,
    include: boolean,
    actor?: UserAccount | null
  ): Promise<ChatRoom> {
    const effectiveActor = actor || this.getSessionUserSync();
    if (!effectiveActor) throw new Error('Sessão expirada.');
    if (ROLE_LEVEL[effectiveActor.role] > 4) {
      throw new Error('Apenas gestores podem alterar participantes da loja.');
    }

    const persisted = this.readJson<ChatRoom[]>(STORAGE_KEYS.CHAT_ROOMS, []);
    const idx = persisted.findIndex((r) => r.id === roomId);
    if (idx === -1) throw new Error('Sala não encontrada.');

    const room = persisted[idx];
    if (targetUserId === room.createdByUserId && !include) {
      throw new Error('O criador da sala não pode ser removido.');
    }

    const nextParticipants = include
      ? Array.from(new Set([...room.participantIds, targetUserId]))
      : room.participantIds.filter((id) => id !== targetUserId);
    const nextRemoved = include
      ? (room.removedEmployeeIds || []).filter((id) => id !== targetUserId)
      : Array.from(new Set([...(room.removedEmployeeIds || []), targetUserId]));

    const updated: ChatRoom = {
      ...room,
      participantIds: nextParticipants,
      removedEmployeeIds: nextRemoved,
      updatedAt: Date.now(),
    };

    const next = [...persisted];
    next[idx] = updated;
    this.writeJson(STORAGE_KEYS.CHAT_ROOMS, next);
    this.emitChatRooms();
    return updated;
  }

  async sendChatMessage(
    roomId: string,
    content: string,
    actor?: UserAccount | null
  ): Promise<ChatMessage> {
    const effectiveActor = actor || this.getSessionUserSync();
    if (!effectiveActor) throw new Error('Sessão expirada.');
    if (!hasPermission(effectiveActor, 'canSendMessages')) {
      throw new Error('Sua conta não tem permissão para enviar mensagens.');
    }

    const clean = content.trim();
    if (!clean) throw new Error('Digite uma mensagem antes de enviar.');

    const room = this.getAllChatRoomsSync().find((r) => r.id === roomId);
    if (!room) throw new Error('Esta sala foi encerrada ou destruída.');
    if (!room.participantIds.includes(effectiveActor.id)) {
      throw new Error('Você não é participante desta sala.');
    }

    const msg: ChatMessage = {
      id: this.generateId('cmsg'),
      roomId: room.id,
      senderId: effectiveActor.id,
      senderName: effectiveActor.name,
      senderRole: effectiveActor.role,
      content: clean.slice(0, 800),
      readByUserIds: [effectiveActor.id],
      deletedForUserIds: [],
      createdAt: Date.now(),
    };

    if (room.isSuperSecret || room.type === 'SUPER_SECRET') {
      // 100% em memória: NUNCA grava em localStorage e NUNCA gera .TXT
      const currentSecret = this.secretChatMessages.get(room.id) || [];
      this.secretChatMessages.set(room.id, [...currentSecret, msg]);
      const updatedRoom: ChatRoom = { ...room, updatedAt: Date.now() };
      this.secretChatRooms.set(room.id, updatedRoom);
      this.emitChatRooms();
      this.emitChatMessages();
      return msg;
    }

    const existing = this.readJson<ChatMessage[]>(
      STORAGE_KEYS.CHAT_MESSAGES,
      []
    );
    this.writeJson(STORAGE_KEYS.CHAT_MESSAGES, [...existing, msg]);

    const rooms = this.readJson<ChatRoom[]>(STORAGE_KEYS.CHAT_ROOMS, []);
    this.writeJson(
      STORAGE_KEYS.CHAT_ROOMS,
      rooms.map((r) =>
        r.id === room.id ? { ...r, updatedAt: Date.now() } : r
      )
    );

    // Auditoria Silenciosa em .TXT (WhatsApp-style) — exclusiva do Super Admin
    ChatAuditService.recordMessageSilently(room, msg);

    this.emitChatRooms();
    this.emitChatMessages();
    return msg;
  }

  /**
   * v4.4-Final: Leitura & Exclusão Individual Pós-Leitura.
   * Quando um participante abre/lê a mensagem em sala POST_READ, ela é apagada imediatamente
   * apenas para ele; assim que todos os participantes da sala tiverem lido, é removida por completo.
   */
  async markChatMessagesRead(
    roomId: string,
    messageIds: string[],
    actor?: UserAccount | null
  ): Promise<void> {
    const effectiveActor = actor || this.getSessionUserSync();
    if (!effectiveActor || messageIds.length === 0) return;

    const room = this.getAllChatRoomsSync().find((r) => r.id === roomId);
    if (!room) return;
    const idSet = new Set(messageIds);
    const isPostRead = room.deletionMode === 'POST_READ';

    const processList = (list: ChatMessage[]): { next: ChatMessage[]; changed: boolean } => {
      let changed = false;
      const next: ChatMessage[] = [];

      for (const msg of list) {
        if (msg.roomId !== roomId || !idSet.has(msg.id)) {
          next.push(msg);
          continue;
        }

        const nextRead = msg.readByUserIds.includes(effectiveActor.id)
          ? msg.readByUserIds
          : [...msg.readByUserIds, effectiveActor.id];

        const nextDeleted = isPostRead
          ? msg.deletedForUserIds.includes(effectiveActor.id)
            ? msg.deletedForUserIds
            : [...msg.deletedForUserIds, effectiveActor.id]
          : msg.deletedForUserIds;

        if (
          nextRead.length !== msg.readByUserIds.length ||
          nextDeleted.length !== msg.deletedForUserIds.length
        ) {
          changed = true;
        }

        const allParticipantsRead =
          room.participantIds.length > 0 &&
          room.participantIds.every((pid) => nextRead.includes(pid));

        if (isPostRead && allParticipantsRead) {
          // Último participante leu -> remove por completo da tela e do armazenamento
          changed = true;
          continue;
        }

        next.push({
          ...msg,
          readByUserIds: nextRead,
          deletedForUserIds: nextDeleted,
        });
      }

      return { next, changed };
    };

    if (room.isSuperSecret || room.type === 'SUPER_SECRET') {
      const current = this.secretChatMessages.get(roomId) || [];
      const { next, changed } = processList(current);
      if (changed) {
        this.secretChatMessages.set(roomId, next);
        this.emitChatMessages();
      }
      return;
    }

    const persisted = this.readJson<ChatMessage[]>(
      STORAGE_KEYS.CHAT_MESSAGES,
      []
    );
    const { next, changed } = processList(persisted);
    if (changed) {
      this.writeJson(STORAGE_KEYS.CHAT_MESSAGES, next);
      this.emitChatMessages();
    }
  }

  /**
   * v4.4-Final: Botão de Pânico dentro da sala ("Destruir Chat Agora").
   * Destrói a sala e todas as mensagens instantaneamente para todos os participantes.
   */
  async panicDestroyChatRoom(
    roomId: string,
    actor?: UserAccount | null
  ): Promise<void> {
    const effectiveActor = actor || this.getSessionUserSync();
    if (!effectiveActor) throw new Error('Sessão expirada.');

    const room = this.getAllChatRoomsSync().find((r) => r.id === roomId);
    if (!room) return;

    if (!canPanicDestroyChat(effectiveActor, room.createdByUserId)) {
      throw new Error('Sem permissão para acionar o botão de pânico desta sala.');
    }

    if (room.isSuperSecret || room.type === 'SUPER_SECRET') {
      this.secretChatRooms.delete(roomId);
      this.secretChatMessages.delete(roomId);
      this.emitChatRooms();
      this.emitChatMessages();
      return;
    }

    const rooms = this.readJson<ChatRoom[]>(STORAGE_KEYS.CHAT_ROOMS, []);
    const msgs = this.readJson<ChatMessage[]>(STORAGE_KEYS.CHAT_MESSAGES, []);

    this.writeJson(
      STORAGE_KEYS.CHAT_ROOMS,
      rooms.filter((r) => r.id !== roomId)
    );
    this.writeJson(
      STORAGE_KEYS.CHAT_MESSAGES,
      msgs.filter((m) => m.roomId !== roomId)
    );

    await ChatAuditService.finalizeRoomAuditLog(room, 'PANIC_DESTROYED');

    this.emitChatRooms();
    this.emitChatMessages();
  }

  async closeChatRoom(
    roomId: string,
    actor?: UserAccount | null
  ): Promise<void> {
    const effectiveActor = actor || this.getSessionUserSync();
    if (!effectiveActor) throw new Error('Sessão expirada.');

    const room = this.getAllChatRoomsSync().find((r) => r.id === roomId);
    if (!room) return;

    if (
      room.createdByUserId !== effectiveActor.id &&
      ROLE_LEVEL[effectiveActor.role] > 3
    ) {
      throw new Error('Apenas o criador da sala ou alta gestão pode encerrar.');
    }

    if (room.isSuperSecret || room.type === 'SUPER_SECRET') {
      this.secretChatRooms.delete(roomId);
      this.secretChatMessages.delete(roomId);
      this.emitChatRooms();
      this.emitChatMessages();
      return;
    }

    const rooms = this.readJson<ChatRoom[]>(STORAGE_KEYS.CHAT_ROOMS, []);
    const msgs = this.readJson<ChatMessage[]>(STORAGE_KEYS.CHAT_MESSAGES, []);

    this.writeJson(
      STORAGE_KEYS.CHAT_ROOMS,
      rooms.filter((r) => r.id !== roomId)
    );
    this.writeJson(
      STORAGE_KEYS.CHAT_MESSAGES,
      msgs.filter((m) => m.roomId !== roomId)
    );

    await ChatAuditService.finalizeRoomAuditLog(room, 'CLOSED');

    this.emitChatRooms();
    this.emitChatMessages();
  }

  // ==========================================================
  // OCORRÊNCIAS NO MAPA, 3 FASES (0-20m / SOMBRA / PROJEÇÃO 1H) & AUDITORIA
  // ==========================================================

  async sweepExpiredOccurrences(): Promise<void> {
    const now = Date.now();
    const occs = this.readJson<MapOccurrence[]>(STORAGE_KEYS.OCCURRENCES, []);
    // Na v4.0, a ocorrência permanece rastreável por até 60 minutos desde a última atualização
    const expired = occs.filter(
      (o) => now >= (o.lastUpdatedAt || o.createdAt) + OCCURRENCE_MAX_LIFE_MS
    );
    if (expired.length === 0) return;

    const expiredIds = new Set(expired.map((o) => o.id));
    const remaining = occs.filter((o) => !expiredIds.has(o.id));
    this.writeJson(STORAGE_KEYS.OCCURRENCES, remaining);

    const audits = this.readJson<AlertAuditEntry[]>(
      STORAGE_KEYS.ALERT_AUDIT,
      []
    );
    const nextAudits = audits.map((entry) => {
      if (entry.status === 'ACTIVE' && expiredIds.has(entry.occurrenceId)) {
        const occ = expired.find((o) => o.id === entry.occurrenceId);
        return {
          ...entry,
          status: 'EXPIRED' as const,
          closedAt:
            (occ?.lastUpdatedAt || occ?.createdAt || now) +
            OCCURRENCE_MAX_LIFE_MS,
        };
      }
      return entry;
    });
    this.writeJson(STORAGE_KEYS.ALERT_AUDIT, nextAudits);

    this.emitOccurrences();
    this.emitAlertAudit();
  }

  async getOccurrences(): Promise<MapOccurrence[]> {
    this.ensureSeededAndMigrated();
    await this.sweepExpiredOccurrences();
    return this.readJson<MapOccurrence[]>(STORAGE_KEYS.OCCURRENCES, []);
  }

  subscribeToOccurrences(callback: Listener<MapOccurrence[]>): () => void {
    this.ensureSeededAndMigrated();
    this.occurrenceListeners.add(callback);
    void this.sweepExpiredOccurrences().then(() => {
      callback(this.readJson(STORAGE_KEYS.OCCURRENCES, []));
    });
    return () => {
      this.occurrenceListeners.delete(callback);
    };
  }

  async getAlertAudit(): Promise<AlertAuditEntry[]> {
    this.ensureSeededAndMigrated();
    return this.readJson<AlertAuditEntry[]>(STORAGE_KEYS.ALERT_AUDIT, []);
  }

  subscribeToAlertAudit(callback: Listener<AlertAuditEntry[]>): () => void {
    this.ensureSeededAndMigrated();
    this.alertAuditListeners.add(callback);
    callback(this.readJson<AlertAuditEntry[]>(STORAGE_KEYS.ALERT_AUDIT, []));
    return () => {
      this.alertAuditListeners.delete(callback);
    };
  }

  async addOccurrence(
    input: Omit<
      MapOccurrence,
      | 'id'
      | 'createdAt'
      | 'expiresAt'
      | 'lastUpdatedAt'
      | 'trailPoints'
      | 'dismissedByUserIds'
    > & {
      storeCode?: string;
    }
  ): Promise<MapOccurrence> {
    const list = await this.getOccurrences();
    const now = Date.now();
    const durationMinutes = Math.max(1, input.durationMinutes || 20);
    const expiresAt = now + OCCURRENCE_ACTIVE_MS;
    const cleanTag = input.tag?.trim().slice(0, 10) || undefined;

    const { storeCode, ...occFields } = input;

    const created: MapOccurrence = {
      ...occFields,
      tag: cleanTag,
      durationMinutes,
      expiresAt,
      lastUpdatedAt: now,
      trailPoints: [{ lat: input.lat, lng: input.lng, timestamp: now }],
      dismissedByUserIds: [input.createdByUserId],
      id: this.generateId('occ'),
      createdAt: now,
    };

    this.writeJson(STORAGE_KEYS.OCCURRENCES, [created, ...list]);

    const audits = this.readJson<AlertAuditEntry[]>(
      STORAGE_KEYS.ALERT_AUDIT,
      []
    );
    const auditEntry: AlertAuditEntry = {
      id: this.generateId('aud'),
      occurrenceId: created.id,
      createdAt: created.createdAt,
      expiresAt: created.expiresAt,
      storeId: created.storeId,
      storeCode,
      storeName: created.storeName || 'Fora de perímetro',
      categoryName: created.categoryName,
      subcategoryName: created.subcategoryName,
      tag: created.tag,
      createdByUserId: created.createdByUserId,
      createdByName: created.createdByName,
      createdByUsername: created.createdByUsername,
      status: 'ACTIVE',
    };
    this.writeJson(STORAGE_KEYS.ALERT_AUDIT, [auditEntry, ...audits]);

    this.emitOccurrences();
    this.emitAlertAudit();
    return created;
  }

  /**
   * v4.0: Atualização colaborativa ("👁️ Eu vi!") — move o pino para a coordenada exata na rua,
   * adiciona ponto ao rastro pontilhado e reinicia o cronômetro de 20 minutos.
   */
  async updateOccurrenceSighting(
    occurrenceId: string,
    lat: number,
    lng: number,
    actor?: UserAccount | null
  ): Promise<MapOccurrence> {
    const list = await this.getOccurrences();
    const idx = list.findIndex((o) => o.id === occurrenceId);
    if (idx === -1) {
      throw new Error('Ocorrência não encontrada ou já encerrada.');
    }

    const now = Date.now();
    const prev = list[idx];
    const stores = await this.getStores();
    const containingStores = stores
      .map((s) => ({
        store: s,
        dist: getDistanceMeters(lat, lng, s.lat, s.lng),
      }))
      .filter((item) => item.dist <= item.store.radiusKm * 1000)
      .sort((a, b) => a.dist - b.dist);
    const primaryStore = containingStores[0]?.store;

    const nextTrail = [
      ...(prev.trailPoints || [
        { lat: prev.lat, lng: prev.lng, timestamp: prev.createdAt },
      ]),
      { lat, lng, timestamp: now },
    ];
    const nextExpiresAt = now + OCCURRENCE_ACTIVE_MS;

    const updated: MapOccurrence = {
      ...prev,
      lat,
      lng,
      storeId: primaryStore?.id,
      storeName: primaryStore?.name || 'Fora de perímetro',
      lastUpdatedAt: now,
      expiresAt: nextExpiresAt,
      trailPoints: nextTrail,
      dismissedByUserIds: actor ? [actor.id] : [],
    };

    const nextList = [...list];
    nextList[idx] = updated;
    this.writeJson(STORAGE_KEYS.OCCURRENCES, nextList);

    const audits = this.readJson<AlertAuditEntry[]>(
      STORAGE_KEYS.ALERT_AUDIT,
      []
    );
    const nextAudits = audits.map((entry) =>
      entry.occurrenceId === occurrenceId
        ? {
            ...entry,
            expiresAt: nextExpiresAt,
            storeId: updated.storeId,
            storeCode: primaryStore?.storeCode,
            storeName: updated.storeName || entry.storeName,
            status: 'ACTIVE' as const,
          }
        : entry
    );
    this.writeJson(STORAGE_KEYS.ALERT_AUDIT, nextAudits);

    this.emitOccurrences();
    this.emitAlertAudit();
    return updated;
  }

  /**
   * v4.0: Usuário clica em "✕ Não vi" no pop-up persistente dentro do raio da loja.
   * Dispensa o aviso apenas para este usuário.
   */
  async dismissOccurrenceAlert(
    occurrenceId: string,
    userId: string
  ): Promise<void> {
    const list = await this.getOccurrences();
    let changed = false;
    const next = list.map((occ) => {
      if (occ.id !== occurrenceId) return occ;
      const existing = occ.dismissedByUserIds || [];
      if (existing.includes(userId)) return occ;
      changed = true;
      return {
        ...occ,
        dismissedByUserIds: [...existing, userId],
      };
    });
    if (changed) {
      this.writeJson(STORAGE_KEYS.OCCURRENCES, next);
      this.emitOccurrences();
    }
  }

  /**
   * v4.4-Final: Saneamento da Campainha do Mapa.
   * Marca o alerta como lido apenas para o usuário atual, removendo da campainha imediatamente.
   */
  async markOccurrenceBellRead(
    occurrenceId: string,
    userId: string
  ): Promise<void> {
    const list = await this.getOccurrences();
    let changed = false;
    const next = list.map((occ) => {
      if (occ.id !== occurrenceId) return occ;
      const existing = occ.bellReadByUserIds || [];
      if (existing.includes(userId)) return occ;
      changed = true;
      return {
        ...occ,
        bellReadByUserIds: [...existing, userId],
      };
    });
    if (changed) {
      this.writeJson(STORAGE_KEYS.OCCURRENCES, next);
      this.emitOccurrences();
    }
  }

  async deleteOccurrence(id: string, actor?: UserAccount | null): Promise<void> {
    const list = await this.getOccurrences();
    this.writeJson(
      STORAGE_KEYS.OCCURRENCES,
      list.filter((o) => o.id !== id)
    );

    const audits = this.readJson<AlertAuditEntry[]>(
      STORAGE_KEYS.ALERT_AUDIT,
      []
    );
    const closedAt = Date.now();
    const nextAudits = audits.map((entry) => {
      if (entry.occurrenceId === id && entry.status === 'ACTIVE') {
        return {
          ...entry,
          status: 'COMPLETED' as const,
          closedByUserId: actor?.id,
          closedByName: actor?.name || 'Sistema',
          closedByUsername: actor?.username || 'sistema',
          closedAt,
        };
      }
      return entry;
    });
    this.writeJson(STORAGE_KEYS.ALERT_AUDIT, nextAudits);

    this.emitOccurrences();
    this.emitAlertAudit();
  }

  async clearAllOccurrences(actor?: UserAccount | null): Promise<void> {
    this.writeJson(STORAGE_KEYS.OCCURRENCES, []);

    const audits = this.readJson<AlertAuditEntry[]>(
      STORAGE_KEYS.ALERT_AUDIT,
      []
    );
    const closedAt = Date.now();
    const nextAudits = audits.map((entry) => {
      if (entry.status === 'ACTIVE') {
        return {
          ...entry,
          status: 'COMPLETED' as const,
          closedByUserId: actor?.id,
          closedByName: actor?.name || 'Administração',
          closedByUsername: actor?.username || 'admin',
          closedAt,
        };
      }
      return entry;
    });
    this.writeJson(STORAGE_KEYS.ALERT_AUDIT, nextAudits);

    this.emitOccurrences();
    this.emitAlertAudit();
  }

  // ==========================================================
  // CONTROLE DE VERSÃO, CHECKLIST QA & ROADMAP (SUPER ADMIN)
  // Chave isolada e blindada: saas_mapa_qa_changelog_v1
  // ==========================================================

  async getQaChangelog(): Promise<QaChangelogState> {
    this.ensureSeededAndMigrated();
    return this.readJson<QaChangelogState>(
      STORAGE_KEYS.QA_CHANGELOG,
      createSeedQaChangelog()
    );
  }

  async saveQaChangelog(state: QaChangelogState): Promise<QaChangelogState> {
    const next: QaChangelogState = {
      ...state,
      lastSavedAt: Date.now(),
    };
    this.writeJson(STORAGE_KEYS.QA_CHANGELOG, next);
    this.emitQaChangelog();
    return next;
  }

  subscribeToQaChangelog(callback: Listener<QaChangelogState>): () => void {
    this.ensureSeededAndMigrated();
    this.qaListeners.add(callback);
    callback(
      this.readJson<QaChangelogState>(
        STORAGE_KEYS.QA_CHANGELOG,
        createSeedQaChangelog()
      )
    );
    return () => {
      this.qaListeners.delete(callback);
    };
  }
}

export const DataService = new MultiOrgDataService();
