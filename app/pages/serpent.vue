<script setup lang="ts">
import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

// build a line from N points.
// Base: XY are (L(t), R(t))
const N = 1200;
const trailVertexPositions = new Float32Array(N * 3);

const geometry = new THREE.BufferGeometry();
geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(trailVertexPositions, 3)
);

const material = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
});

const snapshotCorridorPoints = ref(null as THREE.Points | null);
const snapshotCorridorLines = ref(null as THREE.Line | null);
const line = new THREE.Line(geometry, material);
const useLineMode = ref(false);
const scene = new THREE.Scene();

interface AudioState {
    ctx: AudioContext | null;
    buffer: AudioBuffer | null;
    source: AudioBufferSourceNode | null;
    wavStartedAt: number;
    wavOffset: number;
    started: boolean;
    mode?: string;
}

interface FileInput extends File {
    arrayBuffer(): Promise<ArrayBuffer>;
}

const audio: {
    ctx: AudioContext | null;
    buffer: AudioBuffer | null;
    source: AudioBufferSourceNode | null;
    wavStartedAt: number;
    wavOffset: number;
    started: boolean;
    mode?: string;
} = {
    ctx: null,
    buffer: null,
    source: null,
    wavStartedAt: 0,
    wavOffset: 0,
    started: false,
};

const corridorState = ref({
    buffer: null,
    sr: 0,
    ch0: null,
    ch1: null,
    frameCount: 0,
    xyScale: 1.8,
    ringRadius: 1.8,
    // how many frames have been written into the positions buffer
    builtFrames: 0,
    // typed array backing the Points geometry
    pos: null as Float32Array | null,
});

const galleryMeta = ref({
    zStep: 0.08,
    pointsPerFrame: 128, // points per frame
    windowSize: 2048, // samples per frame window
    hopSize: 1024,    // samples between frames
    maxPoints: 500000, // cap total points for performance (instead of fixed frame count)
});

function clearCorridor() {
    if (snapshotCorridorPoints.value) {
        scene.remove(snapshotCorridorPoints.value);
        snapshotCorridorPoints.value.geometry.dispose();
        if (Array.isArray(snapshotCorridorPoints.value.material)) {
            snapshotCorridorPoints.value.material.forEach(material => material.dispose());
        } else {
            snapshotCorridorPoints.value.material.dispose();
        }
        snapshotCorridorPoints.value = null;
    }
    if (snapshotCorridorLines.value) {
        scene.remove(snapshotCorridorLines.value);
        snapshotCorridorLines.value.geometry.dispose();
        if (Array.isArray(snapshotCorridorLines.value.material)) {
            snapshotCorridorLines.value.material.forEach(material => material.dispose());
        } else {
            snapshotCorridorLines.value.material.dispose();
        }
        snapshotCorridorLines.value = null;
    }
    corridorState.value.buffer = null;
    corridorState.value.sr = 0;
    corridorState.value.ch0 = null;
    corridorState.value.ch1 = null;
    corridorState.value.frameCount = 0;
    corridorState.value.builtFrames = 0;
    corridorState.value.pos = null;
}

function initLiveSnapshotCorridor(buffer) {
    clearCorridor();

    const sr = buffer.sampleRate;
    const ch0 = buffer.getChannelData(0);
    const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : ch0;

    const { windowSize, hopSize, pointsPerFrame, maxPoints } = galleryMeta.value;
    const totalFrames = Math.floor((ch0.length - windowSize) / hopSize);
    // Calculate max frames based on point budget instead of arbitrary frame limit
    const maxFrames = Math.floor(maxPoints / pointsPerFrame);
    const frameCount = Math.max(1, Math.min(totalFrames, maxFrames));

    corridorState.value.buffer = buffer;
    corridorState.value.sr = sr;
    corridorState.value.ch0 = ch0;
    corridorState.value.ch1 = ch1;
    corridorState.value.frameCount = frameCount;
    corridorState.value.builtFrames = 0;

    const totalPoints = frameCount * pointsPerFrame;
    const pos = new Float32Array(totalPoints * 3);
    corridorState.value.pos = pos;

    // Create shared position and color buffers
    const colors = new Float32Array(totalPoints * 3);

    // Create POINTS version
    const gPoints = new THREE.BufferGeometry();
    gPoints.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    gPoints.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    gPoints.setDrawRange(0, 0);

    const mPoints = new THREE.PointsMaterial({
        size: 0.02,
        transparent: true,
        opacity: 0.95,
        vertexColors: true,
    });
    snapshotCorridorPoints.value = new THREE.Points(gPoints, mPoints);
    snapshotCorridorPoints.value.position.set(0, 1.7, 0);
    snapshotCorridorPoints.value.frustumCulled = false;
    snapshotCorridorPoints.value.visible = !useLineMode.value; // Show points if not in line mode
    scene.add(snapshotCorridorPoints.value);

    // Create LINE version (shares same position/color data)
    const gLine = new THREE.BufferGeometry();
    gLine.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    gLine.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    gLine.setDrawRange(0, 0);

    const mLine = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        linewidth: 1, // Note: linewidth > 1 only works with WebGLRenderer in some browsers
    });
    snapshotCorridorLines.value = new THREE.Line(gLine, mLine);
    snapshotCorridorLines.value.position.set(0, 1.7, 0);
    snapshotCorridorLines.value.frustumCulled = false;
    snapshotCorridorLines.value.visible = useLineMode.value; // Show line if in line mode
    scene.add(snapshotCorridorLines.value);

    // Hide the live standing-wave line when in WAV mode (snapshotCorridorPoints becomes the main object)
    line.visible = false;
}


const loadWavFile = async (file: FileInput) => {
    const ctx = audio.ctx || new (window.AudioContext || (window as any).webkitAudioContext)();
    audio.ctx = ctx;

    const arrayBuf = await file.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuf);
    audio.buffer = decoded;
    audio.mode = "wav";
}


</script>

<template>
    <div class="prose">
        <ProseH1>Serpentoscope</ProseH1>
        <ProseH2>Serpentoscope: Where Sound Draws Coils Through Explorable Space (prototype) WIP</ProseH2>
    </div>
</template>

<style scoped></style>