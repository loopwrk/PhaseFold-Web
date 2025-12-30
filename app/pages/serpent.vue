<script setup lang="ts">
import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";

const wavLoaded = ref(false);

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

// build a line from N points.
// Base: XY are (L(t), R(t))
const N = 1200;
const trailVertexPositions = new Float32Array(N * 3);

const geometry = markRaw(new THREE.BufferGeometry());
geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(trailVertexPositions, 3)
);

const material = markRaw(new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
}));

const snapshotCorridorPoints = ref(null as THREE.Points | null);
const snapshotCorridorLines = ref(null as THREE.Line | null);
const line = markRaw(new THREE.Line(geometry, material));
const useLineMode = ref(false);
const scene = markRaw(new THREE.Scene());

let writeIndex = 0;
let phase = 0;

const modulationParams = ref({
    ringRadius: 2.2,
    xyScale: 1.2,
    drift: 0.0,
    detune: 0.0,
});

const autoFollowEnabled = ref(true);

// Three.js objects that need browser environment
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let light: THREE.PointLight;
let ground: THREE.Mesh;
let controls: PointerLockControls;

const canvasContainer = ref<HTMLDivElement | null>(null);
const isFullscreen = ref(false);

const updateRendererSize = () => {
    if (!canvasContainer.value || !renderer || !camera) return;

    const width = canvasContainer.value.clientWidth;
    const height = canvasContainer.value.clientHeight;

    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
};

const toggleFullscreen = async () => {
    if (!canvasContainer.value) return;

    try {
        if (!document.fullscreenElement) {
            await canvasContainer.value.requestFullscreen();
            isFullscreen.value = true;
        } else {
            await document.exitFullscreen();
            isFullscreen.value = false;
        }
    } catch (err) {
        console.error('Error toggling fullscreen:', err);
    }
};

const initaliseScene = () => {
    // Create camera
    camera = markRaw(new THREE.PerspectiveCamera(
        70,
        1, // Will be updated by updateRendererSize
        0.01,
        200
    ));
    camera.position.set(0, 1.6, 6);

    // Create renderer
    renderer = markRaw(new THREE.WebGLRenderer({ antialias: true }));

    if (canvasContainer.value) {
        canvasContainer.value.appendChild(renderer.domElement);
        // Set initial size based on container
        updateRendererSize();
    }

    // Create lights
    scene.add(markRaw(new THREE.AmbientLight(0xffffff, 0.35)));
    light = markRaw(new THREE.PointLight(0xffffff, 0.9));
    light.position.set(3, 6, 4);
    scene.add(light);

    // Create ground
    ground = markRaw(new THREE.Mesh(
        new THREE.PlaneGeometry(200, 200),
        new THREE.MeshStandardMaterial({
            color: 0x050505,
            roughness: 1,
            metalness: 0,
        })
    ));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    scene.add(ground);

    // Create controls
    controls = markRaw(new PointerLockControls(camera, renderer.domElement));
    scene.add(controls.object);

    // Add fog
    scene.fog = markRaw(new THREE.Fog(0x000000, 2, 45));

    // Add line to scene
    scene.add(line);
};

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
    oscL: OscillatorNode | null;
    oscR: OscillatorNode | null;
    analyserL: AnalyserNode | null,
    analyserR: AnalyserNode | null,
    dataL: Float32Array<ArrayBuffer> | null,
    dataR: Float32Array<ArrayBuffer> | null,
} = {
    ctx: null,
    buffer: null,
    source: null,
    wavStartedAt: 0,
    wavOffset: 0,
    started: false,
    oscL: null,
    oscR: null,
    analyserL: null,
    analyserR: null,
    dataL: null,
    dataR: null,
};

const corridorState = ref({
    buffer: null as AudioBuffer | null,
    sr: 0,
    ch0: null as Float32Array | null,
    ch1: null as Float32Array | null,
    frameCount: 0,
    xyScale: 1.8,
    ringRadius: 1.8,
    // how many frames have been written into the positions buffer
    builtFrames: 0,
    // typed array backing the Points geometry
    pos: null as Float32Array | null,
});

const corridorMeta = ref({
    zStep: 0.08,
    pointsPerFrame: 128, // points per frame
    windowSize: 2048, // samples per frame window
    hopSize: 1024,    // samples between frames
    maxPoints: 500000, // cap total points for performance (instead of fixed frame count)
});

