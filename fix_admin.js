const fs = require('fs');
let file = fs.readFileSync('frontend/src/routes/admin/+page.svelte', 'utf8');
const deleteFnIndex = file.indexOf('async function deleteCompany');
if(deleteFnIndex > -1) {
  const newTop = 
<script lang="ts">
  import { toast } from '/stores/toast';
  import { onMount, onDestroy } from 'svelte';
  import ProfileModal from '/components/ProfileModal.svelte';

  let companies: any[] = \\([]);
  let activeTab = \\('ACTIVE'); // 'ACTIVE', 'TRIAL_SUSPENDED', 'DELETED'
  let showProfile = \\(false);
  let showAddCompanyModal = \\(false);

  // New Company Form
  let companyName = \\('');
  let managerName = \\('');
  let managerEmail = \\('');
  let managerPassword = \\('');
  let isCreating = \\(false);

  let filteredCompanies = \\.by(() => {
    return companies.filter(comp => {
      if (activeTab === 'DELETED') return comp.isDeleted;
      if (comp.isDeleted) return false;
      if (activeTab === 'ACTIVE') return comp.planStatus === 'ACTIVE';
      if (activeTab === 'TRIAL_SUSPENDED') return ['TRIAL', 'SUSPENDED'].includes(comp.planStatus);
      return true;
    });
  });

  async function fetchAdminData() {
    const token = sessionStorage.getItem('token');
    const res = await fetch('http://localhost:3000/api/companies', {
      headers: { 'Authorization': \Bearer \\ }
    });
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
    }, 10000);
  });

  onDestroy(() => {
    if (pollInterval) clearInterval(pollInterval);
  });

  async function handleAddCompany(e: Event) {
    e.preventDefault();
    isCreating = true;
    const token = sessionStorage.getItem('token');
    
    try {
      const res = await fetch('http://localhost:3000/api/companies', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': \Bearer \\
        },
        body: JSON.stringify({ companyName, managerName, managerEmail, managerPassword })
      });
      
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
    if (!confirm(\Are you sure you want to change status to \?\)) return;
    
    const token = sessionStorage.getItem('token');
    await fetch(\http://localhost:3000/api/companies/\/status\, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': \Bearer \\ },
      body: JSON.stringify({ planStatus: newStatus, planType: newStatus === 'ACTIVE' ? planType : null })
    });
    fetchAdminData();
  }

  ;
  const result = newTop.trim() + '\n\n  ' + file.substring(deleteFnIndex);
  fs.writeFileSync('frontend/src/routes/admin/+page.svelte', result, 'utf8');
}
