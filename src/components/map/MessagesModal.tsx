import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  Download,
  Eye,
  Flame,
  Info,
  KeyRound,
  Lock,
  Mail,
  Plus,
  Send,
  ShieldAlert,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  ChatDeletionMode,
  ChatMessage,
  ChatRoom,
  ChatRoomType,
  ChatSavePolicy,
  ROLE_LABELS,
  StoreUnit,
  TeamMessage,
  UserAccount,
} from '../../types/radar';
import { formatRelativeDateTime } from '../../utils/geo';
import {
  canChooseSaveChatHistory,
  canCreateChatRoom,
  canCreateSuperSecretChat,
  canPanicDestroyChat,
  getMaxChatRoomsForRole,
  hasPermission,
  isUserLinkedToStore,
  ROLE_LEVEL,
} from '../../utils/rbac';

interface MessagesModalProps {
  isOpen: boolean;
  currentUser: UserAccount;
  users: UserAccount[];
  stores: StoreUnit[];
  messages: TeamMessage[];
  chatRooms: ChatRoom[];
  chatMessages: ChatMessage[];
  onSendMessage: (content: string, storeId?: string) => Promise<TeamMessage>;
  onCreateChatRoom: (input: {
    name: string;
    type: ChatRoomType;
    storeId?: string;
    deletionMode: ChatDeletionMode;
    savePolicy?: ChatSavePolicy;
    initialInviteQueries?: string[];
  }) => Promise<ChatRoom>;
  onJoinChatRoomByCode: (roomCode: string) => Promise<ChatRoom>;
  onInviteUserToChatRoomExact: (
    roomId: string,
    query: string
  ) => Promise<ChatRoom>;
  onToggleStoreRoomParticipant: (
    roomId: string,
    targetUserId: string,
    include: boolean
  ) => Promise<ChatRoom>;
  onSendChatMessage: (roomId: string, content: string) => Promise<ChatMessage>;
  onMarkChatMessagesRead: (
    roomId: string,
    messageIds: string[]
  ) => Promise<void>;
  onPanicDestroyChatRoom: (roomId: string) => Promise<void>;
  onCloseChatRoom: (roomId: string) => Promise<void>;
  onClose: () => void;
}

type ModalScreen = 'list' | 'create' | 'room';

