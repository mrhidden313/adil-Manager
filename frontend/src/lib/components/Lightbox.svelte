<script lang="ts">
  import { fade, scale } from 'svelte/transition';

  let { src = '', alt = 'Preview', onClose } = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  class="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 md:p-8"
  onclick={onClose}
  transition:fade={{ duration: 200 }}
>
  <button 
    class="absolute top-6 right-6 text-white bg-white/10 hover:bg-white/20 p-2 rounded-full backdrop-blur-md transition-colors"
    onclick={onClose}
  >
    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  </button>
  
  <div 
    class="max-w-5xl w-full max-h-full overflow-hidden flex items-center justify-center"
    onclick={(e) => e.stopPropagation()}
    transition:scale={{ start: 0.95, duration: 200 }}
  >
    <img 
      {src} 
      {alt} 
      class="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
    />
  </div>
</div>
