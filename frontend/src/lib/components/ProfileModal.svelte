<script lang="ts">
  import { toast } from '$lib/stores/toast';
  import { onMount } from 'svelte';

  let { showProfile = $bindable(false) } = $props();
  
  let userProfile: any = $state(null);
  let isLoading = $state(true);
  
  let isEditing = $state(false);
  let editName = $state('');
  let editPaymentAccountType = $state('');
  let editPaymentAccountNumber = $state('');
  let editPassword = $state('');
  let isSaving = $state(false);

  let fileInput: HTMLInputElement | undefined = $state();

  async function fetchProfile() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        userProfile = await res.json();
        editName = userProfile.name;
        editPaymentAccountType = userProfile.paymentAccountType || '';
        editPaymentAccountNumber = userProfile.paymentAccountNumber || '';
      }
    } catch (e) {
      console.error(e);
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    if (showProfile) {
      isLoading = true;
      fetchProfile();
      isEditing = false;
      editPassword = '';
    }
  });

  async function handlePictureUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;
    
    isSaving = true;
    try {
      const formData = new FormData();
      formData.append('profilePicture', file, file.name || 'avatar.jpg');

      const token = localStorage.getItem('token');
      const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        userProfile = data.user;
      } else {
        let errMsg = 'Failed to upload picture';
        try {
          const errData = await res.json();
          errMsg = errData.error || errMsg;
        } catch (e) {
          errMsg = `Server error (${res.status})`;
        }
        toast.add(errMsg, 'error');
      }
    } catch (err: any) {
      console.error('Profile picture upload error:', err);
      toast.add(err?.message || 'Error uploading picture', 'error');
    } finally {
      isSaving = false;
    }
  }

  async function handleSaveProfile(e: Event) {
    e.preventDefault();
    isSaving = true;
    
    try {
      const formData = new FormData();
      if (editName !== userProfile.name) formData.append('name', editName);
      if (editPaymentAccountType !== userProfile.paymentAccountType) formData.append('paymentAccountType', editPaymentAccountType);
      if (editPaymentAccountNumber !== userProfile.paymentAccountNumber) formData.append('paymentAccountNumber', editPaymentAccountNumber);
      if (editPassword) formData.append('password', editPassword);

      const token = localStorage.getItem('token');
      const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        userProfile = data.user;
        isEditing = false;
        editPassword = '';
      } else {
        toast.add('Failed to update profile', 'error');
      }
    } catch (err) {
      toast.add('Error updating profile', 'error');
    } finally {
      isSaving = false;
    }
  }
</script>

