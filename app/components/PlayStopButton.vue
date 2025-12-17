<script setup lang="ts">
import { useElementHover } from '@vueuse/core'

const play = usePlayAudio();
const el = useTemplateRef('el')
const isHovered = useElementHover(el)
</script>

<template>
    <div class="play-stop-button-container">
        <button ref="el" class="play-stop-button w-16 h-24 mr-8 flex items-center justify-center cursor-pointer">
            <UIcon name="mingcute-play-fill" class="bg-accessible-blue" :class="[
                play.currentlyPlaying.value ? 'liquid-wheel' : '',
                isHovered ? 'size-17' : 'size-14'
            ]" />
        </button>
    </div>
</template>
