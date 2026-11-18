import {
  ChatAuditLogFile,
  ChatMessage,
  ChatRoom,
  ROLE_LABELS,
} from '../types/radar';

export const CHAT_AUDIT_STORAGE_KEY = 'radar_v44_chat_audit_logs';
const PHP_AUDIT_ENDPOINT = '/api/save-chat-log.php';

type AuditListener = (logs: ChatAuditLogFile[]) => void;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatChatAuditTimestamp(ts: number): string {
  const d = new Date(ts);
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  const hh = pad2(d.getHours());
  const min = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
}

export function formatWhatsAppAuditLine(
  room: Pick<ChatRoom, 'roomCode'>,
  message: Pick<
    ChatMessage,
    'senderName' | 'senderRole' | 'content' | 'createdAt'
  >
): string {
  const dt = formatChatAuditTimestamp(message.createdAt);
  const roleLabel = ROLE_LABELS[message.senderRole] || message.senderRole;
  const cleanText = message.content.replace(/\r?\n/g, ' ').trim();
  return `[${dt}] ${message.senderName} (${roleLabel}) [Sala #${room.roomCode}]: ${cleanText}`;
}

function buildAuditFilename(roomCode: string, createdAt: number): string {
  const d = new Date(createdAt);
  const datePart = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(
    d.getDate()
  )}`;
  const safeCode = roomCode.replace(/[^A-Za-z0-9_-]/g, '');
  return `chat_${safeCode}_${datePart}.txt`;
}

class SilentChatAuditService {
  private listeners = new Set<AuditListener>();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === CHAT_AUDIT_STORAGE_KEY) {
          this.emit();
        }
      });
    }
  }

  private readLogs(): ChatAuditLogFile[] {
    try {
      const raw = localStorage.getItem(CHAT_AUDIT_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as ChatAuditLogFile[]) : [];
    } catch {
      return [];
    }
  }

  private writeLogs(logs: ChatAuditLogFile[]): void {
    try {
      localStorage.setItem(CHAT_AUDIT_STORAGE_KEY, JSON.stringify(logs));
    } catch {
      // Ignora erro de cota se indisponível
    }
    this.emit();
  }

  private emit(): void {
    const logs = this.readLogs();
    this.listeners.forEach((cb) => cb(logs));
  }

  subscribe(callback: AuditListener): () => void {
    this.listeners.add(callback);
    callback(this.readLogs());
    return () => {
      this.listeners.delete(callback);
    };
  }

  getLogsSync(): ChatAuditLogFile[] {
    return this.readLogs();
  }

  /**
   * Registra silenciosamente cada mensagem de salas normais no arquivo .TXT da sala.
   * REGRA CRÍTICA: Nunca registra mensagens do Chat Super Secreto (isSuperSecret === true).
   */
  recordMessageSilently(room: ChatRoom, message: ChatMessage): void {
    if (room.isSuperSecret || room.type === 'SUPER_SECRET') return;

    const logs = this.readLogs();
    const line = formatWhatsAppAuditLine(room, message);
    const now = Date.now();
    const existingIdx = logs.findIndex((l) => l.roomId === room.id);

    if (existingIdx >= 0) {
      const existing = logs[existingIdx];
      const nextContent = existing.contentTxt
        ? `${existing.contentTxt}\n${line}`
        : line;
      const updated: ChatAuditLogFile = {
        ...existing,
        linesCount: existing.linesCount + 1,
        contentTxt: nextContent,
        updatedAt: now,
      };
      const nextLogs = [...logs];
      nextLogs[existingIdx] = updated;
      this.writeLogs(nextLogs);
      return;
    }

    const created: ChatAuditLogFile = {
      id: `clog-${room.id}`,
      filename: buildAuditFilename(room.roomCode, room.createdAt),
      roomId: room.id,
      roomCode: room.roomCode,
      roomName: room.name,
      createdByName: room.createdByName,
      createdByRole: room.createdByRole,
      linesCount: 1,
      contentTxt: line,
      status: 'ACTIVE',
      endpointDispatched: false,
      createdAt: room.createdAt,
      updatedAt: now,
    };

    this.writeLogs([created, ...logs].slice(0, 200));
  }

  /**
   * Dispara fechamento/envio silencioso do .TXT ao endpoint protegido PHP (/api/save-chat-log.php)
   * quando a sala é destruída pelo Botão de Pânico ou encerrada.
   * Nunca executa para Chat Super Secreto.
   */
  async finalizeRoomAuditLog(
    room: ChatRoom,
    status: 'CLOSED' | 'PANIC_DESTROYED'
  ): Promise<void> {
    if (room.isSuperSecret || room.type === 'SUPER_SECRET') return;

    const logs = this.readLogs();
    const existingIdx = logs.findIndex((l) => l.roomId === room.id);
    if (existingIdx < 0) return;

    const now = Date.now();
    const current = logs[existingIdx];
    const closingLine = `[${formatChatAuditTimestamp(now)}] [SISTEMA] [Sala #${
      room.roomCode
    }]: ${
      status === 'PANIC_DESTROYED'
        ? 'Sala destruída via Botão de Pânico.'
        : 'Sala encerrada pelo gestor.'
    }`;

    const updated: ChatAuditLogFile = {
      ...current,
      status,
      contentTxt: current.contentTxt
        ? `${current.contentTxt}\n${closingLine}`
        : closingLine,
      linesCount: current.linesCount + 1,
      updatedAt: now,
    };

    const nextLogs = [...logs];
    nextLogs[existingIdx] = updated;
    this.writeLogs(nextLogs);

    const dispatched = await this.dispatchToProtectedEndpoint(updated);
    if (dispatched) {
      const latest = this.readLogs();
      const idxAfter = latest.findIndex((l) => l.id === updated.id);
      if (idxAfter >= 0) {
        const synced = [...latest];
        synced[idxAfter] = {
          ...synced[idxAfter],
          endpointDispatched: true,
          lastDispatchedAt: Date.now(),
        };
        this.writeLogs(synced);
      }
    }
  }

  private async dispatchToProtectedEndpoint(
    log: ChatAuditLogFile
  ): Promise<boolean> {
    if (typeof fetch === 'undefined') return false;
    try {
      const response = await fetch(PHP_AUDIT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: log.filename,
          roomId: log.roomId,
          roomCode: log.roomCode,
          roomName: log.roomName,
          status: log.status,
          contentTxt: log.contentTxt,
          updatedAt: log.updatedAt,
        }),
      });
      return response.ok;
    } catch {
      // Em preview SPA local (sem servidor PHP ativo), o arquivo permanece salvo no arquivo local do Super Admin
      return false;
    }
  }

  downloadAuditLogTxt(log: ChatAuditLogFile): void {
    const blob = new Blob([log.contentTxt || '(Sem mensagens registradas)'], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = log.filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }
}

export const ChatAuditService = new SilentChatAuditService();
