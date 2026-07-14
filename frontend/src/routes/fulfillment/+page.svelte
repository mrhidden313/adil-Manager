<script lang="ts">
  import { toast } from '$lib/stores/toast';
  import { onMount, onDestroy } from 'svelte';
  import ProfileModal from '$lib/components/ProfileModal.svelte';
  import Lightbox from '$lib/components/Lightbox.svelte';
  import { ripple } from '$lib/actions/ripple';

  let tickets: any[] = $state([]);
  let selectedTicket: any = $state(null);
  let showModal = $state(false);
  let showProfile = $state(false);
  
  let proofFile: FileList | null = $state(null);
  let isSubmitting = $state(false);

  let lightboxSrc = $state('');
  let showLightbox = $state(false);

  function openLightbox(src: string) {
    lightboxSrc = src;
    showLightbox = true;
  }

  // Tabs for Local Agent
  let activeTab = $state('APPROVED'); // APPROVED (To-Do), COMPLETED (Done)

  let filteredTickets = $derived.by(() => {
    return tickets.filter(t => t.status === activeTab);
  });

  let totalOrders = $derived(tickets.length);
  let pendingOrders = $derived(tickets.filter(t => t.status === 'APPROVED').length);
  let totalTickets = $derived(tickets.reduce((sum, t) => sum + (parseInt(t.genericData?.ticketNumber) || 1), 0));
  let earnedBonus = $derived(tickets.filter(t => t.status === 'COMPLETED').reduce((sum, t) => sum + ((parseInt(t.genericData?.ticketNumber) || 1) * 2), 0));

  async function fetchTickets() {
    const token = localStorage.getItem('token');
    const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/tickets', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401) { localStorage.clear(); window.location.href='/'; return; }
    if (res.ok) {
      const allTickets = await res.json();
      tickets = allTickets;
    }
  }

  let pollInterval: any;

  onMount(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.role !== 'FULFILLMENT') {
          toast.add('You are logged in as a different role in another tab. Please log in again.', 'error');
          localStorage.clear();
          window.location.href = '/';
          return;
        }
      } catch (e) {}
    }
    
    fetchTickets();
    
    // Smart polling: only fetch when tab is visible to reduce server load
    pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible' && !isSubmitting) {
        fetchTickets();
      }
    }, 3000);
  });

  onDestroy(() => {
    if (pollInterval) clearInterval(pollInterval);
  });

  function openTicket(ticket: any) {
    selectedTicket = ticket;
    proofFile = null;
    showModal = true;
  }

  function handleFinishOrder(e: Event) {
    e.preventDefault();
    if (!proofFile || proofFile.length === 0) return toast.add('Please attach confirmation image.', 'error');
    
    const token = localStorage.getItem('token');
    
    // Capture state before clearing
    const fileToUpload = proofFile[0];
    const ticketId = selectedTicket.id;
    
    // Immediately close modal and give feedback
    showModal = false;
    proofFile = null;
    toast.add('Order finishing... Uploading proof in background 🚀', 'success');
    activeTab = 'COMPLETED'; // Optimistically switch to completed tab

    // Upload asynchronously without compression
    (async () => {
      try {
        const formData = new FormData();
        formData.append('status', 'COMPLETED');
        formData.append('fulfillmentProof', fileToUpload, fileToUpload.name || 'proof.jpg');

        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/tickets/${ticketId}/status`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        
        if (res.status === 401) { localStorage.clear(); window.location.href='/'; return; }
        if (res.ok) {
          toast.add('Order marked as completed successfully!', 'success');
          fetchTickets();
        } else {
          let errMsg = 'Failed to finish order';
          try {
            const errorData = await res.json();
            errMsg = errorData.error || errMsg;
          } catch (e) {
            errMsg = `Server error (${res.status})`;
          }
          toast.add(errMsg, 'error');
          // Revert tab if failed (optional, user can just refresh)
        }
      } catch (err: any) {
        console.error('Fulfillment upload error:', err);
        toast.add(err?.message || 'Error uploading confirmation image.', 'error');
      }
    })();
  }
</script>

<div class="flex h-screen bg-transparent text-slate-800 font-sans">
  
  <!-- Sidebar -->
  <aside class="w-64 bg-slate-900 text-slate-300 flex-col hidden md:flex shadow-2xl z-10">
    <div class="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950">
      <div class="w-8 h-8 rounded-full overflow-hidden mr-3 shadow-lg shadow-indigo-500/20 bg-indigo-50 flex items-center justify-center">
        <img src="/logo.png" alt="Logo" class="w-full h-full object-cover scale-110" onerror={(e) => e.currentTarget.style.display='none'} />
      </div>
      <h1 class="text-xl font-bold text-white tracking-tight">AK Flow</h1>
    </div>
    <div class="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
      <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">Local Operations</div>
      <button class="w-full flex items-center space-x-3 bg-indigo-500/10 text-indigo-400 px-3 py-2.5 rounded-lg font-medium transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
        <span>Assigned Tasks</span>
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
        <span class="font-bold text-slate-800">AK Flow</span>
      </div>
      <h2 class="hidden md:block text-lg font-semibold text-slate-800">Local Agent Dashboard</h2>
      <div class="flex items-center space-x-4">
        <div class="hidden sm:block text-sm text-slate-500">Fulfillment Mode</div>
        <button class="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold border border-emerald-200 cursor-pointer" onclick={() => showProfile = true}>
          L
        </button>
        <button aria-label="Close menu" onclick={() => { localStorage.clear(); window.location.href = '/'; }} class="md:hidden text-slate-500 hover:text-slate-800">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
        </button>
      </div>
    </header>

    <!-- Page Content -->
    <div class="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50">
      <div class="max-w-5xl mx-auto">
        <div class="mb-6">
          <h1 class="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">Assigned Tasks</h1>
          <p class="text-slate-500 mt-1 text-sm">Process and complete your fulfillment queue.</p>
        </div>

        <!-- Top Stats Cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <!-- Total Orders -->
          <div use:ripple class="p-5 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300 rounded-2xl cursor-pointer" style="background: linear-gradient(135deg, rgba(255,255,255,0.7), rgba(255,255,255,0.3)); border: 1px solid rgba(255,255,255,0.8); box-shadow: 0 4px 30px rgba(0,0,0,0.05); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);">
            <div class="absolute right-[-10px] top-[-10px] w-20 h-20 bg-indigo-400/20 rounded-full blur-lg"></div>
            <div class="absolute left-[-10px] bottom-[-10px] w-16 h-16 bg-blue-400/15 rounded-full blur-lg"></div>
            <div class="relative z-10">
              <p class="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">Total Assigned</p>
              <span class="text-2xl font-black text-slate-800">{totalOrders}</span>
              <p class="text-[10px] text-slate-500 font-semibold mt-1">Orders in Queue</p>
            </div>
          </div>

          <!-- Pending Orders -->
          <div use:ripple onclick={() => activeTab = 'APPROVED'} class="p-5 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300 rounded-2xl cursor-pointer" style="background: linear-gradient(135deg, rgba(255,255,255,0.7), rgba(255,255,255,0.3)); border: 1px solid rgba(255,255,255,0.8); box-shadow: 0 4px 30px rgba(0,0,0,0.05); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);">
            <div class="absolute right-[-10px] top-[-10px] w-20 h-20 bg-amber-400/20 rounded-full blur-lg"></div>
            <div class="absolute left-[-10px] bottom-[-10px] w-16 h-16 bg-orange-400/15 rounded-full blur-lg"></div>
            <div class="relative z-10">
              <p class="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">Pending To-Do</p>
              <span class="text-2xl font-black text-amber-700">{pendingOrders}</span>
              <p class="text-[10px] text-amber-700/80 font-semibold mt-1">Needs action</p>
            </div>
          </div>

          <!-- Total Tickets -->
          <div use:ripple class="p-5 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300 rounded-2xl cursor-pointer" style="background: linear-gradient(135deg, rgba(255,255,255,0.7), rgba(255,255,255,0.3)); border: 1px solid rgba(255,255,255,0.8); box-shadow: 0 4px 30px rgba(0,0,0,0.05); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);">
            <div class="absolute right-[-10px] top-[-10px] w-20 h-20 bg-purple-400/20 rounded-full blur-lg"></div>
            <div class="absolute left-[-10px] bottom-[-10px] w-16 h-16 bg-pink-400/15 rounded-full blur-lg"></div>
            <div class="relative z-10">
              <p class="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">Total Tickets</p>
              <span class="text-2xl font-black text-purple-700">{totalTickets}</span>
              <p class="text-[10px] text-purple-700/80 font-semibold mt-1">Tickets in orders</p>
            </div>
          </div>

          <!-- Earned Bonus (2 PKR / Ticket) -->
          <div use:ripple onclick={() => activeTab = 'COMPLETED'} class="p-5 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300 rounded-2xl cursor-pointer" style="background: linear-gradient(135deg, rgba(255,255,255,0.7), rgba(255,255,255,0.3)); border: 1px solid rgba(255,255,255,0.8); box-shadow: 0 4px 30px rgba(0,0,0,0.05); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);">
            <div class="absolute right-[-10px] top-[-10px] w-20 h-20 bg-emerald-400/20 rounded-full blur-lg"></div>
            <div class="absolute left-[-10px] bottom-[-10px] w-16 h-16 bg-teal-400/15 rounded-full blur-lg"></div>
            <div class="relative z-10">
              <p class="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">Earned Bonus (2 PKR/T)</p>
              <div>
                <span class="text-[10px] font-bold text-slate-600">PKR </span>
                <span class="text-2xl font-black text-emerald-700">{earnedBonus.toLocaleString()}</span>
              </div>
              <p class="text-[10px] text-emerald-700/80 font-semibold mt-1">On finished orders</p>
            </div>
          </div>
        </div>

        <!-- Filter Tabs -->
        <div class="border-b border-slate-200 mb-6">
          <nav class="-mb-px flex space-x-8" aria-label="Tabs">
            <button onclick={() => activeTab = 'APPROVED'} class={`whitespace-nowrap py-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'APPROVED' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} transition-colors`}>
              To-Do List
            </button>
            <button onclick={() => activeTab = 'COMPLETED'} class={`whitespace-nowrap py-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'COMPLETED' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} transition-colors`}>
              Finished Orders
            </button>
          </nav>
        </div>

        {#if filteredTickets.length === 0}
          <div class="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm mt-8">
            <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 class="text-lg font-bold text-slate-800 mb-2">Queue Empty!</h3>
            <p class="text-slate-500 max-w-md mx-auto">You have no tasks in the "{activeTab === 'APPROVED' ? 'To-Do' : 'Finished'}" list right now. Relax!</p>
          </div>
        {:else}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {#each filteredTickets as ticket}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div 
                class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:shadow-lg hover:border-indigo-300 transition-all flex flex-col justify-between"
                class:cursor-pointer={activeTab === 'APPROVED'}
                class:active:scale-95={activeTab === 'APPROVED'}
                onclick={() => { if(activeTab === 'APPROVED') openTicket(ticket) }}
              >
                <div>
                  <div class="flex justify-between items-start mb-3">
                    <span class={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                      activeTab === 'APPROVED' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {ticket.status}
                    </span>
                    <span class="text-xs font-bold text-slate-400">{new Date(ticket.updatedAt).toLocaleDateString()}</span>
                  </div>
                  
                  <h3 class="font-bold text-slate-800 text-lg mb-1">{ticket.genericData?.name || ticket.transactionId}</h3>
                  {#if ticket.genericData?.ticketNumber}
                    <div class="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-lg px-2 py-0.5 mb-1">
                      <span class="text-[10px] font-bold text-amber-600 uppercase tracking-wider">🎫 Tickets:</span>
                      <span class="text-sm font-black text-amber-700">{ticket.genericData.ticketNumber}</span>
                    </div>
                  {/if}
                  {#if ticket.genericData?.phone}
                    <p class="text-xs font-bold text-indigo-600 mt-1">📞 {ticket.genericData.phone}</p>
                  {/if}
                  {#if ticket.createdBy}
                    <p class="text-xs font-semibold text-slate-500 mt-1">By: {ticket.createdBy.name}</p>
                  {/if}
                  
                  {#if ticket.genericData?.notes}
                    <div class="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-600 italic">
                      "{ticket.genericData.notes}"
                    </div>
                  {/if}
                </div>
                
                {#if activeTab === 'APPROVED'}
                  <div class="mt-5 border-t border-slate-100 pt-4">
                    <button class="w-full bg-indigo-50 text-indigo-700 font-bold py-2 px-4 rounded-xl shadow-sm hover:bg-indigo-100 transition-colors border border-indigo-100">
                      Finish Order
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

{#if showModal && selectedTicket}
  <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
      <div class="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white relative">
        <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-400"></div>
        <div>
          <h2 class="text-xl font-bold text-slate-800">Finish Order</h2>
          <p class="text-xs text-slate-500 mt-0.5">Upload proof of completion</p>
        </div>
        <button aria-label="Close modal" class="text-slate-400 hover:text-slate-700 bg-slate-50 p-2 rounded-full hover:bg-slate-100 transition-colors" onclick={() => showModal = false}>
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      
      <div class="p-6 overflow-y-auto bg-slate-50/50 space-y-4">
        <!-- Customer Info — NO payment screenshot for local agents -->
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Order Details</span>
          <div class="space-y-3">
            <div>
              <span class="block text-[10px] uppercase text-slate-400 font-bold mb-0.5">Customer Name</span>
              <span class="text-slate-800 font-bold text-base">{selectedTicket.genericData?.name || selectedTicket.transactionId}</span>
            </div>
            {#if selectedTicket.genericData?.phone}
              <div class="mt-2">
                <span class="block text-[10px] uppercase text-slate-400 font-bold mb-1">Customer WhatsApp</span>
                <a href={`https://wa.me/${selectedTicket.genericData.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" class="inline-flex items-center space-x-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold px-4 py-2 rounded-xl transition-colors text-sm w-full sm:w-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                  <span>{selectedTicket.genericData.phone}</span>
                </a>
              </div>
            {/if}
            {#if selectedTicket.genericData?.paymentMethod}
              <div>
                <span class="block text-[10px] uppercase text-slate-400 font-bold mb-0.5">Payment Via</span>
                <span class="inline-block px-2 py-0.5 rounded text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">{selectedTicket.genericData.paymentMethod}{selectedTicket.genericData.bankType ? ' — ' + selectedTicket.genericData.bankType : ''}</span>
              </div>
            {/if}
            {#if selectedTicket.genericData?.notes}
              <div>
                <span class="block text-[10px] uppercase text-slate-400 font-bold mb-0.5">Notes</span>
                <p class="text-sm text-slate-600 italic bg-slate-50 p-2 rounded-lg border border-slate-100">"{selectedTicket.genericData.notes}"</p>
              </div>
            {/if}
            {#if selectedTicket.genericData?.ticketNumber}
              <div class="pt-2 border-t border-slate-100">
                <span class="block text-[10px] uppercase text-amber-500 font-bold mb-0.5">🎫 Number of Tickets</span>
                <span class="text-2xl font-black text-amber-600">{selectedTicket.genericData.ticketNumber}</span>
              </div>
            {/if}
          </div>
        </div>

        <form onsubmit={handleFinishOrder} class="space-y-4">
          <div>
            <label for="proofFile" class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Confirmation Image</label>
            <p class="text-xs text-slate-500 mb-3">Upload a screenshot or photo to confirm this order is complete.</p>
            <input id="proofFile" type="file" accept="image/*" required bind:files={proofFile} class="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer border border-slate-200 rounded-xl bg-white p-1">
          </div>
          
          <div class="pt-4 border-t border-slate-200">
            <button type="submit" disabled={isSubmitting} class="w-full bg-emerald-600 text-white font-bold py-3.5 px-4 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-sm shadow-emerald-600/20 flex justify-center items-center">
              {#if isSubmitting}
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Processing...
              {:else}
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>
                Mark as Completed
              {/if}
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

<BottomNav role="FULFILLMENT" bind:showProfile={showProfile} />

<ProfileModal bind:showProfile />

