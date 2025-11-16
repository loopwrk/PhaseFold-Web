<template>
  <component :is="`h${level}`" class="pb-2 font-extrabold text-primary" :class="{
    'text-4xl lg:text-5xl': level === 1 && variation === 'primary',
    'text-3xl lg:text-4xl': level === 2 && variation === 'primary',
    'text-2xl lg:text-3xl': level === 3 && variation === 'primary',
    'text-xl lg:text-2xl': level === 4 && variation === 'primary',
  }">
    <slot></slot>
  </component>
  <USeparator v-if="variation === 'primary'" class="mb-8" color="primary" type="solid" />
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    level?: 1 | 2 | 3 | 4
    variation?: string
  }>(),
  {
    level: 1,
    variation: 'primary'
  }
)
</script>
