import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ImagePlus,
  Lock,
  Package,
  Pencil,
  Plus,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import {
  MasterProduct,
  ROLE_LABELS,
  StoreMerchandiseItem,
  StoreUnit,
  UserAccount,
  UserPermissions,
} from '../../types/radar';
import { formatCurrencyBRL, resizeImageToDataUrl } from '../../utils/geo';
import {
  canCreateMasterProduct,
  canManageStoreOptions,
  canManageTargetUser,
  hasPermission,
  isUserLinkedToStore,
  ROLE_LEVEL,
} from '../../utils/rbac';

interface StoreManageOptionsModalProps {
  store: StoreUnit | null;
  currentUser: UserAccount;
  users: UserAccount[];
  merchandise: StoreMerchandiseItem[];
  masterProducts: MasterProduct[];
  onUpdateManagedUser?: (
    userId: string,
    updates: { permissions?: UserPermissions }
  ) => Promise<UserAccount>;
  onAddMerchandise: (input: {
    storeId: string;
    masterProductId?: string;
    name: string;
    photoDataUrl?: string;
    stockQuantity: number;
    unitPrice: number;
  }) => Promise<StoreMerchandiseItem>;
  onUpdateMerchandise: (
    itemId: string,
    updates: Partial<Omit<StoreMerchandiseItem, 'id' | 'storeId' | 'createdAt'>>
  ) => Promise<StoreMerchandiseItem>;
  onDeleteMerchandise: (itemId: string) => Promise<void>;
  onClose: () => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

export const StoreManageOptionsModal: React.FC<
  StoreManageOptionsModalProps
> = ({
  store,
  currentUser,
  users,
  merchandise,
  masterProducts,
  onUpdateManagedUser,
  onAddMerchandise,
  onUpdateMerchandise,
  onDeleteMerchandise,
  onClose,
}) => {
  const [formerDrawerOpen, setFormerDrawerOpen] = useState(false);
  const [mercFormOpen, setMercFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StoreMerchandiseItem | null>(
    null
  );
  const [selectedMasterId, setSelectedMasterId] = useState<string>('');
  const [createCustomMode, setCreateCustomMode] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemPhotoUrl, setItemPhotoUrl] = useState('');
  const [itemStock, setItemStock] = useState('10');
  const [itemPrice, setItemPrice] = useState('0,00');
  const [savingItem, setSavingItem] = useState(false);
  const [updatingPermUserId, setUpdatingPermUserId] = useState<string | null>(
    null
  );
  const [formError, setFormError] = useState<string | null>(null);

  const canManage = canManageStoreOptions(currentUser.role);
  const isMasterCreator = canCreateMasterProduct(currentUser.role);

  const { onlineMembers, offlineMembers } = useMemo(() => {
    if (!store) return { onlineMembers: [], offlineMembers: [] };
    const onlineSet = new Set(store.onlineUserIds || []);
    const linkedUsers = users
      .filter((u) => !u.isBlocked && isUserLinkedToStore(u.id, store))
      .sort((a, b) => ROLE_LEVEL[a.role] - ROLE_LEVEL[b.role]);

    const online = linkedUsers.filter((u) => onlineSet.has(u.id));
    const offline = linkedUsers.filter((u) => !onlineSet.has(u.id));
    return { onlineMembers: online, offlineMembers: offline };
  }, [store, users]);

  const storeItems = useMemo(() => {
    if (!store) return [];
    return merchandise.filter((m) => m.storeId === store.id);
  }, [store, merchandise]);

  if (!store) return null;

  const formerList = store.formerEmployees || [];

  const handleToggleMemberPermission = async (
    member: UserAccount,
    key: 'canViewStoreInventory' | 'canWithdrawRestockInventory',
    checked: boolean
  ) => {
    if (!onUpdateManagedUser) return;
    setUpdatingPermUserId(member.id);
    try {
      await onUpdateManagedUser(member.id, {
        permissions: {
          ...member.permissions,
          [key]: checked,
        },
      });
    } finally {
      setUpdatingPermUserId(null);
    }
  };

  const renderMemberRow = (member: UserAccount, isOnline: boolean) => {
    const canEditMemberPerms =
      Boolean(onUpdateManagedUser) &&
      member.id !== currentUser.id &&
      ROLE_LEVEL[member.role] >= 5 &&
      canManageTargetUser(currentUser.role, member.role);

    const viewInv = hasPermission(member, 'canViewStoreInventory');
    const withdrawInv = hasPermission(member, 'canWithdrawRestockInventory');
    const busy = updatingPermUserId === member.id;

    return (
      <div
        key={member.id}
        className={`p-2.5 rounded-lg bg-white border space-y-2 ${
          isOnline ? 'border-emerald-200' : 'border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {member.avatarDataUrl ? (
              <img
                src={member.avatarDataUrl}
                alt={member.name}
                referrerPolicy="no-referrer"
                className={`w-7 h-7 rounded-full object-cover shrink-0 ${
                  isOnline ? '' : 'grayscale'
                }`}
              />
            ) : (
              <div
                className={`w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                  isOnline
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-300 text-slate-700'
                }`}
              >
                {getInitials(member.name)}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">
                {member.name}
              </div>
              <div className="text-[11px] text-slate-500">
                {ROLE_LABELS[member.role]} · {member.userCode}
              </div>
            </div>
          </div>
          <span
            className={`text-[11px] font-bold shrink-0 ${
              isOnline ? 'text-emerald-700' : 'text-slate-400'
            }`}
          >
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        {canEditMemberPerms && (
          <div className="pt-1.5 border-t border-slate-100 space-y-1">
            <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                disabled={busy}
                checked={viewInv}
                onChange={(e) =>
                  handleToggleMemberPermission(
                    member,
                    'canViewStoreInventory',
                    e.target.checked
                  )
                }
                className="w-3.5 h-3.5 accent-blue-700 shrink-0"
              />
              <span>Visualizar estoque/inventário da loja</span>
            </label>
            <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                disabled={busy}
                checked={withdrawInv}
                onChange={(e) =>
                  handleToggleMemberPermission(
                    member,
                    'canWithdrawRestockInventory',
                    e.target.checked
                  )
                }
                className="w-3.5 h-3.5 accent-emerald-600 shrink-0"
              />
              <span>Realizar retirada e reposição de estoque</span>
            </label>
          </div>
        )}
      </div>
    );
  };

  const openCreateItem = () => {
    setEditingItem(null);
    setSelectedMasterId(masterProducts[0]?.id || '');
    setCreateCustomMode(false);
    setItemName('');
    setItemPhotoUrl('');
    setItemStock('10');
    setItemPrice('');
    setFormError(null);
    setMercFormOpen(true);
  };

  const openEditItem = (item: StoreMerchandiseItem) => {
    setEditingItem(item);
    setSelectedMasterId(item.masterProductId || '');
    setCreateCustomMode(false);
    setItemName(item.name);
    setItemPhotoUrl(item.photoDataUrl || '');
    setItemStock(String(item.stockQuantity));
    setItemPrice(item.unitPrice.toFixed(2).replace('.', ','));
    setFormError(null);
    setMercFormOpen(true);
  };

  const handleUploadItemPhoto = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await resizeImageToDataUrl(file, 220, 0.82);
    setItemPhotoUrl(compressed);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsedStock = Math.max(0, parseInt(itemStock || '0', 10) || 0);
    const normalizedPrice = itemPrice
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^0-9.]/g, '');
    const parsedPrice = normalizedPrice ? parseFloat(normalizedPrice) : 0;

    setSavingItem(true);
    try {
      if (editingItem) {
        await onUpdateMerchandise(editingItem.id, {
          stockQuantity: parsedStock,
          ...(isMasterCreator
            ? {
                name: itemName.trim() || editingItem.name,
                photoDataUrl: itemPhotoUrl.trim() || undefined,
                unitPrice: parsedPrice,
              }
            : {}),
        });
      } else if (!createCustomMode) {
        const chosenMaster = masterProducts.find(
          (mp) => mp.id === (selectedMasterId || masterProducts[0]?.id)
        );
        if (!chosenMaster) {
          setFormError('Selecione um produto do Catálogo Mestre.');
          setSavingItem(false);
          return;
        }
        await onAddMerchandise({
          storeId: store.id,
          masterProductId: chosenMaster.id,
          name: chosenMaster.name,
          photoDataUrl: chosenMaster.photoDataUrl,
          stockQuantity: parsedStock,
          unitPrice: chosenMaster.unitPrice,
        });
      } else {
        if (!itemName.trim()) {
          setFormError('Informe o nome do produto.');
          setSavingItem(false);
          return;
        }
        if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
          setFormError('Informe um preço unitário válido.');
          setSavingItem(false);
          return;
        }
        await onAddMerchandise({
          storeId: store.id,
          name: itemName.trim(),
          photoDataUrl: itemPhotoUrl.trim() || undefined,
          stockQuantity: parsedStock,
          unitPrice: parsedPrice,
        });
      }
      setMercFormOpen(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Erro ao salvar mercadoria.'
      );
    } finally {
      setSavingItem(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1350] flex items-end md:items-center justify-center bg-slate-950/65 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="store-options-title"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-3xl bg-white rounded-t-3xl md:rounded-2xl border border-slate-200 shadow-2xl h-[90vh] md:h-auto md:max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="store-options-title"
              className="text-lg font-extrabold text-slate-900 truncate"
            >
              Opções e Gestão da Loja
            </h2>
            <p className="text-xs font-mono-tabular text-slate-600 truncate">
              {store.storeCode} · {store.name} · Região {store.region}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar opções da loja"
            className="min-h-[44px] min-w-[44px] -mr-2 rounded-xl text-slate-500 hover:bg-slate-200 flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* 1. Status da Equipe & Permissões Individuais de Estoque */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-700" />
                  <span>Equipe da Unidade &amp; Permissões de Estoque</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Controle individualmente quem pode visualizar o estoque da loja e quem pode retirar/repor carga.
                </p>
              </div>
              <span className="text-xs font-mono-tabular text-slate-600">
                {onlineMembers.length} online · {offlineMembers.length} offline
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Online */}
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2">
                <div className="text-xs font-extrabold text-emerald-800 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Trabalhando no Momento (Online)</span>
                </div>
                {onlineMembers.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">
                    Nenhum colaborador online nesta loja.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {onlineMembers.map((member) =>
                      renderMemberRow(member, true)
                    )}
                  </div>
                )}
              </div>

              {/* Offline */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="text-xs font-extrabold text-slate-700">
                  Equipe Offline ({offlineMembers.length})
                </div>
                {offlineMembers.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">
                    Todos os colaboradores vinculados estão online.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {offlineMembers.map((member) =>
                      renderMemberRow(member, false)
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 2. Gaveta "Funcionários Inativos / Antigos" (recolhida por padrão) */}
          <section className="rounded-xl border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setFormerDrawerOpen((prev) => !prev)}
              aria-expanded={formerDrawerOpen}
              className="w-full min-h-[46px] px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between gap-2 text-left"
            >
              <span className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
                {formerDrawerOpen ? (
                  <ChevronDown className="w-4 h-4 text-slate-600 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
                )}
                <UserMinus className="w-4 h-4 text-slate-500 shrink-0" />
                <span>Funcionários Inativos / Antigos</span>
              </span>
              <span className="text-xs font-mono-tabular font-semibold text-slate-500">
                {formerList.length}
              </span>
            </button>

            {formerDrawerOpen && (
              <div className="p-3.5 bg-white border-t border-slate-200">
                {formerList.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2 text-center">
                    Nenhum ex-funcionário registrado nesta loja.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {formerList.map((former) => (
                      <div
                        key={former.userId}
                        className="py-2 flex items-center justify-between gap-3 text-xs"
                      >
                        <span className="font-bold text-slate-900 truncate">
                          {former.name}
                        </span>
                        <span className="font-mono-tabular font-semibold text-slate-600 shrink-0">
                          {former.userCode || former.userId}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 3. Estoque & Mercadorias da Loja */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-700" />
                  <span>Estoque &amp; Mercadorias da Loja</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isMasterCreator
                    ? 'Aloque produtos do Catálogo Mestre ou cadastre um novo produto oficial.'
                    : 'Selecione produtos já cadastrados no Catálogo Mestre para abastecer esta loja.'}
                </p>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={openCreateItem}
                  className="min-h-[42px] px-3.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>Alocar / Adicionar Estoque</span>
                </button>
              )}
            </div>

            {mercFormOpen && canManage && (
              <form
                onSubmit={handleSaveItem}
                className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-900">
                    {editingItem
                      ? `Ajustar Estoque: ${editingItem.name}`
                      : 'Abastecer Loja com Produto do Catálogo'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setMercFormOpen(false)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800"
                  >
                    Cancelar
                  </button>
                </div>

                {!editingItem && isMasterCreator && (
                  <div className="flex items-center gap-2 p-1 rounded-xl bg-white border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setCreateCustomMode(false)}
                      className={`flex-1 min-h-[36px] rounded-lg text-xs font-bold ${
                        !createCustomMode
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600'
                      }`}
                    >
                      Usar Catálogo Mestre
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateCustomMode(true)}
                      className={`flex-1 min-h-[36px] rounded-lg text-xs font-bold ${
                        createCustomMode
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600'
                      }`}
                    >
                      Criar Novo Produto
                    </button>
                  </div>
                )}

                {!editingItem && !createCustomMode ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Produto do Catálogo Mestre
                      </label>
                      <select
                        value={selectedMasterId || masterProducts[0]?.id || ''}
                        onChange={(e) => setSelectedMasterId(e.target.value)}
                        className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 bg-white text-sm font-semibold"
                      >
                        {masterProducts.map((mp) => (
                          <option key={mp.id} value={mp.id}>
                            {mp.name} ({formatCurrencyBRL(mp.unitPrice)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Qtd. a somar
                      </label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={itemStock}
                        onChange={(e) => setItemStock(e.target.value)}
                        className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 bg-white font-mono-tabular text-sm font-bold"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    {!isMasterCreator && editingItem && (
                      <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>
                          Nome, foto e preço são definidos pelo Super Admin / Presidente. Você pode ajustar apenas a quantidade em estoque.
                        </span>
                      </div>
                    )}

                    {isMasterCreator && (
                      <div className="flex flex-wrap items-center gap-3">
                        {itemPhotoUrl ? (
                          <img
                            src={itemPhotoUrl}
                            alt={itemName || 'Prévia do item'}
                            referrerPolicy="no-referrer"
                            className="w-14 h-14 rounded-full object-cover border-2 border-slate-300 shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-slate-200 border-2 border-slate-300 text-slate-500 flex items-center justify-center shrink-0">
                            <Package className="w-6 h-6" />
                          </div>
                        )}

                        <div className="flex-1 min-w-[200px] space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="min-h-[38px] px-3 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800 inline-flex items-center gap-1.5 cursor-pointer hover:bg-slate-50">
                              <ImagePlus className="w-3.5 h-3.5 text-blue-700" />
                              <span>Enviar Foto</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleUploadItemPhoto}
                                className="hidden"
                              />
                            </label>
                            {itemPhotoUrl && (
                              <button
                                type="button"
                                onClick={() => setItemPhotoUrl('')}
                                className="text-xs font-semibold text-red-700 hover:underline"
                              >
                                Remover foto
                              </button>
                            )}
                          </div>
                          <input
                            type="url"
                            value={
                              itemPhotoUrl.startsWith('data:')
                                ? ''
                                : itemPhotoUrl
                            }
                            onChange={(e) => setItemPhotoUrl(e.target.value)}
                            placeholder="Ou cole a URL da imagem (opcional)"
                            className="w-full min-h-[38px] px-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Nome do item
                        </label>
                        <input
                          type="text"
                          required
                          disabled={!isMasterCreator}
                          value={itemName}
                          onChange={(e) => setItemName(e.target.value)}
                          placeholder="Ex: Água Mineral 500ml"
                          className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Qtd. em estoque
                        </label>
                        <input
                          type="number"
                          min={0}
                          required
                          value={itemStock}
                          onChange={(e) => setItemStock(e.target.value)}
                          className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 bg-white font-mono-tabular text-sm font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Preço unitário (R$)
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          required
                          disabled={!isMasterCreator}
                          value={itemPrice}
                          onChange={(e) => setItemPrice(e.target.value)}
                          placeholder="0,00"
                          className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 font-mono-tabular text-sm font-bold"
                        />
                      </div>
                    </div>
                  </>
                )}

                {formError && (
                  <p className="text-xs font-semibold text-red-700">
                    {formError}
                  </p>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingItem}
                    className="min-h-[42px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-bold"
                  >
                    {savingItem
                      ? 'Salvando...'
                      : editingItem
                      ? 'Salvar Estoque'
                      : 'Adicionar ao Estoque da Loja'}
                  </button>
                </div>
              </form>
            )}

            {storeItems.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                Nenhuma mercadoria cadastrada nesta loja ainda.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {storeItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 flex items-center justify-between gap-3 bg-white"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {item.photoDataUrl ? (
                        <img
                          src={item.photoDataUrl}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          className="w-11 h-11 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                          <Package className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">
                          {item.name}
                        </div>
                        <div className="text-xs font-mono-tabular text-slate-600 mt-0.5">
                          Estoque: {item.stockQuantity} un · Unitário:{' '}
                          <strong className="text-slate-900">
                            {formatCurrencyBRL(item.unitPrice)}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditItem(item)}
                          aria-label={`Editar ${item.name}`}
                          className="min-h-[38px] min-w-[38px] rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 flex items-center justify-center"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteMerchandise(item.id)}
                          aria-label={`Excluir ${item.name}`}
                          className="min-h-[38px] min-w-[38px] rounded-lg border border-red-200 hover:bg-red-50 text-red-700 flex items-center justify-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
