<script lang="ts">
  import { onMount } from 'svelte';
  
  let email = $state('');
  let password = $state('');
  let showPassword = $state(false);
  let errorMessage = $state('');
  let isSubmitting = $state(false);

  // For intro animation
  let mounted = $state(false);
  onMount(() => {
    // Auto-login check
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.role === 'SUPER_ADMIN') window.location.href = '/admin';
        else if (user.role === 'SALES') window.location.href = '/sales';
        else if (user.role === 'MANAGER') window.location.href = '/manager';
        else if (user.role === 'FULFILLMENT') window.location.href = '/fulfillment';
        return;
      } catch (e) {
        localStorage.clear();
      }
    }

    setTimeout(() => { mounted = true; }, 100);
  });

  async function handleLogin() {
    errorMessage = '';
    isSubmitting = true;
    try {
      const response = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        errorMessage = data.error || 'Failed to login';
        isSubmitting = false;
        return;
      }
      
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Redirect based on role
      if (data.user.role === 'SUPER_ADMIN') {
        window.location.href = '/admin';
      } else if (data.user.role === 'SALES') {
        window.location.href = '/sales';
      } else if (data.user.role === 'MANAGER') {
        window.location.href = '/manager';
      } else if (data.user.role === 'FULFILLMENT') {
        window.location.href = '/fulfillment';
      }
    } catch (error) {
      errorMessage = 'Connection error. Is backend running?';
      isSubmitting = false;
    }
  }
</script>

<div class="min-h-screen w-full relative overflow-hidden bg-slate-900 flex items-center justify-center">
  <!-- Cinematic Background Elements -->
  <div class="absolute inset-0 z-0">
    <!-- Animated Orbs -->
    <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/30 rounded-full blur-[120px] animate-pulse" style="animation-duration: 8s;"></div>
    <div class="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[150px] animate-pulse" style="animation-duration: 10s; animation-delay: 2s;"></div>
    <div class="absolute top-[40%] left-[60%] w-[30%] h-[30%] bg-blue-500/20 rounded-full blur-[100px] animate-pulse" style="animation-duration: 12s; animation-delay: 1s;"></div>
    
    <!-- Noise Texture Overlay (Optional subtle grit) -->
    <div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
  </div>

  <!-- Login Card container -->
  <div class="relative z-10 w-full max-w-md px-6 transition-all duration-1000 ease-out transform {mounted ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}">
    
    <!-- Glassmorphism Card -->
    <div class="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-8 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)]">
      
      <!-- Logo Circle -->
      <div class="mx-auto w-24 h-24 mb-6 relative">
        <div class="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full animate-spin-slow blur-md opacity-50"></div>
        <div class="relative w-full h-full rounded-full shadow-2xl overflow-hidden flex items-center justify-center bg-transparent">
          <img src="/logo.png" alt="Logo" class="w-full h-full object-cover scale-110" onerror={(e) => e.currentTarget.src='https://ui-avatars.com/api/?name=AK+FLOW&background=random'} />
        </div>
      </div>

      <h2 class="text-center text-3xl font-extrabold tracking-tight text-white mb-2">Welcome Back</h2>
      <p class="text-center text-sm text-indigo-200/80 mb-8 font-medium tracking-wide">Sign in to continue to AK FLOW</p>

      {#if errorMessage}
        <div class="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl flex items-center gap-3 backdrop-blur-md animate-fade-in">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <span class="text-sm text-red-200">{errorMessage}</span>
        </div>
      {/if}

      <form class="space-y-6" onsubmit={(e) => { e.preventDefault(); handleLogin(); }}>
        <!-- Email Input -->
        <div class="space-y-2 relative group">
          <label for="email" class="block text-xs font-bold tracking-wider uppercase text-indigo-300/80 ml-1">Email Address</label>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-black/70 group-focus-within:text-black transition-colors" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
            </div>
            <input 
              id="email" 
              type="email" 
              required 
              bind:value={email} 
              placeholder="manager@company.com"
              class="block w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all shadow-inner sm:text-sm"
            >
          </div>
        </div>

        <!-- Password Input -->
        <div class="space-y-2 relative group">
          <div class="flex items-center justify-between ml-1">
            <label for="password" class="block text-xs font-bold tracking-wider uppercase text-indigo-300/80">Password</label>
          </div>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-black/70 group-focus-within:text-black transition-colors" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
              </svg>
            </div>
            <input 
              id="password" 
              type={showPassword ? 'text' : 'password'} 
              required 
              bind:value={password} 
              placeholder="••••••••"
              class="block w-full pl-11 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all shadow-inner sm:text-sm"
            >
            <button 
              type="button" 
              class="absolute inset-y-0 right-0 pr-4 flex items-center text-black/70 hover:text-black transition-colors focus:outline-none"
              onclick={() => showPassword = !showPassword}
              aria-label="Toggle password visibility"
            >
              {#if showPassword}
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              {:else}
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              {/if}
            </button>
          </div>
        </div>

        <!-- Submit Button -->
        <button 
          type="submit" 
          disabled={isSubmitting}
          class="group relative flex w-full justify-center items-center py-3.5 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 bg-[length:200%_auto] hover:bg-[position:right_center] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-slate-900 transition-all duration-500 shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_30px_rgba(99,102,241,0.6)] disabled:opacity-70 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
        >
          {#if isSubmitting}
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Authenticating...
          {:else}
            <span>Sign in to Dashboard</span>
            <svg class="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
          {/if}
        </button>
      </form>
    </div>
    
    <div class="mt-8 text-center">
      <p class="text-xs text-slate-500">Secure Internal Portal &copy; 2026 AK FLOW</p>
    </div>
  </div>
</div>

<style>
  /* Custom utility classes if Tailwind arbitary values aren't enough */
  @keyframes spin-slow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .animate-spin-slow {
    animation: spin-slow 8s linear infinite;
  }
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fade-in 0.3s ease-out forwards;
  }
</style>
