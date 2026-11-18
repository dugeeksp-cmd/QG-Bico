export type UserRole =
  | 'SUPER_ADMIN'
  | 'PRESIDENTE'
  | 'GOVERNADOR'
  | 'GERENTE'
  | 'SUBGERENTE'
  | 'FISCAL_LOJA'
  | 'CAIXA';

export type StoreRegion = 'Norte' | 'Sul' | 'Leste' | 'Oeste' | 'Centro';

export const STORE_REGIONS: StoreRegion[] = [
  'Norte',
  'Sul',
  'Leste',
  'Oeste',
  'Centro',
];

export interface UserPermissions {
  canViewMap: boolean;
  canMarkOccurrences: boolean;
  canCompleteOccurrences: boolean;
  canOpenCloseStore: boolean;
  canSendMessages: boolean;
  canManageStores: boolean;
  canManageUsers: boolean;
  canResetPasswords: boolean;
  canManageCatalog: boolean;
  canViewDashboardAudit: boolean;
  canViewStoreInventory: boolean;
  canWithdrawRestockInventory: boolean;
}

export interface PermissionMeta {
  key: keyof UserPermissions;
  label: string;
  description: string;
  minRecommendedNote?: string;
}

export const PERMISSION_DEFINITIONS: PermissionMeta[] = [
  {
    key: 'canViewMap',
    label: 'Acessar e visualizar o mapa compartilhado',
    description: 'Permite abrir o Mapa ao Vivo e ver lojas e alertas ativos.',
  },
  {
    key: 'canMarkOccurrences',
    label: 'Marcar ocorrências no mapa',
    description: 'Habilita o registro de alertas no local ou apontando no mapa.',
  },
  {
    key: 'canCompleteOccurrences',
    label: 'Concluir / excluir alertas no mapa',
    description: 'Permite dar baixa ou encerrar ocorrências ativas no radar.',
  },
  {
    key: 'canOpenCloseStore',
    label: 'Abrir e fechar loja',
    description: 'Permite alternar o status Aberta/Fechada das lojas vinculadas.',
  },
  {
    key: 'canSendMessages',
    label: 'Enviar mensagens',
    description: 'Permite enviar comunicados e mensagens no canal da equipe.',
  },
  {
    key: 'canViewStoreInventory',
    label: 'Visualizar estoque/inventário da loja',
    description:
      'Define se o operador pode enxergar o saldo geral de produtos disponíveis na loja.',
  },
  {
    key: 'canWithdrawRestockInventory',
    label: 'Realizar retirada e reposição de estoque',
    description:
      'Autoriza retirar carga na abertura da loja e solicitar reposição durante o expediente.',
  },
  {
    key: 'canManageStores',
    label: 'Cadastrar e editar lojas',
    description: 'Permite criar novas unidades, editar perímetros e responsáveis.',
  },
  {
    key: 'canManageUsers',
    label: 'Cadastrar, editar e bloquear usuários',
    description: 'Gerencia equipe e permissões do seu nível para baixo.',
  },
  {
    key: 'canResetPasswords',
    label: 'Redefinir senha de usuários',
    description: 'Permite trocar a senha de usuários do seu nível para baixo.',
  },
  {
    key: 'canManageCatalog',
    label: 'Gerenciar catálogo de Categorias e Subcategorias',
    description: 'Cria e edita categorias, ícones e subcategorias do mapa.',
    minRecommendedNote: 'Governador+',
  },
  {
    key: 'canViewDashboardAudit',
    label: 'Acessar Dashboard e Histórico de Auditoria',
    description: 'Visualiza métricas, linha do tempo, hierarquia e logs de alertas.',
    minRecommendedNote: 'Gerente+',
  },
];

