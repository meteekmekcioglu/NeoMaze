import { CellType, Position } from '../types';

export const generateMaze = (width: number, height: number) => {
  // Initialize grid with walls
  const grid: CellType[][] = Array(height).fill(null).map(() => Array(width).fill(CellType.WALL));

  const directions = [
    { x: 0, z: -2 }, // North
    { x: 2, z: 0 },  // East
    { x: 0, z: 2 },  // South
    { x: -2, z: 0 }, // West
  ];

  const shuffle = <T,>(array: T[]): T[] => {
    return array.sort(() => Math.random() - 0.5);
  };

  const isInBounds = (x: number, z: number) => {
    return x > 0 && x < width - 1 && z > 0 && z < height - 1;
  };

  const carved = new Set<string>();

  const carve = (x: number, z: number) => {
    carved.add(`${x},${z}`);
    grid[z][x] = CellType.PATH;

    const shuffledDirs = shuffle([...directions]);

    for (const dir of shuffledDirs) {
      const nx = x + dir.x;
      const nz = z + dir.z;

      if (isInBounds(nx, nz) && !carved.has(`${nx},${nz}`)) {
        // Carve wall between
        grid[z + dir.z / 2][x + dir.x / 2] = CellType.PATH;
        carve(nx, nz);
      }
    }
  };

  // Start carving from 1,1
  carve(1, 1);

  // Set start and end
  grid[1][1] = CellType.START;
  
  // Find a far point for END, preferably bottom right area
  let endX = width - 2;
  let endY = height - 2;
  
  // Ensure end is reachable (it should be if maze is perfect, but let's double check it's a path)
  while (grid[endY][endX] === CellType.WALL) {
      if (endX > 1) endX--;
      else if (endY > 1) endY--;
  }
  grid[endY][endX] = CellType.END;

  return { grid, start: { x: 1, z: 1 }, end: { x: endX, z: endY } };
};

export const findEmptySpots = (grid: CellType[][], count: number, excludeNearStart = true): Position[] => {
  const spots: Position[] = [];
  const height = grid.length;
  const width = grid[0].length;
  const attempts = 0;
  
  while (spots.length < count && attempts < 1000) {
    const x = Math.floor(Math.random() * width);
    const z = Math.floor(Math.random() * height);

    if (grid[z][x] === CellType.PATH) {
      if (excludeNearStart && x < 4 && z < 4) continue;
      // Ensure not already picked
      if (!spots.some(s => s.x === x && s.z === z)) {
        spots.push({ x, z });
      }
    }
  }
  return spots;
};

export const findShortestPath = (grid: CellType[][], start: Position, end: Position): Position[] => {
  const queue: { pos: Position, path: Position[] }[] = [];
  const visited = new Set<string>();
  
  // Start from player position (floored)
  const startX = Math.floor(start.x);
  const startZ = Math.floor(start.z);
  const endX = Math.floor(end.x);
  const endZ = Math.floor(end.z);

  queue.push({ 
    pos: { x: startX, z: startZ }, 
    path: [{ x: startX, z: startZ }] 
  });
  visited.add(`${startX},${startZ}`);

  while (queue.length > 0) {
    const { pos, path } = queue.shift()!;

    if (pos.x === endX && pos.z === endZ) {
      return path;
    }

    const neighbors = [
      { x: pos.x + 1, z: pos.z },
      { x: pos.x - 1, z: pos.z },
      { x: pos.x, z: pos.z + 1 },
      { x: pos.x, z: pos.z - 1 }
    ];

    for (const neighbor of neighbors) {
      // Check bounds
      if (neighbor.z >= 0 && neighbor.z < grid.length && neighbor.x >= 0 && neighbor.x < grid[0].length) {
        // Check if walkable (not a wall)
        if (grid[neighbor.z][neighbor.x] !== CellType.WALL) {
          const key = `${neighbor.x},${neighbor.z}`;
          if (!visited.has(key)) {
            visited.add(key);
            queue.push({
              pos: neighbor,
              path: [...path, neighbor]
            });
          }
        }
      }
    }
  }
  
  return [];
};