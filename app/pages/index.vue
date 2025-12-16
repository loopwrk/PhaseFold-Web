<script setup lang="ts">

const play = usePlayAudio();

const selectedDote = ref("C4");
const simpleSynthNotes = ["C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4"];
const noteSequence = ["C4", "C4", "G4", "G4", "A4", "A4", "G4"]

onUnmounted(() => {
  play.stopTimeContext();
});

definePageMeta({
  title: "Tone.js - Learning Environment",
});
</script>


<template>
  <div>
    <Heading :level="4">Simple synth notes</Heading>
    <div>
      <UButton class="mb-4" trailing-icon="i-lucide-play" size="xl" @click="play.singleNote(selectedDote)">Play single
        note
      </UButton>
    </div>
    <div class="flex flex-wrap gap-2 mb-16">
      <UButton v-for="note in simpleSynthNotes" :key="note"
        :class="['w-10 justify-center', selectedDote === note ? 'liquid-wheel' : '']" size="md"
        @click="selectedDote = note" color="primary">
        {{ note.replace('4', '') }}
      </UButton>
    </div>
    <div>
    </div>
    <div>
      <!-- TODO: Fix interrupt playback scheduling bug -->
      <!-- TODO: Make animation only animation during playback and fix animation -->
      <UButton :class="[play.currentlyPlaying.value ? 'liquid-wheel' : '']" class="mb-4" trailing-icon="i-lucide-play"
        size="xl" @click="play.multipleNotes(noteSequence)">Play
        notes in
        sequence
      </UButton>
      <div class="mb-12 flex gap-2">
        <UButton v-for="(noteItem, index) in noteSequence" :key="index"
          :class="['w-10 justify-center', play.currentPlayingIndex.value === index ? 'liquid-wheel' : '']" size="md"
          color="primary">{{ noteItem.replace('4', '') }}
        </UButton>
      </div>
    </div>

    <Heading :level="4">Scheduler</Heading>
    <UButton class="mb-4" trailing-icon="i-lucide-play" size="xl" @click="play.startScheduled()">Play scheduler
    </UButton>
    <UButton color="error" class="mb-8" trailing-icon="i-lucide-square" size="xl" @click="play.stopScheduled()">Stop
      scheduler
    </UButton>


    <Heading :level="4">Time Context</Heading>
    <UButton class="mb-4" trailing-icon="i-lucide-clock" size="xl" @click="play.startTimeContext()">
      Start Time Context
    </UButton>
    <UButton class="mb-4" trailing-icon="i-lucide-square" size="xl" @click="play.stopTimeContext()">
      Stop Time Context
    </UButton>

    <div class="text-2xl font-mono">Time Context: {{ play.timeContext }}s</div>

  </div>
</template>

<style>
.liquid-wheel {
  position: relative !important;
  overflow: hidden !important;
  isolation: isolate;
}

.liquid-wheel::before {
  content: '';
  position: absolute;
  top: -20%;
  left: -20%;
  width: 200%;
  height: 220%;
  background:
    radial-gradient(circle at 20% 50%, rgba(237, 0, 228, 1) 0%, transparent 77%),
    radial-gradient(circle at 80% 80%, rgba(9, 0, 237, 1) 0%, transparent 50%),
    radial-gradient(circle at 40% 40%, rgba(0, 66, 237, 0.9) 0%, transparent 70%),
    radial-gradient(circle at 60% 70%, rgba(255, 0, 128, 1) 0%, transparent 70%),
    radial-gradient(circle at 90% 30%, rgba(237, 9, 238, 1) 0%, transparent 74%);
  animation: liquidFlow 8s ease-in-out infinite;
  border-radius: inherit;
  z-index: -1;
}

.liquid-wheel::after {
  content: '';
  position: absolute;
  inset: 0;
  top: -30%;
  left: -30%;
  width: 200%;
  height: 220%;
  background:
    radial-gradient(circle at 70% 20%, rgb(179, 0, 255) 0%, transparent 71%),
    radial-gradient(circle at 30% 80%, rgba(0, 0, 0, 0.4) 0%, transparent 50%),
    radial-gradient(circle at 50% 50%, rgba(0, 128, 255, 0.8) 0%, transparent 50%);
  animation: liquidFlow 10s ease-in-out infinite reverse;
  border-radius: inherit;
  z-index: -1;
}

.liquid-wheel span {
  color: white !important;
  font-weight: 700 !important;
  text-shadow:
    1px 1px 2px rgba(0, 0, 0, 0.9),
    -1px -1px 2px rgba(0, 0, 0, 0.9),
    1px -1px 2px rgba(0, 0, 0, 0.9),
    -1px 1px 2px rgba(0, 0, 0, 0.9) !important;
}

@keyframes liquidFlow {

  0%,
  100% {
    transform: translate(0, 0) rotate(0deg);
  }

  25% {
    transform: translate(-2%, 3%) rotate(11deg);
  }

  50% {
    transform: translate(-2%, 3%) rotate(8deg);
  }

  75% {
    transform: translate(-2%, 4%) rotate(7eg);
  }

}
</style>
