import React, { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Database,
  Download,
  Eye,
  FileText,
  HardDrive,
  MapPin,
  RefreshCw,
  Server,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  AlertAuditEntry,
  ChatAuditLogFile,
  MapOccurrence,
  QaChangelogState,
  ROLE_LABELS,
  StoreClosingRecord,
  StoreUnit,
  UserAccount,
} from '../../types/radar';

interface SystemHealthViewProps {
  users: UserAccount[];
  stores: StoreUnit[];
  storeClosings: StoreClosingRecord[];
  occurrences: MapOccurrence[];
  alertAudit: AlertAuditEntry[];
  chatAuditLogs: ChatAuditLogFile[];
  qaChangelog: QaChangelogState;
  onDownloadAuditLogTxt: (log: ChatAuditLogFile) => void;
}

const STORAGE_PREFIXES = [
  'radar_v2_users',
  'radar_v2_stores',
  'radar_v2_categories',
  'radar_v2_subcategories',
  'radar_v2_occurrences',
  'radar_v3_alert_audit',
  'radar_v31_store_closings',
  'radar_v4_shift_logs',
  'radar_v4_messages',
  'radar_v42_merchandise',
  'radar_v42_closing_alerts',
  'radar_v43_master_products',
  'radar_v43_central_stock',
  'radar_v43_operator_shifts',
  'radar_v43_admin_alerts',
  'radar_v44_chat_rooms',
  'radar_v44_chat_messages',
  'radar_v44_chat_audit_logs',
  'saas_mapa_qa_changelog_v1',
];

const QUOTA_BYTES = 5 * 1024 * 1024; // ~5 MB padrão navegador

