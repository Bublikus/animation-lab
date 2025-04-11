import * as THREE from 'three';
import { AbstractAnimation } from '../core/AbstractAnimation';

interface Ball {
    mesh: THREE.Mesh;
    velocity: THREE.Vector2;
    position: THREE.Vector2;
    radius: number;
    mass: number;
}

interface Edge {
    start: THREE.Vector2;
    end: THREE.Vector2;
    normal: THREE.Vector2;
    mesh: THREE.Line;
}

export class PentagonRotationAnimation extends AbstractAnimation {
    private pentagon: THREE.Group;
    private edges: Edge[];
    private balls: Ball[];
    private rotationSpeed: number = 0.01;
    private readonly PENTAGON_RADIUS = 0.8;
    private readonly BALL_COUNT = 20;
    private readonly BALL_RADIUS = 0.03;
    private readonly GRAVITY = 0.0005;

    constructor(scene: THREE.Scene) {
        super(scene);
        
        // Create pentagon group
        this.pentagon = new THREE.Group();
        this.scene.add(this.pentagon);

        // Create pentagon edges
        this.edges = this.createPentagonEdges();
        
        // Create balls
        this.balls = this.createBalls();
    }

    private createPentagonEdges(): Edge[] {
        const edges: Edge[] = [];
        const points: THREE.Vector2[] = [];
        
        // Calculate pentagon vertices
        for (let i = 0; i < 5; i++) {
            const angle = (i * 2 * Math.PI / 5) - Math.PI / 2;
            const x = Math.cos(angle) * this.PENTAGON_RADIUS;
            const y = Math.sin(angle) * this.PENTAGON_RADIUS;
            points.push(new THREE.Vector2(x, y));
        }

        // Create edges
        for (let i = 0; i < 5; i++) {
            const start = points[i];
            const end = points[(i + 1) % 5];
            
            // Calculate edge normal (perpendicular to the edge, pointing inward)
            const edgeVector = new THREE.Vector2().subVectors(end, start);
            const normal = new THREE.Vector2(-edgeVector.y, edgeVector.x).normalize();
            
            // Create line geometry
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(start.x, start.y, 0),
                new THREE.Vector3(end.x, end.y, 0)
            ]);
            
            const material = new THREE.LineBasicMaterial({ color: 0xffffff });
            const line = new THREE.Line(geometry, material);
            this.pentagon.add(line);
            
