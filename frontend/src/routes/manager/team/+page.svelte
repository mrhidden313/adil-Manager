<script lang="ts">
  import { toast } from '$lib/stores/toast';
  import { onMount } from 'svelte';
  import ProfileModal from '$lib/components/ProfileModal.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';

  let team: any[] = $state([]);
  let allTickets: any[] = $state([]);
  let allPayouts: any[] = $state([]);
  let activeTab = $state('ACTIVE');
  let showProfile = $state(false);
  let showAddTeamModal = $state(false);

  let showStatsModal = $state(false);
  let selectedAgent: any = $state(null);
  let payBonusAmount = $state('');
  let payoutProofFile: File | null = $state(null);
  let payoutProofPreview: string = $state('');
  let isPayingBonus = $state(false);

  function handleProofSelect(e: any) {
    const file = e.target.files[0];
    if (file) {
      payoutProofFile = file;
      payoutProofPreview = URL.createObjectURL(file);
    }
  }

  let newName = $state('');
  let newEmail = $state('');
  let newPassword = $state('');
  let newRole = $state('SALES');
  let isCreating = $state(false);

  let filteredTeam = $derived.by(() => {
    return team.filter(member => {
      if (activeTab === 'ACTIVE') return member.isActive;
      if (activeTab === 'DISABLED') return !member.isActive;
      return true;
    });
  });

  async function fetchTeamData() {
    const token = localStorage.getItem('token');
    const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/users/team', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) team = await res.json();

    const resTickets = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/tickets', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (resTickets.ok) allTickets = await resTickets.json();

    const resPayouts = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/payouts', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (resPayouts.ok) allPayouts = await resPayouts.json();
  }

  onMount(() => { fetchTeamData(); });

  async function handleAddTeamMember(e: Event) {
    e.preventDefault();
    isCreating = true;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/users/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: newName, email: newEmail, password: newPassword, role: newRole })
      });
      if (res.ok) {
        showAddTeamModal = false;
        newName = ''; newEmail = ''; newPassword = ''; newRole = 'SALES';
        fetchTeamData();
        activeTab = 'ACTIVE';
      } else {
        const data = await res.json();
        toast.add(data.error || 'Failed to create team member', 'error');
      }
    } catch (err) {
      toast.add('Network error', 'error');
    } finally {
      isCreating = false;
    }
  }

  async function toggleStatus(userId: string, currentStatus: boolean, e?: Event) {
    if (e) e.stopPropagation();
    const newStatus = !currentStatus;
    if (!confirm(`Are you sure you want to ${newStatus ? 'activate' : 'disable'} this agent?`)) return;
    const token = localStorage.getItem('token');
    await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/users/team/${userId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ isActive: newStatus })
    });
    fetchTeamData();
  }

  async function deleteTeamMember(userId: string, userName: string, e?: Event) {
    if (e) e.stopPropagation();
    if (!confirm(`WARNING: Are you sure you want to permanently delete agent "${userName}"? This cannot be undone.`)) return;
    const token = localStorage.getItem('token');
    const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/users/team/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      fetchTeamData();
    } else {
      const data = await res.json();
      toast.add(data.error || 'Failed to delete agent.', 'error');
    }
  }

  function openAgentStats(agent: any) {
    selectedAgent = agent;
    payBonusAmount = '';
    payoutProofFile = null;
    payoutProofPreview = '';
    showStatsModal = true;
  }

  async function payBonusDirect() {
    const amount = parseFloat(payBonusAmount);
    if (!amount || amount <= 0) return toast.add('Enter a valid amount', 'error');
    if (!payoutProofFile) return toast.add('Please upload a transfer screenshot.', 'error');

    isPayingBonus = true;
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('agentId', selectedAgent.id);
    formData.append('amount', amount.toString());
    formData.append('proof', payoutProofFile);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/payouts/pay`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        toast.add(`PKR ${amount.toLocaleString()} marked as paid to ${selectedAgent.name}`, 'success');
        payBonusAmount = '';
        payoutProofFile = null;
        payoutProofPreview = '';
        fetchTeamData();
      } else {
        const err = await res.json();
        toast.add(err.error || 'Failed to pay bonus', 'error');
      }
    } catch {
      toast.add('Network error', 'error');
    } finally {
      isPayingBonus = false;
    }
  }

  function getAgentStats(agent: any) {
    if (agent.role === 'SALES') {
      const submitted = allTickets.filter(t => t.createdById === agent.id);
      const pending = submitted.filter(t => t.status === 'PENDING').length;
      const approved = submitted.filter(t => t.status === 'APPROVED').length;
      const completedTickets = submitted.filter(t => t.status === 'COMPLETED');
      const completed = completedTickets.length;
      const totalRevenue = completedTickets.reduce((sum, t) => sum + (t.price || 0), 0);
      const earnedBonus = completedTickets.reduce((sum, t) => sum + (t.bonusAmount || 0), 0);
      // Sum up total individual tickets from all submitted orders
      const totalTickets = submitted.reduce((sum, t) => sum + (parseInt(t.genericData?.ticketNumber) || 1), 0);
      const completedTicketsCount = completedTickets.reduce((sum, t) => sum + (parseInt(t.genericData?.ticketNumber) || 1), 0);
      return { total: submitted.length, pending, approved, completed, totalRevenue, earnedBonus, totalTickets, completedTicketsCount };
    } else {
      const assigned = allTickets.filter(t => t.assignedToId === agent.id);
      const pendingWork = assigned.filter(t => t.status === 'APPROVED').length;
      const completedWork = assigned.filter(t => t.status === 'COMPLETED');
      const completedWorkCount = completedWork.length;
      // Sum up total individual tickets from all assigned orders
      const totalTickets = assigned.reduce((sum, t) => sum + (parseInt(t.genericData?.ticketNumber) || 1), 0);
      const completedTicketsCount = completedWork.reduce((sum, t) => sum + (parseInt(t.genericData?.ticketNumber) || 1), 0);
      return { total: assigned.length, pendingWork, completedWork: completedWorkCount, totalTickets, completedTicketsCount };
    }
  }
</script>

<div class="flex h-screen bg-transparent text-slate-800 font-sans">
  
  <!-- Sidebar -->
  <aside class="w-64 bg-slate-900 text-slate-300 flex-col hidden md:flex shadow-2xl z-10">
    <div class="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950">
      <div class="w-8 h-8 rounded-full overflow-hidden mr-3 shadow-lg bg-indigo-50 flex items-center justify-center">
        <img src="/logo.png" alt="Logo" class="w-full h-full object-cover scale-110" onerror={(e) => e.currentTarget.style.display='none'} />
      </div>
      <h1 class="text-xl font-bold text-white tracking-tight">AK Flow</h1>
    </div>
    <div class="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
      <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">Agency Operations</div>
      <button class="w-full flex items-center space-x-3 hover:bg-slate-800 text-slate-300 px-3 py-2.5 rounded-lg font-medium transition-colors" onclick={() => window.location.href='/manager'}>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
        <span>Overview</span>
      </button>
      <button class="w-full flex items-center space-x-3 bg-indigo-500/10 text-indigo-400 px-3 py-2.5 rounded-lg font-medium transition-colors">
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
    <header class="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8">
      <div class="flex items-center md:hidden">
        <div class="w-8 h-8 rounded-full overflow-hidden mr-2 bg-indigo-50 flex items-center justify-center">
          <img src="/logo.png" alt="Logo" class="w-full h-full object-cover scale-110" onerror={(e) => e.currentTarget.style.display='none'} />
        </div>
        <span class="font-bold text-slate-800">AK Flow</span>
      </div>
      <h2 class="hidden md:block text-lg font-semibold text-slate-800">Staff Management</h2>
      <div class="flex items-center space-x-4">
        <button onclick={() => window.location.href = '/manager'} class="md:hidden flex items-center text-indigo-600 font-bold text-sm bg-indigo-50 px-3 py-1.5 rounded-full">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clip-rule="evenodd" /></svg>
          Orders
        </button>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto p-4 md:p-8 bg-transparent">
      <div class="max-w-7xl mx-auto">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 class="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">Team Roster</h1>
            <p class="text-slate-500 mt-1 text-sm">Manage your Sales and Fulfillment agents.</p>
          </div>
          <button onclick={() => showAddTeamModal = true} class="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-lg shadow-sm shadow-indigo-600/20 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>
            <span>Hire Agent</span>
          </button>
        </div>

        <div class="border-b border-slate-200 mb-6">
          <nav class="-mb-px flex space-x-8">
            <button onclick={() => activeTab = 'ACTIVE'} class={`whitespace-nowrap py-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'ACTIVE' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} transition-colors`}>
              Active Staff
            </button>
            <button onclick={() => activeTab = 'DISABLED'} class={`whitespace-nowrap py-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'DISABLED' ? 'border-rose-500 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} transition-colors`}>
              Disabled
            </button>
          </nav>
        </div>

        {#if filteredTeam.length === 0}
          <div class="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
            <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </div>
            <h3 class="text-lg font-bold text-slate-800 mb-2">No Agents Found</h3>
            <p class="text-slate-500 max-w-md mx-auto mb-6">You have no staff members in this category.</p>
            {#if activeTab === 'ACTIVE'}
              <button onclick={() => showAddTeamModal = true} class="inline-flex text-indigo-600 font-medium hover:text-indigo-700">
                Hire your first agent &rarr;
              </button>
            {/if}
          </div>
        {:else}
          <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {#each filteredTeam as member}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-lg transition-all duration-300 cursor-pointer {!member.isActive ? 'opacity-75' : ''}"
                onclick={() => openAgentStats(member)}
              >
                <div class="p-5 border-b border-slate-100 flex justify-between items-start relative">
                  <div class="pr-8">
                    <h3 class="text-lg font-bold text-slate-800 line-clamp-1">{member.name}</h3>
                    <div class="flex items-center gap-2 mt-2 flex-wrap">
                      <span class={`px-2.5 py-1 inline-flex text-[10px] font-bold uppercase tracking-wider rounded-md border ${member.role === 'SALES' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                        {member.role}
                      </span>
                      {#if member.isActive}
                        <span class="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span>
                      {:else}
                        <span class="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">Disabled</span>
                      {/if}
                    </div>
                  </div>
                  <button onclick={(e) => deleteTeamMember(member.id, member.name, e)} class="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                  </button>
                </div>
                <div class="p-5 flex-1 bg-slate-50/30">
                  <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-100 to-blue-50 text-indigo-700 flex items-center justify-center font-extrabold text-sm uppercase shadow-inner border border-indigo-100 overflow-hidden">
                      {#if member.profilePictureUrl}
                        <img src={member.profilePictureUrl} alt="Avatar" class="w-full h-full object-cover" />
                      {:else}
                        {member.name.substring(0, 2)}
                      {/if}
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-xs text-slate-500 font-medium mb-0.5">Email</p>
                      <p class="text-sm font-semibold text-slate-800 truncate">{member.email}</p>
                    </div>
                  </div>
                </div>
                <div class="px-5 py-4 border-t border-slate-100 bg-white space-y-2">
                  <div class="w-full py-2.5 text-xs font-bold text-center text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg shadow-sm">View Agent History</div>
                  {#if member.isActive}
                    <button onclick={(e) => toggleStatus(member.id, member.isActive, e)} class="w-full py-2.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors shadow-sm">Disable Agent Access</button>
                  {:else}
                    <button onclick={(e) => toggleStatus(member.id, member.isActive, e)} class="w-full py-2.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors shadow-sm">Re-activate Agent</button>
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

<!-- Agent Stats Modal -->
{#if showStatsModal && selectedAgent}
  <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-3xl w-[calc(100%-2rem)] max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col">
      <div class="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white">
        <div>
          <h3 class="text-xl font-bold text-slate-800">Agent History</h3>
          <p class="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider">{selectedAgent.name}</p>
        </div>
        <button onclick={() => showStatsModal = false} class="text-slate-400 hover:text-slate-700 bg-slate-50 rounded-full p-2 hover:bg-slate-100 transition-colors">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="p-8 bg-transparent">
        {#if selectedAgent.role === 'SALES'}
          {@const stats = getAgentStats(selectedAgent)}
          {@const agentPayouts = allPayouts.filter(p => p.agentId === selectedAgent.id)}
          {@const paidBonus = agentPayouts.reduce((sum, p) => sum + p.amount, 0)}
          {@const pendingBonus = stats.earnedBonus - paidBonus}
          <div class="space-y-3">

            <!-- Revenue Banner -->
            <div class="p-5 rounded-2xl text-white relative overflow-hidden" style="background: linear-gradient(135deg, rgba(16,185,129,0.6), rgba(5,150,105,0.6)); backdrop-filter: blur(8px); border: 1px solid rgba(16,185,129,0.3);">
              <div class="absolute right-0 top-0 w-24 h-24 bg-white/10 rounded-bl-full"></div>
              <p class="text-[10px] font-bold uppercase tracking-wide text-white/80 mb-1">Total Generated (Completed Orders)</p>
              <div>
                <span class="text-xs font-semibold text-white/70">PKR </span>
                <span class="text-3xl font-black">{stats.totalRevenue.toLocaleString()}</span>
              </div>
            </div>

            <!-- Stats Grid -->
            <div class="grid grid-cols-2 gap-3">

              <!-- Total Orders -->
              <div class="p-4 rounded-2xl relative overflow-hidden" style="background: linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1)); border: 1px solid rgba(99,102,241,0.2); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);">
                <div class="absolute right-[-8px] top-[-8px] w-14 h-14 bg-indigo-400/20 rounded-full blur-md"></div>
                <p class="text-2xl font-black text-indigo-700 relative z-10">{stats.total}</p>
                <p class="text-[10px] font-bold text-indigo-500 uppercase tracking-wide">Total Orders</p>
              </div>

              <!-- Total Tickets (SUM) -->
              <div class="p-4 rounded-2xl relative overflow-hidden" style="background: linear-gradient(135deg, rgba(6,182,212,0.1), rgba(59,130,246,0.1)); border: 1px solid rgba(6,182,212,0.2); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);">
                <div class="absolute right-[-8px] top-[-8px] w-14 h-14 bg-cyan-400/20 rounded-full blur-md"></div>
                <p class="text-2xl font-black text-cyan-700 relative z-10">{stats.totalTickets}</p>
                <p class="text-[10px] font-bold text-cyan-600 uppercase tracking-wide">Total Tickets</p>
              </div>

              <!-- Completed Orders -->
              <div class="p-4 rounded-2xl relative overflow-hidden" style="background: linear-gradient(135deg, rgba(16,185,129,0.1), rgba(52,211,153,0.1)); border: 1px solid rgba(16,185,129,0.2);">
                <div class="absolute right-[-8px] top-[-8px] w-14 h-14 bg-emerald-400/20 rounded-full blur-md"></div>
                <p class="text-2xl font-black text-emerald-700 relative z-10">{stats.completed}</p>
                <p class="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">Confirmed Orders</p>
              </div>

              <!-- Confirmed Tickets (SUM) -->
              <div class="p-4 rounded-2xl relative overflow-hidden" style="background: linear-gradient(135deg, rgba(16,185,129,0.15), rgba(52,211,153,0.15)); border: 1px solid rgba(16,185,129,0.3); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);">
                <div class="absolute right-[-8px] top-[-8px] w-14 h-14 bg-emerald-400/30 rounded-full blur-md"></div>
                <p class="text-2xl font-black text-emerald-800 relative z-10">{stats.completedTicketsCount}</p>
                <p class="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Confirmed Tickets</p>
              </div>

              <!-- Pending -->
              <div class="p-4 rounded-2xl relative overflow-hidden" style="background: linear-gradient(135deg, rgba(245,158,11,0.1), rgba(251,191,36,0.1)); border: 1px solid rgba(245,158,11,0.2); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);">
                <p class="text-2xl font-black text-amber-700">{stats.pending}</p>
                <p class="text-[10px] font-bold text-amber-600 uppercase tracking-wide">Pending</p>
              </div>

              <!-- Approved -->
              <div class="p-4 rounded-2xl relative overflow-hidden" style="background: linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1)); border: 1px solid rgba(99,102,241,0.2); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);">
                <p class="text-2xl font-black text-indigo-700">{stats.approved}</p>
                <p class="text-[10px] font-bold text-indigo-600 uppercase tracking-wide">Approved</p>
              </div>

            </div>
          </div>
          
          <!-- Pay Bonus section -->
          <div class="mt-6 bg-indigo-50 border border-indigo-200 p-5 rounded-2xl shadow-sm">
            {#if selectedAgent.paymentAccountType}
              <div class="mb-4 pb-4 border-b border-indigo-100">
                <p class="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Agent Payment Details</p>
                <div class="flex justify-between items-center bg-white p-3 rounded-xl border border-indigo-100">
                  <span class="text-sm font-bold text-slate-800">{selectedAgent.paymentAccountType}</span>
                  <span class="text-sm font-mono text-indigo-700 bg-indigo-50 px-2 py-1 rounded">{selectedAgent.paymentAccountNumber || 'N/A'}</span>
                </div>
              </div>
            {:else}
              <div class="mb-4 pb-4 border-b border-indigo-100">
                <p class="text-xs text-rose-500 font-medium">⚠️ Agent hasn't set up payment details yet.</p>
              </div>
            {/if}
            
            <div class="flex justify-between items-end mb-2">
              <p class="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Pay Bonus (PKR)</p>
              <div class="text-right">
                <p class="text-xs font-medium text-slate-500">Total Pending: <span class="font-bold text-rose-600">PKR {pendingBonus.toLocaleString()}</span></p>
                {#if payBonusAmount && !isNaN(parseFloat(payBonusAmount))}
                  <p class="text-[10px] font-bold text-emerald-600 mt-0.5 border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 rounded">Remaining after: PKR {(pendingBonus - parseFloat(payBonusAmount)).toLocaleString()}</p>
                {/if}
              </div>
            </div>
            
            <div class="mb-3">
              <label class="block text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Upload Transfer Screenshot</label>
              <input type="file" accept="image/*" onchange={handleProofSelect} class="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200 transition-all cursor-pointer border border-indigo-200 rounded-xl bg-white" />
            </div>
            
            {#if payoutProofPreview}
              <div class="mb-3 rounded-xl overflow-hidden border border-indigo-200 shadow-sm relative">
                <img src={payoutProofPreview} alt="Preview" class="w-full h-32 object-cover">
              </div>
            {/if}

            <div class="flex gap-2">
              <input type="number" bind:value={payBonusAmount} placeholder="Enter amount" min="1" max={pendingBonus > 0 ? pendingBonus : undefined} class="flex-1 px-4 py-2.5 border border-indigo-300 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm" />
              <button onclick={payBonusDirect} disabled={isPayingBonus || !payBonusAmount || !payoutProofFile} class="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm shadow-indigo-600/30 flex items-center gap-2">
                {#if isPayingBonus}
                  <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Wait...
                {:else}
                  Pay {payBonusAmount ? 'PKR ' + parseFloat(payBonusAmount).toLocaleString() : 'Now'}
                {/if}
              </button>
            </div>
          </div>
        {:else}
          {@const stats = getAgentStats(selectedAgent)}
          <div class="space-y-3">

            <!-- Confirmed Tickets Banner -->
            <div class="p-5 rounded-2xl text-white relative overflow-hidden" style="background: linear-gradient(135deg, rgba(16,185,129,0.6), rgba(5,150,105,0.6)); backdrop-filter: blur(8px); border: 1px solid rgba(16,185,129,0.3);">
              <div class="absolute right-0 top-0 w-24 h-24 bg-white/10 rounded-bl-full"></div>
              <p class="text-[10px] font-bold uppercase tracking-wide text-white/80 mb-1">Total Confirmed Tickets (Physical)</p>
              <span class="text-3xl font-black">{stats.completedTicketsCount}</span>
            </div>

            <div class="grid grid-cols-2 gap-3">

              <!-- Total Assigned Orders -->
              <div class="p-4 rounded-2xl relative overflow-hidden" style="background: linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1)); border: 1px solid rgba(99,102,241,0.2); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);">
                <div class="absolute right-[-8px] top-[-8px] w-14 h-14 bg-indigo-400/20 rounded-full blur-md"></div>
                <p class="text-2xl font-black text-indigo-700 relative z-10">{stats.total}</p>
                <p class="text-[10px] font-bold text-indigo-500 uppercase tracking-wide">Total Assigned Orders</p>
              </div>

              <!-- Total Tickets (ALL) -->
              <div class="p-4 rounded-2xl relative overflow-hidden" style="background: linear-gradient(135deg, rgba(6,182,212,0.1), rgba(59,130,246,0.1)); border: 1px solid rgba(6,182,212,0.2); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);">
                <div class="absolute right-[-8px] top-[-8px] w-14 h-14 bg-cyan-400/20 rounded-full blur-md"></div>
                <p class="text-2xl font-black text-cyan-700 relative z-10">{stats.totalTickets}</p>
                <p class="text-[10px] font-bold text-cyan-600 uppercase tracking-wide">Total Tickets (All)</p>
              </div>

              <!-- Completed Orders -->
              <div class="p-4 rounded-2xl relative overflow-hidden" style="background: linear-gradient(135deg, rgba(16,185,129,0.1), rgba(52,211,153,0.1)); border: 1px solid rgba(16,185,129,0.2);">
                <p class="text-2xl font-black text-emerald-700">{stats.completedWork}</p>
                <p class="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">Completed Orders</p>
              </div>

              <!-- Work Pending -->
              <div class="p-4 rounded-2xl relative overflow-hidden" style="background: linear-gradient(135deg, rgba(245,158,11,0.1), rgba(251,191,36,0.1)); border: 1px solid rgba(245,158,11,0.2); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);">
                <p class="text-2xl font-black text-amber-700">{stats.pendingWork}</p>
                <p class="text-[10px] font-bold text-amber-600 uppercase tracking-wide">Work Pending</p>
              </div>

            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Add Team Member Modal -->
{#if showAddTeamModal}
  <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
      <div class="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white relative">
        <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
        <div>
          <h3 class="text-xl font-bold text-slate-800">Hire Team Member</h3>
          <p class="text-xs text-slate-500 mt-1">Add a new agent to your agency.</p>
        </div>
        <button onclick={() => showAddTeamModal = false} class="text-slate-400 hover:text-slate-700 bg-slate-50 rounded-full p-2 hover:bg-slate-100 transition-colors">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="p-8 overflow-y-auto bg-transparent">
        <form onsubmit={handleAddTeamMember} class="space-y-5">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Full Name</label>
            <input type="text" bind:value={newName} required placeholder="e.g., Jane Doe" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Email Address</label>
            <input type="email" bind:value={newEmail} required placeholder="jane@agency.com" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Temporary Password</label>
            <input type="password" bind:value={newPassword} required placeholder="••••••••" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Role</label>
            <select bind:value={newRole} class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm font-medium">
              <option value="SALES">Sales Agent (Uploads tasks)</option>
              <option value="FULFILLMENT">Local Agent (Processes tasks)</option>
            </select>
          </div>
          <div class="pt-4 flex space-x-3">
            <button type="button" onclick={() => showAddTeamModal = false} class="flex-1 py-3 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm text-sm">Cancel</button>
            <button type="submit" disabled={isCreating} class="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm text-sm">
              {isCreating ? 'Hiring...' : 'Hire Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}

<BottomNav role="MANAGER" bind:showProfile={showProfile} />
<ProfileModal bind:showProfile />
