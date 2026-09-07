import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const formatScore = (value) => (value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2));

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function buildTextTargets(word, count = 680) {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 132;
  const context = canvas.getContext('2d');

  if (!context) {
    return Array.from({ length: count }, (_, index) => [
      ((index % 40) / 40 - 0.5) * 1.15,
      (0.5 - Math.floor(index / 40) / 17) * 0.42,
      0,
    ]);
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#000000';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font =
    word.length <= 4
      ? "600 100px 'Iowan Old Style', 'Songti SC', 'STSong', serif"
      : "600 78px 'Iowan Old Style', 'Songti SC', 'STSong', serif";
  context.fillText(word, canvas.width / 2, canvas.height / 2 + 4);

  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const samples = [];

  for (let y = 0; y < canvas.height; y += 2) {
    for (let x = 0; x < canvas.width; x += 2) {
      const alpha = data[(y * canvas.width + x) * 4 + 3];
      if (alpha > 24) {
        const depthLayer = (Math.random() - 0.5) * 0.22;
        const depthSpread = (Math.random() - 0.5) * 0.08;
        samples.push([
          ((x - canvas.width / 2) / canvas.width) * 1.28,
          ((canvas.height / 2 - y) / canvas.height) * 0.56,
          depthLayer + depthSpread,
        ]);
      }
    }
  }

  if (samples.length === 0) {
    return Array.from({ length: count }, (_, index) => [
      ((index % 40) / 40 - 0.5) * 1.15,
      (0.5 - Math.floor(index / 40) / 17) * 0.42,
      0,
    ]);
  }

  return Array.from({ length: count }, () => samples[Math.floor(Math.random() * samples.length)]);
}

function buildAxisAnchors(position) {
  return [
    [0, -position[1], -position[2]],
    [-position[0], 0, -position[2]],
    [-position[0], -position[1], 0],
  ];
}

function ParticleAssemble({ position, offset, word, active, revealRef }) {
  const pointsRef = useRef(null);
  const materialRef = useRef(null);
  const sourceRef = useRef(null);
  const sourceMaterialRef = useRef(null);
  const startRef = useRef(active ? performance.now() : 0);
  const targetPoints = useMemo(() => buildTextTargets(word), [word]);
  const axisAnchors = useMemo(() => buildAxisAnchors(position), [position]);
  const particles = useMemo(
    () =>
      targetPoints.map((target, index) => {
        const sourceIndex = index % 3;
        const axisAnchor = axisAnchors[sourceIndex];
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const radius = 0.95 + Math.random() * 1.1;

        return {
          target,
          start: [
            axisAnchor[0] + Math.sin(phi) * Math.cos(theta) * radius,
            axisAnchor[1] + Math.cos(phi) * radius,
            axisAnchor[2] + Math.sin(phi) * Math.sin(theta) * radius,
          ],
          sourceIndex,
          drift: [
            (Math.random() - 0.5) * 0.22,
            (Math.random() - 0.5) * 0.22,
            (Math.random() - 0.5) * 0.24,
          ],
        };
      }),
    [axisAnchors, targetPoints]
  );
  const positions = useMemo(() => new Float32Array(particles.length * 3), [particles.length]);
  const sourcePositions = useMemo(() => {
    const values = new Float32Array(axisAnchors.length * 3);
    axisAnchors.forEach((anchor, index) => {
      values[index * 3] = anchor[0];
      values[index * 3 + 1] = anchor[1];
      values[index * 3 + 2] = anchor[2];
    });
    return values;
  }, [axisAnchors]);

  useEffect(() => {
    startRef.current = active ? performance.now() : 0;
    revealRef.current = active ? 0 : 1;

    particles.forEach((particle, index) => {
      positions[index * 3] = offset[0] + particle.start[0];
      positions[index * 3 + 1] = offset[1] + particle.start[1];
      positions[index * 3 + 2] = offset[2] + particle.start[2];
    });
    if (pointsRef.current) {
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
    }
    if (sourceRef.current) {
      sourceRef.current.geometry.attributes.position.needsUpdate = true;
    }
  }, [active, particles, positions, revealRef, sourcePositions]);

  useFrame(() => {
    if (!pointsRef.current || !materialRef.current || !sourceMaterialRef.current) {
      return;
    }

    if (!active) {
      revealRef.current = 1;
      materialRef.current.opacity = 0;
      sourceMaterialRef.current.opacity = 0;
      return;
    }

    const progress = clamp((performance.now() - startRef.current) / 3150, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const reveal = clamp((progress - 0.54) / 0.34, 0, 1);
    revealRef.current = reveal;

    particles.forEach((particle, index) => {
      const swirl = (1 - eased) * 0.3;
      const orbital = (1 - eased) * 0.12;
      const axisBias =
        particle.sourceIndex === 0
          ? [1, 0.16, 0.16]
          : particle.sourceIndex === 1
            ? [0.16, 1, 0.16]
            : [0.16, 0.16, 1];
      positions[index * 3] =
        THREE.MathUtils.lerp(particle.start[0], offset[0] + particle.target[0], eased) +
        particle.drift[0] * swirl * axisBias[0] +
        Math.cos(index * 0.17 + progress * 6.5) * orbital;
      positions[index * 3 + 1] =
        THREE.MathUtils.lerp(particle.start[1], offset[1] + particle.target[1], eased) +
        particle.drift[1] * swirl * axisBias[1] +
        Math.sin(index * 0.13 + progress * 5.4) * orbital * 0.72;
      positions[index * 3 + 2] =
        THREE.MathUtils.lerp(particle.start[2], offset[2] + particle.target[2], eased) +
        particle.drift[2] * swirl * axisBias[2] +
        Math.sin(index * 0.11 + progress * 7.1) * orbital;
    });

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    materialRef.current.opacity =
      progress < 0.86 ? THREE.MathUtils.lerp(0.12, 0.46, progress / 0.86) : THREE.MathUtils.lerp(0.46, 0, (progress - 0.86) / 0.14);
    materialRef.current.size = THREE.MathUtils.lerp(0.011, 0.0054, eased);
    sourceMaterialRef.current.opacity =
      progress < 0.45 ? THREE.MathUtils.lerp(0.65, 0.18, progress / 0.45) : THREE.MathUtils.lerp(0.18, 0, (progress - 0.45) / 0.55);
    sourceMaterialRef.current.size = THREE.MathUtils.lerp(0.085, 0.024, progress);
  });

  if (!active) {
    return null;
  }

  return (
    <>
      <points ref={sourceRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[sourcePositions, 3]}
            count={axisAnchors.length}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          ref={sourceMaterialRef}
          color="#2f2bf6"
          size={0.085}
          sizeAttenuation
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </points>

      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
            count={particles.length}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          ref={materialRef}
          color="#2f2bf6"
          size={0.011}
          sizeAttenuation
          transparent
          opacity={0.2}
          depthWrite={false}
        />
      </points>
    </>
  );
}

export default function WordNode({ item, isSelected, isDimmed, onSelect, shouldBurst }) {
  const [hovered, setHovered] = useState(false);
  const labelRef = useRef(null);
  const groupRef = useRef(null);
  const revealRef = useRef(shouldBurst ? 0 : 1);
  const { camera } = useThree();

  const labelOffset = useMemo(() => {
    const seed = item.id.length + item.word.length;
    return [((seed % 7) - 3) * 0.06, 0.08 + (seed % 5) * 0.024, ((seed % 3) - 1) * 0.03];
  }, [item.id, item.word.length]);

  const hitWidth = useMemo(() => Math.max(1.18, item.word.length * 0.18 + 0.82), [item.word.length]);
  const hitHeight = 0.62;

  useFrame(() => {
    if (!labelRef.current || !groupRef.current) {
      return;
    }

    const worldPosition = new THREE.Vector3();
    groupRef.current.getWorldPosition(worldPosition);
    const distance = camera.position.distanceTo(worldPosition);
    const normalized = THREE.MathUtils.clamp((distance - 4.5) / 8.5, 0, 1);
    const perspectiveScale = THREE.MathUtils.lerp(1.18, 0.84, normalized);
    const perspectiveOpacity = THREE.MathUtils.lerp(1, 0.58, normalized);
    const emphasisScale = isSelected ? 1.08 : hovered ? 1.04 : 1;
    const dimming = isDimmed ? 0.35 : 1;
    const reveal = shouldBurst ? revealRef.current : 1;

    labelRef.current.style.setProperty('--label-depth-scale', `${perspectiveScale * emphasisScale}`);
    labelRef.current.style.setProperty('--label-depth-opacity', `${perspectiveOpacity * dimming}`);
    labelRef.current.style.setProperty('--label-reveal-opacity', `${reveal}`);
  });

  return (
    <group ref={groupRef} position={item.position}>
      <mesh
        position={labelOffset}
        scale={hovered || isSelected ? 1.3 : 1}
        onPointerEnter={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerLeave={() => setHovered(false)}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(item.id);
        }}
      >
        <planeGeometry args={[hitWidth, hitHeight]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <Html position={labelOffset} distanceFactor={10} style={{ pointerEvents: 'auto' }}>
        <div
          ref={labelRef}
          className={`word-label ${isSelected ? 'selected' : ''} ${isDimmed ? 'dimmed' : ''} ${hovered ? 'hovered' : ''}`}
          style={{ '--label-reveal-opacity': shouldBurst ? 0 : 1 }}
          onMouseEnter={(event) => {
            event.stopPropagation();
            setHovered(true);
          }}
          onMouseLeave={(event) => {
            event.stopPropagation();
            setHovered(false);
          }}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(item.id);
          }}
        >
          {item.word}
        </div>
      </Html>

      {(hovered || isSelected) && (
        <Html position={labelOffset} distanceFactor={9} style={{ pointerEvents: 'none' }}>
          <div className="word-tooltip word-tooltip-corner">
            <p className="tooltip-title">{item.word}</p>
            <div className="tooltip-scores">
              <p><span>Entity</span> {formatScore(item.scores.entity)}</p>
              <p><span>Medium</span> {formatScore(item.scores.medium)}</p>
              <p><span>Stability</span> {formatScore(item.scores.stability)}</p>
            </div>
            <p className="tooltip-explanation">{item.explanation}</p>
          </div>
        </Html>
      )}

      <ParticleAssemble
        position={item.position}
        offset={labelOffset}
        word={item.word}
        active={shouldBurst}
        revealRef={revealRef}
      />
    </group>
  );
}
