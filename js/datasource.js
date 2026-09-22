/**
 * AltSec Outreach DataSource — V18 PERFORMANCE
 *
 * Major changes:
 * - Browser no longer calls Apps Script /exec directly for dashboard data.
 * - All dashboard reads go through authenticated Cloudflare Worker.
 * - Avoids browser-facing script.googleusercontent.com redirect/404 failures.
 * - Uses stale-while-revalidate browser cache for fast repeat page loads.
 * - Falls back to the last successful snapshot if a refresh is temporarily slow.
 */

const DataSource = (() => {

  const STORAGE_KEY =
    'altsec_dashboard_snapshot_v18';

  const MEMORY_MAX_AGE_MS =
    60 * 1000;

  const LOCAL_MAX_AGE_MS =
    15 * 60 * 1000;

  const FALLBACK_MAX_AGE_MS =
    24 * 60 * 60 * 1000;

  let memoryStore = null;
  let memorySavedAt = 0;
  let refreshPromise = null;


  function nowIso() {
    return new Date().toISOString();
  }


  function makeStore(
    relational,
    lastUpdated = nowIso(),
    sourceWarnings = []
  ) {
    const safeRelational =
      relational &&
      typeof relational === 'object'
        ? relational
        : {};

    return {
      relational:
        safeRelational,

      /*
       * Keep sheet names at top level too.
       * This preserves compatibility with older DataEngine implementations
       * that read the relational payload directly.
       */
      ...safeRelational,

      lastUpdated:
        lastUpdated || nowIso(),

      sourceWarnings:
        Array.isArray(sourceWarnings)
          ? sourceWarnings
          : []
    };
  }


  function saveLocal(store) {

    memoryStore =
      store;

    memorySavedAt =
      Date.now();

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          savedAt:
            memorySavedAt,
          store:
            store
        })
      );
    } catch (error) {
      // Browser storage is an optimization only.
    }
  }


  function readLocal(maxAgeMs) {

    if (
      memoryStore &&
      (
        Date.now() -
        memorySavedAt
      ) <=
      maxAgeMs
    ) {
      return memoryStore;
    }

    try {

      const raw =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (!raw) {
        return null;
      }

      const parsed =
        JSON.parse(
          raw
        );

      const savedAt =
        Number(
          parsed?.savedAt || 0
        );

      if (
        !savedAt ||
        (
          Date.now() -
          savedAt
        ) >
        maxAgeMs
      ) {
        return null;
      }

      if (
        !parsed.store ||
        typeof parsed.store !==
        'object'
      ) {
        return null;
      }

      memoryStore =
        parsed.store;

      memorySavedAt =
        savedAt;

      return memoryStore;

    } catch (error) {
      return null;
    }
  }


  function extractPayload(response) {

    const result =
      response?.result?.result ||
      response?.result ||
      response ||
      {};

    const relational =
      result.data ||
      result.relational ||
      result;

    if (
      !relational ||
      typeof relational !==
      'object' ||
      Array.isArray(relational)
    ) {
      throw new Error(
        'Dashboard API returned an invalid data payload.'
      );
    }

    return {
      relational,
      generatedAt:
        result.generatedAt ||
        nowIso(),
      serverDurationMs:
        Number(
          result.serverDurationMs || 0
        )
    };
  }


  async function fetchFresh(
    forceRefresh = false
  ) {

    if (
      refreshPromise &&
      !forceRefresh
    ) {
      return refreshPromise;
    }

    const request =
      (async () => {

        if (
          typeof DashboardApi ===
          'undefined' ||
          typeof DashboardApi.getDashboardData !==
          'function'
        ) {
          throw new Error(
            'Dashboard API client is not ready.'
          );
        }

        const response =
          await DashboardApi
            .getDashboardData(
              forceRefresh
            );

        const payload =
          extractPayload(
            response
          );

        const store =
          makeStore(
            payload.relational,
            payload.generatedAt,
            []
          );

        store.serverDurationMs =
          payload.serverDurationMs;

        saveLocal(
          store
        );

        return store;
      })();

    refreshPromise =
      request;

    try {
      return await request;
    } finally {
      if (
        refreshPromise ===
        request
      ) {
        refreshPromise =
          null;
      }
    }
  }


  function refreshInBackground() {

    if (refreshPromise) {
      return;
    }

    setTimeout(
      async () => {

        try {

          const fresh =
            await fetchFresh(
              false
            );

          window.dispatchEvent(
            new CustomEvent(
              'altsec-dashboard-data-refreshed',
              {
                detail:
                  fresh
              }
            )
          );

        } catch (error) {

          console.warn(
            'Background dashboard refresh failed:',
            error
          );
        }
      },
      100
    );
  }


  async function loadData(
    forceRefresh = false
  ) {

    /*
     * Manual Refresh and post-write refreshes explicitly ask the server.
     */
    if (forceRefresh === true) {

      try {
        return await fetchFresh(
          true
        );
      } catch (error) {

        const fallback =
          readLocal(
            FALLBACK_MAX_AGE_MS
          );

        if (fallback) {

          return {
            ...fallback,
            sourceWarnings: [
              'Live refresh is taking longer than expected. Showing the most recent successful dashboard snapshot.'
            ]
          };
        }

        throw error;
      }
    }


    /*
     * Fast repeat navigation/page load:
     * render immediately from memory/localStorage, then refresh quietly.
     */
    const cached =
      readLocal(
        memoryStore
          ? MEMORY_MAX_AGE_MS
          : LOCAL_MAX_AGE_MS
      );

    if (cached) {
      refreshInBackground();
      return cached;
    }


    /*
     * First visit/no usable snapshot.
     */
    try {
      return await fetchFresh(
        false
      );
    } catch (error) {

      const fallback =
        readLocal(
          FALLBACK_MAX_AGE_MS
        );

      if (fallback) {

        return {
          ...fallback,
          sourceWarnings: [
            'Live data is temporarily unavailable. Showing the most recent successful dashboard snapshot.'
          ]
        };
      }

      throw error;
    }
  }


  function clearCache() {

    memoryStore =
      null;

    memorySavedAt =
      0;

    try {
      localStorage.removeItem(
        STORAGE_KEY
      );
    } catch (error) {}
  }


  return {

    loadData,

    refreshData() {
      return loadData(
        true
      );
    },

    clearCache
  };

})();