export const MessagesModal: React.FC<MessagesModalProps> = ({
  isOpen,
  currentUser,
  users,
  stores,
  chatRooms,
  chatMessages,
  onCreateChatRoom,
  onJoinChatRoomByCode,
  onInviteUserToChatRoomExact,
  onToggleStoreRoomParticipant,
  onSendChatMessage,
  onMarkChatMessagesRead,
  onPanicDestroyChatRoom,
  onCloseChatRoom,
  onClose,
}) => {
  const [screen, setScreen] = useState<ModalScreen>('list');
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  // Entrar por código
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinBusy, setJoinBusy] = useState(false);

  // Criação de sala
  const [createType, setCreateType] = useState<ChatRoomType>('STORE');
  const [roomName, setRoomName] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [deletionMode, setDeletionMode] =
    useState<ChatDeletionMode>('POST_READ');
  const [savePolicy, setSavePolicy] =
    useState<ChatSavePolicy>('DELETE_ON_CLOSE');
  const [inviteQueryDraft, setInviteQueryDraft] = useState('');
  const [pendingInviteQueries, setPendingInviteQueries] = useState<string[]>(
    []
  );
  const [creating, setCreating] = useState(false);

  // Dentro da sala
  const [messageDraft, setMessageDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showParticipantsPanel, setShowParticipantsPanel] = useState(false);
  const [roomInviteQuery, setRoomInviteQuery] = useState('');
  const [invitingInRoom, setInvitingInRoom] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [confirmPanic, setConfirmPanic] = useState(false);
  const [destroyingRoom, setDestroyingRoom] = useState(false);

  // Controle local de mensagens POST_READ abertas nesta visualização (purgadas ao clicar ou ao sair da sala)
  const [revealedPostReadIds, setRevealedPostReadIds] = useState<string[]>([]);
  const revealedRef = useRef<{ roomId: string | null; ids: string[] }>({
    roomId: null,
    ids: [],
  });
  revealedRef.current = { roomId: activeRoomId, ids: revealedPostReadIds };

  const [error, setError] = useState<string | null>(null);

  const canSend = hasPermission(currentUser, 'canSendMessages');
  const canCreate = canCreateChatRoom(currentUser.role);
  const canSuperSecret = canCreateSuperSecretChat(currentUser.role);
  const canChooseSave = canChooseSaveChatHistory(currentUser.role);
  const maxRooms = getMaxChatRoomsForRole(currentUser.role);

  const manageableStores = useMemo(() => {
    if (ROLE_LEVEL[currentUser.role] <= 3) return stores;
    return stores.filter((s) => isUserLinkedToStore(currentUser.id, s));
  }, [currentUser, stores]);

  const myCreatedNormalRoomsCount = useMemo(
    () =>
      chatRooms.filter(
        (r) => !r.isSuperSecret && r.createdByUserId === currentUser.id
      ).length,
    [chatRooms, currentUser.id]
  );

  const reachedGerenteLimit =
    maxRooms !== null && myCreatedNormalRoomsCount >= maxRooms;

  const myRooms = useMemo(
    () => chatRooms.filter((r) => r.participantIds.includes(currentUser.id)),
    [chatRooms, currentUser.id]
  );

  const activeRoom = useMemo(
    () => myRooms.find((r) => r.id === activeRoomId) || null,
    [myRooms, activeRoomId]
  );

  const activeRoomMessages = useMemo(() => {
    if (!activeRoom) return [];
    return chatMessages.filter(
      (m) =>
        m.roomId === activeRoom.id &&
        !m.deletedForUserIds.includes(currentUser.id)
    );
  }, [chatMessages, activeRoom, currentUser.id]);

  // Se a sala ativa for destruída remotamente/pânico, retorna para a lista
  useEffect(() => {
    if (screen === 'room' && activeRoomId && !activeRoom) {
      setScreen('list');
      setActiveRoomId(null);
      setRevealedPostReadIds([]);
      setConfirmPanic(false);
    }
  }, [screen, activeRoomId, activeRoom]);

  // Em salas PANIC_BUTTON, marca mensagens visíveis como lidas para zerar o contador
  useEffect(() => {
    if (!isOpen || screen !== 'room' || !activeRoom) return;
    if (activeRoom.deletionMode !== 'PANIC_BUTTON') return;
    const unreadIds = activeRoomMessages
      .filter((m) => !m.readByUserIds.includes(currentUser.id))
      .map((m) => m.id);
    if (unreadIds.length > 0) {
      void onMarkChatMessagesRead(activeRoom.id, unreadIds);
    }
  }, [
    isOpen,
    screen,
    activeRoom,
    activeRoomMessages,
    currentUser.id,
    onMarkChatMessagesRead,
  ]);

  const flushRevealedPostRead = async () => {
    const { roomId, ids } = revealedRef.current;
    if (roomId && ids.length > 0) {
      setRevealedPostReadIds([]);
      await onMarkChatMessagesRead(roomId, ids);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      void flushRevealedPostRead();
      setScreen('list');
      setActiveRoomId(null);
      setError(null);
      setConfirmPanic(false);
      setShowParticipantsPanel(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCloseModal = () => {
    void flushRevealedPostRead();
    onClose();
  };

  const handleBackToList = () => {
    void flushRevealedPostRead();
    setScreen('list');
    setActiveRoomId(null);
    setError(null);
    setConfirmPanic(false);
    setShowParticipantsPanel(false);
  };

  const openCreateView = (presetType: ChatRoomType) => {
    setError(null);
    setCreateType(presetType);
    setRoomName('');
    setSelectedStoreId(manageableStores[0]?.id || '');
    setDeletionMode('POST_READ');
    setSavePolicy('DELETE_ON_CLOSE');
    setInviteQueryDraft('');
    setPendingInviteQueries([]);
    setScreen('create');
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setJoinBusy(true);
    try {
      const joined = await onJoinChatRoomByCode(joinCodeInput);
      setJoinCodeInput('');
      setActiveRoomId(joined.id);
      setScreen('room');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Código de sala inválido.'
      );
    } finally {
      setJoinBusy(false);
    }
  };

  const handleAddPendingInvite = () => {
    const clean = inviteQueryDraft.trim();
    if (!clean) return;
    if (
      pendingInviteQueries.some((q) => q.toLowerCase() === clean.toLowerCase())
    ) {
      setInviteQueryDraft('');
      return;
    }
    setPendingInviteQueries((prev) => [...prev, clean]);
    setInviteQueryDraft('');
  };

  const handleCreateRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const initialInvites =
        inviteQueryDraft.trim().length > 0
          ? [...pendingInviteQueries, inviteQueryDraft.trim()]
          : pendingInviteQueries;
      const created = await onCreateChatRoom({
        name: roomName,
        type: createType,
        storeId: createType === 'STORE' ? selectedStoreId : undefined,
        deletionMode,
        savePolicy:
          createType !== 'SUPER_SECRET' && canChooseSave
            ? savePolicy
            : 'DELETE_ON_CLOSE',
        initialInviteQueries:
          createType === 'STORE' ? undefined : initialInvites,
      });
      setActiveRoomId(created.id);
      setScreen('room');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível criar a sala.'
      );
    } finally {
      setCreating(false);
    }
  };

  const handleInviteInRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom || !roomInviteQuery.trim()) return;
    setError(null);
    setInvitingInRoom(true);
    try {
      await onInviteUserToChatRoomExact(activeRoom.id, roomInviteQuery);
      setRoomInviteQuery('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao convidar participante.'
      );
    } finally {
      setInvitingInRoom(false);
    }
  };

  const handleSendInRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom || !canSend) return;
    setError(null);
    setSending(true);
    try {
      await onSendChatMessage(activeRoom.id, messageDraft);
      setMessageDraft('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao enviar mensagem.'
      );
    } finally {
      setSending(false);
    }
  };

  const handleRevealPostReadMessage = (msgId: string) => {
    setRevealedPostReadIds((prev) =>
      prev.includes(msgId) ? prev : [...prev, msgId]
    );
  };

  const handleConsumeSingleMessageNow = async (msgId: string) => {
    if (!activeRoom) return;
    setRevealedPostReadIds((prev) => prev.filter((id) => id !== msgId));
    await onMarkChatMessagesRead(activeRoom.id, [msgId]);
  };

  const handleCopyRoomCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Fallback silencioso
    }
  };

  const handleExportHistoryCopy = () => {
    if (!activeRoom) return;
    const lines = activeRoomMessages.map((m) => {
      const dt = new Date(m.createdAt).toLocaleString('pt-BR');
      return `[${dt}] ${m.senderName} (${ROLE_LABELS[m.senderRole]}) [Sala #${activeRoom.roomCode}]: ${m.content}`;
    });
    const blob = new Blob(
      [
        lines.length > 0
          ? lines.join('\n')
          : `Sala #${activeRoom.roomCode} — sem mensagens visíveis.`,
      ],
      { type: 'text/plain;charset=utf-8' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `copia_${activeRoom.roomCode}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleConfirmPanicDestroy = async () => {
    if (!activeRoom) return;
    setDestroyingRoom(true);
    try {
      await onPanicDestroyChatRoom(activeRoom.id);
      setConfirmPanic(false);
      setActiveRoomId(null);
      setScreen('list');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao destruir conversa.'
      );
    } finally {
      setDestroyingRoom(false);
    }
  };

  const handleCloseRoomNormal = async () => {
    if (!activeRoom) return;
    setDestroyingRoom(true);
    try {
      await onCloseChatRoom(activeRoom.id);
      setActiveRoomId(null);
      setScreen('list');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao encerrar sala.');
    } finally {
      setDestroyingRoom(false);
    }
  };

  const isSecretTheme =
    (screen === 'create' && createType === 'SUPER_SECRET') ||
    (screen === 'room' && Boolean(activeRoom?.isSuperSecret));

  const activeRoomStore = activeRoom?.storeId
    ? stores.find((s) => s.id === activeRoom.storeId) || null
    : null;

  const activeStoreEmployees = activeRoomStore
    ? activeRoomStore.employeeIds
        .map((id) => users.find((u) => u.id === id && !u.isBlocked))
        .filter((u): u is UserAccount => Boolean(u))
    : [];

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-end md:items-center justify-center bg-slate-950/65 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="smart-chat-title"
      onClick={handleCloseModal}
    >
      <div
        className={`w-full md:max-w-xl rounded-t-3xl md:rounded-2xl shadow-2xl border h-[90vh] md:h-auto md:max-h-[88vh] flex flex-col overflow-hidden ${
          isSecretTheme
            ? 'bg-slate-950 border-amber-500/40 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="md:hidden pt-3 pb-1 flex justify-center shrink-0">
          <div
            className={`w-10 h-1.5 rounded-full ${
              isSecretTheme ? 'bg-slate-700' : 'bg-slate-300'
            }`}
          />
        </div>

        {/* Cabeçalho do Modal */}
        <div
          className={`px-4 sm:px-5 py-3.5 border-b flex items-center justify-between gap-2 shrink-0 ${
            isSecretTheme
              ? 'border-amber-500/30 bg-slate-900'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {screen !== 'list' ? (
              <button
                type="button"
                onClick={handleBackToList}
                aria-label="Voltar para salas"
                className={`min-h-[44px] min-w-[44px] -ml-1.5 rounded-xl flex items-center justify-center shrink-0 ${
                  isSecretTheme
                    ? 'text-amber-300 hover:bg-slate-800'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5" />
              </div>
            )}

            <div className="min-w-0">
              <h2
                id="smart-chat-title"
                className={`text-base font-extrabold truncate ${
                  isSecretTheme ? 'text-amber-300' : 'text-slate-900'
                }`}
              >
                {screen === 'list'
                  ? 'Salas de Chat Inteligentes'
                  : screen === 'create'
                  ? createType === 'SUPER_SECRET'
                    ? '🔒 Chat Super Secreto / Confidencial'
                    : 'Criar Nova Sala de Chat'
                  : activeRoom?.name || 'Sala de Chat'}
              </h2>
              <p
                className={`text-xs truncate ${
                  isSecretTheme ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {screen === 'list'
                  ? 'Autodestrutivo pós-leitura, botão de pânico e entrada por código'
                  : screen === 'create'
                  ? createType === 'SUPER_SECRET'
                    ? 'Exclusivo Presidente · Zero gravação e zero auditoria'
                    : 'Configure tipo de sala e modo de exclusão'
                  : activeRoom
                  ? `${activeRoom.roomCode} · ${
                      activeRoom.deletionMode === 'POST_READ'
                        ? 'Autodestrutiva pós-leitura'
                        : 'Botão de Pânico'
                    }`
                  : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {screen === 'room' && activeRoom && (
              <button
                type="button"
                onClick={() => void handleCopyRoomCode(activeRoom.roomCode)}
                title="Copiar Código da Sala"
                className={`min-h-[44px] px-2.5 rounded-xl text-xs font-mono-tabular font-bold flex items-center gap-1.5 border ${
                  isSecretTheme
                    ? 'border-amber-500/40 bg-slate-800 text-amber-200 hover:bg-slate-700'
                    : 'border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100'
                }`}
              >
                {copiedCode ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedCode ? 'Copiado' : activeRoom.roomCode}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCloseModal}
              aria-label="Fechar chat"
              className={`min-h-[44px] min-w-[44px] -mr-1.5 flex items-center justify-center rounded-xl ${
                isSecretTheme
                  ? 'text-slate-300 hover:bg-slate-800'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mensagem de erro global */}
        {error && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-start gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* TELA 1: LISTA DE SALAS + ENTRAR POR CÓDIGO */}
        {screen === 'list' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {/* Entrar em sala por código */}
            <form
              onSubmit={handleJoinByCode}
              className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-2"
            >
              <label className="block text-xs font-extrabold text-slate-800">
                Entrar em sala por código único
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value)}
                    placeholder="Ex: SALA-4821"
                    className="w-full min-h-[44px] pl-9 pr-3 rounded-xl border border-slate-300 text-sm font-mono-tabular uppercase text-slate-900 placeholder:normal-case placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={joinBusy || !joinCodeInput.trim()}
                  className="min-h-[44px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-extrabold whitespace-nowrap"
                >
                  {joinBusy ? 'Entrando...' : 'Entrar'}
                </button>
              </div>
            </form>

            {/* Botões de criação (Gerente+ e Presidente Super Secreto) */}
            {(canCreate || canSuperSecret) && (
              <div className="space-y-2">
                {canCreate && (
                  <button
                    type="button"
                    disabled={reachedGerenteLimit}
                    onClick={() => openCreateView('STORE')}
                    className="w-full min-h-[48px] px-4 rounded-2xl bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:text-slate-600 text-white text-sm font-extrabold flex items-center justify-between gap-2 shadow-xs"
                  >
                    <span className="flex items-center gap-2">
                      <Plus className="w-4 h-4 shrink-0" />
                      <span>Criar Nova Sala de Chat</span>
                    </span>
                    {maxRooms !== null && (
                      <span className="text-xs font-mono-tabular opacity-90">
                        {myCreatedNormalRoomsCount}/{maxRooms} usadas
                      </span>
                    )}
                  </button>
                )}

                {reachedGerenteLimit && (
                  <p className="text-[11px] font-bold text-amber-800 px-1">
                    Limite máximo de 3 salas atingido para Gerente. Destrua ou
                    encerre uma sala para abrir outra.
                  </p>
                )}

                {canSuperSecret && (
                  <button
                    type="button"
                    onClick={() => openCreateView('SUPER_SECRET')}
                    className="w-full min-h-[48px] px-4 rounded-2xl bg-slate-950 hover:bg-slate-900 border border-amber-400/60 text-amber-300 text-sm font-extrabold flex items-center justify-between gap-2 shadow-md"
                  >
                    <span className="flex items-center gap-2">
                      <Lock className="w-4 h-4 shrink-0" />
                      <span>Chat Super Secreto / Confidencial</span>
                    </span>
                    <span className="text-[11px] font-mono-tabular text-amber-200/80">
                      Memória · Zero Log
                    </span>
                  </button>
                )}
              </div>
            )}

            {/* Lista de Salas Ativas */}
            <div className="space-y-2.5">
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500 px-1">
                Suas Salas Ativas ({myRooms.length})
              </div>

              {myRooms.length === 0 ? (
                <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center space-y-1">
                  <p className="text-sm font-bold text-slate-800">
                    Nenhuma sala ativa no momento
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {canCreate
                      ? 'Crie uma nova sala ou entre informando um Código Único acima.'
                      : 'Peça ao seu Gerente para incluí-lo no Chat da Loja ou digite o Código Único da sala acima.'}
                  </p>
                </div>
              ) : (
                myRooms.map((room) => {
                  const roomMsgs = chatMessages.filter(
                    (m) =>
                      m.roomId === room.id &&
                      !m.deletedForUserIds.includes(currentUser.id)
                  );
                  const unreadCount = roomMsgs.filter(
                    (m) =>
                      m.senderId !== currentUser.id &&
                      !m.readByUserIds.includes(currentUser.id)
                  ).length;
                  const typeText = room.isSuperSecret
                    ? 'Super Secreto (Memória)'
                    : room.type === 'STORE'
                    ? `Chat da Loja · ${room.storeCode || ''}`
                    : 'Chat de Gestão';

                  return (
                    <div
                      key={room.id}
                      className={`p-3.5 rounded-2xl border transition-colors ${
                        room.isSuperSecret
                          ? 'bg-slate-950 border-amber-500/50 text-white'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setActiveRoomId(room.id);
                            setScreen('room');
                          }}
                          className="flex-1 min-w-0 text-left min-h-[44px]"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-extrabold truncate ${
                                room.isSuperSecret
                                  ? 'text-amber-300'
                                  : 'text-slate-900'
                              }`}
                            >
                              {room.isSuperSecret ? '🔒 ' : ''}
                              {room.name}
                            </span>
                            {unreadCount > 0 && (
                              <span className="min-w-[20px] h-[20px] px-1.5 rounded-full bg-red-600 text-white text-[11px] font-mono-tabular font-extrabold flex items-center justify-center shrink-0">
                                {unreadCount}
                              </span>
                            )}
                          </div>
                          <div
                            className={`text-xs mt-1 font-mono-tabular ${
                              room.isSuperSecret
                                ? 'text-slate-400'
                                : 'text-slate-500'
                            }`}
                          >
                            {room.roomCode} · {typeText} ·{' '}
                            {room.participantIds.length} part.
                          </div>
                          <div
                            className={`text-[11px] mt-0.5 ${
                              room.isSuperSecret
                                ? 'text-amber-200/80'
                                : 'text-slate-600'
                            }`}
                          >
                            {room.deletionMode === 'POST_READ'
                              ? 'Apaga após leitura individual'
                              : 'Exclusão via Botão de Pânico'}
                            {room.savePolicy === 'SAVE_HISTORY'
                              ? ' · Histórico salvo pelo criador'
                              : ''}
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleCopyRoomCode(room.roomCode)}
                          aria-label={`Copiar código ${room.roomCode}`}
                          title="Copiar código da sala"
                          className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center shrink-0 border ${
                            room.isSuperSecret
                              ? 'border-slate-700 text-amber-200 hover:bg-slate-800'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TELA 2: CRIAÇÃO DE SALA */}
        {screen === 'create' && (
          <form
            onSubmit={handleCreateRoomSubmit}
            className={`flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 ${
              isSecretTheme ? 'bg-slate-950' : 'bg-slate-50'
            }`}
          >
            {createType !== 'SUPER_SECRET' && (
              <div className="space-y-1.5">
                <span className="block text-xs font-extrabold text-slate-700">
                  Tipo de Sala
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateType('STORE')}
                    className={`min-h-[46px] px-3 rounded-xl border text-xs font-extrabold transition-colors ${
                      createType === 'STORE'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    Chat da Loja
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateType('MANAGEMENT')}
                    className={`min-h-[46px] px-3 rounded-xl border text-xs font-extrabold transition-colors ${
                      createType === 'MANAGEMENT'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    Chat de Gestão
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label
                className={`block text-xs font-extrabold ${
                  isSecretTheme ? 'text-amber-200' : 'text-slate-700'
                }`}
              >
                Nome da Sala
              </label>
              <input
                type="text"
                maxLength={60}
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder={
                  createType === 'SUPER_SECRET'
                    ? 'Ex: Alinhamento Presidência'
                    : createType === 'STORE'
                    ? 'Ex: Turno Loja Butantã'
                    : 'Ex: Coordenação Regional'
                }
                className={`w-full min-h-[46px] px-3.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${
                  isSecretTheme
                    ? 'bg-slate-900 border-amber-500/40 text-white placeholder:text-slate-500 focus:ring-amber-400'
                    : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:ring-blue-600'
                }`}
              />
            </div>

            {createType === 'STORE' ? (
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-slate-700">
                  Loja Vinculada (adiciona todos os funcionários ativos)
                </label>
                {manageableStores.length === 0 ? (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900">
                    Nenhuma loja vinculada disponível. Use Chat de Gestão.
                  </div>
                ) : (
                  <select
                    value={selectedStoreId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
                    className="w-full min-h-[46px] px-3 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-900"
                  >
                    {manageableStores.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.storeCode} · {st.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label
                  className={`block text-xs font-extrabold ${
                    isSecretTheme ? 'text-amber-200' : 'text-slate-700'
                  }`}
                >
                  Convidar por Nome Exato ou ID Único (sem lista pública)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inviteQueryDraft}
                    onChange={(e) => setInviteQueryDraft(e.target.value)}
                    placeholder="Ex: USR-0020 ou Nome completo exato"
                    className={`flex-1 min-h-[44px] px-3.5 rounded-xl border text-xs focus:outline-none focus:ring-2 ${
                      isSecretTheme
                        ? 'bg-slate-900 border-amber-500/40 text-white placeholder:text-slate-500 focus:ring-amber-400'
                        : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:ring-blue-600'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleAddPendingInvite}
                    className={`min-h-[44px] px-3.5 rounded-xl text-xs font-extrabold ${
                      isSecretTheme
                        ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    + Incluir
                  </button>
                </div>

                {currentUser.role === 'GERENTE' && (
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Gerentes não podem convidar o Presidente diretamente. Após
                    criar a sala, envie o Código Único da sala para o
                    Presidente entrar.
                  </p>
                )}

                {pendingInviteQueries.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {pendingInviteQueries.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() =>
                          setPendingInviteQueries((prev) =>
                            prev.filter((item) => item !== q)
                          )
                        }
                        className={`min-h-[32px] px-2.5 rounded-lg text-xs font-mono-tabular font-bold flex items-center gap-1.5 border ${
                          isSecretTheme
                            ? 'bg-slate-900 border-amber-500/40 text-amber-200'
                            : 'bg-white border-slate-300 text-slate-800'
                        }`}
                      >
                        <span>{q}</span>
                        <X className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Modo de Exclusão */}
            <div className="space-y-1.5">
              <span
                className={`block text-xs font-extrabold ${
                  isSecretTheme ? 'text-amber-200' : 'text-slate-700'
                }`}
              >
                Modo de Exclusão das Mensagens
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDeletionMode('POST_READ')}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    deletionMode === 'POST_READ'
                      ? isSecretTheme
                        ? 'bg-amber-500/20 border-amber-400 text-white'
                        : 'bg-blue-50 border-blue-600 text-slate-900'
                      : isSecretTheme
                      ? 'bg-slate-900 border-slate-800 text-slate-300'
                      : 'bg-white border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="text-xs font-extrabold">
                    Exclusão Pós-Leitura
                  </div>
                  <div className="text-[11px] opacity-80 mt-0.5 leading-snug">
                    Apaga imediatamente para quem lê; some para todos após o
                    último ler.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDeletionMode('PANIC_BUTTON')}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    deletionMode === 'PANIC_BUTTON'
                      ? isSecretTheme
                        ? 'bg-amber-500/20 border-amber-400 text-white'
                        : 'bg-red-50 border-red-600 text-slate-900'
                      : isSecretTheme
                      ? 'bg-slate-900 border-slate-800 text-slate-300'
                      : 'bg-white border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="text-xs font-extrabold">
                    Botão de Pânico na Sala
                  </div>
                  <div className="text-[11px] opacity-80 mt-0.5 leading-snug">
                    Conversa visível até acionar &quot;Destruir Chat
                    Agora&quot;.
                  </div>
                </button>
              </div>
            </div>

            {/* Opção de Salvar Histórico (Governador / Presidente / Super Admin em salas normais) */}
            {createType !== 'SUPER_SECRET' && canChooseSave && (
              <div className="space-y-1.5">
                <span className="block text-xs font-extrabold text-slate-700">
                  Política de Histórico (Governador / Presidente)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSavePolicy('DELETE_ON_CLOSE')}
                    className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-bold text-left ${
                      savePolicy === 'DELETE_ON_CLOSE'
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-white border-slate-300 text-slate-700'
                    }`}
                  >
                    Excluir tudo ao encerrar
                  </button>
                  <button
                    type="button"
                    onClick={() => setSavePolicy('SAVE_HISTORY')}
                    className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-bold text-left ${
                      savePolicy === 'SAVE_HISTORY'
                        ? 'bg-blue-700 border-blue-700 text-white'
                        : 'bg-white border-slate-300 text-slate-700'
                    }`}
                  >
                    Salvar histórico desta conversa
                  </button>
                </div>
              </div>
            )}

            {createType === 'SUPER_SECRET' && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-400/40 text-amber-200 text-xs leading-relaxed">
                <strong className="block font-extrabold mb-0.5">
                  Garantia Zero Persistência:
                </strong>
                Esta sala existe apenas na memória desta sessão. Nunca grava no
                navegador, nunca sobe para nuvem e nunca gera arquivo .TXT na
                auditoria do Super Admin.
              </div>
            )}

            <button
              type="submit"
              disabled={
                creating ||
                (createType === 'STORE' && manageableStores.length === 0)
              }
              className={`w-full min-h-[48px] px-4 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 ${
                isSecretTheme
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                  : 'bg-blue-700 hover:bg-blue-800 text-white'
              } disabled:opacity-50`}
            >
              <span>
                {creating
                  ? 'Abrindo sala...'
                  : createType === 'SUPER_SECRET'
                  ? 'Abrir Chat Super Secreto Agora'
                  : 'Criar Sala e Gerar Código'}
              </span>
            </button>
          </form>
        )}

        {/* TELA 3: DENTRO DA SALA DE CHAT */}
        {screen === 'room' && activeRoom && (
          <>
            {/* Banner discreto caso a conversa esteja sendo salva pelo criador */}
            {activeRoom.savePolicy === 'SAVE_HISTORY' &&
              !activeRoom.isSuperSecret && (
                <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs font-bold flex items-center justify-between gap-2 shrink-0">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <Info className="w-4 h-4 text-amber-700 shrink-0" />
                    <span className="truncate">
                      Esta conversa está sendo salva pelo criador
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={handleExportHistoryCopy}
                    className="min-h-[32px] px-2.5 rounded-lg bg-white border border-amber-300 text-amber-900 text-[11px] font-extrabold flex items-center gap-1 shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar cópia</span>
                  </button>
                </div>
              )}

            {/* Banner exclusivo do Chat Super Secreto */}
            {activeRoom.isSuperSecret && (
              <div className="px-4 py-2 bg-amber-500/15 border-b border-amber-500/30 text-amber-200 text-xs font-bold flex items-center gap-2 shrink-0">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Modo Super Secreto · Apenas em memória (zero histórico e zero
                  .TXT)
                </span>
              </div>
            )}

            {/* Barra de Participantes + Botão de Pânico da Sala */}
            <div
              className={`px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 shrink-0 ${
                isSecretTheme
                  ? 'bg-slate-900/70 border-slate-800'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <button
                type="button"
                onClick={() => setShowParticipantsPanel((p) => !p)}
                className={`min-h-[38px] px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
                  isSecretTheme
                    ? 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                    : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>
                  Participantes ({activeRoom.participantIds.length})
                </span>
              </button>

              <div className="flex items-center gap-2">
                {(activeRoom.createdByUserId === currentUser.id ||
                  ROLE_LEVEL[currentUser.role] <= 3) && (
                  <button
                    type="button"
                    disabled={destroyingRoom}
                    onClick={() => void handleCloseRoomNormal()}
                    className={`min-h-[38px] px-3 rounded-xl border text-xs font-bold ${
                      isSecretTheme
                        ? 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Encerrar sala
                  </button>
                )}

                {canPanicDestroyChat(currentUser, activeRoom.createdByUserId) &&
                  (!confirmPanic ? (
                    <button
                      type="button"
                      onClick={() => setConfirmPanic(true)}
                      className="min-h-[38px] px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs"
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>Destruir Chat Agora</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={destroyingRoom}
                        onClick={() => void handleConfirmPanicDestroy()}
                        className="min-h-[38px] px-3 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-extrabold"
                      >
                        {destroyingRoom ? 'Destruindo...' : 'Confirmar Pânico'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmPanic(false)}
                        className="min-h-[38px] px-2.5 rounded-xl bg-slate-200 text-slate-800 text-xs font-bold"
                      >
                        Cancelar
                      </button>
                    </div>
                  ))}
              </div>
            </div>

            {/* Painel expansível de participantes / convite exato / remoção na loja */}
            {showParticipantsPanel && (
              <div
                className={`px-4 py-3 border-b space-y-3 shrink-0 max-h-56 overflow-y-auto ${
                  isSecretTheme
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                {activeRoom.type === 'STORE' &&
                ROLE_LEVEL[currentUser.role] <= 4 ? (
                  <div className="space-y-2">
                    <div className="text-xs font-extrabold text-slate-700">
                      Equipe da Loja (clique para remover ou readicionar)
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeStoreEmployees.map((emp) => {
                        const isIncluded = activeRoom.participantIds.includes(
                          emp.id
                        );
                        return (
                          <button
                            key={emp.id}
                            type="button"
                            onClick={() =>
                              void onToggleStoreRoomParticipant(
                                activeRoom.id,
                                emp.id,
                                !isIncluded
                              )
                            }
                            className={`min-h-[36px] px-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
                              isIncluded
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                                : 'bg-slate-100 border-slate-300 text-slate-500 line-through'
                            }`}
                          >
                            {isIncluded ? (
                              <UserMinus className="w-3.5 h-3.5 text-emerald-700" />
                            ) : (
                              <UserPlus className="w-3.5 h-3.5 text-slate-600" />
                            )}
                            <span>{emp.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div
                      className={`text-xs font-bold ${
                        isSecretTheme ? 'text-amber-200' : 'text-slate-700'
                      }`}
                    >
                      Participantes atuais:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeRoom.participantIds.map((pid) => {
                        const u = users.find((usr) => usr.id === pid);
                        return (
                          <span
                            key={pid}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                              isSecretTheme
                                ? 'bg-slate-800 text-slate-200'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {u ? `${u.name} (${ROLE_LABELS[u.role]})` : pid}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Convite por Nome exato ou ID único para gestores */}
                {(activeRoom.createdByUserId === currentUser.id ||
                  ROLE_LEVEL[currentUser.role] <= 4) && (
                  <form
                    onSubmit={handleInviteInRoom}
                    className="flex items-center gap-2 pt-1"
                  >
                    <input
                      type="text"
                      value={roomInviteQuery}
                      onChange={(e) => setRoomInviteQuery(e.target.value)}
                      placeholder="Convidar por Nome exato ou ID (ex: USR-0020)"
                      className={`flex-1 min-h-[40px] px-3 rounded-xl border text-xs ${
                        isSecretTheme
                          ? 'bg-slate-950 border-slate-700 text-white placeholder:text-slate-500'
                          : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                      }`}
                    />
                    <button
                      type="submit"
                      disabled={invitingInRoom || !roomInviteQuery.trim()}
                      className={`min-h-[40px] px-3 rounded-xl text-xs font-extrabold ${
                        isSecretTheme
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-900 text-white'
                      } disabled:opacity-50`}
                    >
                      {invitingInRoom ? '...' : 'Convidar'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Feed de Mensagens */}
            <div
              className={`flex-1 overflow-y-auto p-4 space-y-3 ${
                isSecretTheme ? 'bg-slate-950' : 'bg-slate-50'
              }`}
            >
              {activeRoomMessages.length === 0 ? (
                <div
                  className={`py-12 text-center text-xs space-y-1 ${
                    isSecretTheme ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  <p className="font-bold text-sm">Nenhuma mensagem visível.</p>
                  <p>
                    {activeRoom.deletionMode === 'POST_READ'
                      ? 'Mensagens são apagadas automaticamente após cada leitura individual.'
                      : 'Escreva abaixo para iniciar a conversa da sala.'}
                  </p>
                </div>
              ) : (
                activeRoomMessages.map((msg) => {
                  const isMine = msg.senderId === currentUser.id;
                  const isPostRead = activeRoom.deletionMode === 'POST_READ';
                  const isAlreadyReadByMe = msg.readByUserIds.includes(
                    currentUser.id
                  );
                  const isRevealed = revealedPostReadIds.includes(msg.id);

                  // Em modo POST_READ, mensagens não lidas de terceiros exigem toque para abrir e depois autodestroem para o leitor
                  if (isPostRead && !isMine && !isAlreadyReadByMe && !isRevealed) {
                    return (
                      <button
                        key={msg.id}
                        type="button"
                        onClick={() => handleRevealPostReadMessage(msg.id)}
                        className={`w-full min-h-[56px] p-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-colors ${
                          isSecretTheme
                            ? 'bg-slate-900 border-amber-500/50 hover:bg-slate-800 text-amber-200'
                            : 'bg-blue-50 border-blue-300 hover:bg-blue-100 text-blue-950'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Lock className="w-4 h-4 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold truncate">
                              Mensagem protegida de {msg.senderName}
                            </div>
                            <div className="text-[11px] opacity-80 font-mono-tabular">
                              {ROLE_LABELS[msg.senderRole]} ·{' '}
                              {formatRelativeDateTime(msg.createdAt)}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-extrabold flex items-center gap-1 shrink-0">
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ler</span>
                        </span>
                      </button>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`p-3.5 rounded-2xl border ${
                        isSecretTheme
                          ? isMine
                            ? 'bg-amber-500/15 border-amber-400/40 ml-6'
                            : 'bg-slate-900 border-slate-800 mr-6'
                          : isMine
                          ? 'bg-blue-50/80 border-blue-200 ml-6'
                          : 'bg-white border-slate-200 mr-6'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span
                          className={`font-extrabold truncate ${
                            isSecretTheme ? 'text-amber-300' : 'text-slate-900'
                          }`}
                        >
                          {msg.senderName} · {ROLE_LABELS[msg.senderRole]}
                        </span>
                        <span
                          className={`text-[11px] font-mono-tabular shrink-0 ${
                            isSecretTheme ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          {formatRelativeDateTime(msg.createdAt)}
                        </span>
                      </div>

                      <p
                        className={`text-sm mt-1.5 leading-relaxed whitespace-pre-wrap break-words ${
                          isSecretTheme ? 'text-slate-100' : 'text-slate-800'
                        }`}
                      >
                        {msg.content}
                      </p>

                      {isPostRead && (
                        <div className="mt-2 pt-2 border-t border-slate-200/40 flex items-center justify-between gap-2">
                          <span
                            className={`text-[11px] font-mono-tabular ${
                              isSecretTheme
                                ? 'text-slate-400'
                                : 'text-slate-500'
                            }`}
                          >
                            Lida por {msg.readByUserIds.length}/
                            {activeRoom.participantIds.length}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              void handleConsumeSingleMessageNow(msg.id)
                            }
                            className={`min-h-[34px] px-2.5 rounded-lg text-[11px] font-extrabold flex items-center gap-1 ${
                              isSecretTheme
                                ? 'bg-amber-500/20 text-amber-200 hover:bg-amber-500/30'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Confirmar leitura (Apagar p/ mim)</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Campo de Envio */}
            <div
              className={`p-4 border-t shrink-0 ${
                isSecretTheme
                  ? 'bg-slate-900 border-amber-500/30'
                  : 'bg-white border-slate-200'
              }`}
            >
              {!canSend ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    Sua conta está em modo somente leitura (sem permissão
                    &quot;Enviar mensagens&quot;).
                  </span>
                </div>
              ) : (
                <form
                  onSubmit={handleSendInRoom}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    maxLength={800}
                    value={messageDraft}
                    onChange={(e) => setMessageDraft(e.target.value)}
                    placeholder={
                      activeRoom.isSuperSecret
                        ? 'Mensagem confidencial (apenas memória)...'
                        : 'Digite uma mensagem na sala...'
                    }
                    className={`flex-1 min-h-[48px] px-3.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${
                      isSecretTheme
                        ? 'bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 focus:ring-amber-400'
                        : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:ring-blue-600'
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={sending || !messageDraft.trim()}
                    aria-label="Enviar mensagem"
                    className={`min-h-[48px] px-4 rounded-xl text-sm font-extrabold flex items-center gap-1.5 shrink-0 disabled:opacity-50 ${
                      isSecretTheme
                        ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                        : 'bg-blue-700 hover:bg-blue-800 text-white'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                    <span>Enviar</span>
                  </button>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
