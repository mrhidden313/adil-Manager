<script lang="ts">
  import '../app.css';
  import Toast from '$lib/components/Toast.svelte';
  import NotificationBanner from '$lib/components/NotificationBanner.svelte';
  import { systemLogs, playAlertSound } from '$lib/stores/systemLogs';
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

        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data?.type === 'PLAY_NOTIFICATION_SOUND') {
            playAlertSound();
          }
        });
      } catch (err) {
        console.error('PWA registration failed:', err);
      }
    }
  });
</script>


<Toast />
<NotificationBanner />
{#key $page.url.pathname}

  <div in:fade={{ duration: 250, delay: 50 }}>
    <slot />
  </div>
{/key}
