<script setup lang="ts">
const colorMode = useColorMode();
const toast = useToast();

const setMode = (mode: "light" | "dark") => {
  if (colorMode.value === mode) {
    toast.clear();
    toast.add({
      title: `${mode === "dark" ? "Dark" : "Light"} mode already active`,
      icon: mode === "dark" ? "i-lucide-moon" : "i-lucide-sun",
      close: {
        size: "xl",
        class: "[&_svg]:size-9",
      },
      ui: {
        title: "text-lg sm:text-xl",
      },
    });
    return;
  }

  colorMode.preference = mode;
};
</script>

<template>
  <div class="flex flex-col gap-4 md:flex-row" role="group" aria-label="Color mode">
    <ClientOnly>
      <UButton :variant="colorMode.value === 'light' ? 'solid' : 'outline'" size="lg"
        class="group min-h-[48px] min-w-[175px] cursor-pointer justify-center rounded-full"
        :aria-pressed="colorMode.value === 'light'" aria-label="Activate light mode" icon="i-lucide-sun" :ui="{
          leadingIcon:
            colorMode.value === 'light'
              ? 'size-7'
              : 'size-6 group-hover:size-7 transition-all duration-140',
        }" @click="setMode('light')">
        <span class="text-xl transition-all duration-200 group-hover:font-bold"
          :class="colorMode.value === 'light' ? 'font-bold' : 'font-normal'">
          Light mode
        </span>
      </UButton>

      <UButton disabled :variant="colorMode.value === 'dark' ? 'solid' : 'outline'" size="lg"
        class="group min-h-[48px] min-w-[175px] cursor-pointer justify-center rounded-full"
        :aria-pressed="colorMode.value === 'dark'" aria-label="Activate dark mode" icon="i-lucide-moon" :ui="{
          leadingIcon:
            colorMode.value === 'dark'
              ? 'size-7'
              : 'size-6 group-hover:size-7 transition-all duration-140',
        }" @click="setMode('dark')">
        <span class="text-xl transition-all duration-200 group-hover:font-bold"
          :class="colorMode.value === 'dark' ? 'font-bold' : 'font-normal'">Dark mode</span>
      </UButton>
    </ClientOnly>
  </div>
</template>
