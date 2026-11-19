import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronRight,
  Layers,
  Search,
  Tag,
  X,
} from 'lucide-react';
import {
  AlertAuditEntry,
  CatalogCategory,
  CatalogSubcategory,
  MapOccurrence,
} from '../../types/radar';
import { CategoryAvatar, OccurrenceAvatar } from '../icons/VehicleSvg';

interface OccurrencePickerModalProps {
  isOpen: boolean;
  primaryCategory: CatalogCategory | null;
  categories: CatalogCategory[];
  subcategories: CatalogSubcategory[];
  activeOccurrences: MapOccurrence[];
  alertAudit: AlertAuditEntry[];
  onSelectSubcategory: (
    category: CatalogCategory,
    subcategory: CatalogSubcategory,
    tag?: string
  ) => void;
  onClose: () => void;
}

export const OccurrencePickerModal: React.FC<OccurrencePickerModalProps> = ({
  isOpen,
  primaryCategory,
  categories,
  subcategories,
  activeOccurrences,
  alertAudit,
  onSelectSubcategory,
  onClose,
}) => {
  const [selectedCategory, setSelectedCategory] =
    useState<CatalogCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [shortTag, setShortTag] = useState('');

  // Ao abrir, entra diretamente na Categoria Principal (ou lista completa se não houver)
  useEffect(() => {
    if (isOpen) {
      setSelectedCategory(primaryCategory || categories[0] || null);
      setSearchQuery('');
      setShortTag('');
    }
  }, [isOpen, primaryCategory, categories]);

  const normalizedTag = shortTag.trim().toUpperCase();

  const hasMatchingTarget = useMemo(() => {
    if (!normalizedTag) return false;
    const inActive = activeOccurrences.some(
      (o) => o.tag?.trim().toUpperCase() === normalizedTag
    );
    if (inActive) return true;
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return alertAudit.some(
      (a) =>
        a.createdAt >= oneDayAgo &&
        a.tag?.trim().toUpperCase() === normalizedTag
    );
  }, [normalizedTag, activeOccurrences, alertAudit]);

  const activeSubcategories = useMemo(() => {
    if (!selectedCategory) return [];
    const q = searchQuery.trim().toLowerCase();
    return subcategories.filter(
      (sub) =>
        sub.categoryId === selectedCategory.id &&
        (!q || sub.name.toLowerCase().includes(q))
    );
  }, [selectedCategory, subcategories, searchQuery]);

  if (!isOpen) return null;

  const handleClose = () => {
    setSelectedCategory(null);
    setSearchQuery('');
    setShortTag('');
    onClose();
  };

  const finalTag = shortTag.trim().slice(0, 10) || undefined;

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-end md:items-center justify-center bg-slate-950/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="occurrence-picker-title"
      onClick={handleClose}
    >
      <div
        className="w-full md:max-w-lg bg-white rounded-t-3xl md:rounded-2xl shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="md:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Cabeçalho com atalho discreto para Outras categorias */}
        <div className="px-5 pt-3 pb-3 border-b border-slate-200 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {selectedCategory && categories.length > 1 ? (
              <div className="flex items-center gap-2 mb-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory(null);
                    setSearchQuery('');
                  }}
                  className="min-h-[36px] px-3 -ml-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5 text-slate-600" />
                  <span>Outras categorias</span>
                </button>
              </div>
            ) : null}

            <h2
              id="occurrence-picker-title"
              className="text-lg font-extrabold text-slate-900 leading-tight"
            >
              {selectedCategory
                ? `${selectedCategory.name} · Outros tipos`
                : 'Outras categorias'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {selectedCategory
                ? 'Toque no veículo/item para marcar direto no mapa ou usar seu GPS.'
                : 'Selecione outra categoria do catálogo.'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Fechar"
            className="min-h-[46px] min-w-[46px] -mr-2 flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Campo opcional de identificação curta (máx. 10 caracteres) */}
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/90 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="occ-short-tag"
              className="text-xs font-bold text-slate-700 flex items-center gap-1.5"
            >
              <Tag className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <span>Placa / Código curto (opcional)</span>
            </label>
            <span className="text-[11px] font-mono-tabular text-slate-500">
              {shortTag.length}/10
            </span>
          </div>
          <input
            id="occ-short-tag"
            type="text"
            maxLength={10}
            value={shortTag}
            onChange={(e) => setShortTag(e.target.value.slice(0, 10))}
            placeholder="Ex: ABC1234 ou VTR-04"
            className="w-full min-h-[46px] px-3.5 bg-white border border-slate-300 rounded-xl text-sm font-mono-tabular font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          {hasMatchingTarget && (
            <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Mesmo veículo/alvo identificado</span>
            </div>
          )}
        </div>

        {!selectedCategory ? (
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {categories.length === 0 ? (
              <div className="col-span-full py-10 text-center text-sm text-slate-500">
                Nenhuma categoria cadastrada ainda.
              </div>
            ) : (
              categories.map((cat) => {
                const subCount = subcategories.filter(
                  (s) => s.categoryId === cat.id
                ).length;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    disabled={subCount === 0}
                    onClick={() => setSelectedCategory(cat)}
                    className="min-h-[82px] p-4 rounded-2xl border-2 border-slate-200 bg-white hover:border-slate-900 hover:bg-slate-50 disabled:opacity-50 active:scale-[0.98] transition-all flex items-center gap-3.5 text-left shadow-xs"
                  >
                    <CategoryAvatar
                      iconType={cat.iconType}
                      colorHex={cat.colorHex}
                      emoji={cat.emoji}
                      alt={cat.name}
                      className="w-14 h-14"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-extrabold text-slate-900 truncate">
                        {cat.name}
                      </div>
                      <div className="text-xs font-semibold text-slate-500 mt-0.5">
                        {cat.isPrimary ? 'Principal · ' : ''}
                        {subCount === 0
                          ? 'Sem opções'
                          : `${subCount} ${subCount === 1 ? 'opção' : 'opções'}`}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                  </button>
                );
              })
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {subcategories.filter((s) => s.categoryId === selectedCategory.id)
              .length > 5 && (
              <div className="px-4 pt-3 pb-2 border-b border-slate-100 bg-slate-50/60">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Buscar em ${selectedCategory.name}...`}
                    className="w-full min-h-[46px] pl-10 pr-4 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeSubcategories.length === 0 ? (
                <div className="col-span-full py-10 text-center text-sm text-slate-500">
                  Nenhuma subcategoria encontrada.
                </div>
              ) : (
                activeSubcategories.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() =>
                      onSelectSubcategory(selectedCategory, sub, finalTag)
                    }
                    className="min-h-[76px] p-3.5 rounded-2xl border-2 border-slate-200 bg-white hover:border-blue-600 hover:bg-blue-50/40 active:scale-[0.98] transition-all flex items-center gap-3.5 text-left shadow-xs"
                  >
                    <OccurrenceAvatar
                      spec={{
                        visualType: sub.visualType,
                        vehicleIconKey: sub.vehicleIconKey,
                        symbolKey: sub.symbolKey,
                        emoji: sub.emoji,
                        customImageDataUrl: sub.customImageDataUrl,
                        colorHex: sub.colorHex,
                        pulseEffect: sub.pulseEffect,
                      }}
                      alt={sub.name}
                      className="w-14 h-14"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-extrabold text-slate-900 truncate">
                        {sub.name}
                      </div>
                      <div className="text-xs font-medium text-slate-500 mt-0.5">
                        {sub.pulseEffect
                          ? 'Alerta visual piscante'
                          : 'Toque para marcar na rua'}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <div className="p-4 border-t border-slate-200 bg-white">
          <button
            type="button"
            onClick={handleClose}
            className="w-full min-h-[48px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-sm transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
