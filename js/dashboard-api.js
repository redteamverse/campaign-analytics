/**
 * CAMPAIGN ANALYTICS - ADMIN WRITE API CLIENT
 *
 * Browser calls only the Cloudflare Worker. The Apps Script admin key
 * is stored in Cloudflare and is never shipped to this repository.
 */
const DashboardApi = (function () {
  const WORKER_URL = 'https://altsec-outreach-api.deepak-95d.workers.dev';

  async function post(action, payload = {}) {
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      cache: 'no-store',
      body: JSON.stringify({ action, ...payload })
    });

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (error) {
      throw new Error(`Admin API returned a non-JSON response (HTTP ${response.status}).`);
    }

    if (!response.ok || data.success === false) {
      throw new Error(data.error || `Admin API HTTP ${response.status}`);
    }

    return data;
  }

  return {
    createUser(payload) {
      return post('create_user', payload);
    },

    updateUser(payload) {
      return post('update_user', payload);
    },

    setUserUnsubscribed(userId, unsubscribed) {
      return post('set_user_unsubscribed', { userId, unsubscribed });
    },

    getWorkerUrl() {
      return WORKER_URL;
    }
  };
})();
