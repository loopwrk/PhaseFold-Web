<script setup lang="ts">

const play = usePlayAudio();

const selectedNote = ref("C4");
const simpleSynthNotes = ["C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4"];
const noteSequence = ref(["C4", "C4", "G4", "G4", "A4", "A4", "G4"])

const addNoteToSequence = (note: string) => {
  noteSequence.value.push(note);
}

const removeNoteFromSequence = (index: number) => {
  noteSequence.value.splice(index, 1);
}

const resetNoteSequence = () => {
  noteSequence.value = ["C4", "C4", "G4", "G4", "A4", "A4", "G4"];
}

const clearNoteSequence = () => {
  noteSequence.value = [];
}

const showSection = ref(true)

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
      <PlayStopButton @click="play.singleNote(selectedNote)" :animate-on-play="false" />
      <fieldset class="note-group" role="group">
        <legend id="play-single-note">Play single note</legend>
        <div class="flex flex-wrap gap-2" aria-labelledby="play-single-note">
          <UButton v-for="note in simpleSynthNotes" :key="note" class="text-amber-100"
            :class="['w-10 justify-center', selectedNote === note ? 'liquid-wheel' : '']" size="md"
            @click="selectedNote = note" color="primary">
            {{ note.replace('4', '') }}
          </UButton>
        </div>
      </fieldset>
    </div>

    <div class="flex mb-16">
      <PlayStopButton @click="play.multipleNotes(noteSequence)" />
      <fieldset class="note-group w-full" role="group">
        <legend id="play-note-sequence">Play note sequence</legend>
        <div class="note-options flex flex-wrap gap-2 mb-4">
          <UButton v-for="note in simpleSynthNotes" :key="note" variant="outline"
            class="w-10 justify-center hover:bg-primary/100 hover:text-amber-100" size="md"
            @click="addNoteToSequence(note)" color="primary">
            {{ note.replace('4', '') }}
          </UButton>
        </div>
        <div
          class="selected-notes flex flex-wrap items-center border-accessible-blue w-full rounded-md border-1 px-5 py-2 gap-2">
          <UButton v-for="(noteItem, index) in noteSequence" :key="index" class="text-amber-100"
            :class="['w-10 justify-center', play.currentPlayingIndex.value === index ? 'liquid-wheel' : '']" size="md"
            color="primary" @click="removeNoteFromSequence(index)">{{ noteItem.replace('4', '') }}
          </UButton>
          <UButton variant="ghost" size="sm" icon="i-heroicons-arrow-path" @click="resetNoteSequence" class="ml-2"
            aria-label="Reset sequence" />
          <UButton class="-translate-x-6" variant="ghost" size="sm" icon="i-heroicons-x-mark" @click="clearNoteSequence"
            aria-label="Clear sequence" />
        </div>
      </fieldset>
    </div>

    <div v-if="!showSection" class="flex mb-16">
      <PlayStopButton :has-stop="true"
        @click="play.isCurrentlyPlaying.value ? play.stopScheduled() : play.startScheduled()" />
      <fieldset class="note-group" role="group">
        <legend id="play-note-sequence">Scheduler</legend>
      </fieldset>
    </div>

    <div v-if="!showSection">
      <Heading :level="4">Time Context</Heading>
      <UButton class="mb-4" trailing-icon="i-lucide-clock" size="xl" @click="play.startTimeContext()">
        Start Time Context
      </UButton>
      <UButton class="mb-4" trailing-icon="i-lucide-square" size="xl" @click="play.stopTimeContext()">
        Stop Time Context
      </UButton>
      <div class="text-2xl font-mono">Time Context: {{ play.timeContext }}s</div>
    </div>



  </div>
</template>

<style>
.note-group {
  border: 0;
  margin: 0;
  padding: 0;
}

.note-group legend {
  margin-bottom: 0.5rem;
}
</style>
