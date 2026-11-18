import React from 'react';
import { Bell, Check, Eye, MapPin, Tag, X } from 'lucide-react';
import { MapOccurrence, StoreUnit } from '../../types/radar';
import { formatDistanceLabel, getOccurrencePhase } from '../../utils/geo';
import { OccurrenceAvatar } from '../icons/VehicleSvg';

export interface NearbyAlertItem {
  occurrence: MapOccurrence;
  nearestStore: StoreUnit;
  distanceMeters: number;
}

interface NearbyAlertsModalProps {
  isOpen: boolean;
  nearbyAlerts: NearbyAlertItem[];
  hasLinkedStores: boolean;
  nowMs: number;
  onCenterOccurrence: (occ: MapOccurrence) => void;
  onStartSightingUpdate: (occ: MapOccurrence) => void;
  onMarkBellAlertRead: (occurrenceId: string) => void | Promise<void>;
  onClose: () => void;
}

export const NearbyAlertsModal: React.FC<NearbyAlertsModalProps> = ({
  isOpen,
  nearbyAlerts,
  hasLinkedStores,
  nowMs,
  onCenterOccurrence,
  onStartSightingUpdate,
  onMarkBellAlertRead,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-end md:items-center justify-center bg-slate-950/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nearby-alerts-title"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-lg bg-white rounded-t-3xl md:rounded-2xl shadow-2xl border border-slate-200 max-h-[86vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="md:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1.5 bg-slate-300 rounded-full" />
        </div>

        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="nearby-alerts-title"
                className="text-base font-extrabold text-slate-900 truncate"
              >
                Alertas Próximos (Raio + 5 km)
              </h2>
              <p className="text-xs text-slate-500 truncate">
                Pinos visíveis no mapa (0–60 min) · Exclusivo de ocorrências
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar alertas próximos"
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
          {!hasLinkedStores ? (
            <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center space-y-1">
              <p className="text-sm font-bold text-slate-800">
                Nenhuma loja vinculada ao seu usuário
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                A campainha exibe alertas filtrados no raio de (loja + 5 km)
                apenas para unidades vinculadas à sua conta.
              </p>
            </div>
          ) : nearbyAlerts.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-1">
              <p className="text-sm font-bold text-slate-800">
                Nenhum alerta não lido na sua região
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Você será notificado aqui enquanto houver pinos ativos no mapa
                (0–60 min) dentro de (raio da loja + 5 km).
              </p>
            </div>
          ) : (
            nearbyAlerts.map(({ occurrence, nearestStore, distanceMeters }) => {
              const phaseInfo = getOccurrencePhase(
                occurrence.lastUpdatedAt || occurrence.createdAt,
                nowMs
              );
              const phaseLabel =
                phaseInfo.phase === 'active'
                  ? 'Ativo'
                  : phaseInfo.phase === 'shadow'
                  ? 'Sombra'
                  : 'Projeção';
              return (
                <div
                  key={occurrence.id}
                  className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <OccurrenceAvatar
                      spec={{
                        visualType: occurrence.visualType,
                        vehicleIconKey: occurrence.vehicleIconKey,
                        symbolKey: occurrence.symbolKey,
                        emoji: occurrence.emoji,
                        customImageDataUrl: occurrence.customImageDataUrl,
                        colorHex: occurrence.colorHex,
                        pulseEffect: occurrence.pulseEffect,
                      }}
                      alt={occurrence.subcategoryName}
                      className="w-12 h-12"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-extrabold text-slate-900 truncate">
                        {occurrence.subcategoryName}
                      </div>
                      <div className="text-xs text-slate-600 font-mono-tabular mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span>
                          {phaseLabel} · {phaseInfo.elapsedLabel}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-bold text-red-700">
                          {formatDistanceLabel(distanceMeters)} de{' '}
                          {nearestStore.name}
                        </span>
                      </div>
                      {occurrence.tag && (
                        <div className="text-xs font-mono-tabular font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                          <Tag className="w-3 h-3 text-slate-500" />
                          <span>{occurrence.tag}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onCenterOccurrence(occurrence);
                      }}
                      className="min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <MapPin className="w-4 h-4 text-blue-700 shrink-0" />
                      <span>Centralizar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onStartSightingUpdate(occurrence);
                      }}
                      className="min-h-[44px] px-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-extrabold flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-4 h-4 shrink-0" />
                      <span>👁️ Eu vi!</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void onMarkBellAlertRead(occurrence.id)}
                      className="min-h-[44px] px-3 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-extrabold flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4 shrink-0" />
                      <span>Marcar como lido</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
