<script lang="ts">
  import { toast } from '$lib/stores/toast';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import ProfileModal from '$lib/components/ProfileModal.svelte';
  import imageCompression from 'browser-image-compression';

  let padId = $page.params.id;
  let pad: any = $state(null);
  let showModal = $state(false);
  let showProfile = $state(false);
  
  // New Fields
  let customerName = $state('');
  let whatsappNumber = $state('');
  let amount = $state('');
  let quantity = $state('1');
  let notes = $state('');
  
  let proofFile: FileList | null = $state(null);
  let isSubmitting = $state(false);

  // Tabs
  let activeTab = $state('PENDING'); // PENDING, APPROVED, COMPLETED

  let filteredTickets = $derived.by(() => {
    if (!pad || !pad.tickets) return [];
    return pad.tickets.filter((t: any) => t.status === activeTab);
  });

  async function fetchPad() {
    const token = sessionStorage.getItem('token');
    if (!token) {
      window.location.href = '/';
      return;
    }
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/pads/${padId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        pad = await res.json();
      } else {
        toast.add('Failed to load Pad', 'error');
        window.location.href = '/sales';
      }
    } catch (err) {
      // Only redirect on initial load if failed
      if (!pad) window.location.href = '/sales';
    }
  }

  let pollInterval: any;

  onMount(() => {
    fetchPad();
    pollInterval = setInterval(fetchPad, 5000);
    
    return () => clearInterval(pollInterval);
  });

  async function handleCreateTicket(e: Event) {
    e.preventDefault();
    if (!proofFile || proofFile.length === 0) return toast.add('Please attach payment proof.', 'error');
    if (!customerName || !whatsappNumber || !amount || !quantity) return toast.add('Please provide Customer Name, WhatsApp Number, Amount, and Quantity.', 'error');
    
    const reqQty = parseInt(quantity, 10);
    const availableQty = pad.totalTickets - pad.ticketsUsed;
    if (reqQty > availableQty) {
      return toast.add(`Not enough tickets left in this pad! You only have ${availableQty} left.`, 'error');
    }

    isSubmitting = true;
    const token = sessionStorage.getItem('token');
    
    try {
      const options = {
        maxSizeMB: 0.1, // 200 KB max
        maxWidthOrHeight: 1024,
        useWebWorker: true
      };
      
      const compressedFile = await imageCompression(proofFile[0], options);
      
      const formData = new FormData();
      formData.append('transactionId', `TRX-${Date.now()}-${Math.floor(Math.random() * 1000)}`);
      formData.append('padId', padId);
      
      formData.append('genericData', JSON.stringify({
        name: customerName,
        whatsappNumber: whatsappNumber,
        amount: amount,
        quantity: quantity,
        notes: notes
      }));

      formData.append('proof', compressedFile, proofFile[0].name);

      const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/tickets', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (res.ok) {
        showModal = false;
        customerName = '';
        whatsappNumber = '';
        amount = '';
        quantity = '1';
        notes = '';
        proofFile = null;
        fetchPad();
        activeTab = 'PENDING';
      } else {
        const errorData = await res.json();
        toast.add(errorData.error || 'Failed to create order', 'error');
      }
    } catch (err) {
      toast.add('Error connecting to server. Please try again.', 'error');
    } finally {
      isSubmitting = false;
    }
  }

  function getTicketName(ticket: any) {
    if (ticket.genericData && typeof ticket.genericData === 'object') {
      return ticket.genericData.name || ticket.transactionId;
    }
    return ticket.transactionId;
  }
</script>

