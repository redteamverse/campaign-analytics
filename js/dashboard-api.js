/**
 * CAMPAIGN ANALYTICS - ADMIN WRITE API CLIENT
 *
 * Browser talks only to the Cloudflare Worker.
 *
 * Security:
 * - ADMIN_USERNAME / ADMIN_PASSWORD stay in Cloudflare Worker Secrets
 * - DASHBOARD_API_KEY stays in Cloudflare Worker Secrets
 * - Session token is stored only in sessionStorage
 * - Protected requests send:
 *
 *   Authorization: Bearer <session-token>
 */

const DashboardApi = (function () {

  // ============================================================
  // CONFIG
  // ============================================================

  const WORKER_URL =
    'https://altsec-outreach-api.deepak-95d.workers.dev';

  const TOKEN_STORAGE_KEY =
    'altsec_admin_session_token';

  const EXPIRY_STORAGE_KEY =
    'altsec_admin_session_expiry';


  // ============================================================
  // SESSION STORAGE
  // ============================================================

  function getToken() {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY);
  }

  function getExpiry() {
    return sessionStorage.getItem(EXPIRY_STORAGE_KEY);
  }

  function saveSession(token, expiresAt) {
    if (!token) {
      throw new Error(
        'Login response did not contain a session token.'
      );
    }

    sessionStorage.setItem(
      TOKEN_STORAGE_KEY,
      token
    );

    if (expiresAt) {
      sessionStorage.setItem(
        EXPIRY_STORAGE_KEY,
        expiresAt
      );
    } else {
      sessionStorage.removeItem(
        EXPIRY_STORAGE_KEY
      );
    }
  }

  function clearSession() {
    sessionStorage.removeItem(
      TOKEN_STORAGE_KEY
    );

    sessionStorage.removeItem(
      EXPIRY_STORAGE_KEY
    );
  }


  // ============================================================
  // SESSION VALIDATION
  // ============================================================

  function isSessionExpired() {
    const expiresAt = getExpiry();

    if (!expiresAt) {
      return false;
    }

    const expiryTime =
      new Date(expiresAt).getTime();

    if (Number.isNaN(expiryTime)) {
      return true;
    }

    return Date.now() >= expiryTime;
  }

  function isAuthenticated() {
    const token = getToken();

    if (!token) {
      return false;
    }

    if (isSessionExpired()) {
      clearSession();
      return false;
    }

    return true;
  }


  // ============================================================
  // RESPONSE PARSER
  // ============================================================

  async function parseResponse(response) {
    const text =
      await response.text();

    let data = {};

    try {
      data =
        text
          ? JSON.parse(text)
          : {};
    } catch (error) {
      throw new Error(
        `Admin API returned a non-JSON response (HTTP ${response.status}).`
      );
    }

    return data;
  }


  // ============================================================
  // LOGIN
  // ============================================================

  async function login(username, password) {
    const cleanUsername =
      String(username || '').trim();

    const cleanPassword =
      String(password || '');

    if (!cleanUsername || !cleanPassword) {
      throw new Error(
        'Username and password are required.'
      );
    }

    let response;

    try {
      response =
        await fetch(
          WORKER_URL,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json'
            },
            cache:
              'no-store',
            body:
              JSON.stringify({
                action:
                  'login',
                username:
                  cleanUsername,
                password:
                  cleanPassword
              })
          }
        );
    } catch (error) {
      throw new Error(
        'Unable to connect to the admin API.'
      );
    }

    const data =
      await parseResponse(response);

    if (
      !response.ok ||
      data.success === false
    ) {
      clearSession();

      throw new Error(
        data.error ||
        `Login failed (HTTP ${response.status}).`
      );
    }

    if (!data.token) {
      clearSession();

      throw new Error(
        'Login succeeded but no session token was returned.'
      );
    }

    saveSession(
      data.token,
      data.expiresAt || ''
    );

    return data;
  }


  // ============================================================
  // PROTECTED ADMIN REQUEST
  // ============================================================

  async function post(action, payload = {}) {
    const token =
      getToken();

    if (!token) {
      const error =
        new Error(
          'Administrator login required.'
        );

      error.code =
        'AUTH_REQUIRED';

      throw error;
    }

    if (isSessionExpired()) {
      clearSession();

      window.dispatchEvent(
        new CustomEvent(
          'admin-auth-required'
        )
      );

      const error =
        new Error(
          'Your admin session has expired. Please log in again.'
        );

      error.code =
        'SESSION_EXPIRED';

      throw error;
    }

    let response;

    try {
      response =
        await fetch(
          WORKER_URL,
          {
            method:
              'POST',
            headers: {
              'Content-Type':
                'application/json',
              'Authorization':
                `Bearer ${token}`
            },
            cache:
              'no-store',
            body:
              JSON.stringify({
                action,
                ...payload
              })
          }
        );
    } catch (error) {
      throw new Error(
        'Unable to connect to the admin API.'
      );
    }

    const data =
      await parseResponse(response);

    // ==========================================================
    // AUTH FAILURE
    // ==========================================================

    if (
      response.status === 401
    ) {
      clearSession();

      window.dispatchEvent(
        new CustomEvent(
          'admin-auth-required'
        )
      );

      const error =
        new Error(
          data.error ||
          'Your admin session is invalid or expired. Please log in again.'
        );

      error.code =
        'AUTH_REQUIRED';

      throw error;
    }

    // ==========================================================
    // OTHER API FAILURE
    // ==========================================================

    if (
      !response.ok ||
      data.success === false
    ) {
      throw new Error(
        data.error ||
        `Admin API HTTP ${response.status}`
      );
    }

    return data;
  }


  // ============================================================
  // PUBLIC METHODS
  // ============================================================

  return {

    // ----------------------------------------------------------
    // AUTH
    // ----------------------------------------------------------

    login(username, password) {
      return login(
        username,
        password
      );
    },

    logout() {
      clearSession();
      return true;
    },

    isAuthenticated() {
      return isAuthenticated();
    },

    getSessionToken() {
      return getToken();
    },

    getSessionExpiry() {
      return getExpiry();
    },


    // ----------------------------------------------------------
    // USERS
    // ----------------------------------------------------------

    createUser(payload) {
      return post(
        'create_user',
        payload
      );
    },

    updateUser(payload) {
      return post(
        'update_user',
        payload
      );
    },

    setUserUnsubscribed(
      userId,
      unsubscribed
    ) {
      return post(
        'set_user_unsubscribed',
        {
          userId,
          unsubscribed
        }
      );
    },


    // ----------------------------------------------------------
    // CAMPAIGNS
    // ----------------------------------------------------------

    createCampaign(payload) {
      return post(
        'create_campaign',
        payload
      );
    },

    updateCampaign(payload) {
      return post(
        'update_campaign',
        payload
      );
    },


    // ----------------------------------------------------------
    // CAMPAIGN MEMBERS
    // ----------------------------------------------------------

    addCampaignMember(payload) {
      return post(
        'add_campaign_member',
        payload
      );
    },

    setCampaignMemberStatus(
      campaignMemberId,
      membershipStatus
    ) {
      return post(
        'set_campaign_member_status',
        {
          campaignMemberId,
          membershipStatus
        }
      );
    },


    // ----------------------------------------------------------
    // PRE-DELIVERY CHECKS
    // ----------------------------------------------------------

    runPrecheckCampaignMember(
      campaignId,
      campaignMemberId
    ) {
      return post(
        'run_precheck_campaign_member',
        {
          campaignId,
          campaignMemberId
        }
      );
    },

    runPrecheckCampaign(
      campaignId
    ) {
      return post(
        'run_precheck_campaign',
        {
          campaignId
        }
      );
    },




    // ----------------------------------------------------------
    // CONTACT AUDIENCES
    // ----------------------------------------------------------

    getContactAudiences() {
      return post(
        'get_contact_audiences',
        {}
      );
    },

    createContactList(payload) {
      return post(
        'create_contact_list',
        payload
      );
    },

    deleteContactList(listId) {
      return post(
        'delete_contact_list',
        {
          listId
        }
      );
    },

    addContactListMember(
      listId,
      userId
    ) {
      return post(
        'add_contact_list_member',
        {
          listId,
          userId
        }
      );
    },

    removeContactListMember(
      listId,
      userId
    ) {
      return post(
        'remove_contact_list_member',
        {
          listId,
          userId
        }
      );
    },

    createContactSegment(payload) {
      return post(
        'create_contact_segment',
        payload
      );
    },

    deleteContactSegment(segmentId) {
      return post(
        'delete_contact_segment',
        {
          segmentId
        }
      );
    },



    // ----------------------------------------------------------
    // CAMPAIGN CONTENT + TEMPLATES
    // ----------------------------------------------------------
    getCampaignContent() {
      return post('get_campaign_content', {});
    },
    saveCampaignContent(payload) {
      return post('save_campaign_content', payload);
    },
    createEmailTemplate(payload) {
      return post('create_email_template', payload);
    },
    archiveEmailTemplate(templateId) {
      return post('archive_email_template', {templateId});
    },

    // ----------------------------------------------------------
    // DEBUG / CONFIG
    // ----------------------------------------------------------

    getWorkerUrl() {
      return WORKER_URL;
    }

  };

})();
