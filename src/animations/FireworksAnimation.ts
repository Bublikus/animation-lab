import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { AbstractAnimation } from '../core/AbstractAnimation';

interface Particle {
    mesh: THREE.Mesh;
    body: CANNON.Body;
    color: THREE.Color;
    lifetime: number;
    age: number;
    flickerSpeed: number;
    flickerIntensity: number;
    lastFlickerTime: number;
}

export class FireworksAnimation extends AbstractAnimation {
    private particles: Particle[] = [];
    private world: CANNON.World;
    private lastFireworkTime: number = 0;
    private fireworkInterval: number = 1500; // milliseconds between fireworks
    private lastColor: number | null = null;
    private colors: number[] = [
        0xff0000, // red
        0x00ff00, // green
        0x0000ff, // blue
        0xffff00, // yellow
        0xff00ff, // magenta
        0x00ffff, // cyan
        0xff8800, // orange
    ];
    private bounds: { left: number; right: number; top: number; bottom: number };

    constructor(scene: THREE.Scene) {
        super(scene);
        
        // Set bounds based on container size
        this.bounds = {
            left: -1,
            right: 1,
            top: 1,
            bottom: -1
        };
        
        // Setup physics world with reduced gravity
        this.world = new CANNON.World({
            gravity: new CANNON.Vec3(0, -4.91, 0) // Half of Earth gravity
        });

        // Create walls
        const wallThickness = 0.1;
        const wallMaterial = new CANNON.Material('wallMaterial');
        const particleMaterial = new CANNON.Material('particleMaterial');
        
        // Create contact material for bouncy collisions
        const contactMaterial = new CANNON.ContactMaterial(
            wallMaterial,
            particleMaterial,
            {
                friction: 0.3,
                restitution: 0.7 // Bouncy collisions
            }
        );
        this.world.addContactMaterial(contactMaterial);
        
        // Left wall
        const leftWall = new CANNON.Body({
            mass: 0,
            shape: new CANNON.Box(new CANNON.Vec3(wallThickness, 2, 0.1)),
            position: new CANNON.Vec3(this.bounds.left - wallThickness, 0, 0),
            material: wallMaterial,
            collisionFilterGroup: 4, // Group 4 for walls
            collisionFilterMask: -1  // Collide with everything
        });
        this.world.addBody(leftWall);

        // Right wall
        const rightWall = new CANNON.Body({
            mass: 0,
            shape: new CANNON.Box(new CANNON.Vec3(wallThickness, 2, 0.1)),
            position: new CANNON.Vec3(this.bounds.right + wallThickness, 0, 0),
            material: wallMaterial,
            collisionFilterGroup: 4, // Group 4 for walls
            collisionFilterMask: -1  // Collide with everything
        });
        this.world.addBody(rightWall);

        // Top wall
        const topWall = new CANNON.Body({
            mass: 0,
            shape: new CANNON.Box(new CANNON.Vec3(2, wallThickness, 0.1)),
            position: new CANNON.Vec3(0, this.bounds.top + wallThickness, 0),
            material: wallMaterial,
            collisionFilterGroup: 4, // Group 4 for walls
            collisionFilterMask: -1  // Collide with everything
        });
        this.world.addBody(topWall);

        // Bottom wall
        const bottomWall = new CANNON.Body({
            mass: 0,
            shape: new CANNON.Box(new CANNON.Vec3(2, wallThickness, 0.1)),
            position: new CANNON.Vec3(0, this.bounds.bottom - wallThickness, 0),
            material: wallMaterial,
            collisionFilterGroup: 4, // Group 4 for walls
            collisionFilterMask: -1  // Collide with everything
        });
        this.world.addBody(bottomWall);
    }

