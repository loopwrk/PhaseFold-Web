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
    <div class="flex mb-16">
      <PlayStopButton @click="play.singleNote(selectedDote)" />
      <fieldset class="note-group" role="group">
        <legend id="play-single-note">Play single note</legend>
        <div class="flex flex-wrap gap-2" aria-labelledby="play-single-note">
          <UButton v-for="note in simpleSynthNotes" :key="note"
            :class="['w-10 justify-center', selectedDote === note ? 'liquid-wheel' : '']" size="md"
            @click="selectedDote = note" color="primary">
            {{ note.replace('4', '') }}
          </UButton>
        </div>
      </fieldset>
    </div>

    <div class="flex mb-16">
      <PlayStopButton @click="play.multipleNotes(noteSequence)" />
      <fieldset class="note-group" role="group">
        <legend id="play-note-sequence">Play note sequence</legend>
        <div class="flex gap-2" aria-labelledby="play-note-sequence">
          <UButton v-for="(noteItem, index) in noteSequence" :key="index"
            :class="['w-10 justify-center', play.currentPlayingIndex.value === index ? 'liquid-wheel' : '']" size="md"
            color="primary">{{ noteItem.replace('4', '') }}
          </UButton>
        </div>
      </fieldset>
    </div>

    <div class="flex mb-16">
      <PlayStopButton :has-stop="true"
        @click="play.isCurrentlyPlaying.value ? play.stopScheduled() : play.startScheduled()" />
      <fieldset class="note-group" role="group">
        <legend id="play-note-sequence">Scheduler</legend>

      </fieldset>
    </div>

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
.note-group {
  border: 0;
  margin: 0;
  padding: 0;
}

.note-group legend {
  font-weight: 500;
  margin-bottom: 0.5rem;
}
</style>
