import * as THREE from 'three';
import { AbstractAnimation } from '../core/AbstractAnimation';

interface GridSquare {
    group: THREE.Group;
    mesh: THREE.Mesh;
    cornerGroup: THREE.Group; // Group containing both lines
    line1: THREE.Mesh;
    line2: THREE.Mesh;
    row: number;
    col: number;
    direction: number; // 0: up-right, 1: right-down, 2: down-left, 3: left-up
    targetRotation?: number; // For smooth animation
}

export class GridPuzzleAnimation extends AbstractAnimation {
    private readonly GRID_SIZE = 10;
    private SQUARE_SIZE!: number; // Will be set dynamically
    private squares: GridSquare[][] = [];
    private gridGroup: THREE.Group;
    private readonly LINE_COLOR = 0x000000;
    private readonly BG_COLOR = 0xffffff;
    private offset: number = 0; // Will be set dynamically

    constructor(scene: THREE.Scene) {
        super(scene);
        this.gridGroup = new THREE.Group();
        this.scene.add(this.gridGroup);
        this.updateGridSizeAndOffset();
        this.createGrid();
    }

    private updateGridSizeAndOffset() {
        // Get camera from scene.userData (set in main.ts) or fallback to default
        // We'll assume camera is always orthographic and covers [-aspect, aspect] x [-1, 1]
        // Find the current camera bounds
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
        // Use the minimum of width and height to keep the grid square and as large as possible
        const width = right - left;
        const height = top - bottom;
        const gridWorldSize = Math.min(width, height);
        this.SQUARE_SIZE = gridWorldSize / this.GRID_SIZE;
        // Center the grid
        this.offset = -this.SQUARE_SIZE * this.GRID_SIZE / 2 + this.SQUARE_SIZE / 2;
    }

    private createGrid() {
        for (let row = 0; row < this.GRID_SIZE; row++) {
            this.squares[row] = [];
            for (let col = 0; col < this.GRID_SIZE; col++) {
                const group = new THREE.Group();
                const x = this.offset + col * this.SQUARE_SIZE;
                const y = this.offset + row * this.SQUARE_SIZE;
                group.position.set(x, y, 0);

                // Square background
                const geometry = new THREE.PlaneGeometry(this.SQUARE_SIZE * 0.98, this.SQUARE_SIZE * 0.98);
                const material = new THREE.MeshBasicMaterial({ color: this.BG_COLOR });
                const mesh = new THREE.Mesh(geometry, material);
                group.add(mesh);

                // Corner (two lines in a group, forming an L/corner)
                const cornerGroup = new THREE.Group();
                const line1 = this.createLine(0);
                const line2 = this.createLine(Math.PI / 2);
                cornerGroup.add(line1);
                cornerGroup.add(line2);
                // Random initial direction
                const initialDirection = Math.floor(Math.random() * 4);
                cornerGroup.rotation.z = initialDirection * (Math.PI / 2);

                group.add(cornerGroup);

                this.gridGroup.add(group);
                this.squares[row][col] = {
                    group,
                    mesh,
                    cornerGroup,
                    line1,
                    line2,
                    row,
                    col,
                    direction: initialDirection // random start
                };
            }
        }
    }

    private createLine(angle: number): THREE.Mesh {
        // The line should go from the center to the edge of the square
        const margin = this.SQUARE_SIZE * 0.01;
        const thickness = this.SQUARE_SIZE * 0.15; // Make it visually thick
        // Increase length so that after shifting, the line reaches the edge
        const length = (this.SQUARE_SIZE / 2) + (thickness / 2) - margin;
        // Create geometry with origin at (0,0) and extends to (0,length)
        const geometry = new THREE.PlaneGeometry(thickness, length);
        geometry.translate(0, length / 2 - thickness / 2, 0); // Shift start in the opposite direction
        const material = new THREE.MeshBasicMaterial({ color: this.LINE_COLOR });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(0, 0, 0.01);
        mesh.rotation.z = angle;
        return mesh;
    }

    private setLineDirection(square: GridSquare, direction: number) {
        // 0: up-right, 1: right-down, 2: down-left, 3: left-up
        square.direction = direction;
        square.targetRotation = direction * (Math.PI / 2);
    }

