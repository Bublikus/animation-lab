import * as THREE from 'three';
import { AbstractAnimation } from './core/AbstractAnimation';

type AnimationConstructor = new (scene: THREE.Scene) => AbstractAnimation;

class AnimationManager {
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera;
    private renderer: THREE.WebGLRenderer;
    private currentAnimation: AbstractAnimation | null = null;
    private container: HTMLElement;
    private resizeObserver!: ResizeObserver;
    private animationFrameId: number | null = null;
    private availableAnimations: { name: string; constructor: AnimationConstructor }[] = [];

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
        this.loadAnimations();
        this.animate();
    }

    private async loadAnimations() {
        try {
            // Dynamically import all files from the animations directory
            const animationModules = await import.meta.glob('./animations/*.ts');
            
            for (const path of Object.keys(animationModules)) {
                const module = await animationModules[path]();
                // Get the first exported class from the module
                const animationClass = Object.values(module as Record<string, unknown>)[0] as AnimationConstructor;
                
                if (animationClass && animationClass.prototype instanceof AbstractAnimation) {
                    const name = path.split('/').pop()?.replace('.ts', '') || '';
                    this.availableAnimations.push({ name, constructor: animationClass });
                }
            }
            
            // Sort animations alphabetically
            this.availableAnimations.sort((a, b) => {
                const nameA = a.name.replace('Animation', '').toLowerCase();
                const nameB = b.name.replace('Animation', '').toLowerCase();
                return nameA.localeCompare(nameB);
            });
            
            // Update select options
            this.updateSelectOptions();
        } catch (error) {
            console.error('Error loading animations:', error);
        }
    }

    private updateSelectOptions() {
        const select = document.getElementById('animation-select') as HTMLSelectElement;
        if (!select) return;

        select.innerHTML = '';
        this.availableAnimations.forEach(({ name }, index) => {
            const option = document.createElement('option');
            // Format the name for display (e.g., "PentagonRotation" -> "pentagon rotation")
            const displayName = name
                .replace('Animation', '')
                .replace(/([A-Z])/g, ' $1')
                .toLowerCase()
                .trim();
            option.value = name;
            option.textContent = displayName;
            select.appendChild(option);

            // Select the first animation by default
            if (index === 0) {
                select.value = name;
                this.loadAnimation(name);
            }
        });
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

        select.addEventListener('change', (e) => {
            const target = e.target as HTMLSelectElement;
            this.loadAnimation(target.value);
        });
    }

    private loadAnimation(name: string) {
        if (this.currentAnimation) {
            this.currentAnimation.dispose();
        }

        const animation = this.availableAnimations.find(a => a.name === name);
        if (animation) {
            this.currentAnimation = new animation.constructor(this.scene);
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