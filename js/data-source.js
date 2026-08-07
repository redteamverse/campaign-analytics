/**
 * =========================================================
 * DATA SOURCE
 * =========================================================
 *
 * Responsible for retrieving raw data.
 *
 * V1:
 *     Local CSV file
 *
 * Future:
 *     Google Sheet
 *
 * Important:
 * The rest of the application should not care where
 * the data comes from.
 * =========================================================
 */

const DATA_SOURCE_CONFIG = {
    type: "csv",

    csvPath: "data/campaign_analytics_dummy_data.csv"
};


/**
 * Load CSV data.
 *
 * @returns {Promise<Array>}
 */
async function loadCSVData() {

    if (typeof Papa === "undefined") {
        throw new Error(
            "Papa Parse was not loaded. Check the CDN script in index.html."
        );
    }

    const response = await fetch(DATA_SOURCE_CONFIG.csvPath);

    if (!response.ok) {
        throw new Error(
            `Unable to load CSV: ${response.status} ${response.statusText}`
        );
    }

    const csvText = await response.text();

    return new Promise((resolve, reject) => {

        Papa.parse(csvText, {

            header: true,

            skipEmptyLines: true,

            dynamicTyping: false,

            complete: function(results) {

                if (results.errors && results.errors.length > 0) {

                    console.warn(
                        "CSV parsing warnings:",
                        results.errors
                    );
                }

                resolve(results.data);
            },

            error: function(error) {
                reject(error);
            }
        });

    });
}


/**
 * Main data loader.
 *
 * This function becomes our single entry point
 * for loading analytics data.
 */
async function loadData() {

    console.log("Loading analytics data...");

    const rawData = await loadCSVData();

    console.log(
        `Loaded ${rawData.length} records.`
    );

    return rawData;
}
