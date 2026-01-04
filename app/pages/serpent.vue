<script setup lang="ts">
import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";

const wavLoaded = ref(false);

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const snapshotCorridorPoints = ref(null as THREE.Points | null);
const snapshotCorridorLines = ref(null as THREE.Line | null);
const useLineMode = ref(false);
const scene = markRaw(new THREE.Scene());

const autoFollowEnabled = ref(true);

// Three.js objects that need browser environment
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let light: THREE.PointLight;
let ground: THREE.Mesh;
let controls: PointerLockControls;

const canvasContainer = ref<HTMLDivElement | null>(null);
const isFullscreen = ref(false);

let requestAnimFrame: number | null = null;

const onFullscreenChange = () => {
    isFullscreen.value = !!document.fullscreenElement;
    updateRendererSize();
};

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
    const cameraFOV = ref(70);
    const aspectRatio = ref(1);
    const nearClip = ref(0.01);
    const farClip = ref(200);
    const pointLightIntensity = ref(0.35);
    const lightColour = ref(0xffffff);
    const lightIntensity = ref(0.9);
    const groundColor = ref(0x050505);

    const initCamCoords = {
        x: 0,
        y: 1.6,
        z: 6,
    } as const;

    const pointLightPos = {
        x: 3,
        y: 6,
        z: 4,
    } as const;

    const planeDimensions = {
        width: 200,
        height: 200,
    } as const;

    const fog = {
        colour: 0x000000,
        distanceStart: 200,
        distanceEnd: 200,
    } as const;

    // Create camera
    camera = markRaw(new THREE.PerspectiveCamera(
        cameraFOV.value,
        aspectRatio.value, // Will be updated by updateRendererSize
        nearClip.value,
        farClip.value
    ));

    camera.position.set(initCamCoords.x, initCamCoords.y, initCamCoords.z);

    // Create renderer
    renderer = markRaw(new THREE.WebGLRenderer({ antialias: true }));

    if (canvasContainer.value) {
        canvasContainer.value.appendChild(renderer.domElement);
        // Apply border radius to match container (rounded-lg = 0.5rem)
        renderer.domElement.style.borderRadius = '0.5rem';
        // Set initial size based on container
        updateRendererSize();
    }

    // Create lights
    scene.add(markRaw(new THREE.AmbientLight(lightColour.value, pointLightIntensity.value)));
    light = markRaw(new THREE.PointLight(lightColour.value, lightIntensity.value));
    light.position.set(pointLightPos.x, pointLightPos.y, pointLightPos.z);
    scene.add(light);

    // Create ground
    ground = markRaw(new THREE.Mesh(
        new THREE.PlaneGeometry(planeDimensions.width, planeDimensions.height),
        new THREE.MeshStandardMaterial({
            color: groundColor.value,
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
    scene.fog = markRaw(new THREE.Fog(fog.colour, fog.distanceStart, fog.distanceEnd));
};

interface AudioState {
    ctx: AudioContext | null;
    buffer: AudioBuffer | null;
    source: AudioBufferSourceNode | null;
    wavStartedAt: number;
    wavOffset: number;
    started: boolean;
}

interface FileInput extends File {
    arrayBuffer(): Promise<ArrayBuffer>;
}

const audio: AudioState = {
    ctx: null,
    buffer: null,
    source: null,
    wavStartedAt: 0,
    wavOffset: 0,
    started: false,
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
    // Oscillation data
    frequencies: null as Float32Array | null,
    amplitudes: null as Float32Array | null,
    anchorPositions: null as Float32Array | null,
});

const oscillationEnabled = ref(false);

// Frequency analysis window sizes (in samples)
// Smaller = better temporal resolution, larger = better frequency resolution
const ANALYSIS_WINDOW_TEMPORAL = 256;  // Fast response, good for percussion/transients
const ANALYSIS_WINDOW_BALANCED = 512;  // Balanced time/frequency resolution
const ANALYSIS_WINDOW_SPECTRAL = 2048; // Detailed frequency, good for sustained tones

type FrequencyResolution = 'temporal' | 'balanced' | 'spectral';
const frequencyResolution = ref<FrequencyResolution>('balanced');

const getAnalysisWindowSize = () => {
    switch (frequencyResolution.value) {
        case 'temporal': return ANALYSIS_WINDOW_TEMPORAL;
        case 'spectral': return ANALYSIS_WINDOW_SPECTRAL;
        case 'balanced':
        default: return ANALYSIS_WINDOW_BALANCED;
    }
};

const corridorMeta = ref({
    zStep: 0.08, // distance between frames along Z axis
    pointsPerFrame: 128,
    windowSize: 2048, // samples per frame window
    hopSize: 1024,    // samples between frames
    maxPoints: 1500000, // cap total points for performance (instead of fixed frame count)
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
    corridorState.value.frequencies = null;
    corridorState.value.amplitudes = null;
    corridorState.value.anchorPositions = null;
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
    const positionArrayMultiplier = 3; // x, y, z
    const pos = new Float32Array(totalPoints * positionArrayMultiplier);
    corridorState.value.pos = pos;

    const colorArrayMultiplier = 3;    // r, g, b
    const colors = new Float32Array(totalPoints * colorArrayMultiplier);

    // Allocate oscillation data arrays
    const frequencies = new Float32Array(totalPoints);
    const amplitudes = new Float32Array(totalPoints);
    const anchorPositions = new Float32Array(totalPoints * 3);

    corridorState.value.frequencies = frequencies;
    corridorState.value.amplitudes = amplitudes;
    corridorState.value.anchorPositions = anchorPositions;

    // Create POINTS version
    const gPoints = markRaw(new THREE.BufferGeometry());
    gPoints.setAttribute("position", new THREE.BufferAttribute(pos, positionArrayMultiplier));
    gPoints.setAttribute("color", new THREE.BufferAttribute(colors, colorArrayMultiplier));
    gPoints.setDrawRange(0, 0);

    const mPoints = markRaw(new THREE.PointsMaterial({
        size: 0.02,
        transparent: true,
        opacity: 0.95,
        vertexColors: true,
    }));

    const pointBasePos = reactive({
        x: 0,
        y: 1.7,
        z: 0.95,
    });

    const points = markRaw(new THREE.Points(gPoints, mPoints));
    points.position.set(pointBasePos.x, pointBasePos.y, pointBasePos.z);
    points.frustumCulled = false;
    points.visible = !useLineMode.value; // Show points if not in line mode
    snapshotCorridorPoints.value = points;
    scene.add(points);

    const gLine = markRaw(new THREE.BufferGeometry());
    const buffAttrSize = 3;
    gLine.setAttribute("position", new THREE.BufferAttribute(pos, buffAttrSize));
    gLine.setAttribute("color", new THREE.BufferAttribute(colors, buffAttrSize));
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
}

const loadWavFile = async (file: FileInput) => {
    console.log('Loading WAV file:', file.name);
    const ctx = audio.ctx || new (window.AudioContext || (window as any).webkitAudioContext)();
    audio.ctx = ctx;

    const arrayBuf = await file.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuf);
    console.log('WAV file decoded:', decoded);
    audio.buffer = decoded;

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
    const gainLevel = 0.85; // Reduce volume to 85% to avoid clipping
    gain.gain.value = gainLevel;
    src.connect(gain).connect(audio.ctx.destination);

    audio.source = src;
    audio.wavStartedAt = audio.ctx.currentTime;
    audio.wavOffset = offsetSeconds;

    src.start(0, offsetSeconds);
    src.onended = () => {
        // leave the corridor in place; just stop advancing playback mapping
        audio.source = null;
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
    audio.started = false;
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
    // Ensure integer indices to avoid fractional array access (e.g. data[123.5])
    const safeStartIdx = Math.max(0, Math.floor(startIdx));
    const minSamples = ref(8)
    const endIdx = Math.min(safeStartIdx + windowLen, data.length);
    const actualLen = endIdx - safeStartIdx;
    const midFreq = 0.5
    if (actualLen < minSamples.value) return midFreq;

    let lowEnergy = ref(0);   // Energy in the signal itself (slow changes)
    let highEnergy = ref(0);  // Energy in the derivative (fast changes)

    // Calculate energy in signal and its derivative
    for (let i = safeStartIdx; i < endIdx - 1; i++) {
        const sample = data[i] ?? 0;
        const nextSample = data[i + 1] ?? 0;
        const derivative = nextSample - sample; // Rate of change

        lowEnergy.value += sample * sample;
        highEnergy.value += derivative * derivative;
    }

    // Normalize energies
    lowEnergy.value = Math.sqrt(lowEnergy.value / actualLen);
    highEnergy.value = Math.sqrt(highEnergy.value / actualLen);

    const totalEnergy = lowEnergy.value + highEnergy.value;
    if (totalEnergy < 0.001) return midFreq; // Silence

    // Ratio of high to total energy indicates frequency content
    // More high energy = higher frequencies
    const highRatio = highEnergy.value / totalEnergy;

    // Map to 0-1 range with enhanced contrast
    const contrastMultiplier = 3;
    return clamp(highRatio * contrastMultiplier, 0, 1);
}

const getPlaybackTimeSeconds = () => {
    if (!audio.ctx) return 0;
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
    const { ch0, ch1, frameCount, xyScale, ringRadius, pos, frequencies, amplitudes, anchorPositions } = corridorState.value;
    if (!pos || !ch0 || !ch1 || !snapshotCorridorPoints.value) return;
    if (!frequencies || !amplitudes || !anchorPositions) return;

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
        const analysisWindow = getAnalysisWindowSize();
        const windowCenteringCalc = 2;
        const windowStart = Math.max(0, i - analysisWindow / windowCenteringCalc);

        // Analyze both channels and average
        const freqL = analyzeFrequencyBand(ch0, windowStart, analysisWindow);
        const freqR = analyzeFrequencyBand(ch1, windowStart, analysisWindow);
        const channelAverage = 2;
        const freqContent = (freqL + freqR) / channelAverage; // 0 = low freq, 1 = high freq

        // Map frequency to color with FULL spectrum range:
        // Low frequencies (bass) = RED (hue 0.0)
        // Mid frequencies = YELLOW/GREEN (hue 0.33)
        // High frequencies (treble) = BLUE/MAGENTA (hue 0.75)
        const color = new THREE.Color();
        const hueRangeMultiplier = 0.75;
        const hue = freqContent * hueRangeMultiplier; // Full spectrum: Red -> Orange -> Yellow -> Green -> Cyan -> Blue -> Magenta
        const hslColourSaturation = 0.85;
        const saturation = hslColourSaturation; // High saturation for vivid colors
        const baseLightness = 0.35
        const amplitudeBrightnessFactor = 0.5;
        const lightness = baseLightness + normalizedAmp * amplitudeBrightnessFactor; // Amplitude affects brightness only
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

        // Store oscillation data for this point
        const pointIndex = frameIndex * pointsPerFrame + k;

        // Convert freqContent (0-1) to Hz using logarithmic scale
        // Low frequencies: ~100 Hz, High frequencies: ~8000 Hz
        const minFreqHz = 100;
        const maxFreqHz = 8000;
        const hz = minFreqHz * Math.pow(maxFreqHz / minFreqHz, freqContent);
        frequencies[pointIndex] = hz;

        // Store amplitude (scale to reasonable oscillation range: 0.005 to 0.05 units)
        const minOscAmpRange = 0.045;
        const maxOscAmpRange = 0.005;
        amplitudes[pointIndex] = normalizedAmp * minOscAmpRange + maxOscAmpRange;

        // Store anchor position (original position before any oscillation)
        anchorPositions[p] = pos[p] ?? 0;
        anchorPositions[p + 1] = pos[p + 1] ?? 0;
        anchorPositions[p + 2] = pos[p + 2] ?? 0;

        const positionIncrement = 3;
        p += positionIncrement;
    }
}

const oscillateExistingPoints = (time: number) => {
    // Apply oscillation to all built points based on their stored frequency data
    const { pos, frequencies, amplitudes, anchorPositions, builtFrames } = corridorState.value;
    const { pointsPerFrame } = corridorMeta.value;

    if (!pos || !frequencies || !amplitudes || !anchorPositions) return;
    if (builtFrames === 0) return;

    const totalBuiltPoints = builtFrames * pointsPerFrame;

    for (let i = 0; i < totalBuiltPoints; i++) {
        const positionArrayStride = 3;
        const p = i * positionArrayStride;
        const freq = frequencies[i] ?? 0;
        const amp = amplitudes[i] ?? 0;

        // Calculate oscillation using sine wave at the point's frequency
        // Use slight phase offsets for each axis to create 3D motion
        const phaseCalcMultiplier = 2;
        const phaseShiftY = Math.PI / 3; // 60° phase offset for Y-axis
        const phaseShiftZ = 2 * Math.PI / 3; // 120° phase offset for Z-axis
        const phase = phaseCalcMultiplier * Math.PI * freq * time;
        const oscX = Math.sin(phase) * amp;
        const oscY = Math.sin(phase + phaseShiftY) * amp;
        const oscZ = Math.sin(phase + phaseShiftZ) * amp;

        // Update position by adding oscillation to anchor position
        pos[p] = (anchorPositions[p] ?? 0) + oscX;
        pos[p + 1] = (anchorPositions[p + 1] ?? 0) + oscY;
        pos[p + 2] = (anchorPositions[p + 2] ?? 0) + oscZ;
    }

    // Mark geometry for update
    if (snapshotCorridorPoints.value) {
        const pointsPos = snapshotCorridorPoints.value.geometry.attributes.position;
        if (pointsPos) pointsPos.needsUpdate = true;
    }
    if (snapshotCorridorLines.value) {
        const linesPos = snapshotCorridorLines.value.geometry.attributes.position;
        if (linesPos) linesPos.needsUpdate = true;
    }
}

const updateLiveSnapshotCorridor = () => {
    // Build frames progressively up to the current playback-derived target.
    if (!snapshotCorridorPoints.value || !corridorState.value.buffer) return;

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

const updateAutoFollowCamera = () => {
    if (!autoFollowEnabled.value || !snapshotCorridorPoints.value || !corridorState.value.buffer) return;

    // Calculate the Z position of the corridor head (latest built frame)
    const headFrameIndex = corridorState.value.builtFrames - 1;
    if (headFrameIndex < 0) return;

    const frameCenteringDivisor = 2; // to center the head frame
    const headZ = (headFrameIndex - corridorState.value.frameCount / frameCenteringDivisor) * corridorMeta.value.zStep;
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
const animate = (now: number) => {
    if (snapshotCorridorPoints.value) {
        // Build points progressively as playback advances
        updateLiveSnapshotCorridor();
        // Auto-follow the corridor head if enabled
        updateAutoFollowCamera();
        // Apply oscillation to existing points if enabled
        const milliSecToSec = now / 1000;
        if (oscillationEnabled.value) {
            oscillateExistingPoints(milliSecToSec);
        }
    }

    renderer.render(scene, camera);
    requestAnimFrame = requestAnimationFrame(animate);
}

// Watch for render mode changes and update visibility
watch(useLineMode, (newValue) => {
    if (snapshotCorridorPoints.value) {
        snapshotCorridorPoints.value.visible = !newValue;
    }
    if (snapshotCorridorLines.value) {
        snapshotCorridorLines.value.visible = newValue;
    }
});

onMounted(() => {
    initaliseScene();
    requestAnimFrame = requestAnimationFrame(animate);

    // Handle window resize
    window.addEventListener('resize', updateRendererSize);

    // Handle fullscreen change (e.g., ESC key)
    document.addEventListener('fullscreenchange', onFullscreenChange);
});

onUnmounted(() => {

    if (requestAnimFrame !== null) {
        cancelAnimationFrame(requestAnimFrame);
        requestAnimFrame = null;
    }

    window.removeEventListener('resize', updateRendererSize);
    document.removeEventListener('fullscreenchange', onFullscreenChange);

    stopAllAudio();
    clearCorridor();
});

</script>

<template>
    <div>
        <ProseH1>Serpentoscope</ProseH1>
        <ProseH2>Where Sound Draws Coils Through Explorable Space (prototype) WIP</ProseH2>

        <ProseH3>Playback controls</ProseH3>
        <div class="flex flex-wrap items-center gap-2 border-accessible-blue w-full rounded-md border-1 py-3 px-5 mb-6">
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
        </div>

        <ProseH3>Display controls</ProseH3>
        <div class="border-accessible-blue w-full border-1 rounded-md py-4 px-6 mb-6">
            <div class="flex gap-16">
                <!-- Left Column -->
                <div class="flex-1 space-y-4">
                    <div class="mb-6">
                        <label class="block font-bold text-primary text-lg mb-2">
                            Points Per Frame: <span class="text-secondary">{{ corridorMeta.pointsPerFrame }}</span>
                        </label>
                        <USlider v-model="corridorMeta.pointsPerFrame" :min="32" :max="512" :step="32"
                            :ui="{ thumb: 'bg-primary' }" :disabled="audio.started" />
                    </div>
                    <USeparator class="py-2" />
                    <div class="mb-6">
                        <URadioGroup v-model="useLineMode" legend="Render Mode" size="xl" :items="[
                            { label: 'Points', value: false },
                            { label: 'Lines', value: true }
                        ]" :ui="{ legend: 'text-lg text-primary font-bold', label: 'text-primary' }" value-key="value"
                            orientation="horizontal" :disabled="audio.started" />
                    </div>
                    <USeparator class="py-2" />
                    <div class="flex items-center gap-3 mb-2">
                        <UCheckbox v-model="oscillationEnabled" id="oscillation-toggle" />
                        <label for="oscillation-toggle" class="text-primary text-lg font-bold cursor-pointer">
                            Enable Point Oscillation
                        </label>
                    </div>
                </div>

                <!-- Right Column -->
                <div class="flex-1 space-y-4">
                    <div>
                        <URadioGroup v-model="frequencyResolution" legend="Frequency Analysis Resolution" size="xl"
                            :items="[
                                {
                                    label: 'Hi-Res',
                                    value: 'spectral',
                                    help: 'Detailed frequency analysis. Best for sustained tones, classical and ambient.'
                                },
                                {
                                    label: 'Mid',
                                    value: 'balanced',
                                    help: 'Balanced time/frequency resolution. Good for most music genres.'
                                },
                                {
                                    label: 'Lo-Res',
                                    value: 'temporal',
                                    help: 'Fast response to changes. Best for percussion and electronic.'
                                }
                            ]" :ui="{ legend: 'text-lg text-primary font-bold', label: 'text-primary' }"
                            value-key="value" :disabled="audio.started">
                            <template #label="{ item }">
                                <div class="flex flex-col gap-1">
                                    <span class="font-bold text-primary">{{ item.label }}</span>
                                    <span class="text-sm text-primary dark:text-gray-400">{{ item.help }}</span>
                                </div>
                            </template>
                        </URadioGroup>
                    </div>
                </div>
            </div>
        </div>

        <div class="relative rounded-lg w-full h-[600px] bg-black" ref="canvasContainer">
            <UButton class="absolute top-4 right-4 z-10" color="primary" variant="solid" size="xl"
                :icon="isFullscreen ? 'i-heroicons-arrows-pointing-in' : 'i-heroicons-arrows-pointing-out'"
                @click="toggleFullscreen" :aria-label="isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'" />
        </div>
    </div>
</template>
