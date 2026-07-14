<script lang="ts">
  import { onMount } from 'svelte';

  let statusMessage = $state('Establishing secure cockpit session...');

  onMount(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const userStr = params.get('user');
      const redirectUrl = params.get('redirect') || '/';

      if (!token || !userStr) {
        statusMessage = 'Authentication payload missing or invalid.';
        setTimeout(() => { window.location.href = '/'; }, 2000);
        return;
      }

      // Set auth data cleanly in this new tab
      localStorage.setItem('token', token);
      localStorage.setItem('user', userStr);

      statusMessage = ' Cockpit authorized. Entering dashboard...';

      // Immediate redirect
      setTimeout(() => {
        window.location.replace(redirectUrl);
      }, 300);
    } catch (err) {
      statusMessage = 'Session initialization error.';
      console.error(err);
    }
  });
</script>

<svelte:head>
  <title>Securing Session | AK Flow</title>
</svelte:head>

<div class="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans relative overflow-hidden">
  <!-- Glowing Background Orbs -->
  <div class="absolute -top-32 -left-32 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse"></div>
  <div class="absolute -bottom-32 -right-32 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>

  <!-- Crystal Card -->
  <div class="relative z-10 w-full max-w-md bg-slate-900/60 border border-white/10 backdrop-blur-2xl rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center">
    <!-- Spinner / Pulse Logo -->
    <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-400 via-indigo-500 to-purple-500 p-0.5 shadow-[0_0_25px_rgba(6,182,212,0.5)] mb-6 flex items-center justify-center animate-bounce">
      <div class="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
        <span class="text-2xl font-black text-cyan-400">⚡</span>
      </div>
    </div>

    <h2 class="text-xl font-extrabold tracking-wide mb-2">AK FLOW COCKPIT</h2>
    <p class="text-sm text-slate-400 mb-6 font-medium">{statusMessage}</p>

    <!-- Progress Bar -->
    <div class="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden border border-white/5">
      <div class="bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-500 h-full w-full animate-pulse"></div>
    </div>
  </div>
</div>
