<template>
  <UApp>
    <SkipLink />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
const colorMode = useColorMode();
import { useFavicon } from "@vueuse/core";

const icon = useFavicon();

onMounted(() => {
  if (colorMode.preference === "light") {
    icon.value = "/favicon-light.ico";
  } else {
    icon.value = "/favicon-dark.ico";
  }
});
</script>