    update() {
        // On each update, check if the camera size has changed and update grid if needed
        this.updateGridSizeAndOffset();
        // Update positions and sizes
        for (let row = 0; row < this.GRID_SIZE; row++) {
            for (let col = 0; col < this.GRID_SIZE; col++) {
                const square = this.squares[row][col];
                const x = this.offset + col * this.SQUARE_SIZE;
                const y = this.offset + row * this.SQUARE_SIZE;
                square.group.position.set(x, y, 0);
                // Update background size
                square.mesh.geometry.dispose();
                square.mesh.geometry = new THREE.PlaneGeometry(this.SQUARE_SIZE * 0.98, this.SQUARE_SIZE * 0.98);
                // Update lines
                square.line1.geometry.dispose();
                square.line1.geometry = new THREE.PlaneGeometry(this.SQUARE_SIZE * 0.15, (this.SQUARE_SIZE / 2) + (this.SQUARE_SIZE * 0.15 / 2) - (this.SQUARE_SIZE * 0.01));
                square.line1.geometry.translate(0, ((this.SQUARE_SIZE / 2) + (this.SQUARE_SIZE * 0.15 / 2) - (this.SQUARE_SIZE * 0.01)) / 2 - (this.SQUARE_SIZE * 0.15) / 2, 0);
                square.line2.geometry.dispose();
                square.line2.geometry = new THREE.PlaneGeometry(this.SQUARE_SIZE * 0.15, (this.SQUARE_SIZE / 2) + (this.SQUARE_SIZE * 0.15 / 2) - (this.SQUARE_SIZE * 0.01));
                square.line2.geometry.translate(0, ((this.SQUARE_SIZE / 2) + (this.SQUARE_SIZE * 0.15 / 2) - (this.SQUARE_SIZE * 0.01)) / 2 - (this.SQUARE_SIZE * 0.15) / 2, 0);
            }
        }
        // For each square, with a small probability, trigger a new rotation if not already rotating
        for (let row = 0; row < this.GRID_SIZE; row++) {
            for (let col = 0; col < this.GRID_SIZE; col++) {
                const square = this.squares[row][col];
                // Check if the square is not currently rotating
                let current = square.cornerGroup.rotation.z % (2 * Math.PI);
                if (current < 0) current += 2 * Math.PI;
                let target = (square.targetRotation ?? square.direction * (Math.PI / 2)) % (2 * Math.PI);
                if (target < 0) target += 2 * Math.PI;
                if (Math.abs(current - target) < 0.01) {
                    // With a small probability, trigger a new rotation
                    if (Math.random() < 0.005) { // ~0.5% chance per frame per square
                        let newDir = (square.direction + 1 + Math.floor(Math.random() * 3)) % 4;
                        this.setLineDirection(square, newDir);
                    }
                }
            }
        }
        // Animate rotation for all squares
        for (let row = 0; row < this.GRID_SIZE; row++) {
            for (let col = 0; col < this.GRID_SIZE; col++) {
                const square = this.squares[row][col];
                if (square.targetRotation === undefined) continue;
                // Normalize current and target rotation to [0, 2PI)
                let current = square.cornerGroup.rotation.z % (2 * Math.PI);
                if (current < 0) current += 2 * Math.PI;
                let target = square.targetRotation % (2 * Math.PI);
                if (target < 0) target += 2 * Math.PI;
                // Find shortest direction
                let delta = target - current;
                if (delta > Math.PI) delta -= 2 * Math.PI;
                if (delta < -Math.PI) delta += 2 * Math.PI;
                // Animate
                const speed = 0.15; // radians per frame
                if (Math.abs(delta) < 0.01) {
                    square.cornerGroup.rotation.z = target;
                } else {
                    square.cornerGroup.rotation.z += Math.sign(delta) * Math.min(Math.abs(delta), speed);
                }
            }
        }
    }

    dispose() {
        this.gridGroup.removeFromParent();
        this.gridGroup.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
                obj.geometry.dispose();
                (obj.material as THREE.Material).dispose();
            } else if (obj instanceof THREE.Line) {
                obj.geometry.dispose();
                (obj.material as THREE.Material).dispose();
            }
        });
        this.squares = [];
    }
}
