<script lang="ts">
  import { page } from '$app/stores';

  let { role, showProfile = $bindable() } = $props<{ role: string; showProfile: boolean }>();
  
  let currentPath = $derived($page.url.pathname);

  async function returnToAdmin() {
    const token = localStorage.getItem('token');
    const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/auth/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ companyId: null })
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('token', data.token);
      window.location.href = '/admin';
    }
  }

</script>

  {#if role === 'SUPER_ADMIN'}
    <div class="fixed top-4 right-4 z-50">
      <button onclick={returnToAdmin} class="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-full shadow-lg hover:bg-indigo-700 flex items-center space-x-2">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"></path></svg>
        <span>Exit Company Mode</span>
      </button>
    </div>
  {/if}


<div class="md:hidden fixed bottom-0 left-0 w-full h-16 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40 flex items-center justify-around px-2 pb-safe">
  
  {#if role === 'MANAGER'}
    <button onclick={() => window.location.href = '/manager'} class="flex flex-col items-center justify-center w-full h-full text-slate-500 hover:text-indigo-600 {currentPath === '/manager' ? 'text-indigo-600' : ''}">
      <svg class="w-6 h-6 mb-1 {currentPath === '/manager' ? 'text-indigo-600' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
      <span class="text-[10px] font-bold">Review</span>
    </button>

    <button onclick={() => window.location.href = '/manager/team'} class="flex flex-col items-center justify-center w-full h-full text-slate-500 hover:text-indigo-600 {currentPath === '/manager/team' ? 'text-indigo-600' : ''}">
      <svg class="w-6 h-6 mb-1 {currentPath === '/manager/team' ? 'text-indigo-600' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
      <span class="text-[10px] font-bold">Team</span>
    </button>
  {:else if role === 'SALES'}
    <button onclick={() => window.location.href = '/sales'} class="flex flex-col items-center justify-center w-full h-full text-slate-500 hover:text-indigo-600 {currentPath === '/sales' ? 'text-indigo-600' : ''}">
      <svg class="w-6 h-6 mb-1 {currentPath === '/sales' ? 'text-indigo-600' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
      <span class="text-[10px] font-bold">Dashboard</span>
    </button>
  {:else if role === 'FULFILLMENT'}
    <button onclick={() => window.location.href = '/fulfillment'} class="flex flex-col items-center justify-center w-full h-full text-slate-500 hover:text-indigo-600 {currentPath === '/fulfillment' ? 'text-indigo-600' : ''}">
      <svg class="w-6 h-6 mb-1 {currentPath === '/fulfillment' ? 'text-indigo-600' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
      <span class="text-[10px] font-bold">Tasks</span>
    </button>
  {/if}

  {#if role !== 'SALES' || window.location.pathname === '/chat' || (typeof localStorage !== 'undefined' && localStorage.getItem('allowSalesChat') !== 'false')}
  <button onclick={() => window.location.href = '/chat'} class="flex flex-col items-center justify-center w-full h-full text-slate-500 hover:text-indigo-600 {currentPath === '/chat' ? 'text-indigo-600' : ''}">
    <svg class="w-6 h-6 mb-1 {currentPath === '/chat' ? 'text-indigo-600' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
    <span class="text-[10px] font-bold">Chat</span>
  </button>
  {/if}
  <button onclick={() => showProfile = true} class="flex flex-col items-center justify-center w-full h-full text-slate-500 hover:text-indigo-600">
    <svg class="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
    <span class="text-[10px] font-bold">Profile</span>
  </button>

</div>
