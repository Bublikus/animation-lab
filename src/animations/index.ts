import * as THREE from 'three';
import { AbstractAnimation } from '../core/AbstractAnimation';
import { BounceAnimation } from './BounceAnimation';
import { FireworksAnimation } from './FireworksAnimation';
import { PentagonRotationAnimation } from './PentagonRotationAnimation';

type AnimationConstructor = new (scene: THREE.Scene) => AbstractAnimation;

export const animations: AnimationConstructor[] = [
    PentagonRotationAnimation,
    BounceAnimation,
    FireworksAnimation,
]; 