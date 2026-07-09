<script lang="ts">
  import { toast } from '$lib/stores/toast';
  import { onMount, onDestroy } from 'svelte';
  import ProfileModal from '$lib/components/ProfileModal.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import Lightbox from '$lib/components/Lightbox.svelte';
  import imageCompression from 'browser-image-compression';

  let tickets: any[] = $state([]);
  let payouts: any[] = $state([]);
  let notifications: any[] = $state([]);
  
  let showProfile = $state(false);
  let showLightbox = $state(false);
  let lightboxSrc = $state('');

  function openLightbox(src: string) {
    lightboxSrc = src;
    showLightbox = true;
  }

  // Create Order Modal State
  let showModal = $state(false);
  let customerName = $state('');
  let countryCode = $state('+92');
  let phoneDigits = $state('');
  let amount = $state('');
  let paymentMethod = $state('EASYPAISA'); // EASYPAISA, JAZZCASH, BANK
  let bankType = $state('');
  let notes = $state('');
  let ticketNumber = $state('');
  let proofFile: FileList | null = $state(null);
  let isSubmitting = $state(false);

  let showNotifications = $state(false);

  let activeTab = $state('ORDERS'); // ORDERS, PAYOUTS

  // Stats — REJECTED excluded from all totals
  let activeTickets = $derived(tickets.filter(t => t.status !== 'REJECTED'));
  let totalSales = $derived(activeTickets.reduce((sum, t) => sum + (t.price || 0), 0));
  let totalTickets = $derived(activeTickets.length);
  let pendingBonus = $derived(tickets.filter(t => t.status === 'COMPLETED').reduce((sum, t) => sum + (t.bonusAmount || 0), 0) - payouts.reduce((sum, p) => sum + p.amount, 0));
  let paidBonus = $derived(payouts.filter(p => p.status === 'APPROVED').reduce((sum, p) => sum + p.amount, 0));

  let ordersTab = $state('ALL'); // ALL, PENDING, APPROVED, COMPLETED
  let sortedTickets = $derived(tickets.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  let displayedTickets = $derived(sortedTickets.filter(t => ordersTab === 'ALL' || t.status === ordersTab));

  async function fetchData() {
    const token = sessionStorage.getItem('token');
    
    const [resTickets, resPayouts, resNotif] = await Promise.all([
      fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/tickets', { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/payouts', { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/notifications', { headers: { 'Authorization': `Bearer ${token}` } })
    ]);

    if (resTickets.status === 401) { sessionStorage.clear(); window.location.href='/'; return; }
    
    if (resTickets.ok) tickets = await resTickets.json();
    if (resPayouts.ok) payouts = await resPayouts.json();
    if (resNotif.ok) notifications = await resNotif.json();
  }

  let pollInterval: any;
  onMount(() => {
    fetchData();
    pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible' && !isSubmitting) fetchData();
    }, 5000);
    return () => clearInterval(pollInterval);
  });


  async function handleCreateTicket(e: Event) {
    e.preventDefault();
    if (!proofFile || proofFile.length === 0) return toast.add('Please attach payment proof.', 'error');
    if (!customerName || !amount || parseFloat(amount) <= 0) return toast.add('Please provide valid customer name and amount.', 'error');

    isSubmitting = true;
    const token = sessionStorage.getItem('token');
    
    try {
      const options = { maxSizeMB: 0.1, maxWidthOrHeight: 1024, useWebWorker: true };
      const compressedFile = await imageCompression(proofFile[0], options);
      
      const formData = new FormData();
      formData.append('transactionId', `TRX-${Date.now()}-${Math.floor(Math.random() * 1000)}`);
      formData.append('price', amount);
      
      formData.append('genericData', JSON.stringify({
        name: customerName,
        phone: countryCode + phoneDigits,
        ticketNumber,
        paymentMethod,
        bankType: paymentMethod === 'BANK' ? bankType : '',
        notes
      }));

      formData.append('proof', compressedFile, proofFile[0].name);

      const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/tickets', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (res.ok) {
        showModal = false;
        customerName = ''; countryCode = '+92'; phoneDigits = ''; ticketNumber = ''; amount = ''; paymentMethod = 'EASYPAISA'; bankType = ''; notes = ''; proofFile = null;
        toast.add('Order submitted! You will earn a 10% bonus when completed.', 'success');
        fetchData();
      } else {
        const err = await res.json();
        toast.add(err.error || 'Failed to create order', 'error');
      }
    } catch (err) {
      toast.add('Error connecting to server.', 'error');
    } finally {
      isSubmitting = false;
    }
  }

  async function approvePayout(payoutId: string) {
    const token = sessionStorage.getItem('token');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/payouts/${payoutId}/approve`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.add('Payout approved successfully!', 'success');
        fetchData();
      } else {
        toast.add('Failed to approve payout', 'error');
      }
    } catch (err) {
      toast.add('Network error', 'error');
    }
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

<div class="flex h-screen bg-slate-50 text-slate-900 font-sans pb-16 md:pb-0">
  
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
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
        <span>Dashboard</span>
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

        <button class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold border border-blue-200 cursor-pointer" onclick={() => showProfile = true}>S</button>
      </div>
    </header>

    <!-- Page Content -->
    <div class="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50">
      <div class="max-w-6xl mx-auto space-y-6">
        
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h1 class="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Welcome back!</h1>
            <p class="text-slate-500 mt-1 text-sm">Track your performance and submit new orders.</p>
          </div>
          <button onclick={() => showModal = true} class="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-lg shadow-sm shadow-indigo-600/20 transition-all focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>
            <span>Submit New Order</span>
          </button>
        </div>

        <!-- Top Stats -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
            <div class="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full"></div>
            <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Sales</p>
            <p class="text-3xl font-black text-slate-900">PKR {totalSales.toLocaleString()}</p>
            <p class="text-xs text-emerald-600 font-bold mt-2">{totalTickets} Orders</p>
          </div>

          <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
            <div class="absolute right-0 top-0 w-24 h-24 bg-blue-500/5 rounded-bl-full"></div>
            <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Tickets</p>
            <p class="text-3xl font-black text-blue-600">{totalTickets}</p>
            <p class="text-xs text-slate-500 font-medium mt-2">Active orders</p>
          </div>
          
          <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
            <div class="absolute right-0 top-0 w-24 h-24 bg-amber-500/5 rounded-bl-full"></div>
            <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Pending Bonus (10%)</p>
            <p class="text-3xl font-black text-amber-600">PKR {pendingBonus.toLocaleString()}</p>
            <p class="text-xs text-slate-500 font-medium mt-2">Waiting for Manager to pay</p>
          </div>
          
          <div class="bg-gradient-to-br from-indigo-600 to-purple-700 p-5 rounded-2xl shadow-md border border-indigo-500 text-white relative overflow-hidden flex flex-col justify-between">
            <div>
              <p class="text-xs font-bold text-indigo-200 uppercase tracking-wider mb-1">Total Paid Bonus</p>
              <p class="text-3xl font-black">PKR {paidBonus.toLocaleString()}</p>
            </div>
            <p class="text-xs text-indigo-100 font-medium mt-2">Total cash received</p>
          </div>
        </div>


        <!-- Main Tabs -->
        <div class="border-b border-slate-200 mt-8 mb-4">
          <nav class="-mb-px flex space-x-8" aria-label="Tabs">
            <button onclick={() => activeTab = 'ORDERS'} class={`whitespace-nowrap py-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'ORDERS' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} transition-colors`}>
              My Orders
            </button>
            <button onclick={() => activeTab = 'PAYOUTS'} class={`whitespace-nowrap py-4 px-1 border-b-2 font-semibold text-sm flex items-center gap-2 ${activeTab === 'PAYOUTS' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} transition-colors`}>
              My Payouts
              {#if payouts.filter(p => p.status === 'PENDING').length > 0}
                <span class="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">Needs Approval</span>
              {/if}
            </button>
          </nav>
        </div>

        {#if activeTab === 'ORDERS'}
          <div class="flex space-x-4 mb-4 overflow-x-auto pb-2">
            <button onclick={() => ordersTab = 'ALL'} class={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-colors ${ordersTab === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>All Orders</button>
            <button onclick={() => ordersTab = 'PENDING'} class={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-colors ${ordersTab === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Pending</button>
            <button onclick={() => ordersTab = 'APPROVED'} class={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-colors ${ordersTab === 'APPROVED' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Approved</button>
            <button onclick={() => ordersTab = 'COMPLETED'} class={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-colors ${ordersTab === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Completed</button>
          </div>

          <div class="space-y-4">
            {#if displayedTickets.length === 0}
              <div class="p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-100 shadow-sm">No orders found.</div>
            {/if}
            {#each displayedTickets as ticket}
              <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center transition-all border-l-4 {ticket.status === 'COMPLETED' ? 'border-l-emerald-400' : ticket.status === 'APPROVED' ? 'border-l-indigo-400' : 'border-l-amber-400'}">
                <div>
                  <h3 class="font-bold text-slate-900 text-lg">{ticket.genericData?.name || ticket.transactionId}</h3>
                  <div class="flex items-center space-x-3 mt-1">
                    <span class="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-xs font-bold border border-emerald-100">
                      PKR {ticket.price}
                    </span>
                    <span class="text-xs font-medium text-slate-500">Bonus: <span class="font-bold {ticket.bonusStatus === 'PAID' ? 'text-emerald-600' : 'text-amber-500'}">PKR {ticket.bonusAmount} ({ticket.bonusStatus})</span></span>
                  </div>
                  <p class="text-xs text-slate-400 mt-2">{new Date(ticket.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <span class={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide border ${
                    ticket.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    ticket.status === 'APPROVED' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                    'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {ticket.status}
                  </span>
                </div>
              </div>
            {/each}
          </div>
        {/if}

        {#if activeTab === 'PAYOUTS'}
          <div class="space-y-4">
            {#if payouts.length === 0}
              <div class="p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-100 shadow-sm">No payouts yet.</div>
            {/if}
            {#each payouts as payout}
              <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <p class="font-black text-slate-900 text-2xl">PKR {payout.amount.toFixed(2)}</p>
                  <p class="text-xs text-slate-500 mt-1">{new Date(payout.createdAt).toLocaleString()}</p>
                  <span class="inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border {payout.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}">
                    {payout.status === 'APPROVED' ? 'Received & Approved' : 'Waiting for Your Approval'}
                  </span>
                </div>
                <div class="flex items-center gap-3 w-full sm:w-auto">
                  <button onclick={() => openLightbox(payout.proofUrl)} class="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-100 text-slate-700 hover:bg-slate-200 px-4 py-2 rounded-xl text-sm font-bold transition">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                    View Proof
                  </button>
                  {#if payout.status === 'PENDING'}
                    <button onclick={() => approvePayout(payout.id)} class="flex-1 sm:flex-none bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition">
                      Approve Payout
                    </button>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </main>
</div>

<!-- Submit Order Modal -->
{#if showModal}
  <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
      <div class="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white relative">
        <div class="absolute top-0 left-0 w-full h-1 bg-indigo-600"></div>
        <div>
          <h2 class="text-xl font-bold text-slate-900">Submit New Order</h2>
        </div>
        <button class="text-slate-400 hover:text-slate-700 bg-slate-50 p-2 rounded-full transition-colors" onclick={() => showModal = false}>
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      
      <div class="p-6 overflow-y-auto bg-slate-50/50">
        <form onsubmit={handleCreateTicket} class="space-y-4">

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Customer Name</label>
            <input type="text" required bind:value={customerName} placeholder="e.g., Ali Khan" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm">
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Phone Number</label>
            <div class="flex space-x-2">
              <select bind:value={countryCode} class="w-32 px-2 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm font-medium">
                <option disabled value="">── Top ──</option>
                <option value="+92">🇵🇰 PK +92</option>
                <option value="+966">🇸🇦 SA +966</option>
                <option value="+968">🇴🇲 OM +968</option>
                <option value="+971">🇦🇪 AE +971</option>
                <option disabled value="">── All ──</option>
                <option value="+93">🇦🇫 AF +93</option>
                <option value="+355">🇦🇱 AL +355</option>
                <option value="+213">🇩🇿 DZ +213</option>
                <option value="+376">🇦🇩 AD +376</option>
                <option value="+244">🇦🇴 AO +244</option>
                <option value="+54">🇦🇷 AR +54</option>
                <option value="+374">🇦🇲 AM +374</option>
                <option value="+61">🇦🇺 AU +61</option>
                <option value="+43">🇦🇹 AT +43</option>
                <option value="+994">🇦🇿 AZ +994</option>
                <option value="+973">🇧🇭 BH +973</option>
                <option value="+880">🇧🇩 BD +880</option>
                <option value="+32">🇧🇪 BE +32</option>
                <option value="+501">🇧🇿 BZ +501</option>
                <option value="+229">🇧🇯 BJ +229</option>
                <option value="+975">🇧🇹 BT +975</option>
                <option value="+591">🇧🇴 BO +591</option>
                <option value="+387">🇧🇦 BA +387</option>
                <option value="+267">🇧🇼 BW +267</option>
                <option value="+55">🇧🇷 BR +55</option>
                <option value="+673">🇧🇳 BN +673</option>
                <option value="+359">🇧🇬 BG +359</option>
                <option value="+226">🇧🇫 BF +226</option>
                <option value="+257">🇧🇮 BI +257</option>
                <option value="+855">🇰🇭 KH +855</option>
                <option value="+237">🇨🇲 CM +237</option>
                <option value="+1">🇨🇦 CA +1</option>
                <option value="+238">🇨🇻 CV +238</option>
                <option value="+236">🇨🇫 CF +236</option>
                <option value="+235">🇹🇩 TD +235</option>
                <option value="+56">🇨🇱 CL +56</option>
                <option value="+86">🇨🇳 CN +86</option>
                <option value="+57">🇨🇴 CO +57</option>
                <option value="+269">🇰🇲 KM +269</option>
                <option value="+242">🇨🇬 CG +242</option>
                <option value="+506">🇨🇷 CR +506</option>
                <option value="+385">🇭🇷 HR +385</option>
                <option value="+53">🇨🇺 CU +53</option>
                <option value="+357">🇨🇾 CY +357</option>
                <option value="+420">🇨🇿 CZ +420</option>
                <option value="+45">🇩🇰 DK +45</option>
                <option value="+253">🇩🇯 DJ +253</option>
                <option value="+1767">🇩🇲 DM +1767</option>
                <option value="+1809">🇩🇴 DO +1809</option>
                <option value="+593">🇪🇨 EC +593</option>
                <option value="+20">🇪🇬 EG +20</option>
                <option value="+503">🇸🇻 SV +503</option>
                <option value="+240">🇬🇶 GQ +240</option>
                <option value="+291">🇪🇷 ER +291</option>
                <option value="+372">🇪🇪 EE +372</option>
                <option value="+251">🇪🇹 ET +251</option>
                <option value="+679">🇫🇯 FJ +679</option>
                <option value="+358">🇫🇮 FI +358</option>
                <option value="+33">🇫🇷 FR +33</option>
                <option value="+241">🇬🇦 GA +241</option>
                <option value="+220">🇬🇲 GM +220</option>
                <option value="+995">🇬🇪 GE +995</option>
                <option value="+49">🇩🇪 DE +49</option>
                <option value="+233">🇬🇭 GH +233</option>
                <option value="+30">🇬🇷 GR +30</option>
                <option value="+1473">🇬🇩 GD +1473</option>
                <option value="+502">🇬🇹 GT +502</option>
                <option value="+224">🇬🇳 GN +224</option>
                <option value="+245">🇬🇼 GW +245</option>
                <option value="+592">🇬🇾 GY +592</option>
                <option value="+509">🇭🇹 HT +509</option>
                <option value="+504">🇭🇳 HN +504</option>
                <option value="+36">🇭🇺 HU +36</option>
                <option value="+354">🇮🇸 IS +354</option>
                <option value="+91">🇮🇳 IN +91</option>
                <option value="+62">🇮🇩 ID +62</option>
                <option value="+98">🇮🇷 IR +98</option>
                <option value="+964">🇮🇶 IQ +964</option>
                <option value="+353">🇮🇪 IE +353</option>
                <option value="+972">🇮🇱 IL +972</option>
                <option value="+39">🇮🇹 IT +39</option>
                <option value="+1876">🇯🇲 JM +1876</option>
                <option value="+81">🇯🇵 JP +81</option>
                <option value="+962">🇯🇴 JO +962</option>
                <option value="+7">🇰🇿 KZ +7</option>
                <option value="+254">🇰🇪 KE +254</option>
                <option value="+686">🇰🇮 KI +686</option>
                <option value="+965">🇰🇼 KW +965</option>
                <option value="+996">🇰🇬 KG +996</option>
                <option value="+856">🇱🇦 LA +856</option>
                <option value="+371">🇱🇻 LV +371</option>
                <option value="+961">🇱🇧 LB +961</option>
                <option value="+266">🇱🇸 LS +266</option>
                <option value="+231">🇱🇷 LR +231</option>
                <option value="+218">🇱🇾 LY +218</option>
                <option value="+423">🇱🇮 LI +423</option>
                <option value="+370">🇱🇹 LT +370</option>
                <option value="+352">🇱🇺 LU +352</option>
                <option value="+261">🇲🇬 MG +261</option>
                <option value="+265">🇲🇼 MW +265</option>
                <option value="+60">🇲🇾 MY +60</option>
                <option value="+960">🇲🇻 MV +960</option>
                <option value="+223">🇲🇱 ML +223</option>
                <option value="+356">🇲🇹 MT +356</option>
                <option value="+692">🇲🇭 MH +692</option>
                <option value="+222">🇲🇷 MR +222</option>
                <option value="+230">🇲🇺 MU +230</option>
                <option value="+52">🇲🇽 MX +52</option>
                <option value="+691">🇫🇲 FM +691</option>
                <option value="+373">🇲🇩 MD +373</option>
                <option value="+377">🇲🇨 MC +377</option>
                <option value="+976">🇲🇳 MN +976</option>
                <option value="+382">🇲🇪 ME +382</option>
                <option value="+212">🇲🇦 MA +212</option>
                <option value="+258">🇲🇿 MZ +258</option>
                <option value="+264">🇳🇦 NA +264</option>
                <option value="+674">🇳🇷 NR +674</option>
                <option value="+977">🇳🇵 NP +977</option>
                <option value="+31">🇳🇱 NL +31</option>
                <option value="+64">🇳🇿 NZ +64</option>
                <option value="+505">🇳🇮 NI +505</option>
                <option value="+227">🇳🇪 NE +227</option>
                <option value="+234">🇳🇬 NG +234</option>
                <option value="+389">🇲🇰 MK +389</option>
                <option value="+47">🇳🇴 NO +47</option>
                <option value="+670">🇹🇱 TL +670</option>
                <option value="+507">🇵🇦 PA +507</option>
                <option value="+675">🇵🇬 PG +675</option>
                <option value="+595">🇵🇾 PY +595</option>
                <option value="+51">🇵🇪 PE +51</option>
                <option value="+63">🇵🇭 PH +63</option>
                <option value="+48">🇵🇱 PL +48</option>
                <option value="+351">🇵🇹 PT +351</option>
                <option value="+974">🇶🇦 QA +974</option>
                <option value="+40">🇷🇴 RO +40</option>
                <option value="+7">🇷🇺 RU +7</option>
                <option value="+250">🇷🇼 RW +250</option>
                <option value="+1869">🇰🇳 KN +1869</option>
                <option value="+1758">🇱🇨 LC +1758</option>
                <option value="+1784">🇻🇨 VC +1784</option>
                <option value="+685">🇼🇸 WS +685</option>
                <option value="+378">🇸🇲 SM +378</option>
                <option value="+239">🇸🇹 ST +239</option>
                <option value="+221">🇸🇳 SN +221</option>
                <option value="+381">🇷🇸 RS +381</option>
                <option value="+248">🇸🇨 SC +248</option>
                <option value="+232">🇸🇱 SL +232</option>
                <option value="+65">🇸🇬 SG +65</option>
                <option value="+421">🇸🇰 SK +421</option>
                <option value="+386">🇸🇮 SI +386</option>
                <option value="+677">🇸🇧 SB +677</option>
                <option value="+252">🇸🇴 SO +252</option>
                <option value="+27">🇿🇦 ZA +27</option>
                <option value="+82">🇰🇷 KR +82</option>
                <option value="+34">🇪🇸 ES +34</option>
                <option value="+94">🇱🇰 LK +94</option>
                <option value="+249">🇸🇩 SD +249</option>
                <option value="+597">🇸🇷 SR +597</option>
                <option value="+268">🇸🇿 SZ +268</option>
                <option value="+46">🇸🇪 SE +46</option>
                <option value="+41">🇨🇭 CH +41</option>
                <option value="+963">🇸🇾 SY +963</option>
                <option value="+886">🇹🇼 TW +886</option>
                <option value="+992">🇹🇯 TJ +992</option>
                <option value="+255">🇹🇿 TZ +255</option>
                <option value="+66">🇹🇭 TH +66</option>
                <option value="+228">🇹🇬 TG +228</option>
                <option value="+676">🇹🇴 TO +676</option>
                <option value="+1868">🇹🇹 TT +1868</option>
                <option value="+216">🇹🇳 TN +216</option>
                <option value="+90">🇹🇷 TR +90</option>
                <option value="+993">🇹🇲 TM +993</option>
                <option value="+688">🇹🇻 TV +688</option>
                <option value="+256">🇺🇬 UG +256</option>
                <option value="+380">🇺🇦 UA +380</option>
                <option value="+44">🇬🇧 UK +44</option>
                <option value="+1">🇺🇸 US +1</option>
                <option value="+598">🇺🇾 UY +598</option>
                <option value="+998">🇺🇿 UZ +998</option>
                <option value="+678">🇻🇺 VU +678</option>
                <option value="+58">🇻🇪 VE +58</option>
                <option value="+84">🇻🇳 VN +84</option>
                <option value="+967">🇾🇪 YE +967</option>
                <option value="+260">🇿🇲 ZM +260</option>
                <option value="+263">🇿🇼 ZW +263</option>
              </select>
              <input type="tel" bind:value={phoneDigits} placeholder="3001234567" class="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm">
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Ticket Number <span class="text-rose-500">*</span></label>
            <input type="number" required bind:value={ticketNumber} min="1" placeholder="e.g., 10, 25, 100" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm">
            <p class="text-[10px] text-slate-500 mt-1">Enter the quantity of tickets for this order.</p>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Amount in PKR</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">PKR</span>
              <input type="number" step="1" required bind:value={amount} placeholder="0" class="w-full pl-14 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm">
            </div>
            <p class="text-[10px] text-emerald-600 mt-1 font-bold">You will earn PKR {amount ? Math.floor(parseFloat(amount) * 0.1).toLocaleString() : '0'} (10% bonus)</p>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Payment Method</label>
            <select bind:value={paymentMethod} class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm font-medium">
              <option value="EASYPAISA">EasyPaisa</option>
              <option value="JAZZCASH">JazzCash</option>
              <option value="BANK">Bank Transfer</option>
            </select>
          </div>

          {#if paymentMethod === 'BANK'}
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Bank Name</label>
              <input type="text" bind:value={bankType} placeholder="e.g., HBL, Meezan, UBL" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm">
            </div>
          {/if}

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Upload Payment Screenshot</label>
            <input type="file" accept="image/*" required bind:files={proofFile} class="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer border border-slate-200 rounded-xl bg-white p-1">
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Notes (Optional)</label>
            <textarea bind:value={notes} placeholder="Any additional notes..." rows="2" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm resize-none"></textarea>
          </div>

          <div class="pt-2">
            <button type="submit" disabled={isSubmitting} class="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm shadow-indigo-600/20 text-sm">
              {isSubmitting ? 'Uploading...' : 'Submit Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}

{#if showLightbox}
  <Lightbox src={lightboxSrc} onClose={() => showLightbox = false} />
{/if}

<BottomNav role="SALES" bind:showProfile={showProfile} />
<ProfileModal bind:showProfile />
