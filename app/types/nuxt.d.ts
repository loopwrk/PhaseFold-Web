declare module '#app' {
  interface NuxtApp {
    $axe: {
      runScan: () => Promise<void>;
    };
  }
}

export {};
