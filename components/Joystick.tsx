import React, { useState, useEffect } from 'react';

interface JoystickProps {
  onMove: (vector: { x: number; y: number }) => void;
  side: 'left' | 'right';
  maxRadius?: number;
}

export const Joystick: React.FC<JoystickProps> = ({ onMove, side, maxRadius = 60 }) => {
  const [touchId, setTouchId] = useState<number | null>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 }); // Screen coordinates where touch started
  const [position, setPosition] = useState({ x: 0, y: 0 }); // Offset from origin (the stick movement)

  // --- Handlers ---

  const handleStart = (clientX: number, clientY: number, id: number | null) => {
    setTouchId(id);
    setOrigin({ x: clientX, y: clientY });
    setPosition({ x: 0, y: 0 });
    onMove({ x: 0, y: 0 });
  };

  const handleMove = (clientX: number, clientY: number) => {
    const dx = clientX - origin.x;
    const dy = clientY - origin.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Clamp movement to maxRadius
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    
    const cx = Math.cos(angle) * clampedDist;
    const cy = Math.sin(angle) * clampedDist;
    
    setPosition({ x: cx, y: cy });
    
    // Normalize output -1 to 1
    onMove({ x: cx / maxRadius, y: cy / maxRadius });
  };

  const handleEnd = () => {
    setTouchId(null);
    setPosition({ x: 0, y: 0 });
    onMove({ x: 0, y: 0 });
  };

  // --- Touch Events ---

  const onTouchStart = (e: React.TouchEvent) => {
    if (touchId !== null) return; // Already active
    
    // Use changedTouches to find the new touch
    const touch = e.changedTouches[0] as React.Touch;
    if (touch) {
      handleStart(touch.clientX, touch.clientY, touch.identifier);
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchId === null) return;
    const touch = (Array.from(e.changedTouches) as React.Touch[]).find(t => t.identifier === touchId);
    if (touch) {
      handleMove(touch.clientX, touch.clientY);
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchId === null) return;
    const touch = (Array.from(e.changedTouches) as React.Touch[]).find(t => t.identifier === touchId);
    if (touch) {
      handleEnd();
    }
  };

  // --- Mouse Events (Desktop Debugging) ---

  const onMouseDown = (e: React.MouseEvent) => {
    handleStart(e.clientX, e.clientY, 999); // Arbitrary ID for mouse
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (touchId === 999) handleMove(e.clientX, e.clientY);
    };
    const onMouseUp = () => {
      if (touchId === 999) handleEnd();
    };

    if (touchId === 999) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [touchId, origin]);

  return (
    <>
      {/* Invisible Interactive Zone */}
      <div 
        className="absolute top-0 bottom-0 z-40 touch-none select-none"
        style={{
          left: side === 'left' ? 0 : '50%',
          width: '50%',
          // pointerEvents: 'auto' is implicit for divs, but good to be aware 
          // that this will block clicks on elements *behind* it (like the 3D canvas),
          // but NOT elements *inside* the same parent with higher z-index (like buttons).
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
      />

      {/* Visual Representation (Only visible when active) */}
      {touchId !== null && (
        <div 
          className="fixed z-50 pointer-events-none"
          style={{
            left: origin.x,
            top: origin.y,
            transform: 'translate(-50%, -50%)',
            width: maxRadius * 2,
            height: maxRadius * 2,
          }}
        >
          {/* Base */}
          <div className="w-full h-full rounded-full bg-black/40 border border-white/20 backdrop-blur-sm relative flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.1)]">
            <div className="absolute inset-0 rounded-full border border-white/5 opacity-50 scale-75"></div>
            
            {/* Stick */}
            <div 
              className="w-12 h-12 rounded-full bg-black/80 border-2 border-yellow-400 absolute flex items-center justify-center transition-transform duration-75"
              style={{ 
                transform: `translate(${position.x}px, ${position.y}px)`,
                boxShadow: '0 0 15px rgba(251, 255, 0, 0.5)'
              }}
            >
              <div className="w-2 h-2 bg-yellow-400 rounded-full shadow-[0_0_5px_#FBFF00]" />
            </div>
          </div>
        </div>
      )}
    </>
  );
};