<script lang="ts">
  import { toast } from '$lib/stores/toast';
  import { onMount } from 'svelte';
  import imageCompression from 'browser-image-compression';
  import ProfileModal from '$lib/components/ProfileModal.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';

  let pads: any[] = $state([]);
  let salesAgents: any[] = $state([]);
  let showProfile = $state(false);
  let showCreateModal = $state(false);
  
  let newName = $state('');
  let newColor = $state('#4f46e5');
  let newTotalTickets = $state('100');
  let newAssignedToId = $state('');
  let isSubmitting = $state(false);
  let showExtraPaidModal = $state(false);
  let activePadForExtra = $state<string | null>(null);
  let extraPaymentNotes = $state('');
  let extraPaymentFile = $state<FileList | null>(null);


  let activeTab = $state('ACTIVE'); // ACTIVE, COMPLETED, PAID

  let filteredPads = $derived.by(() => {
    return pads.filter(p => {
      if (activeTab === 'ACTIVE') return p.status === 'PENDING' || p.status === 'ACTIVE';
      return p.status === activeTab;
    });
  });

  async function fetchData() {
    const token = sessionStorage.getItem('token');
    
    // Fetch Pads
    const resPads = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/pads/company', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (resPads.ok) {
      pads = await resPads.json();
    }

    // Fetch Agents for assignment
    const resAgents = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/users/team', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (resAgents.ok) {
      const team = await resAgents.json();
      salesAgents = team.filter((u: any) => u.role === 'SALES' && u.isActive);
    }
  }

  onMount(() => {
    fetchData();
  });

  async function handleCreatePad(e: Event) {
    e.preventDefault();
    if (!newName || !newTotalTickets || !newAssignedToId) return toast.add('Missing fields', 'error');
    
    isSubmitting = true;
    const token = sessionStorage.getItem('token');
    
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/pads', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          color: newColor,
          totalTickets: newTotalTickets,
          assignedToId: newAssignedToId
        })
      });
      
      if (res.ok) {
        showCreateModal = false;
        newName = '';
        newColor = '#4f46e5';
        newTotalTickets = '100';
        newAssignedToId = '';
        fetchData();
        activeTab = 'ACTIVE';
      } else {
        const err = await res.json();
        toast.add(err.error || 'Failed to create pad', 'error');
      }
    } catch (err) {
      toast.add('Network error', 'error');
    } finally {
      isSubmitting = false;
    }
  }

  async function markAsPaid(padId: string) {
    if (!confirm('Mark this pad as Paid Off?')) return;
    const token = sessionStorage.getItem('token');
    await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/pads/${padId}/status`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID' })
    });
    fetchData();
  }

  async function openExtraPaidModal(padId: string) {
    activePadForExtra = padId;
    extraPaymentNotes = '';
    extraPaymentFile = null;
    showExtraPaidModal = true;
  }

  async function submitExtraPaid(e: Event) {
    e.preventDefault();
    if (!activePadForExtra) return;
    
    isSubmitting = true;
    const token = sessionStorage.getItem('token');
    
    const formData = new FormData();
    if (extraPaymentNotes) formData.append('extraPaymentNotes', extraPaymentNotes);
    if (extraPaymentFile && extraPaymentFile.length > 0) {
      const options = { maxSizeMB: 0.1, maxWidthOrHeight: 1024, useWebWorker: true };
      const compressedFile = await imageCompression(extraPaymentFile[0], options);
      formData.append('proof', compressedFile, extraPaymentFile[0].name);
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/pads/${activePadForExtra}/extra-paid`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        showExtraPaidModal = false;
        fetchData();
        toast.add('Extra amount marked as paid', 'success');
      } else {
        toast.add('Failed to mark as paid', 'error');
      }
    } catch (e) {
      toast.add('Error updating extra paid', 'error');
    } finally {
      isSubmitting = false;
    }
  }

  function getPadRevenue(pad: any) {
    if (!pad.tickets) return 0;
    const confirmed = pad.tickets.filter((t: any) => t.status === 'COMPLETED');
    return confirmed.reduce((sum: number, t: any) => sum + (parseFloat(t.genericData?.amount) || 0), 0);
  }
</script>