<div class="flex h-screen bg-slate-50 text-slate-900 font-sans">
  
  <!-- Sidebar -->
  <aside class="w-64 bg-slate-900 text-slate-300 flex-col hidden md:flex shadow-2xl z-10 relative overflow-hidden">
    {#if pad}
      <div class="absolute top-0 left-0 w-full h-1" style="background-color: {pad.color}"></div>
    {/if}
    <div class="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950">
      <div class="w-8 h-8 rounded-full overflow-hidden mr-3 shadow-lg shadow-indigo-500/20 bg-indigo-50 flex items-center justify-center">
        <img src="/logo.png" alt="Logo" class="w-full h-full object-cover scale-110" onerror={(e) => e.currentTarget.style.display='none'} />
      </div>
      <h1 class="text-xl font-bold text-white tracking-tight">AK Flow</h1>
    </div>
    <div class="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
      <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">Sales Operations</div>
      <button onclick={() => window.location.href = '/sales'} class="w-full flex items-center space-x-3 hover:bg-slate-800 text-slate-300 px-3 py-2.5 rounded-lg font-medium transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        <span>Back to Pads</span>
      </button>
      <button onclick={() => showProfile = true} class="w-full flex items-center space-x-3 hover:bg-slate-800 text-slate-300 px-3 py-2.5 rounded-lg font-medium transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        <span>Profile</span>
      </button>
    </div>
  </aside>

  <!-- Main Content -->
  <main class="flex-1 flex flex-col min-w-0 overflow-hidden relative">
    
    <!-- Header -->
    <header class="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8">
      <div class="flex items-center md:hidden">
        <button onclick={() => window.location.href = '/sales'} class="mr-4 text-slate-500">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <span class="font-bold text-slate-900">AK Flow</span>
      </div>
      <h2 class="hidden md:block text-lg font-semibold text-slate-800">
        {#if pad} <span style="color: {pad.color}">{pad.name}</span> {:else} Loading... {/if}
      </h2>
      <div class="flex items-center space-x-4">
        <div class="hidden sm:block text-sm text-slate-500">Sales Mode</div>
        <button class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold border border-blue-200 cursor-pointer" onclick={() => showProfile = true}>
          S
        </button>
      </div>
    </header>

    <!-- Page Content -->
    <div class="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50">
      <div class="max-w-5xl mx-auto">
        {#if pad}
          <div class="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 class="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight" style="color: {pad.color}">{pad.name}</h1>
              <p class="text-slate-500 mt-1 text-sm font-bold bg-white px-3 py-1 rounded-full border border-slate-200 inline-block">
                Tickets Left: {pad.totalTickets - pad.ticketsUsed} / {pad.totalTickets}
              </p>
            </div>
            {#if pad.status === 'ACTIVE' || pad.status === 'PENDING'}
              <button onclick={() => showModal = true} class="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-lg shadow-sm shadow-indigo-600/20 transition-all focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>
                <span>Create Order</span>
              </button>
            {/if}
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
              <p class="text-slate-500 max-w-md mx-auto">You have no orders in the "{activeTab}" status.</p>
              {#if activeTab === 'PENDING' && (pad.status === 'ACTIVE' || pad.status === 'PENDING')}
                <button onclick={() => showModal = true} class="inline-flex mt-4 text-indigo-600 font-medium hover:text-indigo-700">
                  Submit a new order &rarr;
                </button>
              {/if}
            </div>
          {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              {#each filteredTickets as ticket}
                <div 
                  class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all"
                  class:border-l-4={true}
                  class:border-l-amber-400={activeTab === 'PENDING'}
                  class:border-l-indigo-400={activeTab === 'APPROVED'}
                  class:border-l-emerald-400={activeTab === 'COMPLETED'}
                >
                  <div class="flex justify-between items-start mb-3">
                    <h3 class="font-bold text-slate-900 text-lg">
                      {getTicketName(ticket)}
                      {#if ticket.genericData?.quantity}
                        <span class="text-xs text-slate-400 ml-1 font-medium">({ticket.genericData.quantity} tickets)</span>
                      {/if}
                    </h3>
                    {#if ticket.genericData?.amount}
                      <span class="text-emerald-700 bg-emerald-50 px-2 py-1 rounded text-sm font-bold border border-emerald-100">
                        Rs {ticket.genericData.amount}
                      </span>
                    {/if}
                  </div>
                  
                  <div class="flex items-center justify-between mt-4 border-t border-slate-100 pt-3">
                    <p class="text-xs font-medium text-slate-500">Created: {new Date(ticket.createdAt).toLocaleDateString()}</p>
                    <span class={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                      activeTab === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      activeTab === 'APPROVED' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                      'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {ticket.status}
                    </span>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </main>
</div>

{#if showModal}
  <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
      <div class="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white relative">
        <div class="absolute top-0 left-0 w-full h-1" style="background-color: {pad?.color || '#4f46e5'}"></div>
        <div>
          <h2 class="text-xl font-bold text-slate-900">Create Order</h2>
          <p class="text-xs text-slate-500 mt-0.5">Submit to {pad?.name}</p>
        </div>
        <button aria-label="Close modal" class="text-slate-400 hover:text-slate-700 bg-slate-50 p-2 rounded-full hover:bg-slate-100 transition-colors" onclick={() => showModal = false}>
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      
      <div class="p-6 overflow-y-auto bg-slate-50/50">
        <form onsubmit={handleCreateTicket} class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Customer Name</label>
            <input type="text" required bind:value={customerName} placeholder="e.g., John Doe" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm">
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">WhatsApp Number</label>
            <input id="whatsappNumber" type="text" required bind:value={whatsappNumber} placeholder="e.g., +923001234567" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm">
          </div>
          
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Amount (Rs)</label>
            <input type="number" step="0.01" required bind:value={amount} placeholder="0.00" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm">
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Quantity of Tickets</label>
            <input type="number" min="1" max={pad ? pad.totalTickets - pad.ticketsUsed : 100} required bind:value={quantity} placeholder="1" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm">
            {#if pad}
              <p class="text-[10px] text-slate-500 mt-1 font-bold">Max allowed: {pad.totalTickets - pad.ticketsUsed}</p>
            {/if}
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Notes (Optional)</label>
            <textarea id="notes" bind:value={notes} rows="2" placeholder="Any special instructions..." class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"></textarea>
          </div>
          
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Payment Screenshot</label>
            <input id="proofFile" type="file" accept="image/*" required bind:files={proofFile} class="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer border border-slate-200 rounded-xl bg-white p-1">
          </div>
          
          <div class="pt-4 flex space-x-3">
            <button type="button" onclick={() => showModal = false} class="flex-1 py-3 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm text-sm">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} class="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm shadow-indigo-600/20 text-sm">
              {isSubmitting ? 'Uploading...' : 'Submit Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}

<ProfileModal bind:showProfile />
