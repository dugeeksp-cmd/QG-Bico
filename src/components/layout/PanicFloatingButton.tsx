import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';

interface PanicFloatingButtonProps {
  onDestroySession: () => void;
}

const BUTTON_SIZE = 48;
const MARGIN = 12;

export const PanicFloatingButton: React.FC<PanicFloatingButtonProps> = ({
  onDestroySession,
}) => {
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: 24, y: 120 };
    return {
      x: Math.max(MARGIN, window.innerWidth - BUTTON_SIZE - 14),
      y: Math.max(72, window.innerHeight - 156),
    };
  });

  const onDestroySessionRef = useRef(onDestroySession);
  onDestroySessionRef.current = onDestroySession;

  const draggingRef = useRef<{
    active: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  }>({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
    moved: false,
  });

  const executeInstantExit = useCallback(() => {
    onDestroySessionRef.current();
    try {
      window.location.replace('https://www.google.com');
    } catch {
      window.location.href = 'https://www.google.com';
    }
  }, []);

  // Mantém a bolinha sempre dentro da viewport ao redimensionar a janela
  useEffect(() => {
    const clampToViewport = () => {
      setPos((prev) => ({
        x: Math.min(
          Math.max(MARGIN, prev.x),
          Math.max(MARGIN, window.innerWidth - BUTTON_SIZE - MARGIN)
        ),
        y: Math.min(
          Math.max(64, prev.y),
          Math.max(64, window.innerHeight - BUTTON_SIZE - 76)
        ),
      }));
    };
    window.addEventListener('resize', clampToViewport);
    return () => window.removeEventListener('resize', clampToViewport);
  }, []);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const drag = draggingRef.current;
      if (!drag.active || drag.pointerId !== e.pointerId) return;

      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (Math.hypot(dx, dy) > 5) {
        drag.moved = true;
      }

      const maxX = Math.max(MARGIN, window.innerWidth - BUTTON_SIZE - MARGIN);
      const maxY = Math.max(64, window.innerHeight - BUTTON_SIZE - 16);
      setPos({
        x: Math.min(Math.max(MARGIN, drag.origX + dx), maxX),
        y: Math.min(Math.max(64, drag.origY + dy), maxY),
      });
    };

    const handlePointerUp = (e: PointerEvent) => {
      const drag = draggingRef.current;
      if (!drag.active || drag.pointerId !== e.pointerId) return;
      const wasClick = !drag.moved;
      drag.active = false;
      drag.pointerId = null;
      if (wasClick) {
        executeInstantExit();
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [executeInstantExit]);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    draggingRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
      moved: false,
    };
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      executeInstantExit();
    }
  };

  return (
    <div
      className="fixed z-[1150]"
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
      }}
    >
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
        aria-label="Saída rápida imediata (arraste para mover, 1 toque para sair)"
        title="Arraste para mover · 1 toque limpa sessão e sai imediatamente"
        className="w-12 h-12 rounded-full bg-slate-900 hover:bg-red-700 active:scale-95 text-white border-2 border-slate-700 shadow-xl flex items-center justify-center touch-none cursor-grab active:cursor-grabbing select-none transition-all"
      >
        <Lock className="w-5 h-5 text-amber-300 pointer-events-none" />
      </button>
    </div>
  );
};