    private createParticle(color: number, position: THREE.Vector3, velocity: THREE.Vector3, isMainParticle: boolean = false): Particle {
        const size = 0.02;
        const geometry = new THREE.SphereGeometry(size, 8, 8);
        const material = new THREE.MeshBasicMaterial({ 
            color: color,
            transparent: true,
            opacity: 1
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        this.scene.add(mesh);

        // Create physics body
        const shape = new CANNON.Sphere(size);
        const body = new CANNON.Body({
            mass: 0.1,
            shape: shape,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            velocity: new CANNON.Vec3(velocity.x, velocity.y, velocity.z),
            linearDamping: 0.01,
            material: new CANNON.Material('particleMaterial')
        });

        // Set collision filter for main particle
        if (isMainParticle) {
            body.collisionFilterGroup = 2; // Group 2 for main particle
            body.collisionFilterMask = 4;  // Only collide with walls (group 4)
        } else {
            body.collisionFilterGroup = 1; // Group 1 for explosion particles
            body.collisionFilterMask = -1; // Collide with everything
        }

        this.world.addBody(body);

        return {
            mesh,
            body,
            color: new THREE.Color(color),
            lifetime: 3 + Math.random() * 2,
            age: 0,
            flickerSpeed: 0.1 + Math.random() * 0.2, // Random flicker speed
            flickerIntensity: 0.2 + Math.random() * 0.3, // Random flicker intensity
            lastFlickerTime: 0
        };
    }

    private launchFirework() {
        // Select a color different from the last one
        let availableColors = this.colors.filter(color => color !== this.lastColor);
        const color = availableColors[Math.floor(Math.random() * availableColors.length)];
        this.lastColor = color;

        const position = new THREE.Vector3(0, this.bounds.bottom, 0);
        const initialVelocity = 4.5 + Math.random() * 0.5;
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.3,
            initialVelocity,
            0
        );

        const mainParticle = this.createParticle(color, position, velocity, true);
        this.particles.push(mainParticle);

        // Calculate time to reach peak height (when vertical velocity becomes 0)
        // v = v0 + at
        // 0 = initialVelocity + (-gravity) * t
        // t = initialVelocity / gravity
        const gravity = 4.91; // Half of Earth gravity
        const timeToPeak = initialVelocity / gravity;
        
        // Explode even earlier (was 0.6, now 0.42)
        const explosionDelay = (timeToPeak * 0.42) * 1000; // Convert to milliseconds

        setTimeout(() => {
            this.explode(mainParticle);
        }, explosionDelay);
    }

    private explode(particle: Particle) {
        const numParticles = 30 + Math.floor(Math.random() * 20);
        const position = new THREE.Vector3().copy(particle.mesh.position);

        this.removeParticle(particle);

        for (let i = 0; i < numParticles; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.3 + Math.random() * 0.3; // Reduced speed

            const velocity = new THREE.Vector3(
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                0
            );

            const explosionParticle = this.createParticle(
                particle.color.getHex(),
                position,
                velocity
            );
            this.particles.push(explosionParticle);
        }
    }

    private removeParticle(particle: Particle) {
        this.scene.remove(particle.mesh);
        this.world.removeBody(particle.body);
        particle.mesh.geometry.dispose();
        (particle.mesh.material as THREE.Material).dispose();
        this.particles = this.particles.filter(p => p !== particle);
    }

    update() {
        const currentTime = Date.now();
        if (currentTime - this.lastFireworkTime > this.fireworkInterval) {
            this.launchFirework();
            this.lastFireworkTime = currentTime;
        }

        // Update physics with smaller time step for more accuracy
        this.world.step(1/120);

        this.particles.forEach(particle => {
            particle.mesh.position.copy(particle.body.position as any);
            
            particle.age += 1/60;
            const progress = particle.age / particle.lifetime;
            
            // Calculate base opacity from lifetime
            const baseOpacity = 1 - progress;
            
            // Add flickering effect
            const timeSinceLastFlicker = currentTime - particle.lastFlickerTime;
            if (timeSinceLastFlicker > 1000 / 60) { // Update at 60fps
                const flicker = Math.sin(currentTime * particle.flickerSpeed) * particle.flickerIntensity;
                const opacity = Math.max(0, Math.min(1, baseOpacity + flicker));
                (particle.mesh.material as THREE.MeshBasicMaterial).opacity = opacity;
                particle.lastFlickerTime = currentTime;
            }

            if (particle.age >= particle.lifetime) {
                this.removeParticle(particle);
            }
        });
    }

    dispose() {
        this.particles.forEach(particle => this.removeParticle(particle));
    }
} 