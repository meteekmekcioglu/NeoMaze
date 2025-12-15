import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  GamePhase, 
  CellType, 
  Position, 
  LevelConfig, 
  Obstacle, 
  PowerUp, 
  PowerUpType, 
  ObstacleType 
} from './types';
import { 
  LEVELS, 
  PLAYER_SPEED, 
  PLAYER_RADIUS, 
  MEMORIZE_TIME, 
  PEEK_TIME,
  COLORS,
  PULVERISE_RADIUS
} from './constants';
import { generateMaze, findEmptySpots, findShortestPath } from './utils/maze';
import { Minimap } from './components/Minimap';
import { Scene3D } from './components/Scene3D';
import { Joystick } from './components/Joystick';
import { Radar } from './components/Radar';
import { Play, Eye, Heart, RotateCw, Skull, Trophy, Zap, Radio, Pause, RotateCcw } from 'lucide-react';

const App = () => {
  // Game State
  const [phase, setPhase] = useState<GamePhase>(GamePhase.MENU);
  const [levelIndex, setLevelIndex] = useState(0);
  const [grid, setGrid] = useState<CellType[][]>([]);
  const [startPos, setStartPos] = useState<Position>({ x: 1, z: 1 });
  const [endPos, setEndPos] = useState<Position>({ x: 1, z: 1 });
  
  // Player State
  const [playerPos, setPlayerPos] = useState<Position>({ x: 1, z: 1 });
  const [playerRotation, setPlayerRotation] = useState(0);
  const [lives, setLives] = useState(3);
  const [timer, setTimer] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionKey, setSessionKey] = useState(0); // Used to reset Joysticks
  
  // Gameplay State
  const [canPulverise, setCanPulverise] = useState(false);
  const [pulveriseCooldown, setPulveriseCooldown] = useState(0);
  const [optimalPath, setOptimalPath] = useState<Position[]>([]);

  // Entities
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [powerUps, setPowerUps] = useState<PowerUp[]>([]);

  // Controls
  const moveJoystickRef = useRef({ x: 0, y: 0 }); // Left: Movement
  const lookJoystickRef = useRef({ x: 0, y: 0 }); // Right: Rotation
  
  const lastTimeRef = useRef(0);
  const animationFrameRef = useRef<number>(0);
  const invulnerableRef = useRef(false);

  // --- Logic ---

  const startLevel = useCallback((index: number) => {
    // Reset inputs
    moveJoystickRef.current = { x: 0, y: 0 };
    lookJoystickRef.current = { x: 0, y: 0 };
    setSessionKey(prev => prev + 1);
    setIsPaused(false);

    const config: LevelConfig = LEVELS[index] || LEVELS[LEVELS.length - 1];
    const extraSize = index >= LEVELS.length ? (index - LEVELS.length + 1) * 2 : 0;
    const size = config.size + extraSize;
    
    const { grid: newGrid, start, end } = generateMaze(size, size);
    
    setGrid(newGrid);
    setStartPos(start);
    setEndPos(end);
    setPlayerPos({ x: start.x, z: start.z });
    setOptimalPath([]);
    
    // Determine initial rotation to face the opening
    let startRot = 0;
    const { x, z } = start;

    // Check neighbors to find the path. 
    // Rotation mapping: 0 = North (-Z), PI = South (+Z), -PI/2 = East (+X), PI/2 = West (-X)
    
    // Check North
    if (z > 0 && newGrid[z - 1][x] !== CellType.WALL) {
        startRot = 0; 
    } 
    // Check South
    else if (z < newGrid.length - 1 && newGrid[z + 1][x] !== CellType.WALL) {
        startRot = Math.PI;
    }
    // Check East
    else if (x < newGrid[0].length - 1 && newGrid[z][x + 1] !== CellType.WALL) {
        startRot = -Math.PI / 2;
    }
    // Check West
    else if (x > 0 && newGrid[z][x - 1] !== CellType.WALL) {
        startRot = Math.PI / 2;
    }
    
    setPlayerRotation(startRot);
    
    const emptySpots = findEmptySpots(newGrid, config.obstacles + 2, true); 
    
    const newObstacles: Obstacle[] = [];
    const newPowerUps: PowerUp[] = [];

    // Add Obstacles
    for (let i = 0; i < config.obstacles; i++) {
        if (!emptySpots[i]) break;
        const spot = emptySpots[i];
        const isMoving = config.movingObstacles && i % 2 === 0;
        
        newObstacles.push({
            id: `obs-${i}`,
            x: spot.x,
            z: spot.z,
            initialPos: { ...spot },
            type: isMoving ? ObstacleType.PATROL_ENEMY : ObstacleType.STATIC_SPIKE,
            axis: Math.random() > 0.5 ? 'x' : 'z',
            speed: 1.5 + Math.random(),
            range: 1.5
        });
    }

    // Add Powerups
    for (let i = config.obstacles; i < emptySpots.length; i++) {
        const spot = emptySpots[i];
        const type = Math.random() > 0.6 ? PowerUpType.EXTRA_LIFE : PowerUpType.MAP_REVEAL;
        newPowerUps.push({
            id: `pwr-${i}`,
            x: spot.x,
            z: spot.z,
            type: type,
            collected: false
        });
    }

    setObstacles(newObstacles);
    setPowerUps(newPowerUps);
    setCanPulverise(false);
    
    setLevelIndex(index);
    setPhase(GamePhase.MEMORIZE);
    setTimer(MEMORIZE_TIME);
  }, []);

  // Timer Logic
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (!isPaused && (phase === GamePhase.MEMORIZE || phase === GamePhase.MAP_PEEK)) {
      interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            setPhase(GamePhase.PLAYING);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [phase, isPaused]);

  // Cooldown timer
  useEffect(() => {
      let interval: ReturnType<typeof setInterval>;
      if (!isPaused && pulveriseCooldown > 0) {
          interval = setInterval(() => {
              setPulveriseCooldown(c => Math.max(0, c - 1));
          }, 1000);
      }
      return () => clearInterval(interval);
  }, [pulveriseCooldown, isPaused]);

  // Game Loop
  const update = (time: number) => {
    if (phase !== GamePhase.PLAYING || isPaused) {
        lastTimeRef.current = time;
        animationFrameRef.current = requestAnimationFrame(update);
        return;
    }

    const deltaTime = (time - lastTimeRef.current) / 1000;
    lastTimeRef.current = time;

    // 1. Rotation (Right Joystick)
    const lookX = lookJoystickRef.current.x;
    const rotationSpeed = 2.5;
    if (Math.abs(lookX) > 0.05) {
        setPlayerRotation(prev => prev - lookX * rotationSpeed * deltaTime);
    }

    // 2. Movement (Left Joystick)
    const moveX = moveJoystickRef.current.x; 
    const moveY = moveJoystickRef.current.y; 

    if (Math.abs(moveX) > 0.1 || Math.abs(moveY) > 0.1) {
        const moveSpeed = PLAYER_SPEED;
        const forward = moveY; 
        const strafe = moveX; 

        const dx = (forward * Math.sin(playerRotation) + strafe * Math.cos(playerRotation)) * moveSpeed * deltaTime;
        const dz = (forward * Math.cos(playerRotation) - strafe * Math.sin(playerRotation)) * moveSpeed * deltaTime;

        setPlayerPos(prev => {
            const nextX = prev.x + dx;
            const nextZ = prev.z + dz;
            let newX = prev.x;
            let newZ = prev.z;
            if (!checkWallCollision(nextX, prev.z, grid)) newX = nextX;
            if (!checkWallCollision(newX, nextZ, grid)) newZ = nextZ;
            return { x: newX, z: newZ };
        });
    }

    const t = time / 1000;
    
    // 3. Update Obstacles & Check Pulverise Proximity
    let nearbyEnemy = false;
    
    // We map obstacles to update their simulated positions for collision/proximity logic
    // Note: We don't update state here to avoid re-renders, we just use the calculated pos
    obstacles.forEach(obs => {
        let obsX = obs.initialPos!.x;
        let obsZ = obs.initialPos!.z;

        if (obs.type === ObstacleType.PATROL_ENEMY) {
             const move = Math.sin(t * obs.speed!) * obs.range!;
             if (obs.axis === 'x') obsX += move;
             else obsZ += move;
        }

        const dist = Math.sqrt(
            Math.pow(obsX - playerPos.x, 2) + 
            Math.pow(obsZ - playerPos.z, 2)
        );

        // Check for Pulverise Availability
        if (dist < PULVERISE_RADIUS) {
            nearbyEnemy = true;
        }

        // Check collision
        if (dist < PLAYER_RADIUS + 0.35 && !invulnerableRef.current) {
            handleHit();
        }
    });

    setCanPulverise(nearbyEnemy && pulveriseCooldown === 0);

    // 4. Check Powerups
    powerUps.forEach(p => {
        if (p.collected) return;
        const dist = Math.sqrt(
            Math.pow(p.x - playerPos.x, 2) + 
            Math.pow(p.z - playerPos.z, 2)
        );
        if (dist < 0.5) {
            collectPowerUp(p);
        }
    });

    // 5. Check End Condition
    const distToEnd = Math.sqrt(
        Math.pow(endPos.x - playerPos.x, 2) + 
        Math.pow(endPos.z - playerPos.z, 2)
    );
    if (distToEnd < 0.5) {
        setPhase(GamePhase.LEVEL_COMPLETE);
    }

    animationFrameRef.current = requestAnimationFrame(update);
  };

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }); 

  // Helpers
  const checkWallCollision = (x: number, z: number, map: CellType[][]) => {
     const pMinX = x - PLAYER_RADIUS;
     const pMaxX = x + PLAYER_RADIUS;
     const pMinZ = z - PLAYER_RADIUS;
     const pMaxZ = z + PLAYER_RADIUS;

     const startX = Math.floor(pMinX - 0.5);
     const endX = Math.ceil(pMaxX + 0.5);
     const startZ = Math.floor(pMinZ - 0.5);
     const endZ = Math.ceil(pMaxZ + 0.5);

     for (let cz = startZ; cz < endZ; cz++) {
         for (let cx = startX; cx < endX; cx++) {
             if (cz >= 0 && cz < map.length && cx >= 0 && cx < map[0].length) {
                 if (map[cz][cx] === CellType.WALL) {
                     const wMinX = cx - 0.5;
                     const wMaxX = cx + 0.5;
                     const wMinZ = cz - 0.5;
                     const wMaxZ = cz + 0.5;
                     if (pMinX < wMaxX && pMaxX > wMinX && pMinZ < wMaxZ && pMaxZ > wMinZ) {
                         return true;
                     }
                 }
             }
         }
     }
     return false;
  };

  const handleHit = () => {
      invulnerableRef.current = true;
      setLives(l => {
          const newLives = l - 1;
          if (newLives <= 0) {
              setPhase(GamePhase.GAME_OVER);
          }
          return newLives;
      });
      setTimeout(() => {
          invulnerableRef.current = false;
      }, 1500); 
  };

  const handlePulverise = () => {
      if (!canPulverise) return;
      
      const t = performance.now() / 1000;

      // Filter out obstacles within range
      setObstacles(prev => prev.filter(obs => {
        let obsX = obs.initialPos!.x;
        let obsZ = obs.initialPos!.z;

        if (obs.type === ObstacleType.PATROL_ENEMY) {
             const move = Math.sin(t * obs.speed!) * obs.range!;
             if (obs.axis === 'x') obsX += move;
             else obsZ += move;
        }

        const dist = Math.sqrt(
            Math.pow(obsX - playerPos.x, 2) + 
            Math.pow(obsZ - playerPos.z, 2)
        );
        
        return dist > PULVERISE_RADIUS;
      }));

      // Trigger cooldown
      setPulveriseCooldown(3); 
      setCanPulverise(false);
  };

  const collectPowerUp = (p: PowerUp) => {
      setPowerUps(prev => prev.map(pu => pu.id === p.id ? { ...pu, collected: true } : pu));
      
      if (p.type === PowerUpType.EXTRA_LIFE) {
          setLives(l => l + 1);
      } else if (p.type === PowerUpType.MAP_REVEAL) {
          // Calculate Optimal Path
          const path = findShortestPath(grid, playerPos, endPos);
          setOptimalPath(path);
          
          // Clear after 5 seconds
          setTimeout(() => {
            setOptimalPath([]);
          }, 5000);
      }
  };

  const handleRestartLevel = () => {
      startLevel(levelIndex);
  };

  // --- Render ---

  return (
    <div className="w-full h-full relative overflow-hidden bg-black text-white font-sans selection:bg-cyan-500/30">
      
      {/* 3D Scene Layer */}
      {(phase === GamePhase.PLAYING || phase === GamePhase.MAP_PEEK) && (
        <div className="absolute inset-0 z-0">
          <Scene3D 
            grid={grid} 
            playerPos={playerPos} 
            playerRotation={playerRotation}
            obstacles={obstacles}
            powerUps={powerUps}
            optimalPath={optimalPath}
          />
        </div>
      )}

      {/* UI Overlay Layer */}
      <div className="absolute inset-0 z-10 pointer-events-none">
          
          {/* HUD */}
          {(phase === GamePhase.PLAYING || phase === GamePhase.MAP_PEEK) && (
              <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start pointer-events-auto z-[60]">
                  <div className="flex flex-col gap-2">
                      {/* Health */}
                      <div className="bg-black/80 backdrop-blur-md neon-border-red border p-3 rounded-lg flex items-center gap-3">
                          <Heart className="text-red-500 fill-current animate-pulse" size={24} />
                          <div className="flex gap-1">
                            {[...Array(lives)].map((_, i) => (
                                <div key={i} className="w-4 h-6 bg-red-500 skew-x-12 shadow-[0_0_8px_#FF003C]" />
                            ))}
                          </div>
                      </div>
                      
                      {/* Level */}
                      <div className="bg-black/80 backdrop-blur-md neon-border-blue border p-2 rounded-lg flex items-center gap-2 mt-2">
                          <span className="text-xs text-cyan-400 uppercase tracking-widest font-bold">SECTOR</span>
                          <span className="font-bold text-2xl text-white font-mono">{String(levelIndex + 1).padStart(2, '0')}</span>
                      </div>
                  </div>

                  {/* Pause Button and Radar */}
                  <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setIsPaused(true)}
                        className="w-12 h-12 rounded-full bg-black/80 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)] pointer-events-auto"
                    >
                        <Pause className="text-white fill-current" size={20} />
                    </button>
                    {phase === GamePhase.PLAYING && (
                        <Radar 
                            playerPos={playerPos}
                            playerRotation={playerRotation}
                            obstacles={obstacles}
                            powerUps={powerUps}
                        />
                    )}
                  </div>
              </div>
          )}

          {/* Pause Menu Overlay */}
          {isPaused && (
             <div className="absolute inset-0 bg-black/90 backdrop-blur-lg flex flex-col items-center justify-center pointer-events-auto z-[100]">
                 <div className="mb-8 p-6 border-2 neon-border-yellow bg-black/50 rounded-lg transform -skew-x-12">
                     <h2 className="text-4xl font-black text-yellow-400 tracking-widest skew-x-12">SYSTEM PAUSED</h2>
                 </div>
                 
                 <div className="flex flex-col gap-4 w-64">
                    <button 
                        onClick={() => setIsPaused(false)}
                        className="px-8 py-4 bg-cyan-900/30 border border-cyan-500 text-cyan-400 font-bold tracking-widest hover:bg-cyan-500 hover:text-black transition-all"
                    >
                        <span className="flex items-center justify-center gap-2">
                           <Play size={18} className="fill-current"/> RESUME
                        </span>
                    </button>
                    <button 
                        onClick={handleRestartLevel}
                        className="px-8 py-4 bg-red-900/30 border border-red-500 text-red-500 font-bold tracking-widest hover:bg-red-500 hover:text-black transition-all"
                    >
                        <span className="flex items-center justify-center gap-2">
                           <RotateCcw size={18} /> RESTART SECTOR
                        </span>
                    </button>
                 </div>
             </div>
          )}

          {/* Map Overlay */}
          {(phase === GamePhase.MEMORIZE || phase === GamePhase.MAP_PEEK) && (
             <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-auto z-50">
                <Minimap 
                    grid={grid} 
                    playerPos={playerPos} 
                    startPos={startPos} 
                    endPos={endPos} 
                    revealed={phase === GamePhase.MAP_PEEK}
                    phase={phase}
                />
                <div className="mt-8 flex flex-col items-center">
                    <div className="text-8xl font-black text-white neon-text-blue font-mono">{timer}</div>
                    <div className="text-sm font-bold tracking-[0.3em] text-cyan-500 uppercase mt-2 animate-pulse">Initializing Neural Link...</div>
                </div>

                {phase === GamePhase.MEMORIZE && (
                    <button 
                        onClick={() => setPhase(GamePhase.PLAYING)}
                        className="mt-12 px-12 py-4 bg-cyan-900/30 neon-border-blue border-2 text-cyan-400 font-bold text-xl tracking-widest hover:bg-cyan-500 hover:text-black transition-all duration-200 active:scale-95 flex items-center gap-3"
                    >
                        <Play size={20} className="fill-current" /> SKIP TIMER
                    </button>
                )}

                {phase === GamePhase.MAP_PEEK && (
                    <button 
                        onClick={() => setPhase(GamePhase.PLAYING)}
                        className="mt-12 px-10 py-4 bg-red-600/20 neon-border-red border-2 text-red-500 font-bold tracking-widest hover:bg-red-600 hover:text-white transition-all duration-200"
                    >
                        ABORT SCAN
                    </button>
                )}
             </div>
          )}

          {/* Controls */}
          {phase === GamePhase.PLAYING && (
              <div className="pointer-events-auto">
                  {/* Left Touch Zone (Movement) */}
                  <Joystick 
                    key={`move-${sessionKey}`} 
                    side="left"
                    onMove={(vec) => moveJoystickRef.current = vec} 
                  />
                  
                  {/* Right Touch Zone (Rotation) */}
                  <Joystick 
                    key={`look-${sessionKey}`} 
                    side="right"
                    onMove={(vec) => lookJoystickRef.current = vec} 
                  />
                  
                  {/* Pulverise Button (High Z-Index to sit above right touch zone) */}
                  <div className="absolute bottom-40 right-10 flex flex-col items-center gap-2 z-50 pointer-events-auto">
                      <button
                        onClick={handlePulverise}
                        disabled={!canPulverise}
                        className={`
                            w-20 h-20 rounded-full border-2 flex items-center justify-center transition-all duration-300
                            ${canPulverise 
                                ? 'bg-red-600/20 border-red-500 neon-border-red scale-110 active:scale-95' 
                                : 'bg-gray-900/50 border-gray-700 opacity-50 grayscale'}
                        `}
                      >
                          <Zap size={32} className={canPulverise ? "text-red-500 fill-current" : "text-gray-500"} />
                      </button>
                      <span className={`text-[10px] tracking-widest font-bold uppercase ${canPulverise ? 'text-red-500 animate-pulse' : 'text-gray-600'}`}>
                          {pulveriseCooldown > 0 ? `COOLING ${pulveriseCooldown}s` : 'PULVERISE'}
                      </span>
                  </div>

                  {/* Desktop Hints */}
                  <div className="hidden md:block absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/60 neon-border-blue border px-6 py-2 rounded-full backdrop-blur text-center z-50 pointer-events-none">
                      <div className="flex gap-8 text-xs font-mono text-cyan-400">
                        <span className="flex items-center gap-2"><Radio size={12}/> LEFT: DRAG TO MOVE</span>
                        <span className="flex items-center gap-2"><RotateCw size={12}/> RIGHT: DRAG TO LOOK</span>
                      </div>
                  </div>
              </div>
          )}

          {/* Main Menu */}
          {phase === GamePhase.MENU && (
              <div className="absolute inset-0 bg-black flex flex-col items-center justify-center pointer-events-auto">
                  {/* Artistic decorative elements */}
                  <div className="absolute inset-0 opacity-20">
                       <div className="absolute top-1/4 left-1/4 w-64 h-64 border border-red-500 rounded-full blur-[100px]"></div>
                       <div className="absolute bottom-1/4 right-1/4 w-64 h-64 border border-blue-500 rounded-full blur-[100px]"></div>
                  </div>

                  <div className="mb-12 flex gap-6 relative z-10">
                      <div className="w-16 h-16 bg-transparent border-2 neon-border-red"></div>
                      <div className="w-16 h-16 bg-transparent border-2 neon-border-blue translate-y-4"></div>
                      <div className="w-16 h-16 bg-transparent border-2 neon-border-yellow"></div>
                  </div>
                  
                  <h1 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500 mb-2 tracking-tighter neon-text-blue">
                      NEO<span className="text-cyan-400">MAZE</span>
                  </h1>
                  <h2 className="text-xl font-mono text-gray-500 mb-16 tracking-[0.5em] uppercase">Cyber-Construct v3.0</h2>
                  
                  <button 
                    onClick={() => {
                        setLives(3);
                        startLevel(0);
                    }}
                    className="group relative px-16 py-6 bg-yellow-400/10 border border-yellow-400 neon-border-yellow text-yellow-400 font-bold text-2xl hover:bg-yellow-400 hover:text-black transition-all duration-300 active:scale-95"
                  >
                      <span className="flex items-center gap-4 relative z-10">
                        <Play size={28} className="fill-current" /> INITIATE
                      </span>
                  </button>
                  
                  <div className="mt-12 flex gap-4 text-xs text-gray-600 font-mono">
                      <span>sys.ready</span>
                      <span>//</span>
                      <span>memory.alloc</span>
                      <span>//</span>
                      <span>link.established</span>
                  </div>
              </div>
          )}

          {/* Level Complete */}
          {phase === GamePhase.LEVEL_COMPLETE && (
               <div className="absolute inset-0 bg-green-900/40 backdrop-blur-xl flex flex-col items-center justify-center pointer-events-auto text-white">
                   <div className="p-12 border border-green-500/50 bg-black/80 rounded-2xl flex flex-col items-center shadow-[0_0_50px_rgba(0,255,0,0.2)]">
                       <Trophy size={80} className="mb-6 text-green-400 drop-shadow-[0_0_15px_rgba(0,255,0,0.8)]" />
                       <h2 className="text-5xl font-black mb-8 text-white tracking-tighter">SECTOR CLEARED</h2>
                       <button 
                        onClick={() => startLevel(levelIndex + 1)}
                        className="px-12 py-4 bg-green-500 text-black font-bold text-xl rounded-none hover:bg-green-400 transition-colors shadow-[0_0_20px_rgba(0,255,0,0.6)]"
                       >
                           PROCEED NEXT >>
                       </button>
                   </div>
               </div>
          )}

          {/* Game Over */}
          {phase === GamePhase.GAME_OVER && (
               <div className="absolute inset-0 bg-red-900/40 backdrop-blur-xl flex flex-col items-center justify-center pointer-events-auto text-white">
                   <div className="p-12 border border-red-500/50 bg-black/80 rounded-2xl flex flex-col items-center shadow-[0_0_50px_rgba(255,0,0,0.2)]">
                       <Skull size={80} className="mb-6 text-red-500 drop-shadow-[0_0_15px_rgba(255,0,0,0.8)]" />
                       <h2 className="text-6xl font-black mb-4 text-red-500 tracking-tighter">TERMINATED</h2>
                       <p className="mb-8 text-gray-400 font-mono">SIGNAL LOST AT SECTOR {levelIndex + 1}</p>
                       <button 
                        onClick={() => setPhase(GamePhase.MENU)}
                        className="px-12 py-4 border border-red-500 text-red-500 font-bold text-xl hover:bg-red-500 hover:text-black transition-all"
                       >
                           REBOOT SYSTEM
                       </button>
                   </div>
               </div>
          )}
      </div>
    </div>
  );
};

export default App;