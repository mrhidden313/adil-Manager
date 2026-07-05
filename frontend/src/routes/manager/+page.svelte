<script lang="ts">
  import { toast } from '$lib/stores/toast';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import ProfileModal from '$lib/components/ProfileModal.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import Lightbox from '$lib/components/Lightbox.svelte';

  let tickets: any[] = $state([]);
  let fulfillmentAgents: any[] = $state([]);
  let selectedTicket: any = $state(null);
  
  let showTicketModal = $state(false);
  let showProfile = $state(false);

  let lightboxSrc = $state('');
  let showLightbox = $state(false);

  function openLightbox(src: string) {
    lightboxSrc = src;
    showLightbox = true;
  }
  let assignToId = $state('');
  let isSubmitting = $state(false);
  let notifications: any[] = $state([]);
  let showNotifications = $state(false);

  let activeTab = $state('PENDING'); // PENDING, APPROVED, COMPLETED
  let agentIdFilter = $state<string | null>(null);

  // Filter tickets by the active tab, and optionally by the agentId from URL
  let filteredTickets = $derived.by(() => {
    return tickets.filter(t => {
      // Basic tab matching
      if (t.status !== activeTab) return false;
      
      // If an agent filter is active, only show their tickets
      if (agentIdFilter && t.createdById !== agentIdFilter) return false;

      return true;
    });
  });

  async function fetchData() {
    const token = sessionStorage.getItem('token');
    
    // Fetch tickets
    const resTickets = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/tickets', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (resTickets.status === 401) { sessionStorage.clear(); window.location.href='/'; return; }
    if (resTickets.ok) {
      tickets = await resTickets.json();
    }

    // Fetch team members for the assignment dropdown
    const resTeam = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/users/team', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (resTeam.status === 401) { sessionStorage.clear(); window.location.href='/'; return; }
    if (resTeam.ok) {
      const team = await resTeam.json();
      fulfillmentAgents = team.filter((u: any) => u.role === 'FULFILLMENT' && u.isActive);
    }
    
    // Fetch notifications
    const resNotif = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/notifications', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (resNotif.ok) {
      notifications = await resNotif.json();
    }
  }

  let pollInterval: any;

  onMount(() => {
    // Read the query parameter
    agentIdFilter = $page.url.searchParams.get('agentId');
    fetchData();
    
    // Smart polling: only fetch when tab is visible to reduce server load
    pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible' && !isSubmitting) {
        fetchData();
      }
    }, 3000);
    
    return () => clearInterval(pollInterval);
  });

  function openTicket(ticket: any) {
    selectedTicket = ticket;
    assignToId = '';
    showTicketModal = true;
  }

  async function updateStatus(status: string) {
    if (status === 'APPROVED' && !assignToId) {
      return toast.add('Please select a local agent to assign this ticket to.', 'error');
    }

    isSubmitting = true;
    const token = sessionStorage.getItem('token');

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/tickets/${selectedTicket.id}/status`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          status,
          assignedToId: status === 'APPROVED' ? assignToId : undefined
        })
      });

      if (res.status === 401) { sessionStorage.clear(); window.location.href='/'; return; }
    if (res.ok) {
        showTicketModal = false;
        fetchData();
      } else {
        const err = await res.json();
        toast.add(err.error || 'Failed to update ticket', 'error');
      }
    } catch (e) {
      toast.add('Network error', 'error');
    } finally {
      isSubmitting = false;
    }
  }

  function clearAgentFilter() {
    window.location.href = '/manager';
  }

  async function markNotificationAsRead(id: string) {
    const token = sessionStorage.getItem('token');
    await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/notifications/${id}/read`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchData();
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
      <button class="w-full flex items-center space-x-3 bg-indigo-500/10 text-indigo-400 px-3 py-2.5 rounded-lg font-medium transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        <span>Orders (Tasks)</span>
      </button>
      <button class="w-full flex items-center space-x-3 hover:bg-slate-800 text-slate-300 px-3 py-2.5 rounded-lg font-medium transition-colors" onclick={() => window.location.href='/manager/pads'}>
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
    
    <!-- Header -->
    <header class="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8">
      <div class="flex items-center md:hidden">
        <div class="w-8 h-8 rounded-full overflow-hidden mr-2 bg-indigo-50 flex items-center justify-center">
          <img src="/logo.png" alt="Logo" class="w-full h-full object-cover scale-110" onerror={(e) => e.currentTarget.style.display='none'} />
        </div>
        <span class="font-bold text-slate-900">AK Flow</span>
      </div>
      <h2 class="hidden md:block text-lg font-semibold text-slate-800">Review Orders</h2>
      <div class="flex items-center space-x-4">
        <div class="hidden sm:block text-sm text-slate-500">Manager Mode</div>
        
        <!-- Notifications Bell -->
        <div class="relative">
          <button onclick={() => showNotifications = !showNotifications} class="p-2 text-slate-500 hover:text-indigo-600 transition-colors relative">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            {#if notifications.filter(n => !n.isRead).length > 0}
              <span class="absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-rose-500 rounded-full border-2 border-white"></span>
            {/if}
          </button>
          
          {#if showNotifications}
            <div class="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50">
              <div class="p-4 border-b border-slate-100 bg-slate-50/50">
                <h3 class="font-bold text-slate-900">Notifications</h3>
              </div>
              <div class="max-h-64 overflow-y-auto">
                {#if notifications.length === 0}
                  <div class="p-4 text-center text-sm text-slate-500">No notifications</div>
                {:else}
                  {#each notifications as notif}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div 
                      class="p-4 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                      class:bg-indigo-50={!notif.isRead}
                      onclick={() => markNotificationAsRead(notif.id)}
                    >
                      <div class="flex justify-between items-start mb-1">
                        <span class="text-xs font-bold text-slate-900" class:text-indigo-700={!notif.isRead}>{notif.title}</span>
                        <span class="text-[10px] text-slate-400 font-medium">{new Date(notif.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p class="text-sm text-slate-600 leading-snug">{notif.message}</p>
                    </div>
                  {/each}
                {/if}
              </div>
            </div>
          {/if}
        </div>

        <button class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border border-indigo-200 cursor-pointer" onclick={() => showProfile = true}>
          M
        </button>
        <!-- Mobile Dropdown -->
        <button onclick={() => window.location.href='/manager/team'} class="md:hidden text-indigo-600 font-bold text-sm">
          Staff
        </button>
      </div>
    </header>

    <!-- Page Content -->
    <div class="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50">
      <div class="max-w-5xl mx-auto">
        <div class="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Review Orders</h1>
            <p class="text-slate-500 mt-1 text-sm">Approve tasks and track pipeline progression.</p>
          </div>
          
          <div class="flex flex-col sm:flex-row gap-3">
            {#if agentIdFilter}
              <div class="bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-xl flex items-center space-x-3 text-sm font-bold shadow-sm h-full">
                <span>Filtering by specific agent</span>
                <button onclick={clearAgentFilter} class="p-1 hover:bg-indigo-100 rounded-full transition" title="Clear Filter">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                </button>
              </div>
            {/if}
            <button onclick={() => window.location.href='/manager/pads'} class="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-lg shadow-sm shadow-indigo-600/20 transition-all focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>
              <span>Create New Pad</span>
            </button>
          </div>
        </div>

        <!-- Filter Tabs -->
        <div class="border-b border-slate-200 mb-6">
          <nav class="-mb-px flex space-x-8" aria-label="Tabs">
            <button onclick={() => activeTab = 'PENDING'} class={`whitespace-nowrap py-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'PENDING' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} transition-colors`}>
              Pending Approval
            </button>
            <button onclick={() => activeTab = 'APPROVED'} class={`whitespace-nowrap py-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'APPROVED' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} transition-colors`}>
              Approved
            </button>
            <button onclick={() => activeTab = 'COMPLETED'} class={`whitespace-nowrap py-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'COMPLETED' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} transition-colors`}>
              Confirmed
            </button>
          </nav>
        </div>

        {#if filteredTickets.length === 0}
          <div class="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm mt-8">
            <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <h3 class="text-lg font-bold text-slate-900 mb-2">No Orders Found</h3>
            <p class="text-slate-500 max-w-md mx-auto">There are no orders in the "{activeTab}" status for this view.</p>
          </div>
        {:else}
          <div class="space-y-4">
            {#each filteredTickets as ticket}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div 
                class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center cursor-pointer hover:shadow-md hover:border-slate-300 transition-all active:scale-95"
                class:border-l-4={true}
                class:border-l-amber-400={activeTab === 'PENDING'}
                class:border-l-indigo-400={activeTab === 'APPROVED'}
                class:border-l-emerald-400={activeTab === 'COMPLETED'}
                onclick={() => openTicket(ticket)}
              >
                <div>
                  <div class="flex items-center space-x-3 mb-2 flex-wrap gap-y-2">
                    <span class={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                      activeTab === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      activeTab === 'APPROVED' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                      'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {ticket.status}
                    </span>
                    {#if ticket.createdBy}
                      <span class="flex items-center space-x-1.5 px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold border border-slate-200">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-slate-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" /></svg>
                        <span>Agent: {ticket.createdBy.name}</span>
                      </span>
                    {/if}
                    {#if ticket.pad}
                      <span class="flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200 shadow-sm" style="background-color: {ticket.pad.color}15; color: {ticket.pad.color}">
                        <div class="w-1.5 h-1.5 rounded-full" style="background-color: {ticket.pad.color}"></div>
                        <span>{ticket.pad.name}</span>
                      </span>
                    {/if}
                  </div>
                  <p class="font-bold text-slate-900 text-lg truncate w-[200px] sm:w-[300px] md:w-auto">
                    {ticket.genericData?.name || ticket.transactionId}
                  </p>
                  <p class="text-xs font-medium text-slate-500 mt-1">Submitted: {new Date(ticket.createdAt).toLocaleString()}</p>
                </div>
                <div class="text-slate-400 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </main>
</div>

{#if showTicketModal && selectedTicket}
  <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
      <div class="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
        <h2 class="text-xl font-black text-slate-900">Review Order</h2>
        <button aria-label="Close modal" class="text-slate-400 hover:text-slate-700 bg-slate-50 p-2 rounded-full hover:bg-slate-100 transition-colors" onclick={() => showTicketModal = false}>
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      
      <div class="p-6 overflow-y-auto flex-1 bg-slate-50/50">
        <!-- Hidden Transaction ID from general view unless needed for debugging -->
        
        {#if selectedTicket.pad}
          <div class="mb-5 flex items-center justify-between bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
            <div>
              <span class="block text-[10px] uppercase text-slate-400 font-bold mb-1">Pad Collection</span>
              <span class="text-slate-800 font-semibold">{selectedTicket.pad.name}</span>
            </div>
            <div class="w-8 h-8 rounded-full shadow-inner border border-white/20" style="background-color: {selectedTicket.pad.color}"></div>
          </div>
        {/if}

        {#if selectedTicket.genericData}
          <div class="mb-5 bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
            <span class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Order Details</span>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <span class="block text-[10px] uppercase text-slate-400 font-bold mb-1">Customer Name</span>
                <span class="text-slate-800 font-semibold">{selectedTicket.genericData.name || 'N/A'}</span>
              </div>
              
              {#if selectedTicket.genericData.whatsappNumber}
                <div>
                  <span class="block text-[10px] uppercase text-slate-400 font-bold mb-1">WhatsApp</span>
                  <a href="https://wa.me/{selectedTicket.genericData.whatsappNumber.replace(/[^0-9]/g, '')}" target="_blank" class="inline-flex items-center space-x-1 text-emerald-600 font-bold hover:text-emerald-700 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                    <span>{selectedTicket.genericData.whatsappNumber}</span>
                  </a>
                </div>
              {/if}
              <div>
                <span class="block text-[10px] uppercase text-slate-400 font-bold mb-1">Amount</span>
                <span class="text-emerald-600 font-bold">Rs {selectedTicket.genericData.amount || '0'}</span>
              </div>
              <div>
                <span class="block text-[10px] uppercase text-slate-400 font-bold mb-1">Quantity</span>
                <span class="text-slate-800 font-semibold">{selectedTicket.genericData.quantity || '1'} tickets</span>
              </div>
            </div>
            {#if selectedTicket.genericData.notes}
              <div class="mt-4 pt-3 border-t border-slate-100">
                <span class="block text-[10px] uppercase text-slate-400 font-bold mb-1">Notes</span>
                <p class="text-slate-600 text-sm italic">"{selectedTicket.genericData.notes}"</p>
              </div>
            {/if}
          </div>
        {/if}

        {#if selectedTicket.createdBy}
          <div class="mb-5 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
            <span class="block text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Submitted By</span>
            <span class="text-indigo-900 font-bold">{selectedTicket.createdBy.name}</span>
            <span class="text-indigo-600 text-sm block mt-0.5">{selectedTicket.createdBy.email}</span>
          </div>
        {/if}

        {#if selectedTicket.paymentProofUrl}
          <div class="mb-5">
            <span class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Payment Proof</span>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="bg-white border border-slate-200 p-2 rounded-xl shadow-sm cursor-pointer hover:opacity-90 transition-opacity" onclick={() => openLightbox(selectedTicket.paymentProofUrl)}>
              <img src={selectedTicket.paymentProofUrl} alt="Proof" class="w-full rounded-lg">
            </div>
          </div>
        {/if}

        {#if selectedTicket.status === 'PENDING'}
          <div class="mb-2">
            <span class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Assign Local Agent</span>
            {#if fulfillmentAgents.length === 0}
              <div class="text-sm text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-100">
                You have no active local agents! Go to Staff Management to hire someone first.
              </div>
            {:else}
              <select bind:value={assignToId} class="block w-full rounded-xl border-slate-200 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm font-medium p-3 outline-none">
                <option value="">-- Select Agent --</option>
                {#each fulfillmentAgents as agent}
                  <option value={agent.id}>{agent.name}</option>
                {/each}
              </select>
            {/if}
          </div>
        {/if}
      </div>
      
      {#if selectedTicket.status === 'PENDING'}
        <div class="p-6 border-t border-slate-100 bg-white flex space-x-3">
          <button onclick={() => updateStatus('REJECTED')} disabled={isSubmitting} class="flex-1 bg-rose-50 border border-rose-200 text-rose-700 font-bold py-3 px-4 rounded-xl hover:bg-rose-100 disabled:opacity-50 transition-colors">
            Reject
          </button>
          <button onclick={() => updateStatus('APPROVED')} disabled={isSubmitting || (fulfillmentAgents.length === 0)} class="flex-1 bg-indigo-600 text-white font-bold py-3 px-4 rounded-xl shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {isSubmitting ? 'Approving...' : 'Approve'}
          </button>
        </div>
      {:else}
        <div class="p-6 border-t border-slate-100 bg-white text-center">
          <button onclick={() => showTicketModal = false} class="w-full bg-slate-100 text-slate-700 font-bold py-3 px-4 rounded-xl hover:bg-slate-200 transition-colors">
            Close
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

{#if showLightbox}
  <Lightbox src={lightboxSrc} onClose={() => showLightbox = false} />
{/if}

<BottomNav role="MANAGER" bind:showProfile={showProfile} />

<ProfileModal bind:showProfile />
