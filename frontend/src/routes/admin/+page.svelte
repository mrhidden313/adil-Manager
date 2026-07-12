<script lang="ts">
  import { toast } from '$lib/stores/toast';
  import { onMount, onDestroy } from 'svelte';
  import ProfileModal from '$lib/components/ProfileModal.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';

  let companies: any[] = $state([]);
  let showProfileModal = $state(false);
  let currentUser: any = $state(null);
  let activeTab = $state('ACTIVE'); // 'ACTIVE', 'TRIAL_SUSPENDED', 'DELETED'
  let showProfile = $state(false);
  let showAddCompanyModal = $state(false);

  // New Company Form
  let companyName = $state('');
  let managerName = $state('');
  let managerEmail = $state('');
  let managerPassword = $state('');
  let isCreating = $state(false);

  let filteredCompanies = $derived.by(() => {
    return companies.filter(comp => {
      if (activeTab === 'DELETED') return comp.isDeleted;
      if (comp.isDeleted) return false;
      if (activeTab === 'ACTIVE') return comp.planStatus === 'ACTIVE';
      if (activeTab === 'TRIAL_SUSPENDED') return ['TRIAL', 'SUSPENDED'].includes(comp.planStatus);
      return true;
    });
  });

  async function fetchAdminData() {
    const token = localStorage.getItem('token');
    const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/companies', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401) { localStorage.clear(); window.location.href='/'; return; }
    if (res.ok) {
      companies = await res.json();
    }
  }

  let pollInterval: any;

  onMount(() => {
    fetchAdminData();
    pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible' && !isCreating) {
        fetchAdminData();
      }
    }, 3000);
  });

  onDestroy(() => {
    if (pollInterval) clearInterval(pollInterval);
  });

  
  async function manageCompany(companyId: string) {
    const token = localStorage.getItem('token');
    const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/auth/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ companyId })
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('token', data.token);
      window.location.href = '/manager';
    } else {
      toast.add('Failed to enter company mode', 'error');
    }
  }

  async function handleAddCompany(e: Event) {
    e.preventDefault();
    isCreating = true;
    const token = localStorage.getItem('token');
    
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/companies', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ companyName, managerName, managerEmail, managerPassword })
      });
      
      if (res.status === 401) { localStorage.clear(); window.location.href='/'; return; }
    if (res.ok) {
        showAddCompanyModal = false;
        companyName = ''; managerName = ''; managerEmail = ''; managerPassword = '';
        fetchAdminData();
        activeTab = 'TRIAL_SUSPENDED'; // newly created are in trial
      } else {
        const data = await res.json();
        toast.add(data.error || 'Failed to create company', 'error');
      }
    } catch (err) {
      toast.add('Network error', 'error');
    } finally {
      isCreating = false;
    }
  }

  async function toggleStatus(companyId: string, currentStatus: string, planType: string = 'MONTHLY') {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!confirm(`Are you sure you want to change status to ${newStatus}?`)) return;
    
    const token = localStorage.getItem('token');
    await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/companies/${companyId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ planStatus: newStatus, planType: newStatus === 'ACTIVE' ? planType : null })
    });
    fetchAdminData();
  }

  async function deleteCompany(companyId: string, companyName: string) {
    if (!confirm(`WARNING: Are you sure you want to delete agency "${companyName}"? Managers and users will lose access immediately.`)) return;
    
    const token = localStorage.getItem('token');
    await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/companies/${companyId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchAdminData();
  }

  let selectedCompanyUsers: any[] = $state([]);
  let selectedCompanyName: string = $state('');
  let showUsersModal = $state(false);

  async function viewUsers(comp: any) {
    selectedCompanyName = comp.name;
    const token = localStorage.getItem('token');
    const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/companies/${comp.id}/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401) { localStorage.clear(); window.location.href='/'; return; }
    if (res.ok) {
      selectedCompanyUsers = await res.json();
      showUsersModal = true;
    }
  }

  function getStatusBadge(status: string) {
    switch(status) {
      case 'TRIAL': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'ACTIVE': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'SUSPENDED': return 'bg-rose-100 text-rose-700 border-rose-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
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
      <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">Management</div>
      <button class="w-full flex items-center space-x-3 bg-indigo-500/10 text-indigo-400 px-3 py-2.5 rounded-lg font-medium transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
        <span>Agencies</span>
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
      <h2 class="hidden md:block text-lg font-semibold text-slate-800">Platform Overview</h2>
      <div class="flex items-center space-x-4">
        <div class="hidden sm:block text-sm text-slate-500">Super Admin Mode</div>
        <div class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border border-indigo-200 cursor-pointer" onclick={() => showProfile = true}>
          S
        </div>
        <button onclick={() => { localStorage.clear(); window.location.href = '/'; }} class="md:hidden text-slate-500 hover:text-slate-800">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
        </button>
      </div>
    </header>

    <!-- Page Content -->
    <div class="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50">
      <div class="max-w-7xl mx-auto">
        
        <!-- Header Actions -->
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 class="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">Agencies</h1>
            <p class="text-slate-500 mt-1 text-sm">Manage tenant companies, subscriptions, and owners.</p>
          </div>
          <button onclick={() => showAddCompanyModal = true} class="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-lg shadow-sm shadow-indigo-600/20 transition-all focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>
            <span>Onboard Agency</span>
          </button>
        </div>

        <!-- Filter Tabs -->
        <div class="border-b border-slate-200 mb-6">
          <nav class="-mb-px flex space-x-8" aria-label="Tabs">
            <button onclick={() => activeTab = 'ACTIVE'} class={`whitespace-nowrap py-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'ACTIVE' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} transition-colors`}>
              Active Subscriptions
            </button>
            <button onclick={() => activeTab = 'TRIAL_SUSPENDED'} class={`whitespace-nowrap py-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'TRIAL_SUSPENDED' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} transition-colors`}>
              Trials & Suspended
            </button>
            <button onclick={() => activeTab = 'DELETED'} class={`whitespace-nowrap py-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'DELETED' ? 'border-rose-500 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} transition-colors`}>
              Deleted
            </button>
          </nav>
        </div>

        <!-- Empty State -->
        {#if filteredCompanies.length === 0}
          <div class="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
            <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            </div>
            <h3 class="text-lg font-bold text-slate-800 mb-2">No Agencies Found</h3>
            <p class="text-slate-500 max-w-md mx-auto mb-6">No agencies match the current filter in this category.</p>
            {#if activeTab === 'TRIAL_SUSPENDED'}
              <button onclick={() => showAddCompanyModal = true} class="inline-flex text-indigo-600 font-medium hover:text-indigo-700">
                Create a new agency &rarr;
              </button>
            {/if}
          </div>
        {:else}
          <!-- Companies Grid -->
          <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {#each filteredCompanies as comp}
              <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-lg transition-all duration-300 {comp.isDeleted ? 'opacity-75 grayscale-[30%]' : ''}">
                
                <!-- Card Header -->
                <div class="p-5 border-b border-slate-100 flex justify-between items-start relative">
                  <div class="pr-8">
                    <h3 class="text-lg font-bold text-slate-800 line-clamp-1" title={comp.name}>{comp.name}</h3>
                    <p class="text-[10px] text-slate-500 font-semibold mb-1">Created: {new Date(comp.createdAt).toLocaleDateString()}</p>
                    <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                      {#if comp.isDeleted}
                        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide bg-rose-100 text-rose-700 border-rose-200">DELETED</span>
                      {:else}
                        <span class={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide ${getStatusBadge(comp.planStatus)}`}>
                          {comp.planStatus}
                        </span>
                        {#if comp.planType && comp.planStatus === 'ACTIVE'}
                          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide bg-blue-100 text-blue-700 border-blue-200">
                            {comp.planType} PLAN
                          </span>
                        {/if}
                        {#if comp.planStatus === 'ACTIVE' && comp.planEndsAt}
                          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide bg-amber-100 text-amber-700 border-amber-200">
                            {Math.max(0, Math.ceil((new Date(comp.planEndsAt).getTime() - new Date().getTime()) / (1000 * 3600 * 24)))} Days Left
                          </span>
                        {/if}
                      {/if}
                    </div>
                  </div>

                  {#if !comp.isDeleted}
                    <!-- Delete Button Dropdown alternative -->
                    <button onclick={() => deleteCompany(comp.id, comp.name)} class="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Delete Agency">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                    </button>
                  {/if}
                </div>
                
                <!-- Card Body -->
                <div class="p-5 flex-1 bg-slate-50/30">
                  <div class="flex items-center space-x-3 mb-5">
                    <div class="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-100 to-blue-50 text-indigo-700 flex items-center justify-center font-extrabold text-sm uppercase shadow-inner border border-indigo-100">
                      {comp.users[0]?.name.substring(0, 2) || 'NA'}
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-bold text-slate-800 truncate">{comp.users[0]?.name || 'No Manager'}</p>
                      <p class="text-xs text-slate-500 truncate">{comp.users[0]?.email || 'N/A'}</p>
                    </div>
                  </div>
                  
                  <div class="grid grid-cols-2 gap-3">
                    <div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center space-x-3">
                      <div class="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                      </div>
                      <div>
                        <div class="text-xl font-black text-slate-800 leading-none">{comp._count.users}</div>
                        <div class="text-[10px] uppercase font-bold text-slate-500 mt-1 tracking-wide">Staff</div>
                      </div>
                    </div>
                    
                    <div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center space-x-3">
                      <div class="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <div>
                        <div class="text-xl font-black text-slate-800 leading-none">{comp._count.tickets}</div>
                        <div class="text-[10px] uppercase font-bold text-slate-500 mt-1 tracking-wide">Tickets</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- Card Footer Actions -->
                {#if !comp.isDeleted}
                  <div class="px-5 py-4 border-t border-slate-100 bg-white">
                    <div class="flex space-x-2 mb-3">
                      <button onclick={() => viewUsers(comp)} class="flex-1 py-2 text-xs font-bold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                        View Staff
                      </button>
                    </div>

                    {#if comp.planStatus === 'ACTIVE'}
                      <button onclick={() => toggleStatus(comp.id, comp.planStatus)} class="w-full py-2.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors shadow-sm">
                        Suspend Subscription
                      </button>
                    {:else}
                      <div class="flex gap-2">
                        <button onclick={() => toggleStatus(comp.id, comp.planStatus, 'MONTHLY')} class="flex-1 py-2.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors shadow-sm">
                          Activate Monthly
                        </button>
                        <button onclick={() => toggleStatus(comp.id, comp.planStatus, 'YEARLY')} class="flex-1 py-2.5 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors shadow-sm">
                          Activate Yearly
                        </button>
                      </div>
                    {/if}
                  </div>
                {:else}
                  <div class="px-5 py-4 border-t border-slate-100 bg-slate-100 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Agency Deactivated
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </main>

<BottomNav role="SUPER_ADMIN" bind:showProfile />
</div>

<!-- Onboard Agency Modal -->
{#if showAddCompanyModal}
  <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
      <div class="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white relative">
        <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
        <div>
          <h3 class="text-xl font-bold text-slate-800">Onboard Agency</h3>
          <p class="text-xs text-slate-500 mt-1">Create a tenant workspace and assign an owner.</p>
        </div>
        <button onclick={() => showAddCompanyModal = false} class="text-slate-400 hover:text-slate-700 bg-slate-50 rounded-full p-2 hover:bg-slate-100 transition-colors">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      
      <div class="p-8 overflow-y-auto bg-slate-50/50">
        <form onsubmit={handleAddCompany} class="space-y-5">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Agency / Company Name</label>
            <input type="text" bind:value={companyName} required placeholder="e.g., Apex Solutions" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm">
          </div>
          
          <div class="relative py-4">
            <div class="absolute inset-0 flex items-center" aria-hidden="true">
              <div class="w-full border-t border-slate-200"></div>
            </div>
            <div class="relative flex justify-center">
              <span class="bg-slate-50 px-4 text-[10px] font-black uppercase tracking-widest text-indigo-400">Manager Access</span>
            </div>
          </div>
          
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Manager Full Name</label>
            <input type="text" bind:value={managerName} required placeholder="John Doe" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Manager Email</label>
            <input type="email" bind:value={managerEmail} required placeholder="john@apex.com" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Temporary Password</label>
            <input type="password" bind:value={managerPassword} required placeholder="••••••••" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm">
          </div>
          
          <div class="pt-4 flex space-x-3">
            <button type="button" onclick={() => showAddCompanyModal = false} class="flex-1 py-3 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm text-sm">
              Cancel
            </button>
            <button type="submit" disabled={isCreating} class="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm shadow-indigo-600/20 text-sm">
              {isCreating ? 'Creating...' : 'Create (3-Day Trial)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}

<!-- Staff List Modal -->
{#if showUsersModal}
  <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
      <div class="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white">
        <div>
          <h3 class="text-xl font-bold text-slate-800">{selectedCompanyName} Staff</h3>
          <p class="text-xs text-slate-500 mt-1">Users operating inside this tenant's workspace.</p>
        </div>
        <button onclick={() => showUsersModal = false} class="text-slate-400 hover:text-slate-700 bg-slate-50 rounded-full p-2 hover:bg-slate-100 transition-colors">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      
      <div class="flex-1 overflow-y-auto p-0 bg-slate-50/30">
        {#if selectedCompanyUsers.length === 0}
          <div class="p-12 text-center">
            <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </div>
            <p class="text-slate-500 font-medium">No staff members have been added to this agency yet.</p>
          </div>
        {:else}
          <table class="min-w-full divide-y divide-slate-200">
            <thead class="bg-slate-50 sticky top-0">
              <tr>
                <th class="px-8 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">User</th>
                <th class="px-8 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Role</th>
                <th class="px-8 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th class="px-8 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Joined</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-slate-100">
              {#each selectedCompanyUsers as user}
                <tr class="hover:bg-slate-50/50 transition-colors">
                  <td class="px-8 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm uppercase border border-slate-200 shadow-sm">
                        {user.name.substring(0, 2)}
                      </div>
                      <div class="ml-4">
                        <div class="text-sm font-bold text-slate-800">{user.name}</div>
                        <div class="text-xs text-slate-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-8 py-4 whitespace-nowrap">
                    <span class={`px-2.5 py-1 inline-flex text-[10px] font-bold uppercase tracking-wider rounded-md border ${
                      user.role === 'MANAGER' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 
                      user.role === 'SALES' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td class="px-8 py-4 whitespace-nowrap">
                    {#if user.isActive}
                      <span class="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <svg class="mr-1.5 h-2 w-2 text-emerald-500" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" /></svg> Active
                      </span>
                    {:else}
                      <span class="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200">
                        <svg class="mr-1.5 h-2 w-2 text-slate-400" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" /></svg> Disabled
                      </span>
                    {/if}
                  </td>
                  <td class="px-8 py-4 whitespace-nowrap text-xs font-medium text-slate-500">
                    {new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    </div>
  </div>
{/if}

<ProfileModal bind:showProfile />
