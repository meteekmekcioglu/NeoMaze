export const WALL_HEIGHT = 2;
export const PLAYER_SPEED = 4; // Units per second
export const PLAYER_RADIUS = 0.3;
export const CELL_SIZE = 1;
export const PULVERISE_RADIUS = 3.5;

// Neo-Mondrian Palette (OLED/Neon)
export const COLORS = {
  RED: '#FF003C',     // Neon Red/Pink
  BLUE: '#00F0FF',    // Cyber Cyan
  YELLOW: '#FBFF00',  // Electric Yellow
  WHITE: '#FFFFFF',   // Pure White
  BLACK: '#000000',   // OLED Black
  GRAY: '#1A1A1A',    // Dark Gray
  GREEN: '#00FF41',   // Matrix Green
  GRID: '#111111',    // Floor Grid
};

export const LEVELS = [
  { size: 7, obstacles: 0, movingObstacles: false },
  { size: 9, obstacles: 2, movingObstacles: false },
  { size: 11, obstacles: 4, movingObstacles: true },
  { size: 13, obstacles: 6, movingObstacles: true },
  { size: 15, obstacles: 8, movingObstacles: true },
];

export const MEMORIZE_TIME = 10;
export const PEEK_TIME = 5;