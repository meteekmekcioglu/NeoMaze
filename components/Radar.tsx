import React, { useEffect, useState, useRef } from 'react';
import { Obstacle, PowerUp, Position, ObstacleType } from '../types';
import { COLORS } from '../constants';

interface RadarProps {
  playerPos: Position;
  playerRotation: number;
  obstacles: Obstacle[];
  powerUps: PowerUp[];
  radius?: number; // Visual radius in px
  range?: number; // Game units range
}

export const Radar: React.FC<RadarProps> = ({
  playerPos,
  playerRotation,
  obstacles,
  powerUps,
  radius = 50,
  range = 8
}) => {
  const [blips, setBlips] = useState<Array<{x: number, y: number, type: 'enemy' | 'powerup', id: string}>>([]);
  const requestRef = useRef<number>(0);
  
  const updateRadar = () => {
    const time = performance.now() / 1000;
    const newBlips: Array<typeof blips[0]> = [];

    // Process Obstacles
    obstacles.forEach(obs => {
        let obsX = obs.initialPos!.x;
        let obsZ = obs.initialPos!.z;

        if (obs.type === ObstacleType.PATROL_ENEMY) {
             const move = Math.sin(time * (obs.speed || 1)) * (obs.range || 1.5);
             if (obs.axis === 'x') obsX += move;
             else obsZ += move;
        }

        const dx = obsX - playerPos.x;
        const dz = obsZ - playerPos.z;
        
        // Rotate to player frame
        // angle = playerRotation maps North (-z) to Up (-y)
        const angle = playerRotation;
        const rx = dx * Math.cos(angle) - dz * Math.sin(angle);
        const rz = dx * Math.sin(angle) + dz * Math.cos(angle);
        
        const dist = Math.sqrt(rx * rx + rz * rz);
        
        if (dist <= range) {
            const scale = (radius / range);
            newBlips.push({
                x: rx * scale,
                y: rz * scale,
                type: 'enemy',
                id: obs.id
            });
        }
    });

    // Process Powerups
    powerUps.forEach(p => {
        if (p.collected) return;
        const dx = p.x - playerPos.x;
        const dz = p.z - playerPos.z;
        
        const angle = playerRotation;
        const rx = dx * Math.cos(angle) - dz * Math.sin(angle);
        const rz = dx * Math.sin(angle) + dz * Math.cos(angle);
        
        const dist = Math.sqrt(rx * rx + rz * rz);
        
        if (dist <= range) {
             const scale = (radius / range);
             newBlips.push({
                x: rx * scale,
                y: rz * scale,
                type: 'powerup',
                id: p.id
            });
        }
    });

    setBlips(newBlips);
    requestRef.current = requestAnimationFrame(updateRadar);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(updateRadar);
    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [playerPos, playerRotation, obstacles, powerUps]);

  return (
    <div 
        className="relative rounded-full border-2 border-cyan-500/50 bg-black/80 backdrop-blur-md overflow-hidden shadow-[0_0_15px_rgba(0,240,255,0.2)] pointer-events-none"
        style={{ width: radius * 2, height: radius * 2 }}
    >
        {/* Radar Grid */}
        <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-2 rounded-full border border-cyan-500"></div>
            <div className="absolute inset-6 rounded-full border border-cyan-500"></div>
            <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-cyan-500"></div>
            <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-cyan-500"></div>
        </div>

        {/* Scanner Sweep */}
        <div className="absolute inset-0 animate-[spin_2s_linear_infinite] origin-center">
             <div className="w-full h-full bg-[conic-gradient(from_0deg,transparent_0deg,transparent_270deg,rgba(0,240,255,0.4)_360deg)]"></div>
        </div>

        {/* Player Marker */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_5px_#fff] z-10"></div>

        {/* Blips */}
        {blips.map(b => (
            <div 
                key={b.id}
                className={`absolute w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-[0_0_5px_currentColor] ${
                    b.type === 'enemy' ? 'bg-red-500 text-red-500' : 'bg-green-400 text-green-400'
                }`}
                style={{
                    left: radius + b.x,
                    top: radius + b.y
                }}
            />
        ))}
    </div>
  );
};
