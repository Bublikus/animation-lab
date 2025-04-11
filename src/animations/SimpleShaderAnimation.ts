import * as THREE from 'three';
import { AbstractAnimation } from '../core/AbstractAnimation';

export class SimpleShaderAnimation extends AbstractAnimation {
    private mesh: THREE.Mesh;

    constructor(scene: THREE.Scene) {
        super(scene);
        
        // Create a plane that fills the entire viewport
        const geometry = new THREE.PlaneGeometry(2, 2);
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                resolution: { value: new THREE.Vector2() }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform vec2 resolution;
                varying vec2 vUv;

                void main() {
                    vec2 uv = vUv;
                    float pulse = sin(time) * 0.5 + 0.5;
                    vec3 color = vec3(uv.x, uv.y, pulse);
                    gl_FragColor = vec4(color, 1.0);
                }
            `
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.mesh);
    }

    update() {
        this.time += 0.01;
        (this.mesh.material as THREE.ShaderMaterial).uniforms.time.value = this.time;
    }

    dispose() {
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.ShaderMaterial).dispose();
        this.mesh.parent?.remove(this.mesh);
    }
} 