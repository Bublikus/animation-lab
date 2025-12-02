import * as THREE from 'three';
import { AbstractAnimation } from '../core/AbstractAnimation';

type Landmark = { x: number; y: number; z: number };
type HandResults = { multiHandLandmarks?: Landmark[][] };
type HandsClass = new (config: { locateFile: (file: string) => string }) => {
    setOptions: (options: Record<string, unknown>) => void;
    onResults: (callback: (results: HandResults) => void) => void;
    send: (input: { image: HTMLVideoElement }) => Promise<void>;
    close: () => void;
};
type CameraClass = new (
    video: HTMLVideoElement,
    config: { onFrame: () => Promise<void> | void; width?: number; height?: number }
) => { start: () => void; stop: () => void };

export class ControlledSphereAnimation extends AbstractAnimation {
    private group: THREE.Group;
    private rotationSpeed = new THREE.Vector2(0.4, 0.25);
    private currentScale = 0.9;
    private targetScale = 0.9;
    private baseScale = 0.9;
    private lastDetected = 0;
    private disposed = false;
    private video: HTMLVideoElement | null = null;
    private stream: MediaStream | null = null;
    private hands: InstanceType<HandsClass> | null = null;
    private camera: InstanceType<CameraClass> | null = null;

    constructor(scene: THREE.Scene) {
        super(scene);

        this.group = new THREE.Group();
        const wireMaterial = new THREE.MeshBasicMaterial({
            color: 0x66ccff,
            wireframe: true,
            transparent: true,
            opacity: 0.85
        });
        const geometry = new THREE.SphereGeometry(0.55, 32, 32);
        const sphere = new THREE.Mesh(geometry, wireMaterial);

        const glow = new THREE.Mesh(
            new THREE.SphereGeometry(0.6, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0x99d6ff, transparent: true, opacity: 0.25 })
        );

        this.group.add(sphere);
        this.group.add(glow);
        this.scene.add(this.group);

        this.setupHandTracking();
    }

    private async loadHandLibraries(): Promise<{ Hands: HandsClass; Camera: CameraClass }> {
        const [handsModule, cameraModule] = await Promise.all([
            import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js'),
            import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js')
        ]);

        return {
            Hands: handsModule.Hands as HandsClass,
            Camera: cameraModule.Camera as CameraClass
        };
    }

    private async setupHandTracking() {
        try {
            if (this.disposed) {
                return;
            }

            const video = document.createElement('video');
            video.autoplay = true;
            video.playsInline = true;
            video.style.position = 'fixed';
            video.style.opacity = '0';
            video.style.pointerEvents = 'none';
            video.style.width = '0';
            video.style.height = '0';
            document.body.appendChild(video);
            this.video = video;

            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: 640, height: 480 },
                audio: false
            });

            if (this.disposed) {
                this.stopMediaStream();
                this.cleanupVideoElement();
                return;
            }

            video.srcObject = this.stream;
            await video.play();

            const { Hands, Camera } = await this.loadHandLibraries();

            if (this.disposed) {
                this.stopMediaStream();
                this.cleanupVideoElement();
                return;
            }

            this.hands = new Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            });
            this.hands.setOptions({
                maxNumHands: 1,
                modelComplexity: 1,
                minDetectionConfidence: 0.6,
                minTrackingConfidence: 0.6
            });
            this.hands.onResults((results) => this.handleHandResults(results));

            this.camera = new Camera(video, {
                onFrame: async () => {
                    if (this.hands && video.readyState >= 2) {
                        await this.hands.send({ image: video });
                    }
                },
                width: 640,
                height: 480
            });
            if (!this.disposed) {
                this.camera.start();
            }
        } catch (error) {
            console.error('Hand tracking setup failed', error);
        }
    }

    private handleHandResults(results: HandResults) {
        if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            return;
        }

        const landmarks = results.multiHandLandmarks[0];
        let minX = 1, minY = 1, maxX = 0, maxY = 0;
        for (const landmark of landmarks) {
            minX = Math.min(minX, landmark.x);
            minY = Math.min(minY, landmark.y);
            maxX = Math.max(maxX, landmark.x);
            maxY = Math.max(maxY, landmark.y);
        }

        const width = maxX - minX;
        const height = maxY - minY;
        const size = Math.max(width, height);
        const scale = THREE.MathUtils.clamp(this.baseScale + size * 2.2, 0.3, 2.2);
        this.targetScale = scale;
        this.lastDetected = performance.now();
    }

    update() {
        this.time += 0.016;
        this.group.rotation.x += this.rotationSpeed.x * 0.01;
        this.group.rotation.y += this.rotationSpeed.y * 0.01;

        const elapsedSinceDetection = performance.now() - this.lastDetected;
        if (elapsedSinceDetection > 1500) {
            this.targetScale = THREE.MathUtils.lerp(this.targetScale, this.baseScale, 0.02);
        }

        this.currentScale = THREE.MathUtils.lerp(this.currentScale, this.targetScale, 0.1);
        this.group.scale.setScalar(this.currentScale);
    }

    dispose() {
        this.disposed = true;
        this.group.removeFromParent();
        this.group.traverse((obj: THREE.Object3D) => {
            if (obj instanceof THREE.Mesh) {
                obj.geometry.dispose();
                (obj.material as THREE.Material).dispose();
            }
        });

        if (this.camera) {
            this.camera.stop();
            this.camera = null;
        }

        if (this.hands) {
            this.hands.close();
            this.hands = null;
        }

        this.stopMediaStream();
        this.cleanupVideoElement();
    }

    private stopMediaStream() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }

    private cleanupVideoElement() {
        if (!this.video) {
            return;
        }

        this.video.pause();
        this.video.srcObject = null;
        if (this.video.parentElement) {
            this.video.parentElement.removeChild(this.video);
        }

        this.video = null;
    }
}
