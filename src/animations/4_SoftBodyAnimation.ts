import * as THREE from 'three';
import { AbstractAnimation } from '../core/AbstractAnimation';
import Ammo from 'ammojs-typed';

export class SoftBodyAnimation extends AbstractAnimation {
    private physicsWorld: Ammo.btSoftRigidDynamicsWorld | null = null;
    private ammoModule: typeof Ammo | null = null;

    constructor(scene: THREE.Scene) {
        super(scene);
        this.initPhysics();
    }

    private async initPhysics() {
        try {
            // Initialize Ammo.js
            // @ts-ignore
            this.ammoModule = (await new Ammo()) as typeof Ammo;
            
            // Configure physics world
            const collisionConfiguration = new this.ammoModule.btSoftBodyRigidBodyCollisionConfiguration();
            const dispatcher = new this.ammoModule.btCollisionDispatcher(collisionConfiguration);
            const broadphase = new this.ammoModule.btDbvtBroadphase();
            const solver = new this.ammoModule.btSequentialImpulseConstraintSolver();
            const softBodySolver = new this.ammoModule.btDefaultSoftBodySolver();

            // Create the physics world
            this.physicsWorld = new this.ammoModule.btSoftRigidDynamicsWorld(
                dispatcher,
                broadphase,
                solver,
                collisionConfiguration,
                softBodySolver
            );

            // Set gravity
            const gravity = new this.ammoModule.btVector3(0, -9.81, 0);
            this.physicsWorld.setGravity(gravity);

            console.log('Ammo.js physics initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Ammo.js physics:', error);
        }
    }

    update() {
        if (this.physicsWorld) {
            // Step the physics world
            this.physicsWorld.stepSimulation(1 / 60, 10);
        }
    }

    dispose() {
        // Clean up Ammo.js resources
        if (this.physicsWorld) {
            // Note: Ammo.js doesn't provide direct disposal methods
            // We set references to null to allow garbage collection
            this.physicsWorld = null;
            this.ammoModule = null;
        }
    }
} 