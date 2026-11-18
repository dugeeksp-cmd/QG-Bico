import {
  ROLE_LABELS,
  StoreUnit,
  UserAccount,
  UserPermissions,
  UserRole,
} from '../types/radar';

export const ROLE_LEVEL: Record<UserRole, number> = {
  SUPER_ADMIN: 1,
  PRESIDENTE: 2,
  GOVERNADOR: 3,
  GERENTE: 4,
  SUBGERENTE: 5,
  FISCAL_LOJA: 6,
  CAIXA: 7,
};

export const ALL_ROLES_ORDERED: UserRole[] = [
  'SUPER_ADMIN',
  'PRESIDENTE',
  'GOVERNADOR',
  'GERENTE',
  'SUBGERENTE',
  'FISCAL_LOJA',
  'CAIXA',
];

export function getDefaultPermissionsForRole(role: UserRole): UserPermissions {
  const level = ROLE_LEVEL[role];
  return {
    canViewMap: true,
    canMarkOccurrences: true,
    canCompleteOccurrences: true,
    canOpenCloseStore: true,
    canSendMessages: true,
    canManageStores: level <= 4,
    canManageUsers: level <= 4,
    canResetPasswords: level <= 4,
    canManageCatalog: level <= 3,
    canViewDashboardAudit: level <= 4,
    canViewStoreInventory: level <= 6, // Gerente+, Subgerente, Fiscal por padrão (Caixa customizável)
    canWithdrawRestockInventory: level <= 5, // Gerente+ e Subgerente por padrão (Fiscal/Caixa customizável)
  };
}

export function hasPermission(
  user: UserAccount | null | undefined,
  permission: keyof UserPermissions
): boolean {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') {
    if (user.permissions && typeof user.permissions[permission] === 'boolean') {
      return user.permissions[permission];
    }
    return true;
  }
  if (user.permissions && typeof user.permissions[permission] === 'boolean') {
    return user.permissions[permission];
  }
  return getDefaultPermissionsForRole(user.role)[permission];
}

export function hasAdminPanelAccess(user: UserAccount): boolean {
  return (
    hasPermission(user, 'canManageStores') ||
    hasPermission(user, 'canManageUsers') ||
    hasPermission(user, 'canManageCatalog') ||
    hasPermission(user, 'canViewDashboardAudit') ||
    user.role === 'SUPER_ADMIN'
  );
}

export function canManageCatalog(user: UserAccount | UserRole): boolean {
  if (typeof user === 'string') return ROLE_LEVEL[user] <= 3;
  return hasPermission(user, 'canManageCatalog');
}

export function canSetPrimaryCategory(role: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'PRESIDENTE';
}

/**
 * v4.3-UI: Criação de novos produtos no Catálogo Mestre é EXCLUSIVA de Super Admin e Presidente
 */
export function canCreateMasterProduct(role: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'PRESIDENTE';
}

/**
 * v4.3-UI: Gestão de Estoque Central e Alocação para Lojas (Gerente, Governador, Presidente, Super Admin)
 */
export function canManageCentralStock(role: UserRole): boolean {
  return ROLE_LEVEL[role] <= 4;
}

/**
 * v4.3-UI: Acesso à tela "Financeiro & Vendas" (Caixa, Fiscal, Subgerente e Gerente vinculados a loja, ou Super Admin)
 */
export function canAccessFinanceSales(
  user: UserAccount,
  stores: StoreUnit[]
): boolean {
  if (user.role === 'SUPER_ADMIN') return stores.length > 0;
  if (ROLE_LEVEL[user.role] < 4) return false; // Presidente e Governador acompanham pelo Dashboard / Conferência
  return stores.some((s) => isUserLinkedToStore(user.id, s));
}

export function canManageStores(user: UserAccount | UserRole): boolean {
  if (typeof user === 'string') return ROLE_LEVEL[user] <= 4;
  return hasPermission(user, 'canManageStores');
}

export function canManageGlobalOccurrences(role: UserRole): boolean {
  return role === 'SUPER_ADMIN';
}

export function canViewAuditHistory(user: UserAccount | UserRole): boolean {
  if (typeof user === 'string') return ROLE_LEVEL[user] <= 4;
  return hasPermission(user, 'canViewDashboardAudit');
}

export function canViewGlobalAuditHistory(role: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'PRESIDENTE';
}

export function canManageQaVersion(role: UserRole): boolean {
  return role === 'SUPER_ADMIN';
}

export function canManageStoreOptions(role: UserRole): boolean {
  return ROLE_LEVEL[role] <= 4; // Gerente, Governador, Presidente, Super Admin
}

export function canAccessClosingReview(role: UserRole): boolean {
  return ROLE_LEVEL[role] <= 4; // Gerente, Governador, Presidente (leitura), Super Admin
}

export function canDecideClosingReview(role: UserRole): boolean {
  return role === 'GERENTE' || role === 'GOVERNADOR' || role === 'SUPER_ADMIN';
}