{#if showProfile}
  <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
    <div class="bg-white rounded-3xl shadow-2xl w-[calc(100%-2rem)] max-w-sm max-h-[90vh] overflow-y-auto relative">
      <div class="bg-gradient-to-r from-indigo-500 to-purple-600 h-28 relative">
        <button aria-label="Close" class="absolute top-4 right-4 text-white/80 hover:text-white transition-colors bg-black/20 rounded-full p-1.5" onclick={() => showProfile = false}>
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      
      <div class="px-6 pb-6 relative">
        <!-- Avatar -->
        <div class="absolute -top-12 left-1/2 -translate-x-1/2 flex flex-col items-center">
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div 
            class="w-24 h-24 bg-white rounded-full p-1 shadow-xl relative group cursor-pointer"
            onclick={() => fileInput?.click()}
          >
            {#if userProfile?.profilePictureUrl}
              <img src={userProfile.profilePictureUrl} alt="Avatar" class="w-full h-full rounded-full object-cover" />
            {:else}
              <div class="w-full h-full bg-gradient-to-tr from-indigo-100 to-blue-50 rounded-full flex items-center justify-center text-3xl font-extrabold text-indigo-700 shadow-inner">
                {userProfile?.name?.substring(0, 2).toUpperCase() || '?'}
              </div>
            {/if}
            <div class="absolute inset-1 rounded-full bg-black/50 hidden group-hover:flex items-center justify-center transition-all">
              <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
          </div>
          <input type="file" accept="image/*" class="hidden" bind:this={fileInput} onchange={handlePictureUpload} />
          
          {#if isSaving}
            <span class="text-xs text-indigo-600 font-bold mt-1 animate-pulse">Uploading...</span>
          {/if}
        </div>

        <div class="pt-16">
          {#if isLoading}
            <div class="animate-pulse space-y-4">
              <div class="h-4 bg-slate-200 rounded w-1/2 mx-auto"></div>
              <div class="h-4 bg-slate-200 rounded w-3/4 mx-auto"></div>
            </div>
          {:else}
            {#if userProfile}
              {#if isEditing}
                <form onsubmit={handleSaveProfile} class="space-y-4">
                  <div>
                    <label for="profile-name" class="block text-xs font-bold text-slate-700 mb-1 uppercase">Name</label>
                    <input type="text" id="profile-name" bind:value={editName} class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" required />
                  </div>
                  <div>
                    <label for="profile-password" class="block text-xs font-bold text-slate-700 mb-1 uppercase">New Password</label>
                    <input type="password" id="profile-password" bind:value={editPassword} placeholder="Leave blank to keep current" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label for="profile-pat" class="block text-xs font-bold text-slate-700 mb-1 uppercase">Payment Account Type</label>
                    <select id="profile-pat" bind:value={editPaymentAccountType} class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                      <option value="">None</option>
                      <option value="Easypaisa">Easypaisa</option>
                      <option value="JazzCash">JazzCash</option>
                      <option value="SadaPay">SadaPay</option>
                      <option value="NayaPay">NayaPay</option>
                      <option value="Bank">Bank Account</option>
                    </select>
                  </div>
                  <div>
                    <label for="profile-pan" class="block text-xs font-bold text-slate-700 mb-1 uppercase">Account Number / IBAN</label>
                    <input type="text" id="profile-pan" bind:value={editPaymentAccountNumber} placeholder="e.g. 03001234567" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div class="flex space-x-2 pt-2">
                    <button type="button" onclick={() => isEditing = false} class="flex-1 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg text-sm hover:bg-slate-200 transition-colors">Cancel</button>
                    <button type="submit" disabled={isSaving} class="flex-1 py-2 bg-indigo-600 text-white font-bold rounded-lg text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm shadow-indigo-500/30">
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              {:else}
                <div class="text-center mb-6">
                  <h2 class="text-2xl font-black text-slate-800">{userProfile?.name}</h2>
                  <p class="text-sm font-medium text-slate-500">{userProfile?.email}</p>
                  <button onclick={() => isEditing = true} class="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider">
                    Edit Profile
                  </button>
                </div>

                <div class="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div class="flex justify-between items-center">
                    <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Role</span>
                    <span class={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                      userProfile?.role === 'SALES' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      userProfile?.role === 'MANAGER' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                      'bg-purple-50 text-purple-700 border-purple-200'
                    }`}>
                      {userProfile?.role}
                    </span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Member Since</span>
                    <span class="text-sm font-bold text-slate-700">
                      {userProfile?.createdAt ? new Date(userProfile.createdAt).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  {#if userProfile?.paymentAccountType}
                    <div class="flex flex-col pt-2 border-t border-slate-200 mt-2">
                      <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Payment Details</span>
                      <div class="flex justify-between items-center">
                        <span class="text-sm font-bold text-slate-700">{userProfile?.paymentAccountType}</span>
                        <span class="text-sm font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{userProfile?.paymentAccountNumber}</span>
                      </div>
                    </div>
                  {/if}
                </div>

                <div class="mt-6 pt-4 border-t border-slate-100 text-center">
                  <button onclick={() => { localStorage.clear(); window.location.href='/'; }} class="w-full text-sm font-bold text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-6 py-3 rounded-xl transition-colors inline-flex justify-center items-center space-x-2">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                    <span>Sign Out</span>
                  </button>
                </div>
              {/if}
            {:else}
              <div class="text-center text-rose-500 font-bold p-4 bg-rose-50 rounded-xl">
                Failed to load profile. Please check your connection or login again.
              </div>
            {/if}
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
