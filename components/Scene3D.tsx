import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { PerspectiveCamera, Environment, Stars, Float, shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { CellType, Obstacle, Position, PowerUp, PowerUpType, ObstacleType } from '../types';
import { COLORS, WALL_HEIGHT, CELL_SIZE, PLAYER_RADIUS, PLAYER_SPEED } from '../constants';

// --- Custom Shaders ---

const GradientPathMaterial = shaderMaterial(
  { uTime: 0 },
  // Vertex Shader
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment Shader
  `
    uniform float uTime;
    varying vec2 vUv;
    void main() {
      // Moving gradient: (vUv.x goes from 0 start to 1 end)
      // We subtract time so the phase moves towards 1
      float flow = vUv.x * 15.0 - uTime * 3.0;
      
      // Rainbow palette
      vec3 color = 0.5 + 0.5 * cos(flow + vec3(0.0, 2.0, 4.0));
      
      // Pulsate brightness
      float pulse = 0.8 + 0.4 * sin(uTime * 4.0 - vUv.x * 5.0);
      
      // Emission boost
      vec3 finalColor = color * pulse * 2.0; 
      
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
);

extend({ GradientPathMaterial });

// --- Sub-components for Scene ---

interface WallProps {
  position: [number, number, number];
  color: string;
}

const Wall: React.FC<WallProps> = ({ position, color }) => {
  return (
    <group position={position}>
      {/* Main Block (Dark Glass/Metal) */}
      <mesh position={[0, WALL_HEIGHT / 2, 0]}>
        <boxGeometry args={[CELL_SIZE, WALL_HEIGHT, CELL_SIZE]} />
        <meshPhysicalMaterial 
            color="#050505" 
            roughness={0.2} 
            metalness={0.8}
            emissive={color}
            emissiveIntensity={0.2}
        />
      </mesh>
      {/* Neon Edges */}
      <mesh position={[0, WALL_HEIGHT / 2, 0]}>
        <boxGeometry args={[CELL_SIZE * 1.01, WALL_HEIGHT * 1.01, CELL_SIZE * 1.01]} />
        <meshBasicMaterial color={color} wireframe toneMapped={false} />
      </mesh>
    </group>
  );
};

const Floor = ({ width, height }: { width: number, height: number }) => {
  return (
    <group>
        {/* Reflective Dark Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2 - 0.5, -0.01, height / 2 - 0.5]}>
        <planeGeometry args={[width * 4, height * 4]} />
        <meshStandardMaterial color="#000000" roughness={0.1} metalness={0.8} />
        </mesh>
        {/* Grid Helper */}
        <gridHelper 
            args={[Math.max(width, height) * 4, Math.max(width, height) * 4, COLORS.GRAY, '#0a0a0a']} 
            position={[width / 2 - 0.5, 0.01, height / 2 - 0.5]} 
        />
    </group>
  );
};

interface CollectibleProps {
  position: [number, number, number];
  type: PowerUpType;
}

const Collectible: React.FC<CollectibleProps> = ({ position, type }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.05;
      meshRef.current.rotation.z += 0.02;
      meshRef.current.position.y = 0.5 + Math.sin(state.clock.elapsedTime * 3) * 0.1;
    }
  });

  const color = type === PowerUpType.EXTRA_LIFE ? COLORS.GREEN : COLORS.BLUE;
  const geometry = type === PowerUpType.EXTRA_LIFE ? <octahedronGeometry args={[0.25]} /> : <torusGeometry args={[0.2, 0.05, 16, 32]} />;

  return (
    <group position={position}>
        <mesh ref={meshRef}>
        {geometry}
        <meshBasicMaterial color={color} />
        </mesh>
        <pointLight color={color} distance={2} intensity={2} />
    </group>
  );
};

interface ObstacleMeshProps {
  obstacle: Obstacle;
}

const ObstacleMesh: React.FC<ObstacleMeshProps> = ({ obstacle }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (obstacle.type === ObstacleType.PATROL_ENEMY && meshRef.current) {
      const time = state.clock.elapsedTime;
      const speed = obstacle.speed || 1;
      const range = obstacle.range || 2;
      const move = Math.sin(time * speed) * range;
      
      const baseX = obstacle.initialPos!.x;
      const baseZ = obstacle.initialPos!.z;
      
      if (obstacle.axis === 'x') {
        meshRef.current.position.x = baseX + move;
      } else {
        meshRef.current.position.z = baseZ + move;
      }
    }
  });

  // Glowing Spike Sphere
  return (
    <group>
        <mesh ref={meshRef} position={[obstacle.initialPos!.x, 0.5, obstacle.initialPos!.z]}>
        <icosahedronGeometry args={[0.25, 1]} />
        <meshStandardMaterial color={COLORS.RED} emissive={COLORS.RED} emissiveIntensity={2} roughness={0.2} metalness={1} />
        </mesh>
    </group>
  );
};

const DestinationMarker = ({ position }: { position: [number, number, number] }) => {
    return (
        <group position={position}>
             <Float speed={2} rotationIntensity={0} floatIntensity={0.5}>
                 <mesh position={[0, 0.5, 0]}>
                    <coneGeometry args={[0.3, 0.8, 4]} />
                    <meshStandardMaterial color={COLORS.YELLOW} emissive={COLORS.YELLOW} emissiveIntensity={1} wireframe />
                 </mesh>
             </Float>
             <pointLight position={[0, 0.5, 0]} color={COLORS.YELLOW} distance={3} intensity={2} />
             <mesh position={[0, 0.05, 0]} rotation={[-Math.PI/2, 0, 0]}>
                 <ringGeometry args={[0.4, 0.5, 32]} />
                 <meshBasicMaterial color={COLORS.YELLOW} />
             </mesh>
        </group>
    )
}

const MovingOptimalPath = ({ path }: { path: Position[] }) => {
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    
    // Create a smooth curve from the path
    const curve = useMemo(() => {
        if (!path || path.length < 2) return null;
        // Lift the path slightly off the ground (0.3)
        const points = path.map(p => new THREE.Vector3(p.x, 0.3, p.z));
        return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.1);
    }, [path]);

    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
        }
    });

    if (!curve) return null;

    return (
        <mesh>
            {/* 
                TubeGeometry: 
                path: curve
                tubularSegments: path.length * 8 (high resolution)
                radius: 0.2 (Thick!)
                radialSegments: 8
                closed: false
            */}
            <tubeGeometry args={[curve, Math.max(20, path.length * 5), 0.2, 8, false]} />
            {/* @ts-ignore */}
            <gradientPathMaterial ref={materialRef} transparent />
        </mesh>
    );
};

// --- Camera Controller ---

interface CameraControllerProps {
  playerPos: Position;
  playerRotation: number;
}

const CameraController: React.FC<CameraControllerProps> = ({ playerPos, playerRotation }) => {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  useFrame(() => {
    if (cameraRef.current) {
      const targetPos = new THREE.Vector3(playerPos.x, 0.8, playerPos.z);
      cameraRef.current.position.lerp(targetPos, 0.2); // Smooth follow

      const currentRot = cameraRef.current.rotation.y;
      let diff = playerRotation - currentRot;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      
      cameraRef.current.rotation.y += diff * 0.15;
    }
  });

  return (
    <PerspectiveCamera 
      ref={cameraRef} 
      makeDefault 
      fov={85} 
      position={[1, 0.8, 1]} 
      near={0.1} 
    />
  );
};

interface SceneProps {
  grid: CellType[][];
  playerPos: Position;
  playerRotation: number;
  obstacles: Obstacle[];
  powerUps: PowerUp[];
  optimalPath: Position[];
}

export const Scene3D: React.FC<SceneProps> = ({ 
  grid, 
  playerPos, 
  playerRotation,
  obstacles, 
  powerUps,
  optimalPath
}) => {
  const height = grid.length;
  const width = grid[0].length;

  const walls = [];
  let endPos: [number, number, number] = [0,0,0];

  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      if (grid[z][x] === CellType.WALL) {
        // Deterministic neon color
        const rand = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
        const val = rand - Math.floor(rand);
        let color = COLORS.WHITE;
        if (val > 0.85) color = COLORS.RED;
        else if (val > 0.60) color = COLORS.BLUE;
        else if (val > 0.40) color = COLORS.YELLOW;

        walls.push(<Wall key={`${x}-${z}`} position={[x, 0, z]} color={color} />);
      } else if (grid[z][x] === CellType.END) {
        endPos = [x, 0, z];
      }
    }
  }

  return (
    <Canvas shadows dpr={[1, 2]}>
      <color attach="background" args={['#000000']} />
      <fog attach="fog" args={['#000000', 2, 12]} />
      
      <CameraController playerPos={playerPos} playerRotation={playerRotation} />
      
      <Stars radius={50} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
      
      {/* Dark Ambient & Point Lights */}
      <ambientLight intensity={0.2} />
      
      {/* Player Light */}
      <pointLight position={[playerPos.x, 0.5, playerPos.z]} color="#ffffff" intensity={1.5} distance={6} castShadow />

      <group>
        {walls}
        <Floor width={width} height={height} />
        <DestinationMarker position={endPos} />
        
        {/* Render Optimal Path */}
        <MovingOptimalPath path={optimalPath} />

        {powerUps.filter(p => !p.collected).map(p => (
          <Collectible key={p.id} position={[p.x, 0.5, p.z]} type={p.type} />
        ))}

        {obstacles.map(o => (
           <ObstacleMesh key={o.id} obstacle={o} />
        ))}
      </group>
    </Canvas>
  );
};