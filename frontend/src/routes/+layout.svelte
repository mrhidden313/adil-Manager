<script lang="ts">
  import '../app.css';
  import Toast from '$lib/components/Toast.svelte';
  import { onMount } from 'svelte';

  onMount(async () => {
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
<slot />
