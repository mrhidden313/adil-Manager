<script lang="ts">
  import { toast } from '$lib/stores/toast';
  import { onMount } from 'svelte';
  import ProfileModal from '$lib/components/ProfileModal.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';

  let pads: any[] = $state([]);
  let showProfile = $state(false);

  let activeTab = $state('ACTIVE'); // ACTIVE, COMPLETED

  let filteredPads = $derived.by(() => {
    return pads.filter(p => {
      if (activeTab === 'ACTIVE') return p.status === 'PENDING' || p.status === 'ACTIVE';
      return p.status === 'COMPLETED' || p.status === 'PAID';
    });
  });

  async function fetchPads() {
    const token = sessionStorage.getItem('token');
    if (!token) {
      window.location.href = '/';
      return;
    }
    
    const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/pads/my-pads', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401) { sessionStorage.clear(); window.location.href='/'; return; }
    if (res.ok) {
      pads = await res.json();
    }
  }

  let pollInterval: any;

  onMount(() => {
    fetchPads();
    pollInterval = setInterval(fetchPads, 5000);
    
    return () => clearInterval(pollInterval);
  });

  function getPadRevenue(pad: any) {
    if (!pad.tickets) return 0;
    const confirmed = pad.tickets.filter((t: any) => t.status === 'COMPLETED');
    return confirmed.reduce((sum: number, t: any) => sum + (parseFloat(t.genericData?.amount) || 0), 0);
  }

  async function requestPad() {
    const token = sessionStorage.getItem('token');
    const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/notifications/request-pad', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401) { sessionStorage.clear(); window.location.href='/'; return; }
    if (res.ok) {
      toast.add("Notification sent to your manager requesting a new Pad! Please wait for them to assign it to you.", 'error');
    } else {
      toast.add("Failed to send request. Try again later.", 'error');
    }
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
      <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">Sales Operations</div>
      <button class="w-full flex items-center space-x-3 bg-indigo-500/10 text-indigo-400 px-3 py-2.5 rounded-lg font-medium transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        <span>My Pads</span>
      </button>
      <button class="w-full flex items-center space-x-3 hover:bg-slate-800 text-slate-300 px-3 py-2.5 rounded-lg font-medium transition-colors" onclick={() => window.location.href='/chat'}>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
        <span>Team Chat</span>
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
    
    <!-- Header -->
    <header class="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8">
      <div class="flex items-center md:hidden">
        <div class="w-8 h-8 rounded-full overflow-hidden mr-2 bg-indigo-50 flex items-center justify-center">
          <img src="/logo.png" alt="Logo" class="w-full h-full object-cover scale-110" onerror={(e) => e.currentTarget.style.display='none'} />
        </div>
        <span class="font-bold text-slate-900">AK Flow</span>
      </div>
      <h2 class="hidden md:block text-lg font-semibold text-slate-800">Sales Dashboard</h2>
      <div class="flex items-center space-x-4">
        <div class="hidden sm:block text-sm text-slate-500">Sales Mode</div>
        <button class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold border border-blue-200 cursor-pointer" onclick={() => showProfile = true}>
          S
        </button>
        <button aria-label="Close menu" onclick={() => { sessionStorage.clear(); window.location.href = '/'; }} class="md:hidden text-slate-500 hover:text-slate-900">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
        </button>
      </div>
    </header>

    <!-- Page Content -->
    <div class="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50">
      <div class="max-w-7xl mx-auto">
        <div class="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">My Pads</h1>
            <p class="text-slate-500 mt-1 text-sm">Select a Pad to start submitting orders.</p>
          </div>
          <button onclick={requestPad} class="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-lg shadow-sm shadow-indigo-600/20 transition-all focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>
            <span>Request New Pad</span>
          </button>
        </div>

        <!-- Filter Tabs -->
        <div class="border-b border-slate-200 mb-6">
          <nav class="-mb-px flex space-x-8" aria-label="Tabs">
            <button onclick={() => activeTab = 'ACTIVE'} class={`whitespace-nowrap py-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'ACTIVE' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} transition-colors`}>
              Active Pads
            </button>
            <button onclick={() => activeTab = 'COMPLETED'} class={`whitespace-nowrap py-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'COMPLETED' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} transition-colors`}>
              Past Pads
            </button>
          </nav>
        </div>

        {#if filteredPads.length === 0}
          <div class="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm mt-8">
            <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            </div>
            <h3 class="text-lg font-bold text-slate-900 mb-2">No Pads Found</h3>
            <p class="text-slate-500 max-w-md mx-auto">You have no pads in the "{activeTab}" status.</p>
            {#if activeTab === 'ACTIVE'}
              <button onclick={requestPad} class="inline-flex mt-4 text-indigo-600 font-medium hover:text-indigo-700">
                Request a new Pad from Manager &rarr;
              </button>
            {/if}
          </div>
        {:else}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {#each filteredPads as pad}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div 
                class="bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col hover:shadow-lg transition-all cursor-pointer group"
                style="border-top: 4px solid {pad.color}"
                onclick={() => window.location.href = `/sales/pad/${pad.id}`}
              >
                <div class="p-6">
                  <div class="flex justify-between items-start mb-4">
                    <h3 class="font-bold text-slate-900 text-xl group-hover:text-indigo-600 transition-colors truncate pr-2">{pad.name}</h3>
                    <span class={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                      pad.status === 'ACTIVE' || pad.status === 'PENDING' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                      'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {pad.status === 'PENDING' ? 'ACTIVE' : pad.status}
                    </span>
                  </div>
                  
                  <div class="flex justify-between items-center mb-6">
                    <div>
                      <p class="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Tickets Left</p>
                      <p class="text-3xl font-black text-slate-900">{pad.totalTickets - pad.ticketsUsed}</p>
                    </div>
                    <div class="text-right">
                      <p class="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Generated</p>
                      <div class="flex items-center justify-end space-x-2">
                        <p class="text-xl font-bold text-emerald-600">
                          Rs {Math.min(getPadRevenue(pad), (currentUser?.company?.maxPadLimit || 45000)).toLocaleString()}
                        </p>
                        {#if getPadRevenue(pad) > (currentUser?.company?.maxPadLimit || 45000)}
                          <span class="px-2 py-1 text-xs font-bold rounded-md shadow-sm border {pad.extraPaidOff ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}" title={pad.extraPaidOff ? 'Extra amount paid off by manager' : 'Pending extra amount'}>
                            +{(getPadRevenue(pad) - (currentUser?.company?.maxPadLimit || 45000)).toLocaleString()} {pad.extraPaidOff ? '✓' : ''}
                          </span>
                        {/if}
                      </div>
                    </div>
                  </div>
                  
                  <!-- Progress Bar -->
                  <div class="w-full bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner">
                    <div class="h-3 rounded-full transition-all duration-500" style="width: {(pad.ticketsUsed / pad.totalTickets) * 100}%; background-color: {pad.color}"></div>
                  </div>
                </div>
                
                <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-sm font-bold text-slate-500 group-hover:text-indigo-600 transition-colors">
                  <span>Enter Pad</span>
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </main>
</div>

<BottomNav role="SALES" bind:showProfile={showProfile} />

<ProfileModal bind:showProfile />
