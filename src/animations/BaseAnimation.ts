import * as THREE from 'three';

export abstract class BaseAnimation {
    protected scene: THREE.Scene;
    protected time: number = 0;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    abstract update(): void;
    abstract dispose(): void;
} 