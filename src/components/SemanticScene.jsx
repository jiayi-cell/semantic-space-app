import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import WordNode from './WordNode.jsx';
import { AXIS_LABELS, AXIS_RANGE } from '../lib/constants.js';

function getLabelOffset(item) {
  const seed = item.id.length + item.word.length;
  return [((seed % 7) - 3) * 0.06, 0.08 + (seed % 5) * 0.024, ((seed % 3) - 1) * 0.03];
}

function AxisLabel({ position, children, className = '' }) {
  return (
    <Html position={position} distanceFactor={9} style={{ pointerEvents: 'none' }}>
      <div className={`axis-label ${className}`}>{children}</div>
    </Html>
  );
}

function AxisSystem() {
  const range = AXIS_RANGE;

  return (
    <group>
      <Line points={[[-range, 0, 0], [range, 0, 0]]} color="#363b44" lineWidth={0.5} transparent opacity={0.94} />
      <Line points={[[0, -range, 0], [0, range, 0]]} color="#363b44" lineWidth={0.5} transparent opacity={0.94} />
      <Line points={[[0, 0, -range], [0, 0, range]]} color="#2551ff" lineWidth={0.5} transparent opacity={0.82} />

      <AxisLabel position={[range + 0.35, 0, 0]}>{AXIS_LABELS.x.positive}</AxisLabel>
      <AxisLabel position={[-range - 0.35, 0, 0]} className="align-right">
        {AXIS_LABELS.x.negative}
      </AxisLabel>
      <AxisLabel position={[0.28, range + 0.32, 0]}>{AXIS_LABELS.y.positive}</AxisLabel>
      <AxisLabel position={[0.28, -range - 0.32, 0]}>{AXIS_LABELS.y.negative}</AxisLabel>
      <AxisLabel position={[0.2, 0.2, range + 0.48]}>{AXIS_LABELS.z.positive}</AxisLabel>
      <AxisLabel position={[0.2, 0.2, -range - 0.48]}>{AXIS_LABELS.z.negative}</AxisLabel>

      <AxisLabel position={[range * 0.6, 0.3, 0]} className="axis-name">
        {AXIS_LABELS.x.name}
      </AxisLabel>
      <AxisLabel position={[0.35, range * 0.6, 0]} className="axis-name">
        {AXIS_LABELS.y.name}
      </AxisLabel>
      <AxisLabel position={[0.35, 0.35, range * 0.5]} className="axis-name">
        {AXIS_LABELS.z.name}
      </AxisLabel>
      <gridHelper args={[10, 10, '#e8e3da', '#f0ede7']} />
    </group>
  );
}

function CameraRig() {
  const controlsRef = useRef(null);
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(7.8, 6.4, 7.8);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      minDistance={4}
      maxDistance={18}
      screenSpacePanning
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
    />
  );
}

function ProjectedConnectionBridge({ words, progress, onProject }) {
  const { camera, size } = useThree();
  const visiblePoints = useMemo(() => {
    if (words.length < 2) {
      return [];
    }

    const allPoints = words.map((item) => {
      const [offsetX, offsetY, offsetZ] = getLabelOffset(item);
      return [item.position[0] + offsetX, item.position[1] + offsetY, item.position[2] + offsetZ];
    });
    allPoints.push(allPoints[0]);

    if (allPoints.length < 2 || progress <= 0) {
      return [];
    }

    const segmentCount = allPoints.length - 1;
    const total = progress * segmentCount;
    const completed = Math.floor(total);
    const remainder = total - completed;
    const nextPoints = [allPoints[0]];

    for (let index = 1; index <= completed && index < allPoints.length; index += 1) {
      nextPoints.push(allPoints[index]);
    }

    if (completed < segmentCount) {
      const start = allPoints[completed];
      const end = allPoints[completed + 1];
      nextPoints.push([
        THREE.MathUtils.lerp(start[0], end[0], remainder),
        THREE.MathUtils.lerp(start[1], end[1], remainder),
        THREE.MathUtils.lerp(start[2], end[2], remainder),
      ]);
    }

    return nextPoints;
  }, [words, progress]);

  useFrame(() => {
    if (visiblePoints.length < 2) {
      onProject([]);
      return;
    }

    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();

    const projected = visiblePoints
      .map((point) => {
      const vector = new THREE.Vector3(point[0], point[1], point[2]).project(camera);
      return {
        x: (vector.x * 0.5 + 0.5) * size.width,
        y: (-vector.y * 0.5 + 0.5) * size.height,
      };
      })
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

    onProject(projected);
  });

  return null;
}

function SceneContents({
  words,
  selectedId,
  onSelect,
  burstIds,
  connectionProgress,
  onProjectConnection,
}) {
  return (
    <>
      <color attach="background" args={['#fbfaf6']} />
      <ambientLight intensity={0.98} />
      <directionalLight position={[6, 8, 5]} intensity={0.13} />
      <AxisSystem />

      {connectionProgress > 0 && words.length > 1 && (
        <ProjectedConnectionBridge
          words={words}
          progress={connectionProgress}
          onProject={onProjectConnection}
        />
      )}

      {words.map((item) => (
        <WordNode
          key={item.id}
          item={item}
          isSelected={selectedId === item.id}
          isDimmed={Boolean(selectedId && selectedId !== item.id)}
          onSelect={onSelect}
          shouldBurst={burstIds.includes(item.id)}
        />
      ))}

      <CameraRig />
    </>
  );
}

export default function SemanticScene({
  resetToken,
  words,
  selectedId,
  onSelect,
  onClearSelection,
  burstIds,
  connectionProgress,
}) {
  const shellRef = useRef(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [projectedConnection, setProjectedConnection] = useState([]);

  useEffect(() => {
    if (!shellRef.current) {
      return undefined;
    }

    const element = shellRef.current;
    const updateSize = () => {
      setViewport({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (connectionProgress <= 0) {
      setProjectedConnection([]);
    }
  }, [connectionProgress]);

  useEffect(() => {
    setProjectedConnection([]);
  }, [resetToken]);

  const polylinePoints = useMemo(
    () => projectedConnection.map((point) => `${point.x},${point.y}`).join(' '),
    [projectedConnection]
  );

  return (
    <div ref={shellRef} className="scene-shell">
      <div className="scene-caption">
        <span>Semantic Field</span>
        <span>drag to rotate / right-drag to pan / wheel to zoom</span>
      </div>

      {connectionProgress > 0 && viewport.width > 0 && viewport.height > 0 && projectedConnection.length > 1 && (
        <svg
          className="connection-overlay"
          width={viewport.width}
          height={viewport.height}
          viewBox={`0 0 ${viewport.width} ${viewport.height}`}
          preserveAspectRatio="none"
        >
          <polyline
            points={polylinePoints}
            fill="none"
            stroke="#20252c"
            strokeWidth="0.72"
            strokeOpacity="0.34"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}

      <Canvas camera={{ position: [7.8, 6.4, 7.8], fov: 42 }} onPointerMissed={onClearSelection}>
        <SceneContents
          words={words}
          selectedId={selectedId}
          onSelect={onSelect}
          burstIds={burstIds}
          connectionProgress={connectionProgress}
          onProjectConnection={setProjectedConnection}
        />
      </Canvas>
    </div>
  );
}