            edges.push({ start, end, normal, mesh: line });
        }

        return edges;
    }

    private createBalls(): Ball[] {
        const balls: Ball[] = [];
        
        for (let i = 0; i < this.BALL_COUNT; i++) {
            // Create random position inside pentagon
            let position: THREE.Vector2;
            do {
                const angle = Math.random() * 2 * Math.PI;
                const radius = Math.random() * (this.PENTAGON_RADIUS * 0.8);
                position = new THREE.Vector2(
                    Math.cos(angle) * radius,
                    Math.sin(angle) * radius
                );
            } while (!this.isPointInsidePentagon(position));

            // Create ball mesh
            const geometry = new THREE.SphereGeometry(this.BALL_RADIUS, 16, 16);
            const material = new THREE.MeshBasicMaterial({ 
                color: new THREE.Color().setHSL(Math.random(), 1, 0.5)
            });
            const mesh = new THREE.Mesh(geometry, material);
            this.scene.add(mesh);

            // Set random initial velocity
            const velocity = new THREE.Vector2(
                (Math.random() - 0.5) * 0.03,
                (Math.random() - 0.5) * 0.03
            );

            balls.push({
                mesh,
                velocity,
                position,
                radius: this.BALL_RADIUS,
                mass: this.BALL_RADIUS * this.BALL_RADIUS
            });
        }

        return balls;
    }

    private isPointInsidePentagon(point: THREE.Vector2): boolean {
        // Check if point is inside pentagon using ray casting
        let inside = false;
        for (let i = 0, j = this.edges.length - 1; i < this.edges.length; j = i++) {
            const xi = this.edges[i].start.x, yi = this.edges[i].start.y;
            const xj = this.edges[j].start.x, yj = this.edges[j].start.y;
            
            const intersect = ((yi > point.y) !== (yj > point.y))
                && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    private checkBallEdgeCollision(ball: Ball, edge: Edge): boolean {
        // Transform ball position to pentagon's local space
        const pentagonRotation = this.pentagon.rotation.z;
        const cos = Math.cos(-pentagonRotation);
        const sin = Math.sin(-pentagonRotation);
        
        const localX = ball.position.x * cos - ball.position.y * sin;
        const localY = ball.position.x * sin + ball.position.y * cos;
        const localPosition = new THREE.Vector2(localX, localY);
        
        // Project local position onto edge
        const edgeVector = new THREE.Vector2().subVectors(edge.end, edge.start);
        const ballToStart = new THREE.Vector2().subVectors(localPosition, edge.start);
        
        const edgeLength = edgeVector.length();
        const projection = ballToStart.dot(edgeVector) / edgeLength;
        
        // Check if projection is within edge bounds
        if (projection < 0 || projection > edgeLength) return false;
        
        // Calculate distance from ball to edge
        const closestPoint = new THREE.Vector2()
            .copy(edge.start)
            .add(edgeVector.clone().multiplyScalar(projection / edgeLength));
        
        const distance = localPosition.distanceTo(closestPoint);
        return distance < ball.radius;
    }

    private resolveBallEdgeCollision(ball: Ball, edge: Edge) {
        // Transform ball velocity to pentagon's local space
        const pentagonRotation = this.pentagon.rotation.z;
        const cos = Math.cos(-pentagonRotation);
        const sin = Math.sin(-pentagonRotation);
        
        const localVx = ball.velocity.x * cos - ball.velocity.y * sin;
        const localVy = ball.velocity.x * sin + ball.velocity.y * cos;
        const localVelocity = new THREE.Vector2(localVx, localVy);
        
        // Reflect velocity using edge normal
        const dot = localVelocity.dot(edge.normal);
        localVelocity.sub(edge.normal.clone().multiplyScalar(2 * dot));
        
        // Transform back to world space
        ball.velocity.x = localVelocity.x * cos + localVelocity.y * sin;
        ball.velocity.y = -localVelocity.x * sin + localVelocity.y * cos;
        
        // Move ball outside edge to prevent sticking
        const correction = edge.normal.clone().multiplyScalar(ball.radius);
        // Transform correction to world space
        const worldCorrectionX = correction.x * cos + correction.y * sin;
        const worldCorrectionY = -correction.x * sin + correction.y * cos;
        ball.position.add(new THREE.Vector2(worldCorrectionX, worldCorrectionY));
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
        const restitution = 0.95;
        
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
        // Rotate pentagon
        this.pentagon.rotation.z += this.rotationSpeed;
        
        // Update ball positions and check collisions
        this.balls.forEach(ball => {
            // Apply gravity
            ball.velocity.y -= this.GRAVITY;
            
            // Update position
            ball.position.add(ball.velocity);
            ball.mesh.position.set(ball.position.x, ball.position.y, 0);
            
            // Check edge collisions
            this.edges.forEach(edge => {
                if (this.checkBallEdgeCollision(ball, edge)) {
                    this.resolveBallEdgeCollision(ball, edge);
                }
            });
        });

        // Check ball-ball collisions
        for (let i = 0; i < this.balls.length; i++) {
            for (let j = i + 1; j < this.balls.length; j++) {
                if (this.checkBallCollision(this.balls[i], this.balls[j])) {
                    this.resolveBallCollision(this.balls[i], this.balls[j]);
                }
            }
        }
    }

    dispose() {
        // Remove pentagon
        this.pentagon.removeFromParent();
        this.pentagon.traverse((object) => {
            if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
                object.geometry.dispose();
                (object.material as THREE.Material).dispose();
            }
        });

        // Remove balls
        this.balls.forEach(ball => {
            ball.mesh.geometry.dispose();
            (ball.mesh.material as THREE.Material).dispose();
            ball.mesh.parent?.remove(ball.mesh);
        });
    }
} 