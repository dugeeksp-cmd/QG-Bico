import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Download,
  GitBranch,
  History,
  Plus,
  Save,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import {
  QaChangelogState,
  QaChecklistItem,
  QaSectionKey,
  QaTestStatus,
  VersionReleaseNote,
} from '../../types/radar';
import { bumpSemanticVersion } from '../../utils/rbac';

interface VersionQaModalProps {
  isOpen: boolean;
  changelog: QaChangelogState;
  onSave: (nextState: QaChangelogState) => Promise<QaChangelogState>;
  onClose: () => void;
}

type VersionFilterKey = 'all' | '6.1.0' | '7.0' | '6.0' | 'legacy';

const SECTION_META: {
  key: QaSectionKey;
  title: string;
  subtitle: string;
}[] = [
  {
    key: 'features',
    title: 'Funcionalidades Entregues & Checklist de Validação',
    subtitle:
      'Marque cada entrega como Validada / Funcionando ou Pendente conforme testar no aparelho.',
  },
  {
    key: 'bugs',
    title: 'O que Deu Errado / Pendências de Revisão',
    subtitle:
      'Registre bugs, regressões ou comportamentos que precisam de ajuste.',
  },
  {
    key: 'roadmap',
    title: 'Próximas Etapas & Roadmap (v7.0+)',
    subtitle:
      'Integrações futuras planejadas (Firebase Firestore em tempo real, automações).',
  },
];

function getVersionCategory(tag?: string): VersionFilterKey {
  const clean = (tag || '').trim();
  if (clean.startsWith('6.1')) return '6.1.0';
  if (clean.startsWith('7.')) return '7.0';
  if (clean.startsWith('6.0') || clean === '6') return '6.0';
  return 'legacy';
}

function formatTxtStatusTag(item: QaChecklistItem): string {
  const donePart = item.done ? 'VALIDADO' : 'PENDENTE';
  if (item.qaStatus === 'approved') return `[${donePart} | APROVADO]`;
  if (item.qaStatus === 'attention') return `[${donePart} | DAR ATENÇÃO]`;
  if (item.qaStatus === 'urgent_error') return `[${donePart} | ERRO URGENTE]`;
  return `[${donePart} | AGUARDANDO TESTE]`;
}

function buildTxtReport(state: QaChangelogState): string {
  const now = new Date();
  const dateStr = now.toLocaleString('pt-BR');
  const lines: string[] = [];

  lines.push('=================================================================');
  lines.push(
    `RADAR DA CAÇA - HISTÓRICO DE DESENVOLVIMENTO & QA (VERSÃO ${state.version})`
  );
  lines.push(`Exportado em: ${dateStr}`);
  lines.push('=================================================================');
  lines.push('');

  const total = state.items.length;
  const doneCount = state.items.filter((i) => i.done).length;
  const pendingCount = total - doneCount;
  const approvedCount = state.items.filter(
    (i) => i.qaStatus === 'approved'
  ).length;
  const attentionCount = state.items.filter(
    (i) => i.qaStatus === 'attention'
  ).length;
  const urgentCount = state.items.filter(
    (i) => i.qaStatus === 'urgent_error'
  ).length;

  lines.push(
    `RESUMO: ${doneCount}/${total} Validados (${pendingCount} Pendentes) | ${approvedCount} Aprovados | ${attentionCount} Dar Atenção | ${urgentCount} Erros Urgentes`
  );
  lines.push('');

  if (state.releases && state.releases.length > 0) {
    lines.push('--- HISTÓRICO DE VERSÕES (MAJOR.MINOR) ---');
    state.releases.forEach((rel) => {
      const tag = rel.releaseType === 'major' ? 'MAJOR' : 'MINOR';
      lines.push(`• v${rel.version} [${tag}] — ${rel.summary}`);
    });
    lines.push('');
  }

  SECTION_META.forEach((sec) => {
    const items = state.items.filter((i) => i.section === sec.key);
    lines.push(`--- ${sec.title.toUpperCase()} ---`);
    if (items.length === 0) {
      lines.push('(Nenhum item registrado nesta seção)');
    } else {
      items.forEach((item, idx) => {
        const ver = item.versionTag ? `[v${item.versionTag}] ` : '';
        lines.push(`${idx + 1}. ${ver}${formatTxtStatusTag(item)} ${item.title}`);
      });
    }
    lines.push('');
  });

  return lines.join('\n');
}

export const VersionQaModal: React.FC<VersionQaModalProps> = ({
  isOpen,
  changelog,
  onSave,
  onClose,
}) => {
  const [draft, setDraft] = useState<QaChangelogState>(changelog);
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [versionFilter, setVersionFilter] = useState<VersionFilterKey>('all');

  const [newTitle, setNewTitle] = useState('');
  const [newSection, setNewSection] = useState<QaSectionKey>('bugs');

  // Versionamento Semântico (Major X.0 / Minor X.Y)
  const [pendingReleaseType, setPendingReleaseType] = useState<
    'major' | 'minor' | null
  >(null);
  const [releaseSummary, setReleaseSummary] = useState('');

  const persistQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (isOpen) {
      setDraft(changelog);
      setSaveFeedback(null);
      setPendingReleaseType(null);
      setReleaseSummary('');
    }
  }, [isOpen, changelog]);

  useEffect(() => {
    if (!saveFeedback) return;
    const t = window.setTimeout(() => setSaveFeedback(null), 3500);
    return () => window.clearTimeout(t);
  }, [saveFeedback]);

  const stats = useMemo(() => {
    const items = draft.items;
    const total = items.length;
    const done = items.filter((i) => i.done).length;
    const pending = total - done;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return {
      total,
      done,
      pending,
      percent,
      approved: items.filter((i) => i.qaStatus === 'approved').length,
      attention: items.filter((i) => i.qaStatus === 'attention').length,
      urgent: items.filter((i) => i.qaStatus === 'urgent_error').length,
    };
  }, [draft.items]);

  const latestReleaseSummary = useMemo(() => {
    if (draft.releases && draft.releases.length > 0) {
      return draft.releases[draft.releases.length - 1].summary;
    }
    return 'Correção definitiva do mapa branco, CARTO Escuro Limpo, Botão de Pânico instantâneo e Checklist QA interativo';
  }, [draft.releases]);

  if (!isOpen) return null;

  // Persiste automaticamente no localStorage a cada clique, sem perder o estado ao fechar o modal
  const commitDraftUpdate = (
    updater: (prev: QaChangelogState) => QaChangelogState,
    feedbackMsg = 'Salvo automaticamente no dispositivo.'
  ) => {
    setDraft((prev) => {
      const next = updater(prev);
      persistQueueRef.current = persistQueueRef.current
        .then(async () => {
          setSaving(true);
          try {
            const saved = await onSave(next);
            setDraft((curr) => ({
              ...curr,
              lastSavedAt: saved.lastSavedAt,
            }));
            setSaveFeedback(feedbackMsg);
          } finally {
            setSaving(false);
          }
        })
        .catch(() => {
          setSaving(false);
        });
      return next;
    });
  };

  const toggleDone = (id: string) => {
    commitDraftUpdate((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== id) return item;
        const nextDone = !item.done;
        return {
          ...item,
          done: nextDone,
          qaStatus:
            nextDone && item.qaStatus === 'pending'
              ? 'approved'
              : !nextDone && item.qaStatus === 'approved'
              ? 'pending'
              : item.qaStatus,
        };
      }),
    }));
  };

  const setQaStatus = (id: string, nextStatus: QaTestStatus) => {
    commitDraftUpdate((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== id) return item;
        const toggled = item.qaStatus === nextStatus ? 'pending' : nextStatus;
        return {
          ...item,
          qaStatus: toggled,
          done: toggled === 'approved' ? true : item.done,
        };
      }),
    }));
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const newItem: QaChecklistItem = {
      id: `qa-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      section: newSection,
      title: trimmed,
      done: newSection === 'features',
      qaStatus: newSection === 'bugs' ? 'attention' : 'pending',
      versionTag: newSection === 'roadmap' ? '7.0' : draft.version,
      createdAt: Date.now(),
    };
    commitDraftUpdate(
      (prev) => ({
        ...prev,
        items: [newItem, ...prev.items],
      }),
      'Novo item adicionado e salvo.'
    );
    setNewTitle('');
  };

  const handleDeleteItem = (id: string) => {
    commitDraftUpdate(
      (prev) => ({
        ...prev,
        items: prev.items.filter((item) => item.id !== id),
      }),
      'Tópico removido.'
    );
  };

  const handleConfirmVersionBump = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingReleaseType) return;
    const nextVer = bumpSemanticVersion(draft.version, pendingReleaseType);
    const note: VersionReleaseNote = {
      version: nextVer,
      releaseType: pendingReleaseType,
      summary:
        releaseSummary.trim() ||
        (pendingReleaseType === 'major'
          ? 'Nova versão maior com funcionalidades estruturais'
          : 'Subversão com correções e ajustes finos'),
      releasedAt: Date.now(),
    };
    commitDraftUpdate(
      (prev) => ({
        ...prev,
        version: nextVer,
        releases: [...(prev.releases || []), note],
      }),
      `Versão v${nextVer} registrada e salva.`
    );
    setPendingReleaseType(null);
    setReleaseSummary('');
  };

  const handleManualSave = async () => {
    setSaving(true);
    try {
      const saved = await onSave(draft);
      setDraft(saved);
      setSaveFeedback('Checklist sincronizado com sucesso.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadTxt = () => {
    const content = buildTxtReport(draft);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const dateSlug = new Date().toISOString().slice(0, 10);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `radar-qa-v${draft.version}-${dateSlug}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const matchesVersionFilter = (item: QaChecklistItem) => {
    if (versionFilter === 'all') return true;
    return getVersionCategory(item.versionTag) === versionFilter;
  };

  const nextMajor = bumpSemanticVersion(draft.version, 'major');
  const nextMinor = bumpSemanticVersion(draft.version, 'minor');

  const filterOptions: { key: VersionFilterKey; label: string }[] = [
    { key: 'all', label: `Todas (${draft.items.length})` },
    { key: '6.1.0', label: 'v6.1.0 (Atual)' },
    { key: '7.0', label: 'v7.0 (Firebase)' },
    { key: '6.0', label: 'v6.0' },
    { key: 'legacy', label: 'v1.0 – v5.0' },
  ];

  return (
    <div
      className="fixed inset-0 z-[1350] flex items-end sm:items-center justify-center bg-slate-950/65 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qa-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-5xl bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-2xl h-[92vh] sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-50/70">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-blue-700 shrink-0" />
              <h2
                id="qa-modal-title"
                className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight"
              >
                Versão {draft.version} · Painel de Controle e Testes QA
              </h2>
            </div>

            {/* Resumo + Barra de Progresso */}
            <div className="mt-2 space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono-tabular">
                <span className="font-extrabold text-emerald-700">
                  {stats.done} validados / concluídos
                </span>
                <span className="text-slate-300">·</span>
                <span className="font-bold text-amber-700">
                  {stats.pending} pendentes
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-600">
                  {stats.approved} aprovados · {stats.attention} dar atenção ·{' '}
                  {stats.urgent} urgentes
                </span>
              </div>

              <div className="w-full max-w-md h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${stats.percent}%` }}
                />
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar histórico e QA"
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Banner Versão Atual */}
        <div
          role="status"
          className="px-5 sm:px-6 py-3 bg-blue-50 border-b border-blue-200 flex flex-wrap items-center gap-2.5"
        >
          <span className="px-2 py-0.5 rounded-md bg-blue-700 text-white text-[11px] font-extrabold uppercase tracking-wide shrink-0">
            VERSÃO {draft.version}
          </span>
          <span className="text-xs sm:text-sm font-extrabold text-blue-950">
            {latestReleaseSummary}
          </span>
        </div>

        {/* Filtro por Versão + Barra de Versionamento Semântico */}
        <div className="px-5 sm:px-6 py-3 border-b border-slate-200 bg-slate-50 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {filterOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setVersionFilter(opt.key)}
                  className={`min-h-[34px] px-3 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                    versionFilter === opt.key
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPendingReleaseType('minor');
                  setReleaseSummary('');
                }}
                className="min-h-[34px] px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-800 whitespace-nowrap"
              >
                + Subversão ({nextMinor})
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingReleaseType('major');
                  setReleaseSummary('');
                }}
                className="min-h-[34px] px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold whitespace-nowrap"
              >
                + Versão Maior ({nextMajor})
              </button>
            </div>
          </div>

          {pendingReleaseType && (
            <form
              onSubmit={handleConfirmVersionBump}
              className="flex flex-col sm:flex-row gap-2 pt-1"
            >
              <input
                type="text"
                required
                value={releaseSummary}
                onChange={(e) => setReleaseSummary(e.target.value)}
                placeholder={
                  pendingReleaseType === 'major'
                    ? `Resumo da Versão ${nextMajor} (novas funcionalidades)...`
                    : `Resumo da Subversão ${nextMinor} (correções/ajustes)...`
                }
                className="flex-1 min-h-[40px] px-3 rounded-xl border border-slate-300 bg-white text-xs text-slate-900"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="min-h-[40px] px-3.5 rounded-xl bg-blue-700 text-white text-xs font-bold whitespace-nowrap"
                >
                  Registrar v
                  {pendingReleaseType === 'major' ? nextMajor : nextMinor}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingReleaseType(null)}
                  className="min-h-[40px] px-3 rounded-xl bg-slate-200 text-slate-800 text-xs font-semibold"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {draft.releases && draft.releases.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
              <GitBranch className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              {draft.releases.map((rel, idx) => (
                <span key={`${rel.version}-${idx}`} className="font-mono-tabular">
                  <strong className="text-slate-900">v{rel.version}</strong>:{' '}
                  {rel.summary}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Barra rápida para adicionar novos tópicos ou observações */}
        <form
          onSubmit={handleAddItem}
          className="px-5 sm:px-6 py-3.5 border-b border-slate-200 bg-white flex flex-col sm:flex-row gap-2.5"
        >
          <select
            aria-label="Seção do novo tópico"
            value={newSection}
            onChange={(e) => setNewSection(e.target.value as QaSectionKey)}
            className="min-h-[44px] px-3 rounded-xl border border-slate-300 bg-slate-50 text-xs font-bold text-slate-800 sm:w-56 shrink-0"
          >
            <option value="bugs">Bug / Observação de Teste</option>
            <option value="features">Item Validado / Funcionalidade</option>
            <option value="roadmap">Próxima Etapa (Roadmap)</option>
          </select>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Adicionar novo item de teste, bug ou observação..."
            className="flex-1 min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            type="submit"
            disabled={!newTitle.trim()}
            className="min-h-[44px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar item</span>
          </button>
        </form>

        {/* Corpo rolável com as 3 listas */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-6 bg-slate-50/50">
          {SECTION_META.map((sec) => {
            const sectionItems = draft.items.filter(
              (item) => item.section === sec.key && matchesVersionFilter(item)
            );
            return (
              <section
                key={sec.key}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
              >
                <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      {sec.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {sec.subtitle}
                    </p>
                  </div>
                  <span className="text-xs font-mono-tabular font-semibold text-slate-600">
                    {sectionItems.length}{' '}
                    {sectionItems.length === 1 ? 'tópico' : 'tópicos'}
                  </span>
                </div>

                {sectionItems.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    Nenhum item nesta seção para o filtro selecionado.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {sectionItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 sm:px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <label
                            className={`inline-flex items-center gap-2 min-h-[38px] px-2.5 rounded-lg border cursor-pointer shrink-0 select-none transition-colors ${
                              item.done
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                                : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={item.done}
                              onChange={() => toggleDone(item.id)}
                              className="w-4 h-4 rounded accent-emerald-700"
                            />
                            <span className="text-xs font-extrabold whitespace-nowrap">
                              {item.done ? 'Validado' : 'Pendente'}
                            </span>
                          </label>

                          <div className="min-w-0 flex-1 pt-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {item.versionTag && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono-tabular font-extrabold text-slate-700 shrink-0">
                                  v{item.versionTag}
                                </span>
                              )}
                              <span
                                className={`text-sm leading-snug ${
                                  item.done
                                    ? 'text-slate-900 font-semibold'
                                    : 'text-slate-700'
                                }`}
                              >
                                {item.title}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setQaStatus(item.id, 'approved')}
                            className={`min-h-[38px] px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                              item.qaStatus === 'approved'
                                ? 'bg-emerald-600 text-white border-emerald-700'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-400 hover:text-emerald-800'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span className="whitespace-nowrap">
                              Funcionando
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setQaStatus(item.id, 'attention')}
                            className={`min-h-[38px] px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                              item.qaStatus === 'attention'
                                ? 'bg-amber-400 text-slate-950 border-amber-500'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400 hover:text-amber-800'
                            }`}
                          >
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span className="whitespace-nowrap">
                              Dar Atenção
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setQaStatus(item.id, 'urgent_error')}
                            className={`min-h-[38px] px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                              item.qaStatus === 'urgent_error'
                                ? 'bg-red-600 text-white border-red-700'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-red-400 hover:text-red-700'
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                            <span className="whitespace-nowrap">
                              Erro Urgente
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            aria-label={`Remover tópico ${item.title}`}
                            title="Remover tópico"
                            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* Rodapé fixo */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            {saveFeedback ? (
              <span className="font-bold text-emerald-700 inline-flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                {saveFeedback}
              </span>
            ) : draft.lastSavedAt ? (
              <span className="font-mono-tabular">
                Salvo automaticamente ·{' '}
                {new Date(draft.lastSavedAt).toLocaleString('pt-BR')}
              </span>
            ) : (
              <span>Versão {draft.version} carregada · Salvamento automático ativo</span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadTxt}
              className="min-h-[46px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-900 text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Download className="w-4 h-4 text-slate-700" />
              <span>Baixar Histórico (.TXT)</span>
            </button>

            <button
              type="button"
              onClick={handleManualSave}
              disabled={saving}
              className="min-h-[46px] px-5 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Salvando...' : 'Confirmar & Salvar'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
