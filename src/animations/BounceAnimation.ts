import * as THREE from 'three';
import { AbstractAnimation } from '../core/AbstractAnimation';

interface Ball {
    mesh: THREE.Mesh;
    velocity: THREE.Vector2;
    position: THREE.Vector2;
    radius: number;
    mass: number;
    rotationSpeed: THREE.Vector3;
}

export class BounceAnimation extends AbstractAnimation {
    private balls: Ball[];
    private bounds: { left: number; right: number; top: number; bottom: number };

    constructor(scene: THREE.Scene) {
        super(scene);
        
        // Set bounds based on camera view
        this.bounds = {
            left: -1,
            right: 1,
            top: 1,
            bottom: -1
        };

        // Create multiple balls with different properties
        this.balls = [
            this.createBall(0xff0000, 0.1, new THREE.Vector2(0.01, 0.01)), // Red
            this.createBall(0x00ff00, 0.08, new THREE.Vector2(-0.015, 0.008)), // Green
            this.createBall(0x0000ff, 0.12, new THREE.Vector2(0.008, -0.012)), // Blue
            this.createBall(0xffff00, 0.09, new THREE.Vector2(-0.01, -0.01)), // Yellow
            this.createBall(0xff00ff, 0.11, new THREE.Vector2(0.012, 0.015)) // Magenta
        ];

        // Set random initial positions
        this.balls.forEach(ball => {
            ball.position.set(
                (Math.random() * 2 - 1) * 0.8,
                (Math.random() * 2 - 1) * 0.8,
            );
        });
    }

    private createBall(color: number, radius: number, velocity: THREE.Vector2): Ball {
        const geometry = new THREE.SphereGeometry(radius, 8, 8);
        const material = new THREE.MeshBasicMaterial({ 
            color: color,
            wireframe: true
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        this.scene.add(mesh);

        return {
            mesh,
            velocity,
            position: new THREE.Vector2(0, 0),
            radius,
            mass: radius * radius, // Mass proportional to area
            rotationSpeed: new THREE.Vector3(
                (Math.random() - 0.5) * 0.02,
                (Math.random() - 0.5) * 0.02,
                (Math.random() - 0.5) * 0.02
            )
        };
    }

    private checkBallCollision(ball1: Ball, ball2: Ball): boolean {
        const distance = ball1.position.distanceTo(ball2.position);
        return distance < (ball1.radius + ball2.radius);
    }

    private resolveBallCollision(ball1: Ball, ball2: Ball) {
        // Calculate collision normal
        const normal = new THREE.Vector2().subVectors(ball2.position, ball1.position).normalize();
        
        // Calculate relative velocity
        const relativeVelocity = new THREE.Vector2().subVectors(ball2.velocity, ball1.velocity);
        
        // Calculate relative velocity in terms of the normal direction
        const velocityAlongNormal = relativeVelocity.dot(normal);
        
        // Do not resolve if velocities are separating
        if (velocityAlongNormal > 0) return;
        
        // Calculate restitution (bounciness)
        const restitution = 1.0;
        
        // Calculate impulse scalar
        const j = -(1 + restitution) * velocityAlongNormal;
        const impulse = j / (1/ball1.mass + 1/ball2.mass);
        
        // Apply impulse
        const impulseVec = normal.clone().multiplyScalar(impulse);
        ball1.velocity.sub(impulseVec.clone().multiplyScalar(1/ball1.mass));
        ball2.velocity.add(impulseVec.clone().multiplyScalar(1/ball2.mass));
        
        // Prevent balls from sticking together
        const overlap = (ball1.radius + ball2.radius) - ball1.position.distanceTo(ball2.position);
        if (overlap > 0) {
            const correction = normal.clone().multiplyScalar(overlap * 0.5);
            ball1.position.sub(correction);
            ball2.position.add(correction);
        }
    }

    update() {
        // Update positions and rotations
        this.balls.forEach(ball => {
            ball.position.add(ball.velocity);
            ball.mesh.rotation.x += ball.rotationSpeed.x;
            ball.mesh.rotation.y += ball.rotationSpeed.y;
            ball.mesh.rotation.z += ball.rotationSpeed.z;
        });

        // Check and resolve ball collisions
        for (let i = 0; i < this.balls.length; i++) {
            for (let j = i + 1; j < this.balls.length; j++) {
                if (this.checkBallCollision(this.balls[i], this.balls[j])) {
                    this.resolveBallCollision(this.balls[i], this.balls[j]);
                }
            }
        }

        // Check wall collisions
        this.balls.forEach(ball => {
            if (ball.position.x + ball.radius > this.bounds.right) {
                ball.position.x = this.bounds.right - ball.radius;
                ball.velocity.x *= -1;
            } else if (ball.position.x - ball.radius < this.bounds.left) {
                ball.position.x = this.bounds.left + ball.radius;
                ball.velocity.x *= -1;
            }

            if (ball.position.y + ball.radius > this.bounds.top) {
                ball.position.y = this.bounds.top - ball.radius;
                ball.velocity.y *= -1;
            } else if (ball.position.y - ball.radius < this.bounds.bottom) {
                ball.position.y = this.bounds.bottom + ball.radius;
                ball.velocity.y *= -1;
            }

            // Update ball position
            ball.mesh.position.set(ball.position.x, ball.position.y, 0);
        });
    }

    dispose() {
        this.balls.forEach(ball => {
            ball.mesh.geometry.dispose();
            (ball.mesh.material as THREE.Material).dispose();
            ball.mesh.parent?.remove(ball.mesh);
        });
    }
} 