const clearCorridor = () => {
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

const initLiveSnapshotCorridor = (buffer: AudioBuffer) => {
    clearCorridor();

    const sr = buffer.sampleRate;
    const ch0 = buffer.getChannelData(0);
    const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : ch0;

    const { windowSize, hopSize, pointsPerFrame, maxPoints } = corridorMeta.value;
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
    const gPoints = markRaw(new THREE.BufferGeometry());
    gPoints.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    gPoints.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    gPoints.setDrawRange(0, 0);

    const mPoints = markRaw(new THREE.PointsMaterial({
        size: 0.02,
        transparent: true,
        opacity: 0.95,
        vertexColors: true,
    }));
    const points = markRaw(new THREE.Points(gPoints, mPoints));
    points.position.set(0, 1.7, 0);
    points.frustumCulled = false;
    points.visible = !useLineMode.value; // Show points if not in line mode
    snapshotCorridorPoints.value = points;
    scene.add(points);

    // Create LINE version (shares same position/color data)
    const gLine = markRaw(new THREE.BufferGeometry());
    gLine.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    gLine.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    gLine.setDrawRange(0, 0);

    const mLine = markRaw(new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        linewidth: 1, // Note: linewidth > 1 only works with WebGLRenderer in some browsers
    }));
    const lines = markRaw(new THREE.Line(gLine, mLine));
    lines.position.set(0, 1.7, 0);
    lines.frustumCulled = false;
    lines.visible = useLineMode.value; // Show line if in line mode
    snapshotCorridorLines.value = lines;
    scene.add(lines);

    // Hide the live standing-wave line when in WAV mode (snapshotCorridorPoints becomes the main object)
    line.visible = false;
}

const loadWavFile = async (file: FileInput) => {
    console.log('Loading WAV file:', file.name);
    const ctx = audio.ctx || new (window.AudioContext || (window as any).webkitAudioContext)();
    audio.ctx = ctx;

    const arrayBuf = await file.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuf);
    console.log('WAV file decoded:', decoded);
    audio.buffer = decoded;
    audio.mode = "wav";

    // Build the 3D snapshot corridor progressively as playback advances
    initLiveSnapshotCorridor(decoded);

    // Enable auto-follow camera mode
    autoFollowEnabled.value = true;

    wavLoaded.value = true;
}

const handleFileChange = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    try {
        await loadWavFile(file as FileInput);
    } catch (err) {
        console.error('Failed to load WAV file:', err);
        alert('Failed to load WAV.');
    }
}

const playWav = (offsetSeconds = 0) => {
    if (!audio.ctx || !audio.buffer) return;
    stopWavOnly();

    console.log('Starting WAV playback at offset', offsetSeconds);

    const src = audio.ctx.createBufferSource();
    src.buffer = audio.buffer;

    console.log('src.buffer =', src.buffer);

    const gain = audio.ctx.createGain();
    gain.gain.value = 0.85;
    src.connect(gain).connect(audio.ctx.destination);

    audio.source = src;
    audio.wavStartedAt = audio.ctx.currentTime;
    audio.wavOffset = offsetSeconds;

    src.start(0, offsetSeconds);
    src.onended = () => {
        if (audio.mode === "wav") {
            // leave the corridor in place; just stop advancing playback mapping
            audio.source = null;
        }
    };
}

const stopWavOnly = () => {
    if (audio.source) {
        try {
            // store current offset so we can resume if desired
            const played = audio.ctx!.currentTime - audio.wavStartedAt;
            audio.wavOffset = clamp(audio.wavOffset + played, 0, audio.buffer ? audio.buffer.duration : Infinity);
            audio.source.stop();
        } catch (_) { }
        audio.source = null;
    }
}

const stopAllAudio = () => {
    stopWavOnly();
}

const startAudio = async () => {
    console.log('Starting audio playback');
    if (audio.ctx) {
        await audio.ctx.resume();
    }
    audio.started = true;
    playWav(0);
}

