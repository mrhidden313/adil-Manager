<script lang="ts">
  import { systemLogs, type LogEntry } from '$lib/stores/systemLogs';
  import { onMount } from 'svelte';
  import { toast } from '$lib/stores/toast';

  let logsContainer: HTMLDivElement;
  let copied = $state(false);

  $effect(() => {
    // Whenever $systemLogs updates, auto-scroll to bottom smoothly
    if ($systemLogs && logsContainer) {
      setTimeout(() => {
        logsContainer.scrollTo({ top: logsContainer.scrollHeight, behavior: 'smooth' });
      }, 60);
    }
  });

  function copyAll() {
    const text = $systemLogs.map(l => `[${l.timestamp.toLocaleTimeString()}] [${l.type}] ${l.message} ${l.details ? `| ${l.details}` : ''}`).join('\n');
    navigator.clipboard.writeText(text);
    copied = true;
    toast.add('Live logs copied to clipboard!', 'success');
    setTimeout(() => copied = false, 2000);
  }
</script>

<div class="mt-4 border border-slate-800/80 rounded-2xl bg-slate-950/90 backdrop-blur-xl p-3 flex flex-col shadow-2xl overflow-hidden relative group">
  <div class="flex items-center justify-between border-b border-slate-800/60 pb-2 mb-2">
    <div class="flex items-center space-x-2">
      <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
      <span class="w-2 h-2 rounded-full bg-emerald-400 -ml-4"></span>
      <span class="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-300">Live System Terminal</span>
    </div>
    <div class="flex items-center space-x-1.5">
      <button onclick={copyAll} title="Copy to clipboard" class="px-2 py-0.5 rounded text-[9px] font-mono font-bold border transition-colors {copied ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 border-slate-700/50'} flex items-center gap-1">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        <span>{copied ? 'Copied' : 'Copy'}</span>
      </button>
      <button onclick={() => systemLogs.clear()} title="Clear logs" class="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-800/60 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700/50 hover:border-rose-500/30 transition-colors">
        Clear
      </button>
    </div>
  </div>

  <div bind:this={logsContainer} class="h-44 overflow-y-auto space-y-1.5 pr-1 font-mono text-[10px] scrollbar-thin scrollbar-thumb-slate-800">
    {#if $systemLogs.length === 0}
      <div class="text-center py-6 text-slate-600 italic">No logs generated yet...</div>
    {:else}
      {#each [...$systemLogs].reverse() as log (log.id)}
        <div class="p-1.5 rounded-lg transition-all animate-fade-in {log.type === 'ERROR' ? 'bg-rose-500/10 border border-rose-500/20 text-rose-300' : log.type === 'SUCCESS' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' : log.type === 'WARNING' ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300' : 'bg-slate-900/60 border border-slate-800/60 text-slate-300'}">
          <div class="flex items-center justify-between text-[9px] opacity-75 mb-0.5">
            <span class="font-bold">{log.type}</span>
            <span>{log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
          <div class="leading-tight break-words font-semibold">{log.message}</div>
          {#if log.details}
            <div class="mt-0.5 text-[8.5px] opacity-80 break-all bg-black/30 p-1 rounded font-normal">{log.details}</div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
</style>