<div class="flex h-screen bg-slate-50 text-slate-900 font-sans">
  <!-- Sidebar -->
  <aside class="w-64 bg-slate-900 text-slate-300 flex-col hidden md:flex shadow-2xl z-10">
    <div class="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950">
      <div class="w-8 h-8 rounded-full overflow-hidden mr-3 shadow-lg shadow-indigo-500/20 bg-indigo-50 flex items-center justify-center">
        <img src="/logo.png" alt="Logo" class="w-full h-full object-cover scale-110" onerror={(e) => e.currentTarget.style.display='none'} />
      </div>
      <h1 class="text-xl font-bold text-white tracking-tight">AK Flow</h1>
    </div>
    <div class="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
      <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">Agency Operations</div>
      <button class="w-full flex items-center space-x-3 hover:bg-slate-800 text-slate-300 px-3 py-2.5 rounded-lg font-medium transition-colors" onclick={() => window.location.href='/manager'}>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        <span>Orders (Tasks)</span>
      </button>
      <button class="w-full flex items-center space-x-3 bg-indigo-500/10 text-indigo-400 px-3 py-2.5 rounded-lg font-medium transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        <span>Pads (Copies)</span>
      </button>
      <button class="w-full flex items-center space-x-3 hover:bg-slate-800 text-slate-300 px-3 py-2.5 rounded-lg font-medium transition-colors" onclick={() => window.location.href='/manager/team'}>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
        <span>Staff Management</span>
      </button>
      <button class="w-full flex items-center space-x-3 hover:bg-slate-800 text-slate-300 px-3 py-2.5 rounded-lg font-medium transition-colors" onclick={() => window.location.href='/chat'}>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
        <span>Team Chat</span>
      </button>

      <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-2">Settings</div>
      <button onclick={() => window.location.href = '/manager/settings'} class="w-full flex items-center space-x-3 hover:bg-slate-800 text-slate-300 px-3 py-2.5 rounded-lg font-medium transition-colors">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
        <span>Global Settings</span>
      </button>

      <button onclick={() => showProfile = true} class="w-full flex items-center space-x-3 hover:bg-slate-800 text-slate-300 px-3 py-2.5 rounded-lg font-medium transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        <span>Profile</span>
      </button>
    </div>
    <div class="p-4 border-t border-slate-800">
      <button onclick={() => { sessionStorage.clear(); window.location.href = '/'; }} class="w-full flex items-center space-x-3 hover:bg-slate-800 text-slate-400 hover:text-white px-3 py-2.5 rounded-lg font-medium transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
        <span>Sign Out</span>
      </button>
    </div>
  </aside>

  <!-- Main Content -->
  <main class="flex-1 flex flex-col min-w-0 overflow-hidden">
    <header class="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8">
      <div class="flex items-center md:hidden">
        <div class="w-8 h-8 rounded-full overflow-hidden mr-2 bg-indigo-50 flex items-center justify-center">
          <img src="/logo.png" alt="Logo" class="w-full h-full object-cover scale-110" onerror={(e) => e.currentTarget.style.display='none'} />
        </div>
        <span class="font-bold text-slate-900">AK Flow</span>
      </div>
      <h2 class="hidden md:block text-lg font-semibold text-slate-800">Manage Ticket Pads</h2>
      <div class="flex items-center space-x-4">
        <div class="hidden sm:block text-sm text-slate-500">Manager Mode</div>
        <div class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border border-indigo-200 cursor-pointer" onclick={() => showProfile = true}>
          M
        </div>
        <!-- Mobile Navigation -->
        <div class="md:hidden flex space-x-2">
          <button onclick={() => window.location.href='/manager'} class="text-indigo-600 font-bold text-sm bg-indigo-50 px-3 py-1.5 rounded-full">
            Orders
          </button>
        </div>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50">
      <div class="max-w-7xl mx-auto">
        <div class="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Pads (Copies)</h1>
            <p class="text-slate-500 mt-1 text-sm">Create and assign ticket books to sales agents.</p>
          </div>
          <button onclick={() => showCreateModal = true} class="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-lg shadow-sm transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>
            <span>Create Pad</span>
          </button>
        </div>

        <div class="border-b border-slate-200 mb-6">
          <nav class="-mb-px flex space-x-8" aria-label="Tabs">
            <button onclick={() => activeTab = 'ACTIVE'} class={`whitespace-nowrap py-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'ACTIVE' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'} transition-colors`}>
              Active Pads
            </button>
            <button onclick={() => activeTab = 'COMPLETED'} class={`whitespace-nowrap py-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'COMPLETED' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'} transition-colors`}>
              Completed (Pending Pay)
            </button>
            <button onclick={() => activeTab = 'PAID'} class={`whitespace-nowrap py-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'PAID' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'} transition-colors`}>
              Paid Off
            </button>
          </nav>
        </div>

        {#if filteredPads.length === 0}
          <div class="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
            <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            </div>
            <h3 class="text-lg font-bold text-slate-900 mb-2">No Pads Found</h3>
            <p class="text-slate-500 max-w-md mx-auto mb-6">There are no pads in this status.</p>
          </div>
        {:else}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {#each filteredPads as pad}
              <div class="bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col hover:shadow-md transition-all" style="border-top: 4px solid {pad.color}">
                <div class="p-5 border-b border-slate-100">
                  <div class="flex justify-between items-start mb-2">
                    <h3 class="font-bold text-slate-900 text-lg">{pad.name}</h3>
                    <span class={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                      pad.status === 'ACTIVE' || pad.status === 'PENDING' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                      pad.status === 'COMPLETED' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {pad.status === 'PENDING' ? 'ACTIVE' : pad.status}
                    </span>
                  </div>
                  {#if pad.assignedTo}
                    <p class="text-xs font-semibold text-slate-500 flex items-center">
                      <svg class="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      {pad.assignedTo.name}
                    </p>
                  {/if}
                </div>
                
                <div class="p-5 flex-1 bg-slate-50/50">
                  <div class="flex justify-between items-center mb-4">
                    <div>
                      <p class="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Tickets Left</p>
                      <p class="text-2xl font-black text-slate-900">{pad.totalTickets - pad.ticketsUsed} <span class="text-sm font-medium text-slate-500">/ {pad.totalTickets}</span></p>
                    </div>
                    <div class="text-right">
                      <p class="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Generated</p>
                      <div class="flex items-center justify-end space-x-2">
                        <p class="text-xl font-bold text-emerald-600">
                          Rs {Math.min(getPadRevenue(pad), (currentUser?.company?.maxPadLimit || 45000)).toLocaleString()}
                        </p>
                        {#if getPadRevenue(pad) > (currentUser?.company?.maxPadLimit || 45000)}
                          <button 
                            onclick={() => !pad.extraPaidOff && openExtraPaidModal(pad.id)} 
                            class="px-2 py-1 text-xs font-bold rounded-md shadow-sm transition-colors border {pad.extraPaidOff ? 'bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default' : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 cursor-pointer'}"
                            title={pad.extraPaidOff ? 'Extra amount paid off' : 'Mark extra amount as paid off'}
                          >
                            +{(getPadRevenue(pad) - (currentUser?.company?.maxPadLimit || 45000)).toLocaleString()} {pad.extraPaidOff ? '✓' : ''}
                          </button>
                        {/if}
                      </div>
                    </div>
                  </div>
                  
                  <!-- Progress Bar -->
                  <div class="w-full bg-slate-200 rounded-full h-2 mt-2 overflow-hidden">
                    <div class="h-2 rounded-full transition-all duration-500" style="width: {(pad.ticketsUsed / pad.totalTickets) * 100}%; background-color: {pad.color}"></div>
                  </div>
                </div>

                {#if pad.status === 'COMPLETED'}
                  <div class="px-5 py-4 border-t border-slate-100 bg-white">
                    <button onclick={() => markAsPaid(pad.id)} class="w-full py-2.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors shadow-sm">
                      Mark as Paid Off
                    </button>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </main>
</div>

<!-- Create Pad Modal -->
{#if showCreateModal}
  <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
      <div class="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white relative">
        <div class="absolute top-0 left-0 w-full h-1" style="background-color: {newColor}"></div>
        <div>
          <h3 class="text-xl font-bold text-slate-900">Create Pad</h3>
          <p class="text-xs text-slate-500 mt-1">Assign a new ticket book to an agent.</p>
        </div>
        <button onclick={() => showCreateModal = false} class="text-slate-400 hover:text-slate-700 bg-slate-50 rounded-full p-2 hover:bg-slate-100 transition-colors">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      
      <div class="p-8 overflow-y-auto bg-slate-50/50">
        <form onsubmit={handleCreatePad} class="space-y-5">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Pad Name</label>
            <input type="text" bind:value={newName} required placeholder="e.g., Red Pad A" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm">
          </div>
          <div class="flex gap-4">
            <div class="flex-1">
              <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Total Tickets</label>
              <input type="number" bind:value={newTotalTickets} required min="1" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Color</label>
              <input type="color" bind:value={newColor} class="w-full h-[46px] p-1 bg-white border border-slate-200 rounded-xl cursor-pointer">
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Assign To Sales Agent</label>
            {#if salesAgents.length === 0}
              <p class="text-xs text-rose-500 font-bold bg-rose-50 p-3 rounded-lg border border-rose-100">You need to hire a Sales Agent first.</p>
            {:else}
              <select bind:value={newAssignedToId} required class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm font-medium">
                <option value="">-- Select Agent --</option>
                {#each salesAgents as agent}
                  <option value={agent.id}>{agent.name}</option>
                {/each}
              </select>
            {/if}
          </div>
          
          <div class="pt-4 flex space-x-3">
            <button type="submit" disabled={isSubmitting || salesAgents.length === 0} class="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm shadow-indigo-600/20 text-sm">
              {isSubmitting ? 'Creating...' : 'Create & Assign Pad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}


{#if showExtraPaidModal}
  <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden transform transition-all">
      <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <h3 class="font-bold text-slate-900 text-lg">Mark Extra Amount Paid</h3>
        <button class="text-slate-400 hover:text-slate-700 bg-slate-50 p-2 rounded-full hover:bg-slate-100 transition-colors" onclick={() => showExtraPaidModal = false}>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
        </button>
      </div>
      <div class="p-6">
        <form onsubmit={submitExtraPaid}>
          <div class="space-y-5">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Screenshot (Optional)</label>
              <input type="file" accept="image/*" bind:files={extraPaymentFile} class="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 border border-slate-200 rounded-xl cursor-pointer bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Notes (Optional)</label>
              <textarea bind:value={extraPaymentNotes} rows="3" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm" placeholder="Any payment notes or references..."></textarea>
            </div>
            
            <button type="submit" disabled={isSubmitting} class="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-200 focus:ring-4 focus:ring-indigo-100 transition-all disabled:opacity-70 flex items-center justify-center">
              {#if isSubmitting}
                <svg class="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Processing...
              {:else}
                Confirm Paid
              {/if}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}

<BottomNav role="MANAGER" bind:showProfile={showProfile} />

<ProfileModal bind:showProfile />