// Analyze frequency content using derivative energy (rate of change)
// High frequencies change rapidly, low frequencies change slowly
const analyzeFrequencyBand = (data: Float32Array, startIdx: number, windowLen: number) => {
    const endIdx = Math.min(startIdx + windowLen, data.length);
    const actualLen = endIdx - startIdx;
    if (actualLen < 8) return 0.5; // Default to mid

    let lowEnergy = 0;   // Energy in the signal itself (slow changes)
    let highEnergy = 0;  // Energy in the derivative (fast changes)

    // Calculate energy in signal and its derivative
    for (let i = startIdx; i < endIdx - 1; i++) {
        const sample = data[i] ?? 0;
        const nextSample = data[i + 1] ?? 0;
        const derivative = nextSample - sample; // Rate of change

        lowEnergy += sample * sample;
        highEnergy += derivative * derivative;
    }

    // Normalize energies
    lowEnergy = Math.sqrt(lowEnergy / actualLen);
    highEnergy = Math.sqrt(highEnergy / actualLen);

    const totalEnergy = lowEnergy + highEnergy;
    if (totalEnergy < 0.001) return 0.5; // Silence

    // Ratio of high to total energy indicates frequency content
    // More high energy = higher frequencies
    const highRatio = highEnergy / totalEnergy;

    // Map to 0-1 range with enhanced contrast
    return clamp(highRatio * 3, 0, 1);
}

const getPlaybackTimeSeconds = () => {
    if (!audio.ctx) return 0;
    if (audio.mode !== "wav") return 0;
    const played = audio.source ? (audio.ctx.currentTime - audio.wavStartedAt) : 0;
    return clamp(audio.wavOffset + played, 0, audio.buffer ? audio.buffer.duration : Infinity);
}

const getTargetFrameForPlayback = () => {
    // Map playback time to a frame index.
    if (!corridorState.value.buffer) return 0;
    const t = getPlaybackTimeSeconds();
    const sr = corridorState.value.sr;
    const sample = Math.floor(t * sr);

    const { windowSize, hopSize } = corridorMeta.value;
    // frame 0 corresponds to window starting at sample 0
    const f = Math.floor((sample - windowSize) / hopSize);
    return clamp(f, 0, Math.max(0, corridorState.value.frameCount - 1));
}

const buildOneCorridorFrame = (frameIndex: number) => {
    // Writes a single frame into the preallocated positions buffer.
    const { pointsPerFrame, windowSize, hopSize, zStep } = corridorMeta.value;
    const { ch0, ch1, frameCount, xyScale, ringRadius, pos } = corridorState.value;
    if (!pos || !ch0 || !ch1 || !snapshotCorridorPoints.value) return;

    const frameStart = frameIndex * hopSize;
    const z0 = (frameIndex - frameCount / 2) * zStep;

    // Each frame occupies a contiguous block.
    let p = frameIndex * pointsPerFrame * 3;
    const colors = snapshotCorridorPoints.value.geometry.attributes.color?.array as Float32Array | undefined;
    if (!colors) return;

    for (let k = 0; k < pointsPerFrame; k++) {
        const u = (k / pointsPerFrame) * Math.PI * 2;
        const sampleIndex = frameStart + Math.floor((k / pointsPerFrame) * windowSize);
        const i = clamp(sampleIndex, 0, ch0.length - 1);

        const L = ch0[i] ?? 0;
        const R = ch1[i] ?? 0;

        // Core portrait (XY)
        const x2 = L * xyScale;
        const y2 = R * xyScale;

        // Calculate amplitude for brightness
        const amplitude = Math.sqrt(L * L + R * R);
        const normalizedAmp = clamp(amplitude, 0, 1);

        // Analyze frequency content in a small window around this sample
        const analysisWindow = 512; // Window for frequency analysis
        const windowStart = Math.max(0, i - analysisWindow / 2);

        // Analyze both channels and average
        const freqL = analyzeFrequencyBand(ch0, windowStart, analysisWindow);
        const freqR = analyzeFrequencyBand(ch1, windowStart, analysisWindow);
        const freqContent = (freqL + freqR) / 2; // 0 = low freq, 1 = high freq

        // Map frequency to color with FULL spectrum range:
        // Low frequencies (bass) = RED (hue 0.0)
        // Mid frequencies = YELLOW/GREEN (hue 0.33)
        // High frequencies (treble) = BLUE/MAGENTA (hue 0.75)
        const color = new THREE.Color();
        const hue = freqContent * 0.75; // Full spectrum: Red -> Orange -> Yellow -> Green -> Cyan -> Blue -> Magenta
        const saturation = 0.85; // High saturation for vivid colors
        const lightness = 0.35 + normalizedAmp * 0.5; // Amplitude affects brightness only
        color.setHSL(hue, saturation, lightness);

        // Stable 3D: wrap around a ring so each frame becomes a "floating wreath" you can walk through
        const ringX = Math.cos(u) * ringRadius;
        const ringZ = Math.sin(u) * ringRadius;

        pos[p] = ringX + x2;
        pos[p + 1] = y2;        // portrait controls vertical shape
        pos[p + 2] = ringZ + z0; // time corridor

        // Set color for this point
        colors[p] = color.r;
        colors[p + 1] = color.g;
        colors[p + 2] = color.b;

        p += 3;
    }
}

