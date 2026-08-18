/**
 * =========================================================
 * DATA SOURCE (Apps Script Integration)
 * =========================================================
 */

const DATA_SOURCE_CONFIG = {
    // Replace with your Apps Script Web App URL:
    webAppUrl: "YOUR_COPIED_WEB_APP_URL_HERE"
};

/**
 * Fetch raw sheet records from Google Apps Script Web App
 * @returns {Promise<Array>}
 */
async function loadGoogleSheetData() {
    if (!DATA_SOURCE_CONFIG.webAppUrl || DATA_SOURCE_CONFIG.webAppUrl.includes(https://script.google.com/macros/s/AKfycbyNLtajflaKIeEmQwfOYZ7TmdtmyA5-zsS1pKhJeKIZ9YqeEhrSvdhLRjlQO1-TZah2tg/exec")) {
        throw new Error("Please configure webAppUrl in data-source.js");
    }

    // Requests data using get_dashboard_data action
    const url = `${DATA_SOURCE_CONFIG.webAppUrl}?action=get_dashboard_data`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`HTTP Error (${response.status}): Failed to fetch dashboard data.`);
    }

    const data = await response.json();

    if (data.error) {
        throw new Error(`Apps Script Error: ${data.error}`);
    }

    return data;
}

/**
 * Main data loader entry point for app.js
 */
async function loadData() {
    console.log("Loading live records from Google Sheet...");
    const rawData = await loadGoogleSheetData();
    console.log(`Loaded ${rawData.length} records.`);
    return rawData;
}
