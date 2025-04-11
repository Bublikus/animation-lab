import * as THREE from 'three';
import { AbstractAnimation } from './core/AbstractAnimation';
import { SimpleShaderAnimation } from './animations/SimpleShaderAnimation';
import { BounceAnimation } from './animations/BounceAnimation';

class AnimationManager {
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera;
    private renderer: THREE.WebGLRenderer;
    private currentAnimation: AbstractAnimation | null = null;
    private animations: { [key: string]: new (scene: THREE.Scene) => AbstractAnimation } = {
        'bounce': BounceAnimation,
        'simple-shader': SimpleShaderAnimation
    };
    private container: HTMLElement;
    private resizeObserver!: ResizeObserver;
    private animationFrameId: number | null = null;

    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true
        });
        
        const container = document.getElementById('animation-container');
        if (!container) throw new Error('Container not found');
        this.container = container;
        
        this.setupRenderer();
        this.setupCamera();
        this.setupSelect();
        this.setupResizeHandler();
        this.animate();
    }

    private setupRenderer() {
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);
    }

    private setupCamera() {
        this.camera.position.z = 1;
        this.updateCameraAspect();
    }

    private updateCameraAspect() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        const aspect = width / height;
        if (aspect > 1) {
            this.camera.left = -aspect;
            this.camera.right = aspect;
            this.camera.top = 1;
            this.camera.bottom = -1;
        } else {
            this.camera.left = -1;
            this.camera.right = 1;
            this.camera.top = 1 / aspect;
            this.camera.bottom = -1 / aspect;
        }
        
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    private setupResizeHandler() {
        this.resizeObserver = new ResizeObserver(() => {
            this.updateCameraAspect();
        });
        this.resizeObserver.observe(this.container);
    }

    private setupSelect() {
        const select = document.getElementById('animation-select') as HTMLSelectElement;
        if (!select) throw new Error('Select element not found');

        select.innerHTML = '';

        // Get the first animation key (most recently added)
        const firstAnimationKey = Object.keys(this.animations)[0];

        Object.keys(this.animations).forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = key.replace(/-/g, ' ');
            select.appendChild(option);
        });

        // Select the first animation
        select.value = firstAnimationKey;
        this.loadAnimation(firstAnimationKey);

        select.addEventListener('change', (e) => {
            const target = e.target as HTMLSelectElement;
            this.loadAnimation(target.value);
        });
    }

    private loadAnimation(name: string) {
        if (this.currentAnimation) {
            this.currentAnimation.dispose();
        }

        if (name && this.animations[name]) {
            this.currentAnimation = new this.animations[name](this.scene);
        }
    }

    private animate() {
        this.animationFrameId = requestAnimationFrame(() => this.animate());
        
        if (this.currentAnimation) {
            this.currentAnimation.update();
        }
        
        this.renderer.render(this.scene, this.camera);
    }

    dispose() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.resizeObserver.disconnect();
        if (this.currentAnimation) {
            this.currentAnimation.dispose();
        }
        this.renderer.dispose();
    }
}

new AnimationManager(); 