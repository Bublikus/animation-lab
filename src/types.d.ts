/// <reference types="vite/client" />

interface ImportMeta {
    glob: (pattern: string) => Record<string, () => Promise<any>>;
}

declare module 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js' {
    export class Hands {
        constructor(config: { locateFile: (file: string) => string });
        setOptions(options: Record<string, unknown>): void;
        onResults(callback: (results: { multiHandLandmarks?: { x: number; y: number; z: number }[][] }) => void): void;
        send(input: { image: HTMLVideoElement }): Promise<void>;
        close(): void;
    }
}

declare module 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js' {
    export class Camera {
        constructor(video: HTMLVideoElement, config: { onFrame: () => Promise<void> | void; width?: number; height?: number });
        start(): void;
        stop(): void;
    }
}