export async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const registration = await navigator.serviceWorker.ready;
    
    // Get VAPID public key from backend
    const token = sessionStorage.getItem('token');
    const vapidRes = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/push/vapid-public-key', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const { publicKey } = await vapidRes.json();
    
    // Convert base64 to Uint8Array
    const padding = '='.repeat((4 - publicKey.length % 4) % 4);
    const base64 = (publicKey + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: outputArray
      });
    }
    
    // Send subscription to backend
    await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/push/subscribe', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(subscription)
    });

    return true;
  } catch (error) {
    console.error('Error subscribing to push:', error);
    return false;
  }
}
