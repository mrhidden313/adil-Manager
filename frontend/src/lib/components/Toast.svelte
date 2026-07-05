<script lang="ts">
  import { toast } from '$lib/stores/toast';
  import { fly } from 'svelte/transition';
  
  // Icon helpers
  const icons = {
    success: `<svg class="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>`,
    error: `<svg class="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>`,
    info: `<svg class="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`
  };

  const bgColors = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    error: 'bg-rose-50 border-rose-200 text-rose-900',
    info: 'bg-blue-50 border-blue-200 text-blue-900'
  };
</script>

<div class="fixed bottom-6 right-6 z-[100] flex flex-col space-y-3">
  {#each $toast as t (t.id)}
    <div 
      in:fly={{ y: 20, duration: 300 }} 
      out:fly={{ y: -20, opacity: 0, duration: 200 }}
      class="flex items-center space-x-3 p-4 pr-6 rounded-2xl shadow-xl border backdrop-blur-md {bgColors[t.type]}"
    >
      <div class="flex-shrink-0">
        {@html icons[t.type]}
      </div>
      <p class="text-sm font-bold tracking-wide">{t.message}</p>
      <button onclick={() => toast.remove(t.id)} class="absolute top-1 right-2 p-1 opacity-50 hover:opacity-100 transition-opacity">
        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  {/each}
</div>
