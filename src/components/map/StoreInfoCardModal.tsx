import React from 'react';
import {
  AlertTriangle,
  Building2,
  Clock,
  MapPin,
  Power,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';
import { ROLE_LABELS, StoreUnit, UserAccount } from '../../types/radar';
import {
  canManageStore,
  canManageStoreOptions,
  hasPermission,
  isUserLinkedToStore,
  ROLE_LEVEL,
} from '../../utils/rbac';

interface StoreInfoCardModalProps {
  store: StoreUnit | null;
  users: UserAccount[];
  currentUser: UserAccount;
  insideAlertsCount: number;
  onToggleStoreOpen: (storeId: string, nextOpen: boolean) => Promise<void>;
  onRequestCloseStore: (store: StoreUnit) => void;
  onOpenStoreOptions?: (store: StoreUnit) => void;
  onClose: () => void;
}

export const StoreInfoCardModal: React.FC<StoreInfoCardModalProps> = ({
  store,
  users,
  currentUser,
  insideAlertsCount,
  onToggleStoreOpen,
  onRequestCloseStore,
  onOpenStoreOptions,
  onClose,
}) => {
  if (!store) return null;

  const onlineMembers = users
    .filter((u) => (store.onlineUserIds || []).includes(u.id))
    .sort((a, b) => ROLE_LEVEL[b.role] - ROLE_LEVEL[a.role]);

  const canToggleOpen =
    hasPermission(currentUser, 'canOpenCloseStore') &&
    (ROLE_LEVEL[currentUser.role] <= 3 ||
      isUserLinkedToStore(currentUser.id, store));

  const canOpenOptions =
    Boolean(onOpenStoreOptions) &&
    canManageStoreOptions(currentUser.role) &&
    canManageStore(currentUser, store, users);

  const handlePowerClick = async () => {
    if (store.isOpen) {
      onClose();
      onRequestCloseStore(store);
    } else {
      await onToggleStoreOpen(store.id, true);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1250] flex items-end md:items-center justify-center bg-slate-950/55 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="store-card-title"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-2xl border border-slate-200 shadow-2xl max-h-[88vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="md:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Foto opcional da loja ou banner limpo */}
        <div className="relative h-36 sm:h-40 bg-slate-900 overflow-hidden shrink-0">
          {store.photoDataUrl ? (
            <img
              src={store.photoDataUrl}
              alt={store.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
              <Building2 className="w-12 h-12 text-slate-600" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar card da loja"
            className="absolute top-3 right-3 min-h-[40px] min-w-[40px] rounded-xl bg-black/50 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-xs"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute bottom-3 left-4 right-4 text-white">
            <div className="text-xs font-mono-tabular text-slate-200">
              {store.storeCode} · Região {store.region} ·{' '}
              {store.isOpen ? 'Loja Aberta / Online' : 'Loja Fechada / Offline'}
            </div>
            <h2
              id="store-card-title"
              className="text-lg font-extrabold leading-tight truncate mt-0.5"
            >
              {store.name}
            </h2>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {insideAlertsCount > 0 ? (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>
                Alerta ativo no perímetro: {insideAlertsCount}{' '}
                {insideAlertsCount === 1 ? 'ocorrência' : 'ocorrências'} no raio
                de {store.radiusKm} km
              </span>
            </div>
          ) : (
            <div
              className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
                store.isOpen
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <span>
                {store.isOpen
                  ? 'Unidade Aberta · Perímetro normal'
                  : 'Unidade Fechada · Offline no momento'}
              </span>
              <span className="font-mono-tabular shrink-0">
                Raio {store.radiusKm} km
              </span>
            </div>
          )}

          {store.motto && (
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-500">
                Recado da unidade
              </span>
              <p className="text-sm text-slate-800 leading-relaxed bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
                {store.motto}
              </p>
            </div>
          )}

          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>
                {store.address ||
                  `${store.lat.toFixed(5)}, ${store.lng.toFixed(5)}`}
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono-tabular">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                Expiração padrão de alertas: {store.alertDurationMinutes} min
              </span>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-slate-600" />
                <span>Equipe Online na Loja ({onlineMembers.length})</span>
              </h3>
            </div>

            {onlineMembers.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">
                Nenhum colaborador visível online nesta unidade agora.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {onlineMembers.map((member) => (
                  <div
                    key={member.id}
                    className="px-3.5 py-2.5 flex items-center justify-between gap-2 bg-white"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {member.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {ROLE_LABELS[member.role]}
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-700 shrink-0">
                      Online
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 bg-white flex flex-wrap items-center gap-2.5">
          {canOpenOptions && onOpenStoreOptions && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenStoreOptions(store);
              }}
              className="w-full min-h-[46px] px-4 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Opções / Gerenciar Loja</span>
            </button>
          )}
          {canToggleOpen && (
            <button
              type="button"
              onClick={handlePowerClick}
              className={`flex-1 min-h-[48px] px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
                store.isOpen
                  ? 'bg-slate-900 hover:bg-slate-800 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <Power className="w-4 h-4" />
              <span>{store.isOpen ? 'Fechar Loja' : 'Abrir Loja'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className={`${
              canToggleOpen ? 'px-5' : 'w-full'
            } min-h-[48px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm font-semibold`}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
