import React, { useMemo, useState } from 'react';
import {
  Ban,
  Building2,
  ChevronDown,
  ChevronRight,
  Globe,
  ImagePlus,
  KeyRound,
  Link2,
  MapPin,
  Pencil,
  RotateCcw,
  Search,
  Shield,
  Trash2,
  Unlock,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  PERMISSION_DEFINITIONS,
  ROLE_LABELS,
  STORE_REGIONS,
  StoreRegion,
  StoreUnit,
  UserAccount,
  UserPermissions,
  UserRole,
} from '../../types/radar';
import { resizeImageToDataUrl } from '../../utils/geo';
import {
  ALL_ROLES_ORDERED,
  canManageStore,
  canManageTargetUser,
  canViewTargetUserHierarchy,
  getAssignableRoles,
  getDefaultPermissionsForRole,
  hasPermission,
  isUserLinkedToStore,
  ROLE_LEVEL,
} from '../../utils/rbac';

interface TeamDrillDownViewProps {
  currentUser: UserAccount;
  users: UserAccount[];
  stores: StoreUnit[];
  onCreateUserAndLinkStores: (input: {
    name: string;
    username: string;
    password: string;
    role: UserRole;
    permissions?: UserPermissions;
    region?: StoreRegion;
    avatarDataUrl?: string;
    storeIds?: string[];
  }) => Promise<UserAccount>;
  onUpdateManagedUser: (
    userId: string,
    updates: {
      name?: string;
      role?: UserRole;
      permissions?: UserPermissions;
      region?: StoreRegion;
      avatarDataUrl?: string;
      isBlocked?: boolean;
    }
  ) => Promise<UserAccount>;
  onToggleUserBlocked: (
    userId: string,
    isBlocked: boolean
  ) => Promise<UserAccount>;
  onDeleteUser: (userId: string) => Promise<void>;
  onFindUserForLinking: (query: string) => Promise<UserAccount | null>;
  onSetUserStoreLinks: (
    targetUserId: string,
    allowedManageableStoreIds: string[],
    selectedStoreIds: string[]
  ) => Promise<void>;
  onResetUserPassword: (userId: string, newPassword: string) => Promise<void>;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

export const TeamDrillDownView: React.FC<TeamDrillDownViewProps> = ({
  currentUser,
  users,
  stores,
  onCreateUserAndLinkStores,
  onUpdateManagedUser,
  onToggleUserBlocked,
  onDeleteUser,
  onFindUserForLinking,
  onSetUserStoreLinks,
  onResetUserPassword,
}) => {
  const canResetPasswords = hasPermission(currentUser, 'canResetPasswords');
  const assignableRoles = useMemo(
    () => getAssignableRoles(currentUser.role),
    [currentUser.role]
  );

  const manageableStores = useMemo(
    () => stores.filter((s) => canManageStore(currentUser, s, users)),
    [stores, currentUser, users]
  );
  const manageableStoreIds = useMemo(
    () => manageableStores.map((s) => s.id),
    [manageableStores]
  );

  // Regra estrita de 2 níveis acima + Perfil Público
  const hierarchyVisibleUsers = useMemo(
    () =>
      users
        .filter((u) => canViewTargetUserHierarchy(currentUser, u))
        .sort((a, b) => ROLE_LEVEL[a.role] - ROLE_LEVEL[b.role]),
    [users, currentUser]
  );

  // Filtros e Drill-down
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState<StoreRegion | 'ALL'>('ALL');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL');
  const [selectedRegionDrill, setSelectedRegionDrill] =
    useState<StoreRegion | null>(null);
  const [selectedStoreDrillId, setSelectedStoreDrillId] = useState<
    string | null
  >(null);

  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal Criar / Editar Usuário com Gaveta de Permissões Granulares
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>(
    assignableRoles[0] || 'CAIXA'
  );
  const [formRegion, setFormRegion] = useState<StoreRegion | ''>('');
  const [formAvatarUrl, setFormAvatarUrl] = useState<string | undefined>(
    undefined
  );
  const [formPermissions, setFormPermissions] = useState<UserPermissions>(() =>
    getDefaultPermissionsForRole(assignableRoles[0] || 'CAIXA')
  );
  const [permsDrawerOpen, setPermsDrawerOpen] = useState(false);
  const [formStoreIds, setFormStoreIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingUser, setSavingUser] = useState(false);

  // Modal Vincular Usuário Existente
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResult, setLookupResult] = useState<UserAccount | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupStoreIds, setLookupStoreIds] = useState<string[]>([]);

  // Ações inline por cartão
  const [editingLinksUserId, setEditingLinksUserId] = useState<string | null>(
    null
  );
  const [editingLinksStoreIds, setEditingLinksStoreIds] = useState<string[]>(
    []
  );
  const [resetPwdUserId, setResetPwdUserId] = useState<string | null>(null);
  const [resetPwdValue, setResetPwdValue] = useState('');
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(
    null
  );

  const toggleInArray = (arr: string[], id: string): string[] =>
    arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

  const openCreateModal = () => {
    const defaultRole = assignableRoles.includes('CAIXA')
      ? 'CAIXA'
      : assignableRoles[0] || 'CAIXA';
    setEditingUser(null);
    setFormName('');
    setFormUsername('');
    setFormPassword('');
    setFormRole(defaultRole);
    setFormRegion(currentUser.region || '');
    setFormAvatarUrl(undefined);
    setFormPermissions(getDefaultPermissionsForRole(defaultRole));
    setPermsDrawerOpen(false);
    setFormStoreIds([]);
    setFormError(null);
    setUserModalOpen(true);
  };

  const openEditModal = (u: UserAccount) => {
    setEditingUser(u);
    setFormName(u.name);
    setFormUsername(u.username);
    setFormPassword('');
    setFormRole(u.role);
    setFormRegion(u.region || '');
    setFormAvatarUrl(u.avatarDataUrl);
    setFormPermissions(u.permissions || getDefaultPermissionsForRole(u.role));
    setPermsDrawerOpen(false);
    setFormStoreIds(
      manageableStores
        .filter((s) => isUserLinkedToStore(u.id, s))
        .map((s) => s.id)
    );
    setFormError(null);
    setUserModalOpen(true);
  };

  const handleRoleChange = (nextRole: UserRole) => {
    setFormRole(nextRole);
    setFormPermissions(getDefaultPermissionsForRole(nextRole));
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await resizeImageToDataUrl(file, 220, 0.82);
    setFormAvatarUrl(dataUrl);
  };

  const handleSaveUserModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSavingUser(true);
    try {
      if (editingUser) {
        await onUpdateManagedUser(editingUser.id, {
          name: formName,
          role: formRole,
          permissions: formPermissions,
          region: formRegion || undefined,
          avatarDataUrl: formAvatarUrl,
        });
        await onSetUserStoreLinks(
          editingUser.id,
          manageableStoreIds,
          formStoreIds
        );
        setFeedbackMsg(
          `Usuário "${formName}" atualizado com permissões personalizadas.`
        );
      } else {
        const created = await onCreateUserAndLinkStores({
          name: formName,
          username: formUsername,
          password: formPassword,
          role: formRole,
          permissions: formPermissions,
          region: formRegion || undefined,
          avatarDataUrl: formAvatarUrl,
          storeIds: formStoreIds,
        });
        setFeedbackMsg(
          `${ROLE_LABELS[created.role]} "${created.name}" (${created.userCode}) cadastrado${
            formStoreIds.length === 0 ? ' (sem vínculo de loja).' : '.'
          }`
        );
      }
      setUserModalOpen(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Não foi possível salvar usuário.'
      );
    } finally {
      setSavingUser(false);
    }
  };

  const handleLookupExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    setLookupResult(null);
    try {
      const found = await onFindUserForLinking(lookupQuery);
      if (!found) {
        setLookupError(
          'Nenhum usuário visível para o seu nível foi encontrado com este código ou username.'
        );
        return;
      }
      setLookupResult(found);
      const alreadyLinked = manageableStores
        .filter((s) => isUserLinkedToStore(found.id, s))
        .map((s) => s.id);
      setLookupStoreIds(
        alreadyLinked.length > 0
          ? alreadyLinked
          : manageableStores[0]
          ? [manageableStores[0].id]
          : []
      );
    } catch (err) {
      setLookupError(
        err instanceof Error ? err.message : 'Erro ao buscar usuário.'
      );
    }
  };

  const handleConfirmLinkExisting = async () => {
    if (!lookupResult) return;
    await onSetUserStoreLinks(
      lookupResult.id,
      manageableStoreIds,
      lookupStoreIds
    );
    setFeedbackMsg(
      `${lookupResult.name} (${lookupResult.userCode}) vinculado às lojas selecionadas.`
    );
    setLinkModalOpen(false);
    setLookupResult(null);
    setLookupQuery('');
  };

  const handleToggleBlocked = async (usr: UserAccount) => {
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      const nextBlocked = !usr.isBlocked;
      await onToggleUserBlocked(usr.id, nextBlocked);
      setFeedbackMsg(
        nextBlocked
          ? `${usr.name} foi bloqueado e não poderá mais entrar.`
          : `${usr.name} foi desbloqueado.`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Erro ao alterar bloqueio.'
      );
    }
  };

  const handleSaveLinks = async (userId: string) => {
    await onSetUserStoreLinks(
      userId,
      manageableStoreIds,
      editingLinksStoreIds
    );
    setEditingLinksUserId(null);
    setFeedbackMsg('Vínculos de lojas atualizados.');
  };

  const handleSavePassword = async (userId: string) => {
    if (!resetPwdValue.trim()) return;
    await onResetUserPassword(userId, resetPwdValue);
    setResetPwdUserId(null);
    setResetPwdValue('');
    setFeedbackMsg('Senha redefinida com sucesso.');
  };

  // Busca filtrada global (respeitando 2 níveis + perfil público)
  const isSearchOrFilterActive =
    searchQuery.trim().length > 0 ||
    regionFilter !== 'ALL' ||
    roleFilter !== 'ALL';

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return hierarchyVisibleUsers.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      if (regionFilter !== 'ALL') {
        const userStores = stores.filter((s) => isUserLinkedToStore(u.id, s));
        const matchesUserRegion = u.region === regionFilter;
        const matchesStoreRegion = userStores.some(
          (s) => s.region === regionFilter
        );
        if (!matchesUserRegion && !matchesStoreRegion) return false;
      }
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.userCode.toLowerCase().includes(q)
      );
    });
  }, [hierarchyVisibleUsers, searchQuery, regionFilter, roleFilter, stores]);

  const directLeadershipUsers = useMemo(
    () => hierarchyVisibleUsers.filter((u) => ROLE_LEVEL[u.role] <= 4),
    [hierarchyVisibleUsers]
  );

  const unlinkedUsers = useMemo(
    () =>
      hierarchyVisibleUsers.filter(
        (u) => !stores.some((s) => isUserLinkedToStore(u.id, s))
      ),
    [hierarchyVisibleUsers, stores]
  );

  const selectedStoreDrill = useMemo(
    () => stores.find((s) => s.id === selectedStoreDrillId) || null,
    [stores, selectedStoreDrillId]
  );

  const renderUserCard = (usr: UserAccount) => {
    const isSelf = usr.id === currentUser.id;
    const canManage = !isSelf && canManageTargetUser(currentUser.role, usr.role);
    const linkedStores = stores.filter((s) => isUserLinkedToStore(usr.id, s));
    const isEditingLinks = editingLinksUserId === usr.id;
    const isResettingPwd = resetPwdUserId === usr.id;
    const isDeleting = confirmDeleteUserId === usr.id;

    return (
      <div
        key={usr.id}
        className={`p-4 rounded-2xl border bg-white space-y-3 ${
          usr.isBlocked ? 'border-red-200 bg-red-50/30' : 'border-slate-200'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {usr.avatarDataUrl ? (
              <img
                src={usr.avatarDataUrl}
                alt={usr.name}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div
                className={`w-12 h-12 rounded-xl font-extrabold text-sm flex items-center justify-center shrink-0 ${
                  usr.isBlocked
                    ? 'bg-red-100 text-red-800'
                    : ROLE_LEVEL[usr.role] <= 4
                    ? 'bg-slate-900 text-white'
                    : 'bg-blue-50 text-blue-800 border border-blue-200'
                }`}
              >
                {getInitials(usr.name)}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-extrabold text-slate-900 truncate">
                  {usr.name}
                </span>
                {isSelf && (
                  <span className="text-[11px] font-bold text-blue-700">
                    (Você)
                  </span>
                )}
                {usr.isBlocked && (
                  <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-extrabold uppercase">
                    Bloqueado
                  </span>
                )}
                {usr.isPublicProfile && (
                  <span
                    title="Perfil Público na rede"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700"
                  >
                    <Globe className="w-3 h-3" />
                    <span>Público</span>
                  </span>
                )}
              </div>
              <div className="text-xs font-mono-tabular text-slate-600 mt-0.5">
                {ROLE_LABELS[usr.role]} · {usr.userCode} · @{usr.username}
                {usr.region ? ` · Região ${usr.region}` : ''}
              </div>
              <div className="text-xs text-slate-500 mt-1 truncate">
                {linkedStores.length > 0
                  ? `Lojas: ${linkedStores
                      .map((s) => `${s.storeCode} (${s.name})`)
                      .join(', ')}`
                  : 'Sem loja vinculada'}
              </div>
            </div>
          </div>

          {canManage && (
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => openEditModal(usr)}
                className="min-h-[38px] px-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-800 flex items-center gap-1"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Editar</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const linked = manageableStores
                    .filter((s) => isUserLinkedToStore(usr.id, s))
                    .map((s) => s.id);
                  setEditingLinksUserId(isEditingLinks ? null : usr.id);
                  setEditingLinksStoreIds(linked);
                }}
                className="min-h-[38px] px-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-800"
              >
                Lojas
              </button>

              {canResetPasswords && (
                <button
                  type="button"
                  onClick={() => {
                    setResetPwdUserId(isResettingPwd ? null : usr.id);
                    setResetPwdValue('');
                  }}
                  className="min-h-[38px] px-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-800 flex items-center gap-1"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Senha</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleToggleBlocked(usr)}
                className={`min-h-[38px] px-2.5 rounded-xl border text-xs font-bold flex items-center gap-1 ${
                  usr.isBlocked
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    : 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                }`}
              >
                {usr.isBlocked ? (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Desbloquear</span>
                  </>
                ) : (
                  <>
                    <Ban className="w-3.5 h-3.5" />
                    <span>Bloquear</span>
                  </>
                )}
              </button>

              {!isDeleting ? (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteUserId(usr.id)}
                  aria-label={`Remover ${usr.name}`}
                  className="min-h-[38px] px-2.5 rounded-xl border border-red-200 bg-red-50/50 hover:bg-red-100 text-red-700 text-xs font-bold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={async () => {
                      await onDeleteUser(usr.id);
                      setConfirmDeleteUserId(null);
                    }}
                    className="min-h-[38px] px-2.5 rounded-xl bg-red-600 text-white text-xs font-bold"
                  >
                    Excluir
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteUserId(null)}
                    className="min-h-[38px] px-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {isEditingLinks && (
          <div className="pt-2.5 border-t border-slate-100 space-y-2">
            <span className="block text-xs font-bold text-slate-700">
              Vincular às lojas (opcional):
            </span>
            <div className="flex flex-wrap gap-3">
              {manageableStores.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={editingLinksStoreIds.includes(s.id)}
                    onChange={() =>
                      setEditingLinksStoreIds((prev) => toggleInArray(prev, s.id))
                    }
                  />
                  <span>
                    {s.storeCode} · {s.name}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleSaveLinks(usr.id)}
                className="min-h-[38px] px-4 rounded-xl bg-blue-700 text-white text-xs font-bold"
              >
                Salvar vínculos
              </button>
              <button
                type="button"
                onClick={() => setEditingLinksUserId(null)}
                className="min-h-[38px] px-3 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {isResettingPwd && (
          <div className="pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={resetPwdValue}
              onChange={(e) => setResetPwdValue(e.target.value)}
              placeholder="Nova senha para este usuário"
              className="flex-1 min-h-[40px] px-3 rounded-xl border border-slate-300 text-sm"
            />
            <button
              type="button"
              onClick={() => handleSavePassword(usr.id)}
              className="min-h-[40px] px-4 rounded-xl bg-blue-700 text-white text-xs font-bold"
            >
              Salvar nova senha
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Cabeçalho + Ações Principais */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Equipe &amp; Hierarquia
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Organização escalável por região e loja · {hierarchyVisibleUsers.length}{' '}
              usuários visíveis no seu nível.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setLookupQuery('');
                setLookupResult(null);
                setLookupError(null);
                setLinkModalOpen(true);
              }}
              className="min-h-[44px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-xs sm:text-sm font-bold flex items-center gap-2"
            >
              <Link2 className="w-4 h-4 text-blue-700" />
              <span>Vincular Existente</span>
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="min-h-[44px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-bold flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Novo Usuário</span>
            </button>
          </div>
        </div>

        {feedbackMsg && (
          <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs sm:text-sm font-semibold text-emerald-900 flex items-center justify-between gap-2">
            <span>{feedbackMsg}</span>
            <button
              type="button"
              onClick={() => setFeedbackMsg(null)}
              className="text-emerald-700 hover:text-emerald-950"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-xs sm:text-sm font-semibold text-red-900 flex items-center justify-between gap-2">
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-red-700 hover:text-red-950"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Busca Inteligente + Filtros por Região e Cargo */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
            <div className="relative md:col-span-6">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nome, @usuário ou código USR-..."
                className="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <select
              aria-label="Filtrar por Região"
              value={regionFilter}
              onChange={(e) =>
                setRegionFilter(e.target.value as StoreRegion | 'ALL')
              }
              className="md:col-span-3 min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800"
            >
              <option value="ALL">Todas as Regiões</option>
              {STORE_REGIONS.map((reg) => (
                <option key={reg} value={reg}>
                  Região {reg}
                </option>
              ))}
            </select>

            <select
              aria-label="Filtrar por Cargo"
              value={roleFilter}
              onChange={(e) =>
                setRoleFilter(e.target.value as UserRole | 'ALL')
              }
              className="md:col-span-3 min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800"
            >
              <option value="ALL">Todos os Cargos Visíveis</option>
              {ALL_ROLES_ORDERED.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Modo Busca / Filtro Direto OU Navegação Hierárquica em Cascata (Drill-Down) */}
        {isSearchOrFilterActive ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                Resultados Filtrados ({filteredUsers.length})
              </h2>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setRegionFilter('ALL');
                  setRoleFilter('ALL');
                }}
                className="text-xs font-bold text-blue-700 hover:underline"
              >
                Limpar filtros
              </button>
            </div>
            {filteredUsers.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                Nenhum usuário encontrado respeitando a visibilidade do seu cargo.
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredUsers.map((u) => renderUserCard(u))}
              </div>
            )}
          </section>
        ) : (
          <div className="space-y-6">
            {/* Bloco 1: Liderança Direta Visível */}
            <section className="space-y-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-slate-700" />
                <span>Liderança Direta Visível ({directLeadershipUsers.length})</span>
              </h2>
              {directLeadershipUsers.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-xs text-slate-500">
                  Nenhuma liderança direta visível neste filtro.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {directLeadershipUsers.map((u) => renderUserCard(u))}
                </div>
              )}
            </section>

            {/* Bloco 2: Navegação por Regiões -> Lojas -> Equipe (Escalável para 500 lojas) */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-700" />
                  <span>Navegação por Região e Lojas</span>
                </h2>

                {(selectedRegionDrill || selectedStoreDrill) && (
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRegionDrill(null);
                        setSelectedStoreDrillId(null);
                      }}
                      className="text-blue-700 hover:underline"
                    >
                      Todas as Regiões
                    </button>
                    {selectedRegionDrill && (
                      <>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        <button
                          type="button"
                          onClick={() => setSelectedStoreDrillId(null)}
                          className={
                            selectedStoreDrill
                              ? 'text-blue-700 hover:underline'
                              : 'text-slate-900'
                          }
                        >
                          Zona {selectedRegionDrill}
                        </button>
                      </>
                    )}
                    {selectedStoreDrill && (
                      <>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-900">
                          {selectedStoreDrill.name}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {!selectedRegionDrill ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {STORE_REGIONS.map((region) => {
                    const regionStores = stores.filter(
                      (s) => s.region === region
                    );
                    const regionMembersCount = hierarchyVisibleUsers.filter(
                      (u) =>
                        u.region === region ||
                        regionStores.some((st) => isUserLinkedToStore(u.id, st))
                    ).length;

                    return (
                      <button
                        key={region}
                        type="button"
                        onClick={() => {
                          setSelectedRegionDrill(region);
                          setSelectedStoreDrillId(null);
                        }}
                        className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-blue-600 hover:bg-blue-50/40 text-left transition-all flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="text-sm font-extrabold text-slate-900">
                            Zona {region}
                          </div>
                          <div className="text-xs font-mono-tabular text-slate-600 mt-1">
                            {regionStores.length}{' '}
                            {regionStores.length === 1 ? 'Loja' : 'Lojas'} ·{' '}
                            {regionMembersCount} pessoas
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              ) : !selectedStoreDrill ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Unidades na Zona {selectedRegionDrill}
                  </div>
                  {stores.filter((s) => s.region === selectedRegionDrill)
                    .length === 0 ? (
                    <p className="text-sm text-slate-500 py-4 text-center">
                      Nenhuma loja cadastrada nesta região ainda.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {stores
                        .filter((s) => s.region === selectedRegionDrill)
                        .map((st) => {
                          const linkedCount = hierarchyVisibleUsers.filter(
                            (u) => isUserLinkedToStore(u.id, st)
                          ).length;
                          const owner = hierarchyVisibleUsers.find(
                            (u) => u.id === st.managerId
                          );
                          return (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => setSelectedStoreDrillId(st.id)}
                              className="p-4 rounded-xl border border-slate-200 hover:border-blue-600 hover:bg-blue-50/30 text-left transition-all flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-slate-900 truncate">
                                  {st.name}
                                </div>
                                <div className="text-xs font-mono-tabular text-slate-500 mt-0.5">
                                  {st.storeCode} · {linkedCount} vinculados
                                </div>
                                {owner && (
                                  <div className="text-[11px] text-slate-600 mt-1 truncate">
                                    Resp.: {owner.name}
                                  </div>
                                )}
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Building2 className="w-5 h-5 text-blue-700 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold text-slate-900 truncate">
                          {selectedStoreDrill.storeCode} ·{' '}
                          {selectedStoreDrill.name}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          Equipe visível vinculada a esta unidade
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    {hierarchyVisibleUsers
                      .filter((u) =>
                        isUserLinkedToStore(u.id, selectedStoreDrill)
                      )
                      .map((u) => renderUserCard(u))}
                  </div>
                </div>
              )}
            </section>

            {/* Bloco 3: Sem Loja Vinculada */}
            <section className="space-y-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-600" />
                <span>Sem Loja Vinculada ({unlinkedUsers.length})</span>
              </h2>
              {unlinkedUsers.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 text-xs text-slate-500">
                  Todos os usuários visíveis possuem pelo menos uma loja vinculada no momento.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {unlinkedUsers.map((u) => renderUserCard(u))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* ===================================================== */}
      {/* MODAL: CRIAR / EDITAR USUÁRIO + PERMISSÕES GRANULARES */}
      {/* ===================================================== */}
      {userModalOpen && (
        <div
          className="fixed inset-0 z-[1350] flex items-end md:items-center justify-center bg-slate-950/60 backdrop-blur-xs"
          onClick={() => setUserModalOpen(false)}
        >
          <div
            className="w-full md:max-w-xl bg-white rounded-t-3xl md:rounded-2xl border border-slate-200 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                {editingUser
                  ? `Editar Usuário · ${editingUser.userCode}`
                  : 'Cadastrar Novo Usuário'}
              </h3>
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="min-h-[42px] min-w-[42px] -mr-2 rounded-xl text-slate-500 hover:bg-slate-100 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveUserModal}
              className="flex-1 overflow-y-auto p-5 space-y-4"
            >
              {/* Foto opcional */}
              <div className="flex items-center gap-3">
                {formAvatarUrl ? (
                  <img
                    src={formAvatarUrl}
                    alt="Foto do usuário"
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-xl object-cover border border-slate-200"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-bold text-sm">
                    {formName ? getInitials(formName) : 'USR'}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <label className="min-h-[40px] px-3 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 inline-flex items-center gap-1.5 cursor-pointer">
                    <ImagePlus className="w-4 h-4 text-blue-700" />
                    <span>{formAvatarUrl ? 'Trocar foto' : 'Foto (opcional)'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </label>
                  {formAvatarUrl && (
                    <button
                      type="button"
                      onClick={() => setFormAvatarUrl(undefined)}
                      className="text-xs font-semibold text-red-700 hover:underline"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome completo
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ex: João Oliveira"
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cargo (igual ou inferior)
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) =>
                      handleRoleChange(e.target.value as UserRole)
                    }
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-900"
                  >
                    {assignableRoles.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!editingUser && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Usuário único (login)
                    </label>
                    <input
                      type="text"
                      required
                      autoCapitalize="none"
                      value={formUsername}
                      onChange={(e) => setFormUsername(e.target.value)}
                      placeholder="Ex: joao.caixa"
                      className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Senha inicial
                    </label>
                    <input
                      type="text"
                      required
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="Senha de acesso"
                      className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Região de atuação (opcional)
                </label>
                <select
                  value={formRegion}
                  onChange={(e) =>
                    setFormRegion(e.target.value as StoreRegion | '')
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-sm"
                >
                  <option value="">Sem região específica</option>
                  {STORE_REGIONS.map((reg) => (
                    <option key={reg} value={reg}>
                      Zona {reg}
                    </option>
                  ))}
                </select>
              </div>

              {/* Gaveta de Permissões Granulares (Presets por Cargo + Customização) */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setPermsDrawerOpen((p) => !p)}
                  className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left"
                >
                  <div>
                    <div className="text-xs font-extrabold text-slate-900">
                      Permissões padrão de {ROLE_LABELS[formRole]}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Toque para personalizar individualmente ({PERMISSION_DEFINITIONS.length} permissões)
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-600 transition-transform ${
                      permsDrawerOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {permsDrawerOpen && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-200 bg-white space-y-2">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          setFormPermissions(
                            getDefaultPermissionsForRole(formRole)
                          )
                        }
                        className="text-[11px] font-bold text-blue-700 inline-flex items-center gap-1 hover:underline"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restaurar padrão de {ROLE_LABELS[formRole]}</span>
                      </button>
                    </div>
                    {PERMISSION_DEFINITIONS.map((perm) => (
                      <label
                        key={perm.key}
                        className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(formPermissions[perm.key])}
                          onChange={(e) =>
                            setFormPermissions((prev) => ({
                              ...prev,
                              [perm.key]: e.target.checked,
                            }))
                          }
                          className="w-4 h-4 accent-blue-700 mt-0.5 shrink-0"
                        />
                        <span className="min-w-0">
                          <span className="block text-xs font-bold text-slate-900">
                            {perm.label}
                            {perm.minRecommendedNote
                              ? ` (${perm.minRecommendedNote})`
                              : ''}
                          </span>
                          <span className="block text-[11px] text-slate-500">
                            {perm.description}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Vínculo opcional a Lojas */}
              {manageableStores.length > 0 && (
                <div className="space-y-1.5">
                  <span className="block text-xs font-bold text-slate-700">
                    Vincular às lojas (opcional — pode salvar sem nenhuma):
                  </span>
                  <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-2.5 space-y-1.5 bg-slate-50/50">
                    {manageableStores.map((s) => (
                      <label
                        key={s.id}
                        className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formStoreIds.includes(s.id)}
                          onChange={() =>
                            setFormStoreIds((prev) => toggleInArray(prev, s.id))
                          }
                        />
                        <span>
                          {s.storeCode} · {s.name} ({s.region})
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {formError && (
                <p className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-xl">
                  {formError}
                </p>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="flex-1 min-h-[46px] rounded-xl bg-slate-100 text-slate-900 text-sm font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="flex-1 min-h-[46px] rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-bold"
                >
                  {savingUser
                    ? 'Salvando...'
                    : editingUser
                    ? 'Salvar alterações'
                    : 'Cadastrar usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================== */}
      {/* MODAL: VINCULAR USUÁRIO EXISTENTE (SEM DUPLICAR) */}
      {/* ===================================================== */}
      {linkModalOpen && (
        <div
          className="fixed inset-0 z-[1350] flex items-end md:items-center justify-center bg-slate-950/60 backdrop-blur-xs"
          onClick={() => setLinkModalOpen(false)}
        >
          <div
            className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                Vincular Usuário Existente
              </h3>
              <button
                type="button"
                onClick={() => setLinkModalOpen(false)}
                className="min-h-[42px] min-w-[42px] -mr-2 rounded-xl text-slate-500 hover:bg-slate-100 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Busque por usuário ou código único (ex:{' '}
                <span className="font-mono-tabular font-semibold">caixa1</span>{' '}
                ou{' '}
                <span className="font-mono-tabular font-semibold">
                  USR-0203
                </span>
                ) respeitando a visibilidade do seu cargo.
              </p>

              <form onSubmit={handleLookupExisting} className="flex gap-2">
                <input
                  type="text"
                  value={lookupQuery}
                  onChange={(e) => setLookupQuery(e.target.value)}
                  placeholder="username ou USR-0000"
                  className="flex-1 min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm"
                />
                <button
                  type="submit"
                  className="min-h-[44px] px-4 rounded-xl bg-slate-900 text-white text-xs font-bold"
                >
                  Buscar
                </button>
              </form>

              {lookupError && (
                <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
                  {lookupError}
                </p>
              )}

              {lookupResult && (
                <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-3">
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {lookupResult.name}
                    </div>
                    <div className="text-xs font-mono-tabular text-slate-600">
                      {ROLE_LABELS[lookupResult.role]} · {lookupResult.userCode}{' '}
                      · @{lookupResult.username}
                    </div>
                  </div>

                  {manageableStores.length === 0 ? (
                    <p className="text-xs text-red-700 font-semibold">
                      Cadastre uma loja primeiro para vincular este usuário.
                    </p>
                  ) : (
                    <>
                      <div className="max-h-36 overflow-y-auto space-y-1.5">
                        {manageableStores.map((s) => (
                          <label
                            key={s.id}
                            className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={lookupStoreIds.includes(s.id)}
                              onChange={() =>
                                setLookupStoreIds((prev) =>
                                  toggleInArray(prev, s.id)
                                )
                              }
                            />
                            <span>
                              {s.storeCode} · {s.name}
                            </span>
                          </label>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={handleConfirmLinkExisting}
                        className="w-full min-h-[44px] rounded-xl bg-blue-700 text-white text-xs font-bold"
                      >
                        Confirmar vínculo
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
