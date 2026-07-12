<script lang="ts">
  import { onMount } from 'svelte';
  import { toast } from '$lib/stores/toast';

  let currentUser: any = $state(null);
  let company: any = $state(null);
  let isLoading = $state(true);
  let isSaving = $state(false);

  async function loadSettings() {
    try {
      const token = localStorage.getItem('token');
      const meRes = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } });
      if (meRes.ok) {
        currentUser = await meRes.json();
        
        const setRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/companies/${currentUser.companyId}/settings`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (setRes.ok) {
          company = await setRes.json();
        }
      }
    } catch (e) {
      toast.add('Error loading settings', 'error');
    } finally {
      isLoading = false;
    }
  }

  onMount(loadSettings);

  async function saveSettings(e: Event) {
    e.preventDefault();
    isSaving = true;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/companies/${currentUser.companyId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          name: company.name,
          maxPadLimit: company.maxPadLimit,
          allowSalesChat: company.allowSalesChat,
          requireManagerApproval: company.requireManagerApproval
        })
      });
      if (res.ok) {
        toast.add('Settings saved successfully', 'success');
        company = await res.json();
      } else {
        toast.add('Failed to save settings', 'error');
      }
    } catch (e) {
      toast.add('Network error', 'error');
    } finally {
      isSaving = false;
    }
  }
</script>

<svelte:head>
  <title>Company Settings | Manager</title>
</svelte:head>

<div class="p-6 md:p-10 max-w-4xl mx-auto pb-32">
  <div class="mb-8 flex items-center space-x-4">
    <button onclick={() => window.history.back()} class="p-2 rounded-full hover:bg-slate-200 transition-colors">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
    </button>
    <div>
      <h1 class="text-3xl font-black text-slate-900 tracking-tight">Company Settings</h1>
      <p class="text-slate-500 font-medium mt-1">Manage global preferences for your agency</p>
    </div>
  </div>

  {#if isLoading}
    <div class="animate-pulse space-y-6">
      <div class="h-32 bg-slate-200 rounded-2xl w-full"></div>
      <div class="h-64 bg-slate-200 rounded-2xl w-full"></div>
    </div>
  {:else if company}
    <form onsubmit={saveSettings} class="space-y-8">
      
      <!-- Basic Details -->
      <div class="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
        <h2 class="text-xl font-bold text-slate-900 mb-6">Basic Information</h2>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-bold text-slate-700 mb-1">Company Name</label>
            <input type="text" bind:value={company.name} class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all font-medium text-slate-900" required />
          </div>
        </div>
      </div>

      <!-- Advanced Settings -->
      <div class="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
        <h2 class="text-xl font-bold text-slate-900 mb-6">Pad & Workflow Rules</h2>
        
        <div class="space-y-6">
          <div class="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 class="font-bold text-indigo-900">Maximum Pad Revenue Limit</h3>
              <p class="text-sm text-indigo-700 mt-1">The monetary threshold where a Pad is considered "full". Current limit determines when extra amounts carry over.</p>
            </div>
            <div class="shrink-0 flex items-center bg-white rounded-xl overflow-hidden border border-indigo-200 shadow-sm">
              <span class="px-3 text-slate-500 font-bold bg-slate-50 border-r border-slate-200 py-2">Rs</span>
              {#if currentUser?.role === 'SUPER_ADMIN'}
                <input type="number" bind:value={company.maxPadLimit} class="w-32 px-3 py-2 outline-none font-black text-slate-900" />
              {:else}
                <div class="w-32 px-3 py-2 font-black text-slate-900">{company.maxPadLimit}</div>
              {/if}
            </div>
          </div>
          {#if currentUser?.role !== 'SUPER_ADMIN'}
            <p class="text-xs font-bold text-slate-400 mt-1 ml-2">* Only the Super Admin can change the maximum pad limit.</p>
          {/if}

          <hr class="border-slate-100">

          <label class="flex items-start cursor-pointer group">
            <div class="relative flex items-center justify-center">
              <input type="checkbox" bind:checked={company.allowSalesChat} class="sr-only peer" />
              <div class="w-12 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500 transition-colors"></div>
            </div>
            <div class="ml-4">
              <h3 class="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">Enable Sales Chat</h3>
              <p class="text-sm text-slate-500 mt-0.5">Allow Sales agents to use the Team Chat feature.</p>
            </div>
          </label>

          <label class="flex items-start cursor-pointer group">
            <div class="relative flex items-center justify-center">
              <input type="checkbox" bind:checked={company.requireManagerApproval} class="sr-only peer" />
              <div class="w-12 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500 transition-colors"></div>
            </div>
            <div class="ml-4">
              <h3 class="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">Require Manager Approval for Tickets</h3>
              <p class="text-sm text-slate-500 mt-0.5">Tickets created by Sales must be approved before Fulfillment can start working on them.</p>
            </div>
          </label>

        </div>
      </div>

      <div class="flex justify-end pt-4">
        <button type="submit" disabled={isSaving} class="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center">
          {#if isSaving}
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            Saving...
          {:else}
            Save Settings
          {/if}
        </button>
      </div>
    </form>
  {/if}
</div>
