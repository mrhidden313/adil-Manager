<script lang="ts">
  import { onMount } from 'svelte';
  import { subscribeToPush } from '$lib/utils/push';
  import { toast } from '$lib/stores/toast';

  let showBanner = $state(false);
  let isSubscribing = $state(false);

  onMount(() => {
    // Check if push notifications are supported and not yet granted
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    ) {
      // Check every half second initially or on load
      const perm = Notification.permission;
      if (perm === 'default' || perm === 'denied') {
        showBanner = true;
      }
    }
  });

  async function handleEnable() {
    isSubscribing = true;
    try {
      const success = await subscribeToPush();
      if (success) {
        showBanner = false;
        toast.add('🔔 Push Notifications enabled successfully!', 'success');
      } else {
        if (Notification.permission === 'denied') {
          toast.add('⚠️ Notifications are blocked in browser settings. Please enable them manually.', 'error');
        } else {
          toast.add('Failed to enable push notifications.', 'error');
        }
      }
    } catch (e) {
      console.error(e);
      toast.add('Error activating push service.', 'error');
    } finally {
      isSubscribing = false;
    }
  }
</script>

{#if showBanner}
  <div class="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 text-white px-4 py-3 shadow-2xl animate-fade-in border-b border-white/20">
    <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
      <div class="flex items-center gap-3">
        <span class="flex h-3 w-3 relative shrink-0">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-3 w-3 bg-amber-400"></span>
        </span>
        <p class="text-xs sm:text-sm font-bold tracking-wide">
          Enable Push Notifications to receive instant alerts for new orders & assignments! 🚀
        </p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button
          onclick={handleEnable}
          disabled={isSubscribing}
          class="px-4 py-1.5 bg-white text-indigo-700 hover:bg-slate-100 rounded-xl text-xs sm:text-sm font-black shadow-md hover:shadow-lg transition-all transform active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
        >
          {#if isSubscribing}
            <svg class="animate-spin h-4 w-4 text-indigo-600" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span>Enabling...</span>
          {:else}
            <span>🔔 Allow Notifications</span>
          {/if}
        </button>
        <button
          onclick={() => showBanner = false}
          class="p-1.5 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
          title="Dismiss"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
    </div>
  </div>
{/if}
