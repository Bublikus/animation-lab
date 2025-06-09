import * as THREE from 'three';
import { AbstractAnimation } from '../core/AbstractAnimation';

interface FlyingParticle {
    mesh: THREE.Mesh;
    tail: THREE.Line;
    color: THREE.Color;
    speed: number;
    amplitude: number;
    phase: number;
    tailPositions: THREE.Vector3[];
    angleOffset: number;
}

export class FlyingParticlesAnimation extends AbstractAnimation {
    private particles: FlyingParticle[] = [];
    private readonly PARTICLE_COUNT = 15;
    private readonly TAIL_LENGTH = 40;
    private bounds: { left: number; right: number; top: number; bottom: number } = { left: -1, right: 1, top: 1, bottom: -1 };
    private group: THREE.Group;
    private colors: number[] = [
        0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xff8800, 0xffffff, 0x8888ff, 0xff8888
    ];

    constructor(scene: THREE.Scene) {
        super(scene);
        this.group = new THREE.Group();
        this.scene.add(this.group);
        this.updateBounds();
        this.createParticles();
    }

    private updateBounds() {
        // Try to get camera bounds from scene.userData or fallback
        let left = -1, right = 1, top = 1, bottom = -1;
        if ((this.scene as any).userData && (this.scene as any).userData.camera) {
            const camera = (this.scene as any).userData.camera;
            left = camera.left;
            right = camera.right;
            top = camera.top;
            bottom = camera.bottom;
        } else if ((window as any).appCamera) {
            const camera = (window as any).appCamera;
            left = camera.left;
            right = camera.right;
            top = camera.top;
            bottom = camera.bottom;
        } else if (window.innerWidth && window.innerHeight) {
            const aspect = window.innerWidth / window.innerHeight;
            if (aspect > 1) {
                left = -aspect;
                right = aspect;
                top = 1;
                bottom = -1;
            } else {
                left = -1;
                right = 1;
                top = 1 / aspect;
                bottom = -1 / aspect;
            }
        }
        this.bounds = { left, right, top, bottom };
    }

    private createParticles() {
        const radius = Math.min(
            (this.bounds.right - this.bounds.left),
            (this.bounds.top - this.bounds.bottom)
        ) * 0.4;
        for (let i = 0; i < this.PARTICLE_COUNT; i++) {
            const color = new THREE.Color(this.colors[i % this.colors.length]);
            const speed = 0.1 + Math.random() * 0.05;
            const amplitude = 0.05 + Math.random() * 0.1;
            const phase = Math.random() * Math.PI * 2;
            const angleOffset = (i / this.PARTICLE_COUNT) * Math.PI * 2;

            // Calculate initial position for this particle
            const cx = (this.bounds.left + this.bounds.right) / 2;
            const cy = (this.bounds.top + this.bounds.bottom) / 2;
            const initialWave = Math.sin(phase + angleOffset * 2) * amplitude;
            const initialX = cx + Math.cos(angleOffset) * (radius + initialWave);
            const initialY = cy + Math.sin(angleOffset) * (radius + initialWave);
            const initialPos = new THREE.Vector3(initialX, initialY, 0);

            // Particle mesh
            const geometry = new THREE.SphereGeometry(0.03, 12, 12);
            const material = new THREE.MeshBasicMaterial({ color });
            const mesh = new THREE.Mesh(geometry, material);
            this.group.add(mesh);

            // Tail geometry - initialize all positions to the particle's starting position
            const tailPositions = Array.from({ length: this.TAIL_LENGTH }, () => initialPos.clone());
            const tailGeometry = new THREE.BufferGeometry().setFromPoints(tailPositions);
            // Enable vertex colors for fading effect
            const tailMaterial = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, vertexColors: true });
            const tail = new THREE.Line(tailGeometry, tailMaterial);
            this.group.add(tail);

            this.particles.push({
                mesh,
                tail,
                color,
                speed,
                amplitude,
                phase,
                tailPositions,
                angleOffset
            });
        }
    }

    update() {
        this.updateBounds();
        this.time += 1 / 60;
        const cx = (this.bounds.left + this.bounds.right) / 2;
        const cy = (this.bounds.top + this.bounds.bottom) / 2;
        const radius = Math.min(
            (this.bounds.right - this.bounds.left),
            (this.bounds.top - this.bounds.bottom)
        ) * 0.4;

        for (const p of this.particles) {
            // Angle for circular motion
            const angle = p.angleOffset + this.time * p.speed * Math.PI * 2;
            // Wavy offset
            const wave = Math.sin(this.time * 2 + p.phase + p.angleOffset * 2) * p.amplitude;
            // Position on circle with wavy offset
            const x = cx + Math.cos(angle) * (radius + wave);
            const y = cy + Math.sin(angle) * (radius + wave);
            p.mesh.position.set(x, y, 0);

            // Update tail positions
            p.tailPositions.unshift(new THREE.Vector3(x, y, 0));
            if (p.tailPositions.length > this.TAIL_LENGTH) p.tailPositions.pop();
            (p.tail.geometry as THREE.BufferGeometry).setFromPoints(p.tailPositions);
            // Add fading effect using vertex colors
            const colors = [];
            for (let i = 0; i < p.tailPositions.length; i++) {
                const t = i / (this.TAIL_LENGTH - 1);
                const alpha = 1 - t;
                colors.push(p.color.r, p.color.g, p.color.b, alpha);
            }
            // Set color attribute (RGBA)
            const colorAttr = new Float32Array(colors);
            (p.tail.geometry as THREE.BufferGeometry).setAttribute('color', new THREE.BufferAttribute(colorAttr, 4));
        }
    }

    dispose() {
        this.group.removeFromParent();
        this.group.traverse((obj: THREE.Object3D) => {
            if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
                obj.geometry.dispose();
                (obj.material as THREE.Material).dispose();
            }
        });
        this.particles = [];
    }
}