export interface UserAccount {
  id: string;
  userCode: string; // Ex: USR-0001 (chave legível para busca/vínculo)
  name: string;
  username: string; // Único (lowercase)
  password: string;
  role: UserRole;
  permissions: UserPermissions;
  isBlocked?: boolean;
  isPublicProfile?: boolean; // Padrão false (privado na regra de 2 níveis)
  region?: StoreRegion;
  avatarDataUrl?: string;
  createdByUserId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface FormerStoreEmployee {
  userId: string;
  userCode: string;
  name: string;
  unlinkedAt: number;
}

/**
 * v4.3-UI Camada 1: Catálogo Mestre Global de Produtos (criação exclusiva Super Admin e Presidente)
 */
export interface MasterProduct {
  id: string;
  name: string;
  photoDataUrl?: string; // Miniatura circular estilo Instagram
  unitPrice: number; // Preço unitário padrão (R$)
  createdByUserId: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * v4.3-UI Camada 1.5: Estoque Central do Gestor (Governador / Gerente / Admin)
 */
export interface CentralStockEntry {
  id: string;
  ownerUserId: string;
  ownerName: string;
  ownerRole: UserRole;
  masterProductId: string;
  quantity: number;
  updatedAt: number;
}

/**
 * v4.3-UI Camada 2: Estoque Alocado na Loja
 */
export interface StoreMerchandiseItem {
  id: string;
  storeId: string;
  masterProductId?: string; // Referência ao Catálogo Mestre
  name: string;
  photoDataUrl?: string; // Exibida sempre em miniatura circular (avatar estilo Instagram)
  stockQuantity: number;
  unitPrice: number; // Preço de venda unitário (R$)
  createdAt: number;
  updatedAt: number;
}

/**
 * v4.3-UI Camada 3: Carga em Mãos do Operador no Turno
 */
export interface OperatorShiftItem {
  masterProductId: string;
  storeItemId: string;
  itemName: string;
  photoDataUrl?: string;
  unitPrice: number;
  initialWithdrawnQty: number;
  restockedQty: number;
  soldQty: number;
  currentHandQty: number;
}

export interface OperatorSaleEntry {
  id: string;
  masterProductId: string;
  storeItemId: string;
  itemName: string;
  photoDataUrl?: string;
  unitPrice: number;
  quantity: number;
  totalAmount: number;
  paymentMethod: 'CASH' | 'PIX';
  createdAt: number;
}

export interface OperatorShiftInventory {
  id: string;
  storeId: string;
  storeCode: string;
  storeName: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  items: OperatorShiftItem[];
  realTimeSales: OperatorSaleEntry[];
  status: 'ACTIVE' | 'CLOSED';
  openedAt: number;
  closedAt?: number;
}

export interface ReturnedStockLine {
  storeItemId: string;
  itemName: string;
  quantityReturned: number;
}

export interface StoreUnit {
  id: string;
  storeCode: string; // Ex: LJ-1001 (ID único de loja)
  name: string;
  region: StoreRegion;
  address: string;
  lat: number;
  lng: number;
  radiusKm: number;
  isOpen: boolean; // Inicia fechada (false = Offline/Fechada, true = Aberta/Online)
  photoDataUrl?: string; // Foto/Imagem opcional da loja
  motto?: string; // Frase/Recado da loja
  alertDurationMinutes: number; // Padrão 20 min (configurável por Gerente+)
  managerId: string; // Responsável obrigatório (Gerente, ou Governador/Presidente)
  managerIds: string[]; // Suporta múltiplos gestores vinculados (Gerente, Governador, Presidente)
  employeeIds: string[]; // IDs únicos de operacionais vinculados (Subgerente, Fiscal, Caixa)
  formerEmployees?: FormerStoreEmployee[]; // Ex-funcionários que já foram vinculados à loja
  onlineUserIds: string[]; // IDs de usuários atualmente visíveis como online na loja
  createdAt: number;
  updatedAt: number;
}

export interface ClosingMerchandiseLine {
  itemId: string;
  itemName: string;
  photoDataUrl?: string;
  unitPrice: number;
  quantitySold: number;
  lineTotal: number;
}

export type ClosingBalanceStatus = 'MATCHED' | 'SURPLUS' | 'SHORTAGE';

export type ClosingReviewStatus =
  | 'PENDING_GERENTE'
  | 'PENDING_GOVERNADOR'
  | 'APPROVED'
  | 'REJECTED';

export interface ClosingReviewDecision {
  reviewerUserId: string;
  reviewerName: string;
  reviewerRole: UserRole;
  decision: 'APPROVED' | 'REJECTED';
  observation?: string;
  decidedAt: number;
}

export interface StoreClosingRecord {
  id: string;
  storeId: string;
  storeCode: string;
  storeName: string;
  region: StoreRegion;
  closedByUserId: string;
  closedByName: string;
  dailySalesAmount?: number; // Total consolidado do fechamento em R$
  soldItems?: ClosingMerchandiseLine[];
  returnedItems?: ReturnedStockLine[]; // Sobra devolvida automaticamente ao estoque da loja
  totalItemsSold?: number;
  expectedSalesAmount?: number;
  cashReceived?: number;
  pixReceived?: number;
  totalReceived?: number;
  balanceDifference?: number; // totalReceived - expectedSalesAmount
  balanceStatus?: ClosingBalanceStatus;
  reviewStatus?: ClosingReviewStatus;
  managerDecision?: ClosingReviewDecision;
  governorDecision?: ClosingReviewDecision;
  closedAt: number;
}

export interface ClosingAlertNotification {
  id: string;
  closingId: string;
  storeId: string;
  storeCode: string;
  storeName: string;
  region: StoreRegion;
  targetRole: 'GERENTE' | 'GOVERNADOR' | 'PRESIDENTE';
  targetUserId?: string; // Gerente responsável quando direcionado à loja
  title: string;
  summary: string;
  reviewStatus: ClosingReviewStatus;
  readByUserIds: string[];
  createdAt: number;
}

/**
 * v4.3-UI: Alertas Administrativos / Financeiros (100% separados da campainha geográfica do mapa)
 */
export type AdminAlertType = 'OPENING_WITHDRAWAL' | 'RESTOCK';

export interface AdminAlertItemLine {
  storeItemId: string;
  itemName: string;
  photoDataUrl?: string;
  quantity: number;
  unitPrice: number;
}

export interface AdminFinanceAlert {
  id: string;
  type: AdminAlertType;
  storeId: string;
  storeCode: string;
  storeName: string;
  region: StoreRegion;
  actorUserId: string;
  actorName: string;
  actorRole: UserRole;
  targetManagerId?: string;
  title: string;
  summary: string;
  items: AdminAlertItemLine[];
  status: 'PENDING' | 'CONFIRMED' | 'DISCREPANCY';
  resolvedByUserId?: string;
  resolvedByName?: string;
  observation?: string;
  resolvedAt?: number;
  createdAt: number;
}

export interface StoreShiftLog {
  id: string;
  storeId: string;
  storeCode: string;
  storeName: string;
  action: 'OPENED' | 'CLOSED';
  actorUserId: string;
  actorName: string;
  note?: string;
  timestamp: number;
}

export interface TeamMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  storeId?: string; // Opcional: loja vinculada ou undefined para comunicado geral
  storeName?: string;
  content: string;
  createdAt: number;
}

/**
 * v4.4-Final: Salas de Chat Hierárquicas, Autodestrutivas, Confidenciais & Auditoria .TXT
 */
export type ChatRoomType = 'STORE' | 'MANAGEMENT' | 'SUPER_SECRET';

export type ChatDeletionMode = 'POST_READ' | 'PANIC_BUTTON';

export type ChatSavePolicy = 'DELETE_ON_CLOSE' | 'SAVE_HISTORY';

export interface ChatRoom {
  id: string;
  roomCode: string; // Ex: SALA-4821 (convite direto por código)
  name: string;
  type: ChatRoomType;
  storeId?: string;
  storeCode?: string;
  storeName?: string;
  deletionMode: ChatDeletionMode;
  savePolicy: ChatSavePolicy;
  isSuperSecret: boolean; // Exclusivo Presidente: 100% em memória, sem storage e sem .txt
  createdByUserId: string;
  createdByName: string;
  createdByRole: UserRole;
  participantIds: string[];
  removedEmployeeIds?: string[]; // Funcionários removidos manualmente pelo Gerente no Chat da Loja
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  content: string;
  readByUserIds: string[]; // Participantes que já abriram/leram a mensagem
  deletedForUserIds: string[]; // Participantes para quem a mensagem já foi apagada
  createdAt: number;
}

export interface ChatAuditLogFile {
  id: string;
  filename: string; // Ex: chat_SALA-4821_2026-11-18.txt
  roomId: string;
  roomCode: string;
  roomName: string;
  createdByName: string;
  createdByRole: UserRole;
  linesCount: number;
  contentTxt: string;
  status: 'ACTIVE' | 'CLOSED' | 'PANIC_DESTROYED';
  endpointDispatched: boolean;
  lastDispatchedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type VehicleIconKey =
  | 'pm'
  | 'gcm'
  | 'policia_civil'
  | 'auto_bomba'
  | 'resgate_bombeiros'
  | 'auto_escada'
  | 'samu'
  | 'uti_movel'
  | 'ambulancia_resgate'
  | 'enel'
  | 'claro'
  | 'vivo'
  | 'moto'
  | 'carro_prata'
  | 'carro_colorido';

export type CategoryIconType =
  | 'package_out'
  | 'package_in'
  | 'alert_triangle'
  | 'car'
  | 'custom_emoji';

export type SubcategoryVisualType =
  | 'vehicle_svg'
  | 'alert_triangle'
  | 'symbol'
  | 'emoji'
  | 'photo';

export type SymbolKey =
  | 'alert_triangle'
  | 'box_send'
  | 'box_receive'
  | 'truck_fast'
  | 'clock_wait'
  | 'check_ok'
  | 'shield'
  | 'wrench';

export interface CatalogCategory {
  id: string;
  name: string;
  colorHex: string;
  iconType: CategoryIconType;
  emoji?: string;
  isPrimary?: boolean; // Categoria Principal no botão 1 do Dock (Super Admin ou Presidente)
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface CatalogSubcategory {
  id: string;
  categoryId: string;
  name: string;
  visualType: SubcategoryVisualType;
  vehicleIconKey?: VehicleIconKey;
  symbolKey?: SymbolKey;
  emoji?: string;
  customImageDataUrl?: string;
  colorHex: string;
  pulseEffect?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface OccurrenceTrailPoint {
  lat: number;
  lng: number;
  timestamp: number;
}

export interface MapOccurrence {
  id: string;
  categoryId: string;
  categoryName: string;
  subcategoryId: string;
  subcategoryName: string;
  visualType: SubcategoryVisualType;
  vehicleIconKey?: VehicleIconKey;
  symbolKey?: SymbolKey;
  emoji?: string;
  customImageDataUrl?: string;
  colorHex: string;
  pulseEffect?: boolean;
  tag?: string; // Identificação curta opcional (até 10 caracteres)
  lat: number;
  lng: number;
  storeId?: string;
  storeName?: string;
  durationMinutes: number; // Padrão 20 min (janela Fase 1 Ativa)
  expiresAt: number; // Timestamp limite da Fase 1 Ativa (20 min após última atualização)
  lastUpdatedAt: number; // Timestamp da criação ou último "Eu vi!"
  trailPoints: OccurrenceTrailPoint[]; // Rastro de deslocamento na rua
  dismissedByUserIds?: string[]; // Usuários que clicaram em "Não vi" no aviso atual
  bellReadByUserIds?: string[]; // Usuários que clicaram em "Marcar como lido" na campainha
  createdByUserId: string;
  createdByName: string;
  createdByUsername: string;
  createdAt: number;
}

export type AlertAuditStatus = 'ACTIVE' | 'EXPIRED' | 'COMPLETED';

export interface AlertAuditEntry {
  id: string;
  occurrenceId: string;
  createdAt: number;
  expiresAt: number;
  storeId?: string;
  storeCode?: string;
  storeName: string;
  categoryName: string;
  subcategoryName: string;
  tag?: string;
  createdByUserId: string;
  createdByName: string;
  createdByUsername: string;
  status: AlertAuditStatus;
  closedByUserId?: string;
  closedByName?: string;
  closedByUsername?: string;
  closedAt?: number;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  PRESIDENTE: 'Presidente',
  GOVERNADOR: 'Governador',
  GERENTE: 'Gerente',
  SUBGERENTE: 'Subgerente',
  FISCAL_LOJA: 'Fiscal de Loja',
  CAIXA: 'Caixa',
};

export type AppScreenKey =
  | 'map'
  | 'finance'
  | 'dashboard'
  | 'closings'
  | 'inventory'
  | 'stores'
  | 'team'
  | 'catalog'
  | 'audit'
  | 'occurrences'
  | 'health';

export type QaTestStatus = 'pending' | 'approved' | 'attention' | 'urgent_error';

export type QaSectionKey = 'features' | 'bugs' | 'roadmap';

export interface QaChecklistItem {
  id: string;
  section: QaSectionKey;
  title: string;
  done: boolean;
  qaStatus: QaTestStatus;
  versionTag?: string;
  createdAt: number;
}

export interface VersionReleaseNote {
  version: string;
  releaseType: 'major' | 'minor';
  summary: string;
  releasedAt: number;
}

export interface QaChangelogState {
  version: string;
  items: QaChecklistItem[];
  releases?: VersionReleaseNote[];
  lastSavedAt?: number;
}
