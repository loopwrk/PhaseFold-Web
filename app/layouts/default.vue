<script setup lang="ts">
</script>

<template>
  <div class="flex min-h-svh flex-col">
    <header class="relative z-40 border-b border-primary">
      <UContainer class="flex flex-col items-start justify-between gap-4 py-3 md:flex-row md:items-center">
        <div
          class="header-content mx-auto flex w-full max-w-7xl flex-row items-start justify-between py-3 pr-4 md:items-center">
          <NuxtLink to="/" class="logo rounded-lg px-2 text-2xl font-semibold focus:ring focus:outline-none sm:px-4">
            PhaseFold
          </NuxtLink>
          <div class="flex flex-col gap-4 sm:flex-row">
            <ColorModeToggle />
          </div>
        </div>
      </UContainer>
    </header>

    <main id="content" class="flex-1">
      <UContainer class="py-8">
        <div class="grid gap-8">
          <section class="min-w-0">
            <NuxtPage />
          </section>
        </div>
      </UContainer>
    </main>

    <footer class="mt-auto border-t">
      <UContainer class="text-md flex items-center justify-between py-6">
        <p>
          PhaseFold
          {{ new Date().getFullYear() }}
        </p>
      </UContainer>
    </footer>
  </div>
</template>
