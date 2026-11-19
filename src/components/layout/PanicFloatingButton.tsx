import React, { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';

interface PanicFloatingButtonProps {
  onRequestExit: () => void;
}

const BUTTON_SIZE = 48;
const MARGIN = 12;
const DRAG_THRESHOLD_PX = 12;

export const PanicFloatingButton: React.FC<PanicFloatingButtonProps> = ({
  onRequestExit,
}) => {
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: 24, y: 120 };
    return {
      x: Math.max(MARGIN, window.innerWidth - BUTTON_SIZE - 14),
      y: Math.max(72, window.innerHeight - 156),
    };
  });

  const onRequestExitRef = useRef(onRequestExit);
  onRequestExitRef.current = onRequestExit;

  const suppressNextClickRef = useRef(false);
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

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    suppressNextClickRef.current = false;
    draggingRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
      moved: false,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignora caso pointer capture não seja suportado
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = draggingRef.current;
    if (!drag.active || drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
      drag.moved = true;
    }
    if (!drag.moved) return;

    const maxX = Math.max(MARGIN, window.innerWidth - BUTTON_SIZE - MARGIN);
    const maxY = Math.max(64, window.innerHeight - BUTTON_SIZE - 16);
    setPos({
      x: Math.min(Math.max(MARGIN, drag.origX + dx), maxX),
      y: Math.min(Math.max(64, drag.origY + dy), maxY),
    });
  };

  const finishPointerDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = draggingRef.current;
    if (!drag.active || drag.pointerId !== e.pointerId) return;
    if (drag.moved) {
      suppressNextClickRef.current = true;
      window.setTimeout(() => {
        suppressNextClickRef.current = false;
      }, 120);
    }
    drag.active = false;
    drag.pointerId = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignora caso já tenha sido liberado
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    onRequestExitRef.current();
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
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerDrag}
        onPointerCancel={finishPointerDrag}
        onClick={handleClick}
        aria-label="Sair do sistema com confirmação (arraste para mover)"
        title="Arraste para mover · Toque para encerrar sessão (com confirmação)"
        className="w-12 h-12 rounded-full bg-slate-900 hover:bg-red-700 active:scale-95 text-white border-2 border-slate-700 shadow-xl flex items-center justify-center touch-none cursor-grab active:cursor-grabbing select-none transition-all"
      >
        <Lock className="w-5 h-5 text-amber-300 pointer-events-none" />
      </button>
    </div>
  );
};
