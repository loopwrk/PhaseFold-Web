<template>
  <div>
    <Heading :level="4">Simple synth notes</Heading>
    <UButton class="mb-4" trailing-icon="i-lucide-play" size="xl" @click="play.singleNote()">Play single note</UButton>
    <UButton class="mb-4" trailing-icon="i-lucide-play" size="xl" @click="play.multipleNotes()">Play notes in
      sequence
    </UButton>

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

<script setup lang="ts">

const play = usePlayAudio();

onUnmounted(() => {
  play.stopTimeContext();
});

definePageMeta({
  title: "Home",
});
</script>
