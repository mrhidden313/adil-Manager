<script lang="ts">
  import { toast } from '$lib/stores/toast';
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import ProfileModal from '$lib/components/ProfileModal.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import Lightbox from '$lib/components/Lightbox.svelte';
  


  let tickets: any[] = $state([]);
  let payouts: any[] = $state([]);
  let fulfillmentAgents: any[] = $state([]);
  let salesAgents: any[] = $state([]);
  
  let selectedTicket: any = $state(null);
  let showTicketModal = $state(false);
  
  let selectedAgentForPayout: any = $state(null);
  let showPayoutModal = $state(false);
  let payoutProofFile: File | null = $state(null);
  let payoutProofPreview: string = $state('');
  let payoutAmount = $state('');

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

  let activeTab = $state('ORDERS'); // ORDERS, PAYOUTS
  let ordersTab = $state('PENDING'); // PENDING, APPROVED, COMPLETED

  // Computed Stats — REJECTED tickets excluded from all totals
  let activeTickets = $derived(tickets.filter(t => t.status !== 'REJECTED'));
  let totalAmount = $derived(activeTickets.reduce((acc, t) => acc + (t.price || 0), 0));
  let totalOrders = $derived(activeTickets.length);
  let totalTickets = $derived(activeTickets.reduce((sum, t) => sum + (parseInt(t.genericData?.ticketNumber) || 1), 0));
  let totalBonusEarned = $derived(tickets.filter(t => t.status === 'COMPLETED').reduce((acc, t) => acc + (t.bonusAmount || 0), 0));
  let totalBonusPaid = $derived(payouts.filter(p => p.status === 'APPROVED').reduce((acc, p) => acc + p.amount, 0));
  let totalBonusPending = $derived(totalBonusEarned - payouts.reduce((acc, p) => acc + p.amount, 0));

  // Group pending bonus by agent
  let agentPendingBonuses = $derived.by(() => {
    const map = new Map<string, number>();
    tickets.filter(t => t.status === 'COMPLETED').forEach(t => {
      map.set(t.createdById, (map.get(t.createdById) || 0) + (t.bonusAmount || 0));
    });
    payouts.forEach(p => {
      if (map.has(p.agentId)) {
        map.set(p.agentId, map.get(p.agentId)! - p.amount);
      }
    });
    return map;
  });

  let filteredTickets = $derived.by(() => {
    return tickets.filter(t => t.status === ordersTab);
  });

  async function fetchData() {
    const token = localStorage.getItem('token');
    
    const [resTickets, resTeam, resPayouts, resNotif] = await Promise.all([
      fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/tickets', { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/users/team', { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/payouts', { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/notifications', { headers: { 'Authorization': `Bearer ${token}` } })
    ]);

    if (resTickets.status === 401) { localStorage.clear(); window.location.href='/'; return; }
    
    if (resTickets.ok) tickets = await resTickets.json();
    if (resPayouts.ok) payouts = await resPayouts.json();
    if (resNotif.ok) notifications = await resNotif.json();
    
    if (resTeam.ok) {
      const team = await resTeam.json();
      fulfillmentAgents = team.filter((u: any) => u.role === 'FULFILLMENT' && u.isActive);
      salesAgents = team.filter((u: any) => u.role === 'SALES' && u.isActive);
    }
  }

  let pollInterval: any;
  onMount(() => {
    fetchData();
    pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible' && !isSubmitting) fetchData();
    }, 5000);
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
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/tickets/${selectedTicket.id}/status`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, assignedToId: status === 'APPROVED' ? assignToId : undefined })
      });
      if (res.ok) {
        showTicketModal = false;
        fetchData();
        toast.add('Status updated', 'success');
      } else {
        toast.add('Failed to update', 'error');
      }
    } finally {
      isSubmitting = false;
    }
  }

  function handleProofSelect(e: any) {
    const file = e.target.files[0];
    if (file) {
      payoutProofFile = file;
      payoutProofPreview = URL.createObjectURL(file);
    }
  }

  async function payBonus() {
    if (!payoutProofFile) return toast.add('Please upload a screenshot of the payment.', 'error');
    
    isSubmitting = true;
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('agentId', selectedAgentForPayout.id);
    formData.append('amount', payoutAmount);
    formData.append('proof', payoutProofFile);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/payouts/pay`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        showPayoutModal = false;
        payoutProofFile = null;
        payoutProofPreview = '';
        payoutAmount = '';
        fetchData();
        toast.add('Payout sent successfully', 'success');
      } else {
        const err = await res.json();
        toast.add(err.error || 'Failed to send payout', 'error');
      }
    } finally {
      isSubmitting = false;
    }
  }

  async function markNotificationAsRead(id: string) {
    const token = localStorage.getItem('token');
    await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/notifications/${id}/read`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchData();
  }
</script>

<div class="flex h-screen bg-slate-50 text-slate-900 font-sans pb-16 md:pb-0">
  
  <!-- Sidebar -->
  <aside class="w-64 bg-slate-900 text-slate-300 flex-col hidden md:flex shadow-2xl z-10">
    <div class="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950">
      <div class="w-8 h-8 rounded-full overflow-hidden mr-3 shadow-lg bg-indigo-50 flex items-center justify-center">
        <img src="/logo.png" alt="Logo" class="w-full h-full object-cover scale-110" onerror={(e) => e.currentTarget.style.display='none'} />
      </div>
      <h1 class="text-xl font-bold text-white tracking-tight">AK Flow</h1>
    </div>
    <div class="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
      <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">Dashboard</div>
      <button class="w-full flex items-center space-x-3 bg-indigo-500/10 text-indigo-400 px-3 py-2.5 rounded-lg font-medium transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
        <span>Overview</span>
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
      <button onclick={() => showProfile = true} class="w-full flex items-center space-x-3 hover:bg-slate-800 text-slate-300 px-3 py-2.5 rounded-lg font-medium transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        <span>Profile</span>
      </button>
      <button onclick={() => { localStorage.clear(); window.location.href = '/'; }} class="w-full flex items-center space-x-3 hover:bg-slate-800 text-slate-400 hover:text-white px-3 py-2.5 rounded-lg font-medium transition-colors">
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
      <h2 class="hidden md:block text-lg font-semibold text-slate-800">Manager Dashboard</h2>
      
      <div class="flex items-center space-x-4">
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
                      </div>
                      <p class="text-sm text-slate-600 leading-snug">{notif.message}</p>
                    </div>
                  {/each}
                {/if}
              </div>
            </div>
          {/if}
        </div>
      </div>
    </header>

    <!-- Page Content -->
    <div class="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
      <div class="max-w-6xl mx-auto space-y-6">
                <!-- Top Cinematic Stats -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 animate-stagger" style="animation-delay: 100ms;">

          <!-- Total Generated -->
          <div class="glass-panel p-5 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
            <div class="absolute right-[-10px] top-[-10px] w-20 h-20 bg-teal-400/15 rounded-full blur-lg"></div>
            <div class="absolute left-[-10px] bottom-[-10px] w-16 h-16 bg-rose-400/10 rounded-full blur-lg"></div>
            <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Generated</p>
            <div class="relative z-10">
              <span class="text-[10px] font-semibold text-slate-400">PKR </span>
              <span class="text-2xl font-black text-slate-900">{totalAmount.toLocaleString()}</span>
            </div>
            <p class="text-xs text-indigo-600 font-bold mt-2">{totalOrders} Orders</p>
          </div>

          <!-- Total Tickets -->
          <div class="glass-panel p-5 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
            <div class="absolute right-[-10px] top-[-10px] w-20 h-20 bg-sky-400/15 rounded-full blur-lg"></div>
            <div class="absolute left-[-10px] bottom-[-10px] w-16 h-16 bg-pink-400/10 rounded-full blur-lg"></div>
            <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Tickets</p>
            <span class="text-2xl font-black text-blue-600 relative z-10">{totalTickets}</span>
          </div>
          
          <!-- Pending Bonus -->
          <div class="glass-panel p-5 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
            <div class="absolute right-[-10px] top-[-10px] w-20 h-20 bg-rose-400/15 rounded-full blur-lg"></div>
            <div class="absolute left-[-10px] bottom-[-10px] w-16 h-16 bg-amber-400/10 rounded-full blur-lg"></div>
            <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Pending Bonus</p>
            <div class="relative z-10">
              <span class="text-[10px] font-semibold text-slate-400">PKR </span>
              <span class="text-2xl font-black text-rose-600">{totalBonusPending.toLocaleString()}</span>
            </div>
          </div>
          
          <!-- Paid Bonus -->
          <div class="bg-gradient-to-br from-emerald-500 to-teal-700 p-5 rounded-2xl shadow-lg shadow-emerald-500/20 border border-emerald-500/50 text-white relative overflow-hidden flex flex-col justify-between group hover:scale-[1.02] transition-transform duration-300">
            <div class="absolute right-[-20%] top-[-20%] w-32 h-32 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all"></div>
            <div class="absolute left-0 bottom-0 w-24 h-24 bg-rose-400/20 rounded-full blur-xl"></div>
            <div class="relative z-10">
              <p class="text-[10px] font-bold text-emerald-100 uppercase tracking-wider mb-1">Total Paid Bonus</p>
              <div>
                <span class="text-[10px] font-semibold text-emerald-200">PKR </span>
                <span class="text-2xl font-black">{totalBonusPaid.toLocaleString()}</span>
              </div>
            </div>
          </div>

        </div>

        <!-- Main Tabs: Orders vs Payouts -->
        <div class="border-b border-slate-200 mt-8 mb-4">
          <nav class="-mb-px flex space-x-8" aria-label="Tabs">
            <button onclick={() => activeTab = 'ORDERS'} class={`whitespace-nowrap py-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'ORDERS' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} transition-colors`}>
              Agent Orders
            </button>
            <button onclick={() => activeTab = 'PAYOUTS'} class={`whitespace-nowrap py-4 px-1 border-b-2 font-semibold text-sm flex items-center gap-2 ${activeTab === 'PAYOUTS' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} transition-colors`}>
              Agent Payouts
              {#if totalBonusPending > 0}
                <span class="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">Action Required</span>
              {/if}
            </button>
          </nav>
        </div>

        {#if activeTab === 'ORDERS'}
          <div class="flex space-x-4 mb-4 overflow-x-auto pb-2 animate-stagger" style="animation-delay: 200ms;">
            <button onclick={() => ordersTab = 'PENDING'} class={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${ordersTab === 'PENDING' ? 'bg-amber-500 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'}`}>Pending Approval</button>
            <button onclick={() => ordersTab = 'APPROVED'} class={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${ordersTab === 'APPROVED' ? 'bg-indigo-500 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'}`}>Approved</button>
            <button onclick={() => ordersTab = 'COMPLETED'} class={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${ordersTab === 'COMPLETED' ? 'bg-emerald-500 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'}`}>Completed</button>
          </div>

          <div class="space-y-4">
            {#if filteredTickets.length === 0}
              <div class="p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-100 shadow-sm">No orders found in this status.</div>
            {/if}
            {#each filteredTickets as ticket, index}
              <div class="glass-card p-5 sm:p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4 relative overflow-hidden group hover:shadow-lg transition-all cursor-pointer animate-stagger" style={`animation-delay: ${300 + (index * 50)}ms;`} onclick={() => openTicket(ticket)}>
                <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b {ticket.status === 'COMPLETED' ? 'from-emerald-400 to-emerald-600' : ticket.status === 'APPROVED' ? 'from-indigo-400 to-indigo-600' : ticket.status === 'REJECTED' ? 'from-rose-400 to-rose-600' : 'from-amber-400 to-amber-600'}"></div>
                <div class="flex-1 pl-4">
                  <div class="flex items-center space-x-3 mb-2 flex-wrap gap-y-2">
                    <span class="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border bg-slate-50 text-slate-700 border-slate-200">{ticket.status}</span>
                    <span class="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border bg-emerald-50 text-emerald-700 border-emerald-200">PKR {ticket.price}</span>
                    {#if ticket.genericData?.ticketNumber}
                      <span class="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border bg-amber-50 text-amber-700 border-amber-200">🎫 {ticket.genericData.ticketNumber} tickets</span>
                    {/if}
                  </div>
                  <p class="font-bold text-slate-900 text-lg truncate w-[200px] sm:w-[300px] md:w-auto">{ticket.genericData?.name || ticket.transactionId}</p>
                  <p class="text-xs font-medium text-slate-500 mt-1">By: {ticket.createdBy?.name}</p>
                </div>
              </div>
            {/each}
          </div>
        {/if}

        {#if activeTab === 'PAYOUTS'}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            {#each salesAgents as agent}
              {@const pending = agentPendingBonuses.get(agent.id) || 0}
              <div class="glass-card p-6 flex flex-col sm:flex-row items-center sm:justify-between gap-4">
                <div class="flex items-center gap-4 text-center sm:text-left">
                  <div class="w-12 h-12 bg-indigo-100 text-indigo-700 font-bold rounded-full flex items-center justify-center text-xl">{agent.name.charAt(0)}</div>
                  <div>
                    <h4 class="font-bold text-slate-900">{agent.name}</h4>
                    <p class="text-xs text-slate-500">{agent.email}</p>
                  </div>
                </div>
                
                <div class="flex items-center gap-4 flex-col sm:flex-row w-full sm:w-auto">
                  <div class="text-center sm:text-right">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Bonus</p>
                    <p class="text-xl font-black text-slate-900">PKR {pending.toLocaleString()}</p>
                  </div>
                  <button 
                    onclick={() => { selectedAgentForPayout = agent; showPayoutModal = true; }} 
                    disabled={pending <= 0}
                    class="w-full sm:w-auto bg-indigo-600 text-white font-bold px-4 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition"
                  >
                    Pay Bonus
                  </button>
                </div>
              </div>
            {/each}
          </div>

          <!-- Payout History -->
          <h3 class="text-sm font-bold text-slate-900 mt-8 mb-4 uppercase tracking-wider">Payout History</h3>
          <div class="space-y-4">
            {#if payouts.length === 0}
              <div class="p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-100 shadow-sm">No payout history.</div>
            {/if}
            {#each payouts as payout, index}
              <div class="glass-card p-5 sm:p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4 relative overflow-hidden group hover:shadow-lg transition-all animate-stagger" style={`animation-delay: ${300 + (index * 50)}ms;`}>
                <div>
                  <p class="font-bold text-slate-900">Paid to {payout.agent?.name}</p>
                  <p class="text-xs text-slate-500">{new Date(payout.createdAt).toLocaleString()}</p>
                  <span class="inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border {payout.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}">
                    {payout.status === 'APPROVED' ? 'Agent Approved' : 'Waiting for Agent'}
                  </span>
                </div>
                <div class="flex items-center gap-4">
                  <span class="text-xl font-black text-slate-900">PKR {payout.amount.toLocaleString()}</span>
                  <button onclick={() => openLightbox(payout.proofUrl)} class="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition" title="View Proof">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </main>
</div>

<!-- Modals for Ticket Review and Payout -->
{#if showTicketModal && selectedTicket}
  <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
      <div class="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
        <h2 class="text-xl font-black text-slate-900">Review Order</h2>
        <button class="text-slate-400 hover:text-slate-700 bg-slate-50 p-2 rounded-full hover:bg-slate-100 transition-colors" onclick={() => showTicketModal = false}><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
      </div>
      
      <div class="p-6 overflow-y-auto flex-1 bg-slate-50/50">
        {#if selectedTicket.genericData}
          <div class="mb-5 bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
            <span class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Order Details</span>
            <div class="grid grid-cols-2 gap-4">
              <div><span class="block text-[10px] uppercase text-slate-400 font-bold mb-1">Customer Name</span><span class="text-slate-800 font-semibold">{selectedTicket.genericData.name || 'N/A'}</span></div>
              <div><span class="block text-[10px] uppercase text-slate-400 font-bold mb-1">Total Amount</span><span class="text-emerald-600 font-bold">PKR {selectedTicket.price}</span></div>
              <div><span class="block text-[10px] uppercase text-slate-400 font-bold mb-1">Agent Bonus (10%)</span><span class="text-rose-600 font-bold">PKR {selectedTicket.bonusAmount}</span></div>
              {#if selectedTicket.genericData?.paymentMethod}
              <div>
                <span class="block text-[10px] uppercase text-slate-400 font-bold mb-1">Payment Method</span>
                <span class="text-slate-800 font-semibold">{selectedTicket.genericData.paymentMethod} {selectedTicket.genericData.bankType ? `(${selectedTicket.genericData.bankType})` : ''}</span>
              </div>
              {/if}

              {#if selectedTicket.genericData?.phone}
              <div class="col-span-2 mt-1">
                <span class="block text-[10px] uppercase text-slate-400 font-bold mb-2">Customer Phone / WhatsApp</span>
                <div class="flex items-center space-x-3">
                  <span class="text-slate-800 font-mono font-bold bg-slate-100 px-3 py-2 rounded-lg">{selectedTicket.genericData.phone}</span>
                  <a href={`https://wa.me/${selectedTicket.genericData.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" class="inline-flex items-center space-x-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold px-4 py-2 rounded-lg transition-colors text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                    <span>Message</span>
                  </a>
                </div>
              </div>
              {/if}

              {#if selectedTicket.genericData?.ticketNumber}
              <div class="col-span-2 mt-2"><span class="block text-[10px] uppercase text-amber-500 font-bold mb-1">🎫 Number of Tickets</span><span class="text-2xl font-black text-amber-600">{selectedTicket.genericData.ticketNumber}</span></div>
              {/if}

              {#if selectedTicket.genericData?.notes}
              <div class="col-span-2 mt-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <span class="block text-[10px] uppercase text-amber-600 font-bold mb-1">📝 Agent Notes</span>
                <p class="text-sm text-slate-800 whitespace-pre-wrap">{selectedTicket.genericData.notes}</p>
              </div>
              {/if}
            </div>
          </div>
        {/if}

        {#if selectedTicket.paymentProofUrl}
          <div class="mb-5">
            <span class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Customer Payment Proof</span>
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
            <select bind:value={assignToId} class="block w-full rounded-xl border-slate-200 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm font-medium p-3 outline-none">
              <option value="">-- Select Agent --</option>
              {#each fulfillmentAgents as agent}
                <option value={agent.id}>{agent.name}</option>
              {/each}
            </select>
          </div>
        {/if}
      </div>
      
      {#if selectedTicket.status === 'PENDING'}
        <div class="p-6 border-t border-slate-100 bg-white flex space-x-3">
          <button onclick={() => updateStatus('REJECTED')} disabled={isSubmitting} class="flex-1 bg-rose-50 border border-rose-200 text-rose-700 font-bold py-3 px-4 rounded-xl hover:bg-rose-100 disabled:opacity-50 transition-colors">Reject</button>
          <button onclick={() => updateStatus('APPROVED')} disabled={isSubmitting || (fulfillmentAgents.length === 0)} class="flex-1 bg-indigo-600 text-white font-bold py-3 px-4 rounded-xl shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors">{isSubmitting ? 'Approving...' : 'Approve'}</button>
        </div>
      {/if}
    </div>
  </div>
{/if}

{#if showPayoutModal && selectedAgentForPayout}
  <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
      <div class="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
        <h2 class="text-xl font-black text-slate-900">Pay Bonus</h2>
        <button class="text-slate-400 hover:text-slate-700 bg-slate-50 p-2 rounded-full hover:bg-slate-100 transition-colors" onclick={() => { showPayoutModal = false; payoutProofPreview = ''; payoutProofFile = null; }}><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
      </div>
      
      <div class="p-6 bg-slate-50/50">
        <p class="text-sm text-slate-600 mb-4">You are paying <span class="font-bold text-slate-900">{selectedAgentForPayout.name}</span> — pending bonus: <span class="font-bold text-rose-600">PKR {(agentPendingBonuses.get(selectedAgentForPayout.id) || 0).toLocaleString()}</span>.</p>
        
        <div class="mb-5 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50">
          <span class="block text-xs font-bold text-indigo-900/60 uppercase tracking-wider mb-2">Agent Payment Details</span>
          {#if selectedAgentForPayout.paymentAccountType && selectedAgentForPayout.paymentAccountNumber}
            <div class="flex items-center space-x-3">
              <span class="px-2.5 py-1 bg-white border border-indigo-100 rounded-lg text-xs font-bold text-indigo-700">{selectedAgentForPayout.paymentAccountType}</span>
              <span class="text-indigo-900 font-mono font-bold text-lg">{selectedAgentForPayout.paymentAccountNumber}</span>
            </div>
          {:else}
            <div class="flex items-center space-x-2 text-rose-600 bg-rose-50 px-3 py-2 rounded-lg text-sm font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
              <span>Payment account not added yet.</span>
            </div>
          {/if}
        </div>
        
        <div class="mb-4">
          <label for="payout-amount" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Amount to Pay (PKR)</label>
          <input id="payout-amount" type="number" min="1" bind:value={payoutAmount} placeholder="Enter amount e.g. 5000" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" />
        </div>
        
        <div class="mb-4">
          <label for="payout-proof" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Upload Transfer Screenshot</label>
          <input id="payout-proof" type="file" accept="image/*" onchange={handleProofSelect} class="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all cursor-pointer border border-slate-200 rounded-xl bg-white" />
        </div>

        {#if payoutProofPreview}
          <div class="mt-4 rounded-xl overflow-hidden border border-slate-200 shadow-sm relative">
            <img src={payoutProofPreview} alt="Preview" class="w-full h-48 object-cover">
          </div>
        {/if}
      </div>
      
      <div class="p-6 border-t border-slate-100 bg-white">
        <button onclick={payBonus} disabled={isSubmitting || !payoutProofFile || !payoutAmount} class="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-xl shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          {isSubmitting ? 'Processing Payout...' : `Send PKR ${payoutAmount ? parseFloat(payoutAmount).toLocaleString() : '0'} Payout`}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showLightbox}
  <Lightbox src={lightboxSrc} onClose={() => showLightbox = false} />
{/if}

<BottomNav role="MANAGER" bind:showProfile={showProfile} />
<ProfileModal bind:showProfile />