const updateLiveSnapshotCorridor = () => {
    // Build frames progressively up to the current playback-derived target.
    if (!snapshotCorridorPoints || !corridorState.value.buffer) return;

    const targetFrame = getTargetFrameForPlayback();
    const remaining = targetFrame - corridorState.value.builtFrames;
    if (remaining <= 0) return;

    // Avoid big hitches if the user seeks forward or loads a long file.
    const MAX_FRAMES_PER_TICK = 6;
    const toBuild = Math.min(remaining, MAX_FRAMES_PER_TICK);

    for (let i = 0; i < toBuild; i++) {
        const f = corridorState.value.builtFrames;
        buildOneCorridorFrame(f);
        corridorState.value.builtFrames++;
    }

    const builtPoints = corridorState.value.builtFrames * corridorMeta.value.pointsPerFrame;

    // Update both points and line geometries
    if (snapshotCorridorPoints.value) {
        snapshotCorridorPoints.value.geometry.setDrawRange(0, builtPoints);
        const pointsPos = snapshotCorridorPoints.value.geometry.attributes.position;
        const pointsColor = snapshotCorridorPoints.value.geometry.attributes.color;
        if (pointsPos) pointsPos.needsUpdate = true;
        if (pointsColor) pointsColor.needsUpdate = true;
    }
    if (snapshotCorridorLines.value) {
        snapshotCorridorLines.value.geometry.setDrawRange(0, builtPoints);
        const linesPos = snapshotCorridorLines.value.geometry.attributes.position;
        const linesColor = snapshotCorridorLines.value.geometry.attributes.color;
        if (linesPos) linesPos.needsUpdate = true;
        if (linesColor) linesColor.needsUpdate = true;
    }
}

const updateShape = (dt: number) => {
    if (audio.mode !== "standing") return;
    if (!audio.oscL || !audio.oscR || !audio.ctx) return;

    // Slow modulation that doesn't destabilise everything
    phase += dt * (1.0 + modulationParams.value.drift);
    const base = 110;
    audio.oscL.frequency.setTargetAtTime(
        base + modulationParams.value.detune,
        audio.ctx.currentTime,
        0.03
    );
    audio.oscR.frequency.setTargetAtTime(
        base - modulationParams.value.detune,
        audio.ctx.currentTime,
        0.03
    );

    // Sample a single “instantaneous” value from each channel.
    // We take a mid-buffer sample from the time-domain waveform.
    function getStereoSample() {
        if (audio.mode === "standing") {
            if (!audio.analyserL || !audio.analyserR || !audio.dataL || !audio.dataR) {
                return { L: 0, R: 0 };
            }
            audio.analyserL.getFloatTimeDomainData(audio.dataL);
            audio.analyserR.getFloatTimeDomainData(audio.dataR);
            const i = (audio.dataL.length / 2) | 0;
            return { L: audio.dataL[i] ?? 0, R: audio.dataR[i] ?? 0 };
        }

        // WAV mode: sample directly from decoded AudioBuffer at the current playback time
        if (!audio.buffer) return { L: 0, R: 0 };

        const t = getPlaybackTimeSeconds();
        const sr = audio.buffer.sampleRate;
        const idx = Math.floor(t * sr);

        const ch0 = audio.buffer.getChannelData(0);
        const ch1 = audio.buffer.numberOfChannels > 1 ? audio.buffer.getChannelData(1) : ch0;

        const i0 = clamp(idx, 0, ch0.length - 1);
        return { L: ch0[i0] ?? 0, R: ch1[i0] ?? 0 };
    }

    // Insert several points per frame for smoother curves
    const steps = 18;
    for (let s = 0; s < steps; s++) {
        const { L, R } = getStereoSample();

        // 2D Lissajous core
        const x2 = L * modulationParams.value.xyScale;
        const y2 = R * modulationParams.value.xyScale;

        // Stable "extrusion": wrap around a ring using a phase index
        const u = (writeIndex / N) * Math.PI * 2;
        const ringX = Math.cos(u) * modulationParams.value.ringRadius;
        const ringZ = Math.sin(u) * modulationParams.value.ringRadius;

        const x = ringX + x2;
        const y = y2;
        const z = ringZ;

        const i3 = writeIndex * 3;
        trailVertexPositions[i3 + 0] = x;
        trailVertexPositions[i3 + 1] = y;
        trailVertexPositions[i3 + 2] = z;

        writeIndex = (writeIndex + 1) % N;
    }

    if (geometry.attributes.position) {
        geometry.attributes.position.needsUpdate = true;
    }
}

