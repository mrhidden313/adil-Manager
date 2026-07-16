<script lang="ts">
  let { ticket = {} } = $props();
  let isOpen = $state(false);
  let popoverEl: HTMLDivElement | null = $state(null);

  function formatDate(dateStr: string | Date | undefined): string {
    if (!dateStr) return '—';
    try {
      const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }) + ', ' + d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return '—';
    }
  }

  let createdFormatted = $derived.by(() => {
    // Check audit logs for CREATED action first, otherwise ticket.createdAt
    if (ticket?.auditLogs && Array.isArray(ticket.auditLogs)) {
      const createdLog = ticket.auditLogs.find((l: any) => l.action === 'CREATED');
      if (createdLog?.createdAt) return formatDate(createdLog.createdAt);
    }
    return formatDate(ticket?.createdAt);
  });

  let assignedFormatted = $derived.by(() => {
    if (ticket?.auditLogs && Array.isArray(ticket.auditLogs)) {
      const assignedLog = ticket.auditLogs.find((l: any) => l.action === 'ASSIGNED' || (l.action === 'STATUS_UPDATED' && l.newStatus === 'APPROVED'));
      if (assignedLog?.createdAt) return formatDate(assignedLog.createdAt);
    }
    if (ticket?.assignedToId || ticket?.assignedTo) {
      return formatDate(ticket?.updatedAt || ticket?.createdAt);
    }
    return 'Not assigned yet';
  });

  let completedFormatted = $derived.by(() => {
    if (ticket?.auditLogs && Array.isArray(ticket.auditLogs)) {
      const completedLog = ticket.auditLogs.find((l: any) => l.newStatus === 'COMPLETED');
      if (completedLog?.createdAt) return formatDate(completedLog.createdAt);
    }
    if (ticket?.status === 'COMPLETED') {
      return formatDate(ticket?.updatedAt);
    }
    return 'Not completed yet';
  });

  function toggle(e: MouseEvent) {
    e.stopPropagation();
    isOpen = !isOpen;
  }

  function handleClickOutside(e: MouseEvent) {
    if (isOpen && popoverEl && !popoverEl.contains(e.target as Node)) {
      isOpen = false;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="relative inline-block" bind:this={popoverEl}>
  <!-- Info Icon Button -->
  <button
    type="button"
    onclick={toggle}
    title="View Order Timestamps & History"
    class="p-1.5 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/80 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/30 flex items-center justify-center"
  >
    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
    </svg>
  </button>

  <!-- Popover Box above button -->
  {#if isOpen}
    <div
      class="absolute bottom-full right-0 mb-2 w-64 p-3.5 rounded-2xl bg-slate-900/95 text-white shadow-2xl border border-slate-700/80 backdrop-blur-md z-50 text-left animate-in fade-in zoom-in-95 duration-150"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
        <span class="text-[11px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
          <span>🕒</span> Order Timestamps
        </span>
        <button
          type="button"
          onclick={() => isOpen = false}
          class="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
        >
          <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="space-y-2.5 text-xs">
        <div>
          <p class="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Created At</p>
          <p class="font-semibold text-slate-200">{createdFormatted}</p>
        </div>

        <div>
          <p class="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Assigned At</p>
          <p class="font-semibold {assignedFormatted === 'Not assigned yet' ? 'text-slate-500 italic' : 'text-amber-300'}">{assignedFormatted}</p>
        </div>

        <div>
          <p class="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Completed At</p>
          <p class="font-semibold {completedFormatted === 'Not completed yet' ? 'text-slate-500 italic' : 'text-emerald-400'}">{completedFormatted}</p>
        </div>
      </div>

      <!-- Arrow pointing down -->
      <div class="absolute top-full right-2 -mt-1 border-4 border-transparent border-t-slate-900/95"></div>
    </div>
  {/if}
</div>
