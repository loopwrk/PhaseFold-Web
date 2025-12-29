<script setup lang="ts">
// Reports changes to the dimensions of an Element's content or the border-box (https://vueuse.org/core/useResizeObserver/)
import { useResizeObserver } from '@vueuse/core'

const props = withDefaults(
    defineProps<{
        waveform?: Float32Array | null;
        strokeColor?: string;
        backgroundColor?: string;
        aspectRatio?: string;
    }>(),
    {
        backgroundColor: '#fef3c6',
        strokeColor: '#5700ee',
        aspectRatio: '512 / 200',
    }
)

const play = usePlayAudio();

const containerRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

const size = reactive({ width: 0, height: 0 });

// 100 = max zoom out
const zoom = ref(100);
// Stroke width (CSS pixels)
const strokeWidth = ref(7);

const updateSize = () => {
    const el = containerRef.value;
    if (!el) return;
    size.width = el.clientWidth || 0;
    size.height = el.clientHeight || 0;
};

useResizeObserver(containerRef, () => updateSize());

// Prefer prop waveform, else use global store
const waveformSource = computed<Float32Array | null>(() => {
    const propWave = unref(props.waveform);

    if (propWave instanceof Float32Array) return propWave;
    const globalWave = unref(play.waveform);
    return globalWave instanceof Float32Array ? globalWave : null;
});

const draw = (data: Float32Array | null) => {
    if (!data) return;

    const canvas = canvasRef.value;
    if (!canvas) return;

    const w = size.width;
    const h = size.height;
    if (!w || !h) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = (import.meta.client ? window.devicePixelRatio : 1) || 1;

    // Backing store size (for crisp lines on HiDPI)
    const bw = Math.max(1, Math.floor(w * dpr));
    const bh = Math.max(1, Math.floor(h * dpr));

    if (canvas.width !== bw) canvas.width = bw;
    if (canvas.height !== bh) canvas.height = bh;

    // CSS size
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    // Draw in CSS pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background
    ctx.fillStyle = props.backgroundColor;
    ctx.fillRect(0, 0, w, h);

    // Center line
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Waveform
    ctx.strokeStyle = props.strokeColor;
    ctx.lineWidth = strokeWidth.value;
    ctx.beginPath();

    // Zoom: draw only the last N samples of the buffer
    const total = data.length;
    const minWindow = Math.min(total, 64); // most zoomed-in window size
    const windowSize = Math.max(
        2,
        Math.round(minWindow + (zoom.value / 100) * (total - minWindow))
    );
    const start = Math.max(0, total - windowSize);
    const view = data.subarray(start, start + windowSize);

    const sliceWidth = w / view.length;
    let x = 0;

    for (let i = 0; i < view.length; i++) {
        const y = ((view[i] + 1) / 2) * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
    }

    ctx.stroke();
};

watch(
    [waveformSource, () => size.width, () => size.height, () => zoom.value, () => strokeWidth.value],
    ([data]) => draw(data),
    { immediate: true }
);
</script>

<template>
    <div class="w-full flex flex-col gap-2">
        <div ref="containerRef" class="w-full" :style="{ aspectRatio: props.aspectRatio }">
            <canvas ref="canvasRef" class="w-full h-full rounded border border-neutral-800" />
        </div>

        <div class="flex items-center gap-3">
            <div class="text-xs font-mono opacity-80 whitespace-nowrap">Zoom</div>
            <USlider v-model="zoom" :min="0" :max="100" :step="1" tooltip class="flex-1" />
        </div>
        <div class="flex items-center gap-3">
            <div class="text-xs font-mono opacity-80 whitespace-nowrap">Stroke</div>
            <USlider v-model="strokeWidth" :min="1" :max="10" :step="1" tooltip class="flex-1" />
        </div>
    </div>
</template>