export const SystemHealthView: React.FC<SystemHealthViewProps> = ({
  users,
  stores,
  storeClosings,
  occurrences,
  alertAudit,
  chatAuditLogs,
  qaChangelog,
  onDownloadAuditLogTxt,
}) => {
  const [refreshTick, setRefreshTick] = useState(0);
  const [previewLog, setPreviewLog] = useState<ChatAuditLogFile | null>(null);

  const storageBreakdown = useMemo(() => {
    void refreshTick;
    let totalBytes = 0;
    const rows = STORAGE_PREFIXES.map((key) => {
      let bytes = 0;
      try {
        const val = localStorage.getItem(key) || '';
        bytes = new Blob([key + val]).size;
      } catch {
        bytes = 0;
      }
      totalBytes += bytes;
      return {
        key,
        bytes,
        kb: (bytes / 1024).toFixed(2),
      };
    });
    const percentUsed = Math.min(100, (totalBytes / QUOTA_BYTES) * 100);
    return {
      totalBytes,
      totalKb: (totalBytes / 1024).toFixed(2),
      percentUsed: percentUsed.toFixed(2),
      rows,
    };
  }, [
    refreshTick,
    users,
    stores,
    occurrences,
    alertAudit,
    storeClosings,
    chatAuditLogs,
    qaChangelog,
  ]);

  const blockedUsersCount = users.filter((u) => u.isBlocked).length;
  const publicUsersCount = users.filter((u) => u.isPublicProfile).length;
  const openStoresCount = stores.filter((s) => s.isOpen).length;
  const geolocationAvailable =
    typeof navigator !== 'undefined' && 'geolocation' in navigator;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Activity className="w-6 h-6 text-emerald-700" />
              <span>Saúde do Sistema &amp; Auditoria de Logs (Super Admin)</span>
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Diagnóstico técnico da camada DataService, arquivos silenciosos
              .TXT das conversas e prontidão para Firebase/PHP.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRefreshTick((t) => t + 1)}
            className="min-h-[44px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Atualizar leitura</span>
          </button>
        </div>

        {/* Cartões de Estado Técnico */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Camada DataService</span>
              <Server className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-base font-extrabold text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Operacional (Assíncrono)</span>
            </div>
            <div className="text-xs text-slate-500">
              Repository Pattern pronto p/ Firestore onSnapshot
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Uso de Armazenamento</span>
              <HardDrive className="w-4 h-4 text-blue-700" />
            </div>
            <div className="text-xl font-extrabold font-mono-tabular text-slate-900">
              {storageBreakdown.totalKb} KB
            </div>
            <div className="text-xs text-slate-500 font-mono-tabular">
              {storageBreakdown.percentUsed}% da cota estimada (5 MB)
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Provedor de Mapas &amp; GPS</span>
              <MapPin className="w-4 h-4 text-blue-700" />
            </div>
            <div className="text-base font-extrabold text-slate-900">
              OpenStreetMap Nativo
            </div>
            <div className="text-xs text-slate-500">
              GPS do dispositivo:{' '}
              {geolocationAvailable ? 'Disponível' : 'Indisponível'}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Sessão &amp; Segurança</span>
              <ShieldCheck className="w-4 h-4 text-slate-800" />
            </div>
            <div className="text-base font-extrabold text-slate-900">
              100% em Memória + Anti-Espião
            </div>
            <div className="text-xs text-slate-500">
              Bloqueio automático por perda de foco ativo
            </div>
          </div>
        </div>

        {/* Auditoria Silenciosa em .TXT (Exclusivo Super Admin) */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-700" />
                <span>
                  Auditoria Silenciosa de Chats (.TXT estilo WhatsApp)
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Salas normais (incluindo pós-leitura e botão de pânico) geram
                arquivo .TXT protegido e disparam POST /api/save-chat-log.php.
                O Chat Super Secreto do Presidente nunca gera arquivo.
              </p>
            </div>
            <span className="text-xs font-mono-tabular font-extrabold text-slate-700">
              {chatAuditLogs.length}{' '}
              {chatAuditLogs.length === 1 ? 'arquivo' : 'arquivos'}
            </span>
          </div>

          {chatAuditLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Nenhum arquivo .TXT de conversa registrado ainda. Envie mensagens
              em uma sala normal de chat para gerar automaticamente o arquivo de
              auditoria.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {chatAuditLogs.map((log) => {
                const statusLabel =
                  log.status === 'PANIC_DESTROYED'
                    ? 'Destruída via Pânico'
                    : log.status === 'CLOSED'
                    ? 'Encerrada'
                    : 'Em andamento';
                return (
                  <div
                    key={log.id}
                    className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold font-mono-tabular text-slate-900 truncate">
                        {log.filename}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="font-bold">{log.roomName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">
                          {log.roomCode}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Criada por {log.createdByName} (
                          {ROLE_LABELS[log.createdByRole]})
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">
                          {log.linesCount} linhas · {statusLabel}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono-tabular text-slate-500 mt-0.5">
                        Atualizado em{' '}
                        {new Date(log.updatedAt).toLocaleString('pt-BR')} ·{' '}
                        {log.endpointDispatched
                          ? 'Enviado a /api/save-chat-log.php'
                          : 'Arquivado localmente (pronto p/ PHP)'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewLog(log)}
                        className="min-h-[44px] px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold flex items-center gap-1.5"
                      >
                        <Eye className="w-4 h-4 text-blue-700" />
                        <span>Visualizar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onDownloadAuditLogTxt(log)}
                        className="min-h-[44px] px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5"
                      >
                        <Download className="w-4 h-4" />
                        <span>Baixar .TXT</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Contadores Gerais */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-700" />
            <span>Volume de Registros no Banco Local</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500 font-semibold">
                Usuários Totais
              </div>
              <div className="text-xl font-extrabold font-mono-tabular text-slate-900 mt-1">
                {users.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {blockedUsersCount} bloqueados · {publicUsersCount} públicos
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500 font-semibold">
                Lojas Fixas
              </div>
              <div className="text-xl font-extrabold font-mono-tabular text-slate-900 mt-1">
                {stores.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {openStoresCount} abertas agora
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500 font-semibold">
                Ocorrências &amp; Logs
              </div>
              <div className="text-xl font-extrabold font-mono-tabular text-slate-900 mt-1">
                {occurrences.length} / {alertAudit.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Ativas no mapa / Auditoria total
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500 font-semibold">
                Fechamentos &amp; QA
              </div>
              <div className="text-xl font-extrabold font-mono-tabular text-slate-900 mt-1">
                {storeClosings.length} / {qaChangelog.items.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Fechamentos / Itens de QA (v{qaChangelog.version})
              </div>
            </div>
          </div>
        </section>

        {/* Detalhamento de Chaves */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70">
            <h2 className="text-base font-bold text-slate-900">
              Consumo Detalhado por Coleção (localStorage)
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {storageBreakdown.rows.map((row) => (
              <div
                key={row.key}
                className="px-5 py-3 flex items-center justify-between gap-4 text-xs"
              >
                <span className="font-mono-tabular font-bold text-slate-800 truncate">
                  {row.key}
                </span>
                <span className="font-mono-tabular text-slate-600 shrink-0">
                  {row.kb} KB ({row.bytes} bytes)
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Modal de Visualização de Arquivo .TXT */}
      {previewLog && (
        <div
          className="fixed inset-0 z-[1400] flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewLog(null)}
        >
          <div
            className="w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-2xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50">
              <div className="min-w-0">
                <div className="text-sm font-extrabold font-mono-tabular text-slate-900 truncate">
                  {previewLog.filename}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {previewLog.roomName} · {previewLog.roomCode}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewLog(null)}
                aria-label="Fechar visualização"
                className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-950 text-emerald-300 font-mono-tabular text-xs leading-relaxed whitespace-pre-wrap break-words">
              {previewLog.contentTxt}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 bg-white flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onDownloadAuditLogTxt(previewLog)}
                className="min-h-[44px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Baixar Arquivo .TXT</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
