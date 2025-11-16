<template>
  <component :is="`h${level}`" class="pb-2 font-extrabold" :class="[
    `text-${textSize} lg:text-${textSizeLg} text-${variation}`,
    { 'mb-2': variation !== 'primary' }
  ]">
    <slot></slot>
  </component>
  <USeparator v-if="variation === 'primary'" class="mb-8" color="primary" type="solid" />
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    level?: 1 | 2 | 3 | 4
    variation?: string
  }>(),
  {
    level: 1,
    variation: 'primary'
  }
)

const textSize = computed(() => {
  switch (props.level) {
    case 2: return '3xl'
    case 3: return '2xl'
    case 4: return '1xl'
    default: return '4xl'
  }
})

const textSizeLg = computed(() => {
  switch (props.level) {
    case 2: return '4xl'
    case 3: return '3xl'
    case 4: return '2xl'
    default: return '5xl'
  }
})
</script>
