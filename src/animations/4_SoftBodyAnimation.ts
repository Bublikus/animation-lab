import * as THREE from 'three';
import { AbstractAnimation } from '../core/AbstractAnimation';
import Ammo from 'ammojs-typed';

export class SoftBodyAnimation extends AbstractAnimation {
    private physicsWorld: Ammo.btSoftRigidDynamicsWorld | null = null;
    private ammoModule: typeof Ammo | null = null;
    private softBodies: THREE.Mesh[] = [];
    private rigidBodies: THREE.Mesh[] = [];
    private transformAux1: Ammo.btTransform | null = null;
    private softBodyHelpers: Ammo.btSoftBodyHelpers | null = null;
    private margin = 0.05;
    private clock: THREE.Clock;

    constructor(scene: THREE.Scene) {
        super(scene);
        this.clock = new THREE.Clock();
        this.scene.background = new THREE.Color(0x2c2c2c);
        this.setupLights();
        this.initPhysics();
    }

    private setupLights() {
        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        // Add directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(0.5, 1, 0.75);
        directionalLight.castShadow = true;
        
        // Adjust shadow properties for better quality
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        directionalLight.shadow.camera.near = 0.1;
        directionalLight.shadow.camera.far = 5;
        directionalLight.shadow.camera.left = -1;
        directionalLight.shadow.camera.right = 1;
        directionalLight.shadow.camera.top = 1;
        directionalLight.shadow.camera.bottom = -1;
        
        this.scene.add(directionalLight);
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
            this.physicsWorld.getWorldInfo().set_m_gravity(gravity);

            this.transformAux1 = new this.ammoModule.btTransform();
            this.softBodyHelpers = new this.ammoModule.btSoftBodyHelpers();

            // Create ground and soft body ball
            this.createGround();
            this.createSoftBodyBall();

            console.log('Ammo.js physics initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Ammo.js physics:', error);
        }
    }

    private createGround() {
        if (!this.ammoModule || !this.physicsWorld) return;

        // Create ground mesh
        const groundGeometry = new THREE.BoxGeometry(2, 0.1, 1);
        const groundMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x808080,
            side: THREE.DoubleSide
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.position.set(0, -0.3, 0);
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Create ground physics body
        const shape = new this.ammoModule.btBoxShape(new this.ammoModule.btVector3(1, 0.05, 0.5));
        shape.setMargin(0.01);

        const transform = new this.ammoModule.btTransform();
        transform.setIdentity();
        transform.setOrigin(new this.ammoModule.btVector3(0, -0.3, 0));
        // Ensure ground is perfectly level
        const rotation = new this.ammoModule.btQuaternion(0, 0, 0, 1);
        transform.setRotation(rotation);

        const motionState = new this.ammoModule.btDefaultMotionState(transform);
        const localInertia = new this.ammoModule.btVector3(0, 0, 0);
        const rbInfo = new this.ammoModule.btRigidBodyConstructionInfo(0, motionState, shape, localInertia);
        const body = new this.ammoModule.btRigidBody(rbInfo);
        
        // Increase friction to prevent sliding
        body.setFriction(1.0);
        body.setRollingFriction(0.5);
        body.setRestitution(0.2);
        // Lock all ground body movements
        body.setLinearFactor(new this.ammoModule.btVector3(0, 0, 0));
        body.setAngularFactor(new this.ammoModule.btVector3(0, 0, 0));

        this.physicsWorld.addRigidBody(body);
        ground.userData.physicsBody = body;
        this.rigidBodies.push(ground);

        // Cleanup
        this.ammoModule.destroy(rotation);
    }

    private createSoftBodyBall() {
        if (!this.ammoModule || !this.physicsWorld || !this.softBodyHelpers) return;

        // Create ball mesh with higher resolution
        const ballGeometry = new THREE.SphereGeometry(0.15, 24, 18);
        const ballMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xff0000,
            wireframe: true,
            side: THREE.DoubleSide
        });
        const ball = new THREE.Mesh(ballGeometry, ballMaterial);
        ball.position.set(0, 0.3, 0);
        ball.castShadow = true;
        ball.receiveShadow = true;
        this.scene.add(ball);

        // Create soft body
        const worldInfo = this.physicsWorld.getWorldInfo();
        // Ensure gravity is perfectly vertical
        const gravity = new this.ammoModule.btVector3(0, -9.81, 0);
        worldInfo.set_m_gravity(gravity);
        
        // Create soft body from sphere geometry
        const verticesArray = ballGeometry.attributes.position.array;
        const vertices = Array.from(verticesArray);
        const triangles = [];
        
        // Create triangles array from geometry indices
        const indices = ballGeometry.index ? ballGeometry.index.array : [];
        for (let i = 0; i < indices.length; i += 3) {
            triangles.push(indices[i], indices[i + 1], indices[i + 2]);
        }

        const softBody = this.softBodyHelpers.CreateFromTriMesh(
            worldInfo,
            vertices,
            triangles,
            triangles.length / 3,
            true
        );

        // Configure soft body parameters for better stability
        const sbConfig = softBody.get_m_cfg();
        sbConfig.set_viterations(40);
        sbConfig.set_piterations(40);
        sbConfig.set_collisions(0x11);
        sbConfig.set_kDF(1.0);  // Maximum dynamic friction
        sbConfig.set_kDG(0.0);  // No drag to prevent drift
        sbConfig.set_kLF(0.0);  // No linear friction to prevent drift
        sbConfig.set_kDP(0.0);  // No damping to prevent energy loss
        sbConfig.set_kPR(50);   // Keep pressure for shape
        
        // Set soft body material properties for better stability
        const mat = softBody.get_m_materials().at(0);
        mat.set_m_kLST(1.0); // Maximum linear stiffness
        mat.set_m_kAST(1.0); // Maximum angular stiffness
        mat.set_m_kVST(1.0); // Maximum volume stiffness

        // Generate clusters for better shape preservation
        softBody.generateClusters(16);
        
        // Add additional constraints to prevent edge deformation
        const nodes = softBody.get_m_nodes();
        const numNodes = nodes.size();
        const centerPoint = new this.ammoModule.btVector3(0, 0.3, 0);
        
        // Calculate center point
        for (let i = 0; i < numNodes; i++) {
            const node = nodes.at(i);
            const pos = node.get_m_x();
            centerPoint.setValue(
                centerPoint.x() + pos.x() / numNodes,
                centerPoint.y() + pos.y() / numNodes,
                centerPoint.z() + pos.z() / numNodes
            );
        }

        // Create a rigid body at the center for anchoring
        const centerShape = new this.ammoModule.btSphereShape(0.01);
        const centerTransform = new this.ammoModule.btTransform();
        centerTransform.setIdentity();
        centerTransform.setOrigin(centerPoint);
        // Ensure center body is perfectly aligned
        const centerRotation = new this.ammoModule.btQuaternion(0, 0, 0, 1);
        centerTransform.setRotation(centerRotation);
        
        const centerMotionState = new this.ammoModule.btDefaultMotionState(centerTransform);
        const centerInertia = new this.ammoModule.btVector3(0, 0, 0);
        const centerBody = new this.ammoModule.btRigidBody(
            new this.ammoModule.btRigidBodyConstructionInfo(0.5, centerMotionState, centerShape, centerInertia)
        );
        
        // Constrain center body to vertical movement only
        centerBody.setLinearFactor(new this.ammoModule.btVector3(0, 1, 0));
        centerBody.setAngularFactor(new this.ammoModule.btVector3(0, 0, 0));
        
        this.physicsWorld.addRigidBody(centerBody);

        // Add constraints to maintain spherical shape
        for (let i = 0; i < numNodes; i++) {
            const node = nodes.at(i);
            const nodePos = node.get_m_x();
            const dist = Math.sqrt(
                Math.pow(nodePos.x() - centerPoint.x(), 2) +
                Math.pow(nodePos.y() - centerPoint.y(), 2) +
                Math.pow(nodePos.z() - centerPoint.z(), 2)
            );
            softBody.appendAnchor(i, centerBody, false, 0.5); // Increased anchor influence
        }

        // Set mass
        softBody.setTotalMass(1.0, false); // Reduced mass
        
        // Initialize position with zero velocity
        const startPos = new this.ammoModule.btVector3(0, 0.3, 0);
        softBody.translate(startPos);

        // Initialize velocity for all nodes to zero
        for (let i = 0; i < numNodes; i++) {
            const node = nodes.at(i);
            node.set_m_v(new this.ammoModule.btVector3(0, 0, 0));
        }
        
        // Add soft body to physics world
        this.physicsWorld.addSoftBody(softBody, 1, -1);
        
        // Store references
        ball.userData.physicsBody = softBody;
        ball.userData.centerBody = centerBody;
        this.softBodies.push(ball);

        // Cleanup Ammo.js objects
        this.ammoModule.destroy(startPos);
        this.ammoModule.destroy(centerPoint);
        this.ammoModule.destroy(centerInertia);
        this.ammoModule.destroy(centerTransform);
        this.ammoModule.destroy(centerRotation);
        this.ammoModule.destroy(gravity);
    }

    update() {
        if (!this.physicsWorld || !this.transformAux1) return;

        const deltaTime = Math.min(this.clock.getDelta(), 1 / 60);

        // Step the physics world
        this.physicsWorld.stepSimulation(deltaTime, 10);

        // Update soft bodies
        for (const softBody of this.softBodies) {
            const geometry = softBody.geometry;
            const physicsBody = softBody.userData.physicsBody;
            const positions = geometry.attributes.position.array;
            const nodes = physicsBody.get_m_nodes();
            const numNodes = nodes.size();
            
            // Update each vertex position from physics simulation
            let hasValidPositions = true;
            const centerPoint = new THREE.Vector3();
            let validNodeCount = 0;

            // First pass: calculate center point and check validity
            for (let i = 0; i < numNodes; i++) {
                const node = nodes.at(i);
                const nodePos = node.get_m_x();
                const x = nodePos.x();
                const y = nodePos.y();
                const z = nodePos.z();

                if (!isNaN(x) && !isNaN(y) && !isNaN(z) &&
                    isFinite(x) && isFinite(y) && isFinite(z)) {
                    centerPoint.add(new THREE.Vector3(x, y, z));
                    validNodeCount++;
                } else {
                    hasValidPositions = false;
                    break;
                }
            }

            if (hasValidPositions && validNodeCount > 0) {
                centerPoint.divideScalar(validNodeCount);

                // Second pass: update positions and apply constraints
                for (let i = 0; i < numNodes; i++) {
                    const node = nodes.at(i);
                    const nodePos = node.get_m_x();
                    let x = nodePos.x();
                    let y = nodePos.y();
                    let z = nodePos.z();

                    // Clamp positions to prevent overflow
                    x = Math.max(Math.min(x, 1), -1);
                    y = Math.max(Math.min(y, 1), -1);
                    z = Math.max(Math.min(z, 1), -1);

                    // Apply radial constraint to maintain spherical shape
                    const vertex = new THREE.Vector3(x, y, z);
                    const toCenter = vertex.sub(centerPoint);
                    const distance = toCenter.length();
                    if (distance > 0.3) { // Limit maximum distance from center
                        toCenter.normalize().multiplyScalar(0.3);
                        vertex.copy(centerPoint).add(toCenter);
                        x = vertex.x;
                        y = vertex.y;
                        z = vertex.z;
                    }

                    positions[i * 3] = x;
                    positions[i * 3 + 1] = y;
                    positions[i * 3 + 2] = z;

                    // Update node position
                    node.m_x.setValue(x, y, z);
                }

                // Update geometry
                geometry.attributes.position.needsUpdate = true;
                geometry.computeVertexNormals();
                geometry.computeBoundingSphere();
            }
        }

        // Update rigid bodies
        for (const rigidBody of this.rigidBodies) {
            const physicsBody = rigidBody.userData.physicsBody;
            const motionState = physicsBody.getMotionState();
            
            if (motionState) {
                motionState.getWorldTransform(this.transformAux1);
                const position = this.transformAux1.getOrigin();
                const quaternion = this.transformAux1.getRotation();
                
                rigidBody.position.set(position.x(), position.y(), position.z());
                rigidBody.quaternion.set(quaternion.x(), quaternion.y(), quaternion.z(), quaternion.w());
            }
        }
    }

    dispose() {
        // Clean up Ammo.js resources
        if (this.physicsWorld) {
            // Remove all bodies from the world
            this.softBodies.forEach(body => {
                if (body.userData.physicsBody) {
                    this.physicsWorld?.removeSoftBody(body.userData.physicsBody);
                }
            });
            
            this.rigidBodies.forEach(body => {
                if (body.userData.physicsBody) {
                    this.physicsWorld?.removeRigidBody(body.userData.physicsBody);
                }
            });

            // Clear arrays
            this.softBodies = [];
            this.rigidBodies = [];
            
            // Clear references
            this.physicsWorld = null;
            this.ammoModule = null;
            this.transformAux1 = null;
            this.softBodyHelpers = null;
        }
    }
} 