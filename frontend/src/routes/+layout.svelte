<script lang="ts">
  import '../app.css';
  import Toast from '$lib/components/Toast.svelte';
  import { systemLogs } from '$lib/stores/systemLogs';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { fade } from 'svelte/transition';

  onMount(async () => {
    // Initialize global live logs & socket sync on every user's device
    systemLogs.initGlobalSocket();

    // Only register Service Worker if supported
    if ('serviceWorker' in navigator) {
      try {
        const { registerSW } = await import('virtual:pwa-register');
        registerSW({ immediate: true });
      } catch (err) {
        console.error('PWA registration failed:', err);
      }
    }
  });
</script>

<Toast />
{#key $page.url.pathname}
  <div in:fade={{ duration: 250, delay: 50 }}>
    <slot />
  </div>
{/key}