const updateAutoFollowCamera = () => {
    if (!autoFollowEnabled.value || !snapshotCorridorPoints.value || !corridorState.value.buffer) return;

    // Calculate the Z position of the corridor head (latest built frame)
    const headFrameIndex = corridorState.value.builtFrames - 1;
    if (headFrameIndex < 0) return;

    const headZ = (headFrameIndex - corridorState.value.frameCount / 2) * corridorMeta.value.zStep;
    const galleryY = 1.7; // gallery.position.y

    // Position camera at an isometric angle: behind, above, and to the side of the head
    const offset = {
        x: 5.0,   // to the side
        y: 4.5,   // above
        z: 7.0    // behind the head
    };

    const targetPos = {
        x: offset.x,
        y: galleryY + offset.y,
        z: headZ + offset.z
    };

    // Smooth camera movement
    const camObj = controls.object;
    const lerpFactor = 0.1;
    camObj.position.x += (targetPos.x - camObj.position.x) * lerpFactor;
    camObj.position.y += (targetPos.y - camObj.position.y) * lerpFactor;
    camObj.position.z += (targetPos.z - camObj.position.z) * lerpFactor;

    // Look at the corridor head
    const lookTarget = new THREE.Vector3(0, galleryY, headZ);
    camera.lookAt(lookTarget);
}


// ---------- Main loop ----------
let last = 0;
const animate = (now: number) => {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    if (audio.started) updateShape(dt);
    if (audio.mode === "wav" && snapshotCorridorPoints.value) {
        // Build points progressively as playback advances
        updateLiveSnapshotCorridor();
        // Auto-follow the corridor head if enabled
        updateAutoFollowCamera();
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

onMounted(() => {
    initaliseScene();
    last = performance.now();
    requestAnimationFrame(animate);

    // Handle window resize
    window.addEventListener('resize', updateRendererSize);

    // Handle fullscreen change (e.g., ESC key)
    document.addEventListener('fullscreenchange', () => {
        isFullscreen.value = !!document.fullscreenElement;
        updateRendererSize();
    });
});

onUnmounted(() => {
    window.removeEventListener('resize', updateRendererSize);
});

</script>

<template>
    <div>
        <ProseH1>Serpentoscope</ProseH1>
        <ProseH2>Where Sound Draws Coils Through Explorable Space (prototype) WIP</ProseH2>

        <div class="flex flex-wrap items-center border-accessible-blue w-full rounded-md border-1 py-3 px-5 mb-6">
            <input id="file" type="file" accept="audio/wav" class="hidden" @change="handleFileChange" />

            <UButton as="label" for="file" color="primary" size="lg" leading-icon="i-heroicons-arrow-up-tray">
                Load WAV
            </UButton>

            <UButton id="play" :disabled="!wavLoaded" color="primary" size="lg" leading-icon="i-heroicons-play"
                @click="startAudio">
                Play
            </UButton>

            <UButton id="stop" color="neutral" variant="outline" size="lg" leading-icon="i-heroicons-stop"
                @click="stopAllAudio">
                Stop
            </UButton>

            <UButton
                color="neutral"
                variant="outline"
                size="lg"
                :leading-icon="isFullscreen ? 'i-heroicons-arrows-pointing-in' : 'i-heroicons-arrows-pointing-out'"
                @click="toggleFullscreen">
                {{ isFullscreen ? 'Exit Fullscreen' : 'Fullscreen' }}
            </UButton>
        </div>
        <div class="rounded-lg w-full h-[600px] bg-black" ref="canvasContainer"></div>
    </div>
</template>
