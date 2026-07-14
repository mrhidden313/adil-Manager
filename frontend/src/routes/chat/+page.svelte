<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { toast } from '$lib/stores/toast';
  import { io, Socket } from 'socket.io-client';
  import { subscribeToPush } from '$lib/utils/push';
  import { ripple } from '$lib/actions/ripple';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import ProfileModal from '$lib/components/ProfileModal.svelte';

  let messages: any[] = $state([]);
  let users: any[] = $state([]);
  let currentUser: any = $state(null);
  let companies: any[] = $state([]);
  let activeCompanyId: string = $state('');
  
  let newMessage = $state('');
  let fileInput: HTMLInputElement;
  let selectedFile: File | null = $state(null);
  let isSending = $state(false);
  let showProfileModal = $state(false);
  
  let activeChannel = $state('group'); // 'group' or userId
  let pollInterval: any;
  let messagesContainer: HTMLDivElement;
  let socket: Socket | null = null;

  $effect(() => {
    if (messages.length > 0 && messagesContainer) {
      setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }, 50);
    }
  });

  async function fetchInitialData() {
    const token = localStorage.getItem('token');
    if (!token) return window.location.href = '/';

    try {
      const [meRes, usersRes] = await Promise.all([
        fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/users/team', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (meRes.ok) currentUser = await meRes.json();
      if (usersRes.ok) users = await usersRes.json();
      
      
      if (currentUser?.role === 'SUPER_ADMIN') {
        const companiesRes = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/admin/companies', { headers: { 'Authorization': `Bearer ${token}` } });
        if (companiesRes.ok) {
          companies = await companiesRes.json();
          if (companies.length > 0) activeCompanyId = companies[0].id;
        }
      }
      fetchMessages();
  

      // Setup Socket.io
      const companyToJoin = currentUser?.companyId || activeCompanyId;
      if (companyToJoin) {
        socket = io((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '', {
          transports: ['websocket', 'polling'],
          withCredentials: true
        });
        
        socket.on('connect', () => {
          console.log('SOCKET CONNECTED to backend! Room:', companyToJoin);
          socket?.emit('joinCompany', companyToJoin);
        });

        socket.on('newMessage', (msg) => {
          console.log('NEW MESSAGE RECEIVED via SOCKET:', msg);
          messages = [...messages, msg];
        });
      }
    } catch (e) {
      toast.add('Error loading chat', 'error');
    }
  }

  async function fetchMessages() {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
      const url = activeCompanyId ? `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/messages?companyId=${activeCompanyId}` : (import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/messages';
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) { localStorage.clear(); window.location.href='/'; return; }
    if (res.ok) {
        const data = await res.json();
        // Since we fetch 100 recent messages, we just replace them.
        messages = data;
      }
    } catch (e) {
      console.error(e);
    }
  }

  let showNotificationBanner = $state(false);
  
  onMount(() => {
    // Polling fallback to guarantee auto-fetch
    pollInterval = setInterval(fetchMessages, 3000);

    fetchInitialData();
    if ('Notification' in window && Notification.permission === 'default') {
      showNotificationBanner = true;
    }
  });

  let oldCompanyId = '';
  $effect(() => {
    if (activeCompanyId && oldCompanyId !== activeCompanyId) {
      oldCompanyId = activeCompanyId;
      fetchMessages();
      if (socket) {
        socket.emit('joinCompany', activeCompanyId);
      }
    }
  });

  onDestroy(() => {
    if (socket) socket.disconnect();
    if (pollInterval) clearInterval(pollInterval);
  });

  async function handleSendMessage(e: Event) {
    e.preventDefault();
    if (!newMessage.trim() && !selectedFile) return;

    const messageText = newMessage.trim();
    const file = selectedFile;
    
    // Optimistic UI update
    const optimisticMsg: any = {
      id: 'temp-' + Date.now(),
      content: messageText,
      senderId: currentUser?.id,
      sender: currentUser,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };
    if (file) optimisticMsg.imageUrl = URL.createObjectURL(file);
    
    messages = [...messages, optimisticMsg];
    
    // Clear inputs instantly
    newMessage = '';
    selectedFile = null;
    
    // Scroll to bottom immediately
    setTimeout(() => {
      if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 10);

    const token = localStorage.getItem('token');
    
    try {
      const formData = new FormData();
      if (messageText) formData.append('content', messageText);

      if (currentUser?.role === 'SUPER_ADMIN' && activeCompanyId) {
        formData.append('companyId', activeCompanyId);
      }

      if (file) {
        formData.append('image', file, file.name || 'image.jpg');
      }

      const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/messages', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (res.status === 401) { localStorage.clear(); window.location.href='/'; return; }
      if (res.ok) {
        fetchMessages();
      } else {
        let errMsg = 'Failed to send message';
        try {
          const errData = await res.json();
          errMsg = errData.error || errMsg;
        } catch (e) {
          errMsg = `Server error (${res.status})`;
        }
        toast.add(errMsg, 'error');
        messages = messages.filter((m: any) => m.id !== optimisticMsg.id);
      }
    } catch (err: any) {
      console.error('Chat send error:', err);
      toast.add(err?.message || 'Network error sending message', 'error');
      messages = messages.filter((m: any) => m.id !== optimisticMsg.id);
    }
  }

  function handleFileSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      selectedFile = target.files[0];
    }
  }
</script>

<div class="flex h-screen bg-slate-50 font-sans overflow-hidden">
  
  <!-- Sidebar -->
  <!-- Sidebar -->
  <aside class="w-72 liquid-sidebar text-slate-300 hidden md:flex flex-col shadow-2xl z-10 relative shrink-0">
    <div class="h-16 flex items-center justify-between px-6 border-b border-slate-800/80 bg-slate-950/80">
      <div class="flex items-center space-x-3">
        <button onclick={() => window.history.back()} class="p-1 hover:bg-slate-800/80 rounded-full transition-colors text-slate-400 hover:text-white">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
        </button>
        <h1 class="text-xl font-bold text-white tracking-tight">Team Chat</h1>
      </div>
    </div>
    
    <div class="flex-1 overflow-y-auto py-4 px-3 space-y-4">
      <!-- Universal Navigation inside Chat Sidebar -->
      <div class="space-y-1.5">
        <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-3">Navigation</div>
        <button use:ripple class="w-full flex items-center space-x-3 liquid-glass-btn text-slate-300 px-3.5 py-2 rounded-xl font-medium text-sm" onclick={() => {
          if (currentUser?.role === 'MANAGER' || currentUser?.role === 'SUPER_ADMIN') window.location.href = '/manager';
          else if (currentUser?.role === 'FULFILLMENT') window.location.href = '/fulfillment';
          else if (currentUser?.role === 'SALES') window.location.href = '/sales';
          else window.location.href = '/';
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          <span>Dashboard / Overview</span>
        </button>
        {#if currentUser?.role === 'MANAGER' || currentUser?.role === 'SUPER_ADMIN'}
          <button use:ripple class="w-full flex items-center space-x-3 liquid-glass-btn text-slate-300 px-3.5 py-2 rounded-xl font-medium text-sm" onclick={() => window.location.href = '/manager/team'}>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            <span>Staff Management</span>
          </button>
        {/if}
        <button use:ripple class="w-full flex items-center space-x-3 liquid-glass-btn active px-3.5 py-2 rounded-xl font-medium text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
          <span>Team Chat</span>
        </button>
      </div>

      <div class="border-t border-slate-800/60 pt-3">
        <h2 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-3">Channels</h2>
        <button 
          use:ripple
          onclick={() => activeChannel = 'group'}
          class="w-full flex items-center px-3 py-2 rounded-xl transition-all {activeChannel === 'group' ? 'liquid-glass-btn active' : 'liquid-glass-btn text-slate-300'}"
        >
          <div class="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center mr-3 text-indigo-300 font-bold text-xs">
            #
          </div>
          <span class="font-bold text-sm">Company General</span>
        </button>
      </div>

      <!-- Team Members List -->
      <div class="border-t border-slate-800/60 pt-3">
        <h2 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-3">Team Members ({users.length})</h2>
        <div class="space-y-1">
          {#each users as user}
            <div class="flex items-center px-3 py-1.5 rounded-xl hover:bg-slate-800/60 transition-colors cursor-default">
              <div class="relative w-7 h-7 rounded-full overflow-hidden bg-slate-700 flex-shrink-0 mr-2.5 border border-slate-600/50">
                {#if user.profilePictureUrl}
                  <img src={user.profilePictureUrl} alt={user.name} class="w-full h-full object-cover" />
                {:else}
                  <span class="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-300">
                    {user.name.substring(0,2).toUpperCase()}
                  </span>
                {/if}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-xs font-medium text-slate-200 truncate">{user.name}</p>
                <p class="text-[9px] text-slate-400 uppercase tracking-wider truncate">{user.role}</p>
              </div>
            </div>
          {/each}
        </div>
      </div>

    </div>
    
    {#if currentUser}
    <div class="p-3 border-t border-slate-800/80 bg-slate-950/80 flex items-center justify-between">
      <div class="flex items-center space-x-2.5 min-w-0">
        <div class="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
          {#if currentUser.profilePictureUrl}
            <img src={currentUser.profilePictureUrl} alt="Avatar" class="w-full h-full object-cover"/>
          {:else}
            <span class="text-slate-300 font-bold text-xs">{currentUser.name.substring(0, 2).toUpperCase()}</span>
          {/if}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-bold text-white truncate">{currentUser.name}</p>
          <p class="text-[10px] text-indigo-400 truncate">{currentUser.role}</p>
        </div>
      </div>
      <button onclick={() => showProfileModal = true} title="Profile Settings" class="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
      </button>
    </div>
    {/if}
  </aside>

  <!-- Main Chat Area -->
  <main class="flex-1 flex flex-col min-w-0 bg-white relative">
    <!-- Header -->
    <header class="h-16 flex items-center px-6 border-b border-slate-100 bg-white shadow-sm z-10 shrink-0">
      <div class="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center mr-3">
        <span class="text-indigo-600 font-bold text-lg">#</span>
      </div>
      <div>
        <h2 class="font-bold text-slate-800">Company General</h2>
        <p class="text-xs text-slate-500 font-medium">Chat with everyone in the company</p>
      </div>
    </header>

        
    <!-- Mobile Header -->
    <div class="md:hidden h-16 bg-slate-950 flex items-center justify-between px-4 shrink-0 shadow-md">
      <button onclick={() => window.history.back()} class="p-2 text-slate-300 hover:text-white rounded-full hover:bg-slate-800 transition-colors">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
      </button>
      <h2 class="text-white font-bold text-lg">Team Chat</h2>
      <div class="w-10"></div> <!-- Spacer -->
    </div>

    
    {#if currentUser?.role === 'SUPER_ADMIN'}
    <div class="px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
      <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Select Company Chat</label>
      <select bind:value={activeCompanyId} class="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 outline-none focus:border-indigo-500 text-sm">
        {#each companies as company}
          <option value={company.id}>{company.name}</option>
        {/each}
      </select>
    </div>
    {/if}

    <!-- Notification Banner -->
    {#if showNotificationBanner}
    <div class="bg-indigo-600 text-white px-6 py-3 flex items-center justify-between shrink-0 shadow-md z-20">
      <div class="flex items-center space-x-3">
        <svg class="w-5 h-5 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
        <span class="text-sm font-medium">Never miss a message! Enable push notifications to stay updated when the app is closed.</span>
      </div>
      <div class="flex space-x-2">
        <button onclick={() => showNotificationBanner = false} class="px-3 py-1.5 text-xs font-bold text-indigo-100 hover:text-white transition-colors">Dismiss</button>
        <button onclick={async () => {
          const success = await subscribeToPush();
          if (success) {
            toast.add('Notifications enabled!', 'success');
            showNotificationBanner = false;
          } else {
            toast.add('Failed to enable notifications. Please check browser permissions.', 'error');
            showNotificationBanner = false;
          }
        }} class="px-3 py-1.5 bg-white text-indigo-600 text-xs font-bold rounded shadow-sm hover:bg-indigo-50 transition-colors">Enable Notifications</button>
      </div>
    </div>
    {/if}

    <!-- Messages List -->
    <div bind:this={messagesContainer} class="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
      {#if messages.length === 0}
        <div class="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
          <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
            <svg class="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          </div>
          <p class="text-sm font-medium">No messages yet. Start the conversation!</p>
        </div>
      {:else}
        {#each messages as msg}
          {@const isMine = msg.senderId === currentUser?.id}
          <div class="flex {isMine ? 'justify-end' : 'justify-start'} group">
            <div class="max-w-[70%] flex {isMine ? 'flex-row-reverse' : 'flex-row'} items-end">
              
              <!-- Avatar -->
              {#if !isMine}
              <div class="w-8 h-8 rounded-full bg-slate-200 shrink-0 mr-2 flex items-center justify-center overflow-hidden border border-slate-200">
                {#if msg.sender?.profilePictureUrl}
                  <img src={msg.sender.profilePictureUrl} alt="" class="w-full h-full object-cover"/>
                {:else}
                  <span class="text-xs font-bold text-slate-500">{msg.sender?.name?.substring(0, 2).toUpperCase()}</span>
                {/if}
              </div>
              {/if}

              <!-- Message Bubble -->
              <div class="flex flex-col {isMine ? 'items-end' : 'items-start'}">
                {#if !isMine}
                  <span class="text-[10px] font-bold text-slate-500 ml-1 mb-1">{msg.sender?.name}</span>
                {/if}
                
                <div class="relative group p-3 rounded-2xl {isMine ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white border border-slate-100 text-slate-800 shadow-sm rounded-bl-sm'}">
                  <span class="text-[10px] font-bold text-slate-500 mb-0.5 ml-1 flex items-center space-x-1">
                  <span>{msg.sender?.name || 'Unknown'}</span>
                  {#if msg.sender?.role}
                    <span class="text-[8px] px-1 py-0.5 bg-slate-200 text-slate-600 rounded uppercase tracking-wider">{msg.sender.role}</span>
                  {/if}
                </span>
                {#if msg.imageUrl}
                    <a href={msg.imageUrl} target="_blank" class="block mb-2 overflow-hidden rounded-xl bg-black/5">
                      <img src={msg.imageUrl} alt="Attachment" class="max-w-full max-h-64 object-contain rounded-xl hover:scale-105 transition-transform cursor-zoom-in" />
                    </a>
                  {/if}
                  
                  {#if msg.content}
                    <p class="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  {/if}
                  
                  <span class="text-[9px] font-medium {isMine ? 'text-indigo-200' : 'text-slate-400'} mt-1.5 block text-right">
                    {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
              </div>
              
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Input Area -->
    <div class="p-4 bg-white border-t border-slate-100 shrink-0 relative">
      {#if selectedFile}
        <div class="absolute -top-14 left-4 bg-white border border-slate-200 rounded-lg p-2 shadow-lg flex items-center space-x-3 z-20">
          <div class="w-10 h-10 rounded bg-slate-100 flex items-center justify-center overflow-hidden">
            <img src={URL.createObjectURL(selectedFile)} alt="Preview" class="w-full h-full object-cover" />
          </div>
          <div class="text-xs font-medium text-slate-600 truncate max-w-[150px]">{selectedFile.name}</div>
          <button onclick={() => selectedFile = null} class="text-rose-500 hover:bg-rose-50 p-1 rounded">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      {/if}
      
      <form onsubmit={handleSendMessage} class="flex items-end space-x-2">
        <button type="button" onclick={() => fileInput.click()} class="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors shrink-0">
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        </button>
        <input type="file" accept="image/*" class="hidden" bind:this={fileInput} onchange={handleFileSelect} />
        
        <div class="flex-1 bg-slate-50 border border-slate-200 rounded-2xl focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all flex items-center px-4">
          <input type="text" bind:value={newMessage} placeholder="Type a message..." class="w-full bg-transparent border-none focus:ring-0 py-3.5 text-sm text-slate-800 outline-none" autocomplete="off" />
        </div>
        
        <button type="submit" disabled={isSending || (!newMessage.trim() && !selectedFile)} class="p-3.5 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-600/20 shrink-0">
          {#if isSending}
            <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          {:else}
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
          {/if}
        </button>
      </form>
    </div>
  </main>

  {#if currentUser}
    <BottomNav role={currentUser.role} bind:showProfile={showProfileModal} />
    <ProfileModal bind:showProfile={showProfileModal} />
  {/if}
</div>
