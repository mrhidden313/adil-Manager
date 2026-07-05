<script lang="ts">
  import { toast } from '$lib/stores/toast';
  import { onMount } from 'svelte';
  import ProfileModal from '$lib/components/ProfileModal.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';

  let team: any[] = $state([]);
  let allTickets: any[] = $state([]);
  let activeTab = $state('ACTIVE'); // 'ACTIVE', 'DISABLED'
  let showProfile = $state(false);
  let showAddTeamModal = $state(false);

  // Agent Stats Modal
  let showStatsModal = $state(false);
  let selectedAgent: any = $state(null);

  // New Team Member Form
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
    const token = sessionStorage.getItem('token');
    
    // Fetch Team
    const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/users/team', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      team = await res.json();
    }

    // Fetch all tickets to calculate stats
    const resTickets = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/tickets', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (resTickets.ok) {
      allTickets = await resTickets.json();
    }
  }

  onMount(() => {
    fetchTeamData();
  });

  async function handleAddTeamMember(e: Event) {
    e.preventDefault();
    isCreating = true;
    const token = sessionStorage.getItem('token');

    try {
      const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/users/team', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
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
    
    const token = sessionStorage.getItem('token');
    await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/users/team/${userId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ isActive: newStatus })
    });
    fetchTeamData();
  }

  async function deleteTeamMember(userId: string, userName: string, e?: Event) {
    if (e) e.stopPropagation();
    if (!confirm(`WARNING: Are you sure you want to permanently delete agent "${userName}"? This action cannot be undone.`)) return;
    
    const token = sessionStorage.getItem('token');
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
    showStatsModal = true;
  }

  function getAgentStats(agent: any) {
    if (agent.role === 'SALES') {
      const submitted = allTickets.filter(t => t.createdById === agent.id);
      const pending = submitted.filter(t => t.status === 'PENDING').length;
      const approved = submitted.filter(t => t.status === 'APPROVED').length;
      const completedTickets = submitted.filter(t => t.status === 'COMPLETED');
      const completed = completedTickets.length;
      const totalRevenue = completedTickets.reduce((sum, t) => sum + (parseFloat(t.genericData?.amount) || 0), 0);
      return { total: submitted.length, pending, approved, completed, totalRevenue };
    } else {
      // FULFILLMENT
      const assigned = allTickets.filter(t => t.assignedToId === agent.id);
      const pendingWork = assigned.filter(t => t.status === 'APPROVED').length;
      const completedWork = assigned.filter(t => t.status === 'COMPLETED').length;
      return { total: assigned.length, pendingWork, completedWork };
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
      <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">Agency Operations</div>
      <button class="w-full flex items-center space-x-3 hover:bg-slate-800 text-slate-300 px-3 py-2.5 rounded-lg font-medium transition-colors" onclick={() => window.location.href='/manager'}>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        <span>Orders (Tasks)</span>
      </button>
      <button class="w-full flex items-center space-x-3 hover:bg-slate-800 text-slate-300 px-3 py-2.5 rounded-lg font-medium transition-colors" onclick={() => window.location.href='/manager/pads'}>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        <span>Pads (Copies)</span>
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
      <h2 class="hidden md:block text-lg font-semibold text-slate-800">Staff Management</h2>
      <div class="flex items-center space-x-4">
        <div class="hidden sm:block text-sm text-slate-500">Manager Mode</div>
        <div class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border border-indigo-200 cursor-pointer" onclick={() => showProfile = true}>
          M
        </div>
        <!-- Replaced Logout with Back to Tickets for Mobile -->
        <button onclick={() => window.location.href = '/manager'} class="md:hidden flex items-center text-indigo-600 font-bold text-sm bg-indigo-50 px-3 py-1.5 rounded-full">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clip-rule="evenodd" /></svg>
          Orders
        </button>
      </div>
    </header>

    <!-- Page Content -->
    <div class="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50">
      <div class="max-w-7xl mx-auto">
        
        <!-- Header Actions -->
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 class="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Team Roster</h1>
            <p class="text-slate-500 mt-1 text-sm">Manage your Sales and Fulfillment agents.</p>
          </div>
          <button onclick={() => showAddTeamModal = true} class="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-lg shadow-sm shadow-indigo-600/20 transition-all focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>
            <span>Hire Agent</span>
          </button>
        </div>

        <!-- Filter Tabs -->
        <div class="border-b border-slate-200 mb-6">
          <nav class="-mb-px flex space-x-8" aria-label="Tabs">
            <button onclick={() => activeTab = 'ACTIVE'} class={`whitespace-nowrap py-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'ACTIVE' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} transition-colors`}>
              Active Staff
            </button>
            <button onclick={() => activeTab = 'DISABLED'} class={`whitespace-nowrap py-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'DISABLED' ? 'border-rose-500 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} transition-colors`}>
              Disabled
            </button>
          </nav>
        </div>

        <!-- Empty State -->
        {#if filteredTeam.length === 0}
          <div class="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
            <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </div>
            <h3 class="text-lg font-bold text-slate-900 mb-2">No Agents Found</h3>
            <p class="text-slate-500 max-w-md mx-auto mb-6">You have no staff members in this category.</p>
            {#if activeTab === 'ACTIVE'}
              <button onclick={() => showAddTeamModal = true} class="inline-flex text-indigo-600 font-medium hover:text-indigo-700">
                Hire your first agent &rarr;
              </button>
            {/if}
          </div>
        {:else}
          <!-- Agents Grid -->
          <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {#each filteredTeam as member}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div 
                class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-lg transition-all duration-300 cursor-pointer {!member.isActive ? 'opacity-75' : ''}"
                onclick={() => openAgentStats(member)}
              >
                <!-- Card Header -->
                <div class="p-5 border-b border-slate-100 flex justify-between items-start relative">
                  <div class="pr-8">
                    <h3 class="text-lg font-bold text-slate-900 line-clamp-1" title={member.name}>{member.name}</h3>
                    <div class="flex items-center gap-2 mt-2 flex-wrap">
                      <span class={`px-2.5 py-1 inline-flex text-[10px] font-bold uppercase tracking-wider rounded-md border ${
                        member.role === 'SALES' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'
                      }`}>
                        {member.role}
                      </span>
                      {#if member.isActive}
                        <span class="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      {:else}
                        <span class="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                          Disabled
                        </span>
                      {/if}
                    </div>
                  </div>

                  <!-- Delete Button -->
                  <button onclick={(e) => deleteTeamMember(member.id, member.name, e)} class="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Delete Agent">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                  </button>
                </div>
                
                <!-- Card Body -->
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
                      <p class="text-sm font-semibold text-slate-900 truncate">{member.email}</p>
                    </div>
                  </div>
                </div>
                
                <!-- Card Footer Actions -->
                <div class="px-5 py-4 border-t border-slate-100 bg-white space-y-2">
                  <div class="w-full py-2.5 text-xs font-bold text-center text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg shadow-sm">
                    View Agent History
                  </div>
                  {#if member.isActive}
                    <button onclick={(e) => toggleStatus(member.id, member.isActive, e)} class="w-full py-2.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors shadow-sm">
                      Disable Agent Access
                    </button>
                  {:else}
                    <button onclick={(e) => toggleStatus(member.id, member.isActive, e)} class="w-full py-2.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors shadow-sm">
                      Re-activate Agent
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

<!-- Agent Stats History Modal -->
{#if showStatsModal && selectedAgent}
  <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-3xl w-[calc(100%-2rem)] max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col">
      <div class="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white">
        <div>
          <h3 class="text-xl font-bold text-slate-900">Agent History</h3>
          <p class="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider">{selectedAgent.name}</p>
          {#if selectedAgent.createdAt}
            <p class="text-[10px] font-bold text-indigo-400 mt-1 uppercase tracking-wider">Joined: {new Date(selectedAgent.createdAt).toLocaleDateString()}</p>
          {/if}
        </div>
        <button onclick={() => showStatsModal = false} class="text-slate-400 hover:text-slate-700 bg-slate-50 rounded-full p-2 hover:bg-slate-100 transition-colors">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="p-8 bg-slate-50/50">
        {#if selectedAgent.role === 'SALES'}
          {@const stats = getAgentStats(selectedAgent)}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-gradient-to-br from-emerald-500 to-emerald-700 p-5 rounded-2xl shadow-sm text-center col-span-2 text-white">
              <p class="text-xs font-bold uppercase tracking-wide opacity-80 mb-1">Total Generated (Completed)</p>
              <p class="text-4xl font-black">Rs {stats.totalRevenue.toLocaleString()}</p>
            </div>
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
              <p class="text-4xl font-black text-slate-900 mb-1">{stats.total}</p>
              <p class="text-xs font-bold text-slate-500 uppercase tracking-wide">Total Submitted</p>
            </div>
            <div class="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm text-center">
              <p class="text-4xl font-black text-emerald-600 mb-1">{stats.completed}</p>
              <p class="text-xs font-bold text-emerald-600 uppercase tracking-wide">Confirmed</p>
            </div>
            <div class="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm text-center">
              <p class="text-4xl font-black text-amber-600 mb-1">{stats.pending}</p>
              <p class="text-xs font-bold text-amber-600 uppercase tracking-wide">Pending</p>
            </div>
            <div class="bg-white p-5 rounded-2xl border border-indigo-200 shadow-sm text-center">
              <p class="text-4xl font-black text-indigo-600 mb-1">{stats.approved}</p>
              <p class="text-xs font-bold text-indigo-600 uppercase tracking-wide">Approved</p>
            </div>
          </div>
          <div class="mt-8">
            <button onclick={() => window.location.href = `/manager?agentId=${selectedAgent.id}`} class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-sm transition-colors flex items-center justify-center space-x-2">
              <span>View Filtered Orders</span>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
            </button>
          </div>
        {:else}
          {@const stats = getAgentStats(selectedAgent)}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm text-center col-span-2">
              <p class="text-4xl font-black text-emerald-600 mb-1">{stats.completedWork}</p>
              <p class="text-xs font-bold text-emerald-600 uppercase tracking-wide">Total Confirmed</p>
            </div>
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
              <p class="text-4xl font-black text-slate-900 mb-1">{stats.total}</p>
              <p class="text-xs font-bold text-slate-500 uppercase tracking-wide">Total Assigned</p>
            </div>
            <div class="bg-white p-5 rounded-2xl border border-indigo-200 shadow-sm text-center">
              <p class="text-4xl font-black text-indigo-600 mb-1">{stats.pendingWork}</p>
              <p class="text-xs font-bold text-indigo-600 uppercase tracking-wide">Work Pending</p>
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
          <h3 class="text-xl font-bold text-slate-900">Hire Team Member</h3>
          <p class="text-xs text-slate-500 mt-1">Add a new agent to your agency.</p>
        </div>
        <button onclick={() => showAddTeamModal = false} class="text-slate-400 hover:text-slate-700 bg-slate-50 rounded-full p-2 hover:bg-slate-100 transition-colors">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      
      <div class="p-8 overflow-y-auto bg-slate-50/50">
        <form onsubmit={handleAddTeamMember} class="space-y-5">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Full Name</label>
            <input type="text" bind:value={newName} required placeholder="e.g., Jane Doe" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Email Address</label>
            <input type="email" bind:value={newEmail} required placeholder="jane@agency.com" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Temporary Password</label>
            <input type="password" bind:value={newPassword} required placeholder="••••••••" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Role</label>
            <select bind:value={newRole} class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm font-medium">
              <option value="SALES">Sales Agent (Uploads tasks)</option>
              <option value="FULFILLMENT">Local Agent (Processes tasks)</option>
            </select>
          </div>
          
          <div class="pt-4 flex space-x-3">
            <button type="button" onclick={() => showAddTeamModal = false} class="flex-1 py-3 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm text-sm">
              Cancel
            </button>
            <button type="submit" disabled={isCreating} class="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm shadow-indigo-600/20 text-sm">
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