/**
 * v4.4-Final: Criação de salas de chat (Gerente+, com limite de 3 para Gerente e ilimitado para Governador+)
 */
export function canCreateChatRoom(role: UserRole): boolean {
  return ROLE_LEVEL[role] <= 4;
}

export function getMaxChatRoomsForRole(role: UserRole): number | null {
  if (role === 'GERENTE') return 3;
  if (ROLE_LEVEL[role] <= 3) return null; // Ilimitado (Super Admin, Presidente, Governador)
  return 0;
}

/**
 * v4.4-Final: Botão "Chat Super Secreto / Confidencial" exclusivo do Presidente
 */
export function canCreateSuperSecretChat(role: UserRole): boolean {
  return role === 'PRESIDENTE';
}

/**
 * v4.4-Final: Governador e Presidente (e Super Admin) podem optar por salvar histórico da conversa
 */
export function canChooseSaveChatHistory(role: UserRole): boolean {
  return (
    role === 'GOVERNADOR' ||
    role === 'PRESIDENTE' ||
    role === 'SUPER_ADMIN'
  );
}

export function canPanicDestroyChat(
  actor: UserAccount,
  createdByUserId: string
): boolean {
  if (actor.id === createdByUserId) return true;
  return ROLE_LEVEL[actor.role] <= 4;
}

export function canPromptOpenStoreOnLogin(user: UserAccount): boolean {
  return (
    ROLE_LEVEL[user.role] >= 4 &&
    ROLE_LEVEL[user.role] <= 7 &&
    hasPermission(user, 'canOpenCloseStore')
  );
}

export function isHighManagementInvisibleByDefault(role: UserRole): boolean {
  return ROLE_LEVEL[role] <= 4;
}

/**
 * v3.1-UI: Permite criar/atribuir cargos IGUAIS ou INFERIORES ao cargo do ator (nunca superiores).
 * Super Admin só pode ser criado por Super Admin.
 */
export function getAssignableRoles(actorRole: UserRole): UserRole[] {
  const actorLevel = ROLE_LEVEL[actorRole];
  return ALL_ROLES_ORDERED.filter((r) => {
    if (r === 'SUPER_ADMIN' && actorRole !== 'SUPER_ADMIN') return false;
    return ROLE_LEVEL[r] >= actorLevel;
  });
}

/**
 * v3.1-UI: Verifica se o gestor pode editar/redefinir senha/bloquear um usuário alvo.
 * Permite atuar sobre cargos iguais ou inferiores (exceto Super Admin por não-Super Admin).
 */
export function canManageTargetUser(
  actorRole: UserRole,
  targetRole: UserRole
): boolean {
  if (targetRole === 'SUPER_ADMIN' && actorRole !== 'SUPER_ADMIN') {
    return false;
  }
  return ROLE_LEVEL[actorRole] <= ROLE_LEVEL[targetRole];
}

/**
 * v3.1-UI: Regra estrita de visibilidade hierárquica (teto de 2 níveis acima + exceção Perfil Público).
 */
export function canViewTargetUserHierarchy(
  viewer: UserAccount,
  target: UserAccount
): boolean {
  if (viewer.role === 'SUPER_ADMIN') return true;
  if (viewer.id === target.id) return true;
  if (target.isPublicProfile) return true;

  const viewerLevel = ROLE_LEVEL[viewer.role];
  const targetLevel = ROLE_LEVEL[target.role];

  if (targetLevel >= viewerLevel) return true;

  if (viewerLevel >= 5) {
    return targetLevel >= 4;
  }
  if (viewerLevel === 4) {
    return targetLevel >= 3;
  }
  if (viewerLevel === 3) {
    return targetLevel >= 2;
  }
  return targetLevel >= 2;
}

export function isUserLinkedToStore(userId: string, store: StoreUnit): boolean {
  return (
    store.managerId === userId ||
    (store.managerIds && store.managerIds.includes(userId)) ||
    store.employeeIds.includes(userId)
  );
}

export function canManageStore(
  actor: UserAccount,
  store: StoreUnit,
  allUsers: UserAccount[]
): boolean {
  if (actor.role === 'SUPER_ADMIN') return true;
  if (!hasPermission(actor, 'canManageStores')) return false;
  if (isUserLinkedToStore(actor.id, store)) return true;
  const owner = allUsers.find((u) => u.id === store.managerId);
  if (!owner) return true;
  return ROLE_LEVEL[actor.role] <= ROLE_LEVEL[owner.role];
}

export function getRoleDisplayLabel(role: UserRole): string {
  return ROLE_LABELS[role];
}

export function bumpSemanticVersion(
  currentVersion: string,
  type: 'major' | 'minor'
): string {
  const cleaned = currentVersion.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  const major = Math.max(1, parseInt(parts[0] || '3', 10) || 3);
  const minor = Math.max(0, parseInt(parts[1] || '1', 10) || 0);

  if (type === 'major') {
    return `${major + 1}.0`;
  }
  return `${major}.${minor + 1}`;
}
