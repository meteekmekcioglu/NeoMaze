import React from 'react';
import { CellType, Position } from '../types';
import { COLORS } from '../constants';

interface MinimapProps {
  grid: CellType[][];
  playerPos?: Position;
  revealed: boolean;
  startPos: Position;
  endPos: Position;
  phase: string;
}

export const Minimap: React.FC<MinimapProps> = ({ grid, playerPos, revealed, startPos, endPos, phase }) => {
  const height = grid.length;
  const width = grid[0].length;
  
  return (
    <div className="relative p-4 bg-black/90 shadow-[0_0_30px_rgba(0,240,255,0.2)] rounded-lg border border-white/20 transition-all duration-500 transform backdrop-blur-xl">
      <div 
        className="grid gap-[1px] bg-gray-900 border border-gray-800"
        style={{
          gridTemplateColumns: `repeat(${width}, 1fr)`,
          width: 'min(80vw, 400px)',
          aspectRatio: `${width}/${height}`
        }}
      >
        {grid.map((row, z) => (
          row.map((cell, x) => {
            // Updated Colors for Visibility
            let bgColor = '#000000'; // Path defaults to black
            
            // Wall color - brighter grey for visibility against black paths
            if (cell === CellType.WALL) bgColor = '#666666';
            
            // Highlight special cells with neon glow
            const isStart = cell === CellType.START;
            const isEnd = cell === CellType.END;
            
            const style: React.CSSProperties = {
                backgroundColor: bgColor,
            };

            if (isStart) style.boxShadow = `inset 0 0 10px ${COLORS.GREEN}`;
            if (isEnd) style.boxShadow = `inset 0 0 10px ${COLORS.RED}`;

            return (
              <div 
                key={`${x}-${z}`} 
                style={style}
                className="w-full h-full relative"
              >
                {/* Labels */}
                {isStart && (
                  <span className="absolute inset-0 flex items-center justify-center text-green-400 font-bold text-xs sm:text-sm">A</span>
                )}
                {isEnd && (
                  <span className="absolute inset-0 flex items-center justify-center text-red-500 font-bold text-xs sm:text-sm">B</span>
                )}
                
                {/* Player Marker */}
                {revealed && playerPos && Math.floor(playerPos.x) === x && Math.floor(playerPos.z) === z && (
                  <div className="absolute inset-1 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_10px_#00F0FF] z-10" />
                )}
              </div>
            );
          })
        ))}
      </div>
      <div className="text-center mt-4 font-bold text-cyan-400 uppercase tracking-[0.2em] text-xs">
        {phase === 'MEMORIZE' ? '/// MEMORIZE SECTOR ///' : '/// POSITION TRACKING ///'}
      </div>
    </div>
  );
};