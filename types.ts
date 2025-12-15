export enum GamePhase {
  MENU = 'MENU',
  MEMORIZE = 'MEMORIZE',
  PLAYING = 'PLAYING',
  MAP_PEEK = 'MAP_PEEK',
  GAME_OVER = 'GAME_OVER',
  LEVEL_COMPLETE = 'LEVEL_COMPLETE',
  VICTORY = 'VICTORY'
}

export enum CellType {
  WALL = 0,
  PATH = 1,
  START = 2,
  END = 3,
}

export enum ObstacleType {
  STATIC_SPIKE = 'STATIC_SPIKE',
  PATROL_ENEMY = 'PATROL_ENEMY',
}

export enum PowerUpType {
  MAP_REVEAL = 'MAP_REVEAL',
  EXTRA_LIFE = 'EXTRA_LIFE',
}

export interface Position {
  x: number;
  z: number;
}

export interface Entity extends Position {
  id: string;
}

export interface Obstacle extends Entity {
  type: ObstacleType;
  axis?: 'x' | 'z'; // For patrolling
  direction?: 1 | -1;
  speed?: number;
  range?: number;
  initialPos?: Position;
}

export interface PowerUp extends Entity {
  type: PowerUpType;
  collected: boolean;
}

export interface LevelConfig {
  size: number;
  obstacles: number;
  movingObstacles: boolean;
}
