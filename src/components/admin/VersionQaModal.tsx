import React, { useEffect, useMemo, useState } from 'react';
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

const SECTION_META: {
  key: QaSectionKey;
  title: string;
  subtitle: string;
}[] = [
  {
    key: 'features',
    title: 'Funcionalidades Criadas (v1.0 a v4.5-RC)',
    subtitle: 'Entregas já implementadas para validação de qualidade.',
  },
  {
    key: 'bugs',
    title: 'O que Deu Errado / Pendências de Revisão',
    subtitle:
      'Registre aqui bugs ou falhas encontradas durante os testes da versão.',
  },
  {
    key: 'roadmap',
    title: 'Ideias para o Futuro (Roadmap)',
    subtitle: 'Próximas integrações, banco em nuvem e automação de deploy.',
  },
];

function formatTxtStatusTag(item: QaChecklistItem): string {
  const donePart = item.done ? 'FEITO' : 'PENDENTE';
  if (item.qaStatus === 'approved') return `[${donePart} | APROVADO]`;
  if (item.qaStatus === 'attention') return `[${donePart} | DAR ATENÇÃO]`;
  if (item.qaStatus === 'urgent_error') return `[${donePart} | ERRO URGENTE]`;
  return `[${donePart} | NÃO TESTADO]`;
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
    `RESUMO: ${doneCount}/${total} Feitos | ${approvedCount} Aprovados | ${attentionCount} Dar Atenção | ${urgentCount} Erros Urgentes`
  );
  lines.push('');

  if (state.releases && state.releases.length > 0) {
    lines.push('--- HISTÓRICO DE VERSÕES (MAJOR.MINOR) ---');
    state.releases.forEach((rel) => {
      const tag = rel.releaseType === 'major' ? 'MAJOR (X.0)' : 'MINOR (X.Y)';
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
        lines.push(`${idx + 1}. ${formatTxtStatusTag(item)} ${item.title}`);
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newSection, setNewSection] = useState<QaSectionKey>('bugs');

  // Versionamento Semântico (Major X.0 / Minor X.Y)
  const [pendingReleaseType, setPendingReleaseType] = useState<
    'major' | 'minor' | null
  >(null);
  const [releaseSummary, setReleaseSummary] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDraft(changelog);
      setHasUnsavedChanges(false);
      setSaveFeedback(null);
      setPendingReleaseType(null);
      setReleaseSummary('');
    }
  }, [isOpen, changelog]);

  useEffect(() => {
    if (!saveFeedback) return;
    const t = window.setTimeout(() => setSaveFeedback(null), 4000);
    return () => window.clearTimeout(t);
  }, [saveFeedback]);

  const stats = useMemo(() => {
    const items = draft.items;
    return {
      total: items.length,
      done: items.filter((i) => i.done).length,
      approved: items.filter((i) => i.qaStatus === 'approved').length,
      attention: items.filter((i) => i.qaStatus === 'attention').length,
      urgent: items.filter((i) => i.qaStatus === 'urgent_error').length,
    };
  }, [draft.items]);

  if (!isOpen) return null;

  const toggleDone = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item
      ),
    }));
    setHasUnsavedChanges(true);
  };

  const setQaStatus = (id: string, nextStatus: QaTestStatus) => {
    setDraft((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== id) return item;
        const toggled = item.qaStatus === nextStatus ? 'pending' : nextStatus;
        return { ...item, qaStatus: toggled };
      }),
    }));
    setHasUnsavedChanges(true);
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
      versionTag: draft.version,
      createdAt: Date.now(),
    };
    setDraft((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
    setNewTitle('');
    setHasUnsavedChanges(true);
  };

  const handleDeleteItem = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id),
    }));
    setHasUnsavedChanges(true);
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
    setDraft((prev) => ({
      ...prev,
      version: nextVer,
      releases: [...(prev.releases || []), note],
    }));
    setPendingReleaseType(null);
    setReleaseSummary('');
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await onSave(draft);
      setDraft(saved);
      setHasUnsavedChanges(false);
      setSaveFeedback('Alterações salvas com segurança.');
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

  const nextMajor = bumpSemanticVersion(draft.version, 'major');
  const nextMinor = bumpSemanticVersion(draft.version, 'minor');

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
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-slate-900 shrink-0" />
              <h2
                id="qa-modal-title"
                className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight"
              >
                Versão {draft.version} · Histórico, QA e Roadmap
              </h2>
            </div>
            <p className="mt-1 text-xs font-mono-tabular text-slate-600">
              {stats.done}/{stats.total} feitos · {stats.approved} aprovados ·{' '}
              {stats.attention} dar atenção · {stats.urgent} erros urgentes
            </p>
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

        {/* Alerta de Revisão Crítica v4.5-RC */}
        <div
          role="alert"
          className="px-5 sm:px-6 py-3 bg-red-50 border-b border-red-200 flex flex-wrap items-center gap-2.5"
        >
          <span className="px-2 py-0.5 rounded-md bg-red-600 text-white text-[11px] font-extrabold uppercase tracking-wide shrink-0">
            REVISÃO CRÍTICA
          </span>
          <span className="text-xs sm:text-sm font-extrabold text-red-900">
            Validar saída imediata em 1 toque no botão flutuante do cadeado
          </span>
        </div>

        {/* Barra de Versionamento Semântico (Major X.0 / Minor X.Y) */}
        <div className="px-5 sm:px-6 py-3 border-b border-slate-200 bg-slate-50 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-700">
              <GitBranch className="w-4 h-4 text-slate-700 shrink-0" />
              <span>
                Regra semântica: <strong className="text-slate-900">X.0</strong>{' '}
                novas estruturas · <strong className="text-slate-900">X.Y</strong>{' '}
                correções/ajustes
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPendingReleaseType('minor');
                  setReleaseSummary('');
                }}
                className="min-h-[36px] px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-800 whitespace-nowrap"
              >
                + Subversão ({nextMinor})
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingReleaseType('major');
                  setReleaseSummary('');
                }}
                className="min-h-[36px] px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold whitespace-nowrap"
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
              {draft.releases.map((rel, idx) => (
                <span key={`${rel.version}-${idx}`} className="font-mono-tabular">
                  <strong className="text-slate-900">v{rel.version}</strong> (
                  {rel.releaseType === 'major' ? 'Major' : 'Minor'}): {rel.summary}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Barra rápida para adicionar novos tópicos */}
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
            <option value="bugs">O que Deu Errado / Bug</option>
            <option value="features">Funcionalidade Criada</option>
            <option value="roadmap">Ideia Futura (Roadmap)</option>
          </select>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Adicionar novo tópico ou anotar erro encontrado..."
            className="flex-1 min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            type="submit"
            disabled={!newTitle.trim()}
            className="min-h-[44px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar tópico</span>
          </button>
        </form>

        {/* Corpo rolável com as 3 listas */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-6 bg-slate-50/50">
          {SECTION_META.map((sec) => {
            const sectionItems = draft.items.filter(
              (item) => item.section === sec.key
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
                    Nenhum item registrado ainda. Use o campo acima para anotar pendências ou bugs desta versão.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {sectionItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 sm:px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <label className="inline-flex items-center gap-2 min-h-[36px] px-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer shrink-0 select-none">
                            <input
                              type="checkbox"
                              checked={item.done}
                              onChange={() => toggleDone(item.id)}
                              className="w-4 h-4 rounded accent-slate-900"
                            />
                            <span className="text-xs font-bold text-slate-800">
                              Feito
                            </span>
                          </label>

                          <span
                            className={`text-sm leading-snug pt-1.5 ${
                              item.done
                                ? 'text-slate-900 font-medium'
                                : 'text-slate-700'
                            }`}
                          >
                            {item.title}
                          </span>
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
                              Testado / Aprovado
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
            ) : hasUnsavedChanges ? (
              <span className="font-semibold text-amber-800">
                Existem alterações ainda não salvas no navegador.
              </span>
            ) : draft.lastSavedAt ? (
              <span className="font-mono-tabular">
                Último salvamento:{' '}
                {new Date(draft.lastSavedAt).toLocaleString('pt-BR')}
              </span>
            ) : (
              <span>Versão {draft.version} carregada</span>
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
              onClick={handleSave}
              disabled={saving}
              className="min-h-[46px] px-5 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Salvando...' : 'Salvar Alterações'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
