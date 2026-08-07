/**
 * =========================================================
 * APPLICATION CONTROLLER
 * =========================================================
 */

let allData = [];

let filteredData = [];


/**
 * ---------------------------------------------------------
 * DOM HELPERS
 * ---------------------------------------------------------
 */

function getElement(id) {

    return document.getElementById(id);
}


/**
 * Format number.
 */
function formatNumber(value) {

    return Number(value || 0)
        .toLocaleString("en-IN");
}


/**
 * Format percentage.
 */
function formatPercentage(value) {

    return `${Number(value || 0).toFixed(1)}%`;
}


/**
 * Update text.
 */
function setText(id, value) {

    const element = getElement(id);

    if (!element) {
        return;
    }

    element.textContent = value;
}


/**
 * ---------------------------------------------------------
 * KPI RENDERING
 * ---------------------------------------------------------
 */

function renderKPIs(data) {

    const metrics =
        calculateOverviewMetrics(data);


    setText(
        "kpiRecipients",
        formatNumber(metrics.recipients)
    );


    setText(
        "kpiMessages",
        formatNumber(metrics.messages)
    );


    setText(
        "kpiSent",
        formatNumber(metrics.sent)
    );


    setText(
        "kpiVerified",
        formatNumber(metrics.verified)
    );


    setText(
        "kpiOpenRate",
        formatPercentage(metrics.openRate)
    );


    setText(
        "kpiClickRate",
        formatPercentage(metrics.clickRate)
    );


    setText(
        "kpiReplyRate",
        formatPercentage(metrics.replyRate)
    );


    setText(
        "kpiUnsubscribeRate",
        formatPercentage(metrics.unsubscribeRate)
    );
}


/**
 * ---------------------------------------------------------
 * FILTER OPTIONS
 * ---------------------------------------------------------
 */

function getUniqueValues(data, accessor) {

    return [
        ...new Set(
            data
                .map(accessor)
                .filter(Boolean)
        )
    ].sort();
}


function populateSelect(
    selectId,
    values
) {

    const select =
        getElement(selectId);

    if (!select) {
        return;
    }


    const firstOption =
        select.options[0];

    select.innerHTML = "";

    select.appendChild(
        firstOption
    );


    values.forEach(value => {

        const option =
            document.createElement("option");

        option.value = value;

        option.textContent = value;

        select.appendChild(option);

    });
}


function initializeFilters() {

    populateSelect(
        "campaignFilter",
        getUniqueValues(
            allData,
            record => record.campaignName
        )
    );


    populateSelect(
        "sequenceFilter",
        getUniqueValues(
            allData,
            record => record.sequence
        )
    );


    populateSelect(
        "versionFilter",
        getUniqueValues(
            allData,
            record => record.emailVersion
        )
    );


    populateSelect(
        "segmentFilter",
        getUniqueValues(
            allData,
            record => record.targetSegment
        )
    );


    populateSelect(
        "companyFilter",
        getUniqueValues(
            allData,
            record => record.company
        )
    );
}


/**
 * ---------------------------------------------------------
 * APPLY FILTERS
 * ---------------------------------------------------------
 */

function applyFilters() {

    const campaign =
        getElement("campaignFilter").value;

    const sequence =
        getElement("sequenceFilter").value;

    const version =
        getElement("versionFilter").value;

    const segment =
        getElement("segmentFilter").value;

    const company =
        getElement("companyFilter").value;


    filteredData = allData.filter(record => {

        if (
            campaign &&
            record.campaignName !== campaign
        ) {
            return false;
        }


        if (
            sequence &&
            record.sequence !== sequence
        ) {
            return false;
        }


        if (
            version &&
            record.emailVersion !== version
        ) {
            return false;
        }


        if (
            segment &&
            record.targetSegment !== segment
        ) {
            return false;
        }


        if (
            company &&
            record.company !== company
        ) {
            return false;
        }


        return true;
    });


    renderDashboard();
}


/**
 * ---------------------------------------------------------
 * CLEAR FILTERS
 * ---------------------------------------------------------
 */

function clearFilters() {

    [
        "campaignFilter",
        "sequenceFilter",
        "versionFilter",
        "segmentFilter",
        "companyFilter"
    ].forEach(id => {

        const element =
            getElement(id);

        if (element) {
            element.value = "";
        }

    });


    filteredData = [...allData];

    renderDashboard();
}


/**
 * ---------------------------------------------------------
 * DASHBOARD
 * ---------------------------------------------------------
 */

function renderDashboard() {

    console.log(
        "Rendering dashboard with",
        filteredData.length,
        "records"
    );


    // ---------------------------------------------
    // KPI cards
    // ---------------------------------------------

    renderKPIs(
        filteredData
    );


    // ---------------------------------------------
    // Charts
    // ---------------------------------------------

    renderCharts(
        filteredData
    );
}


/**
 * ---------------------------------------------------------
 * NAVIGATION
 * ---------------------------------------------------------
 */

const VIEW_TITLES = {

    overview: "Overview",

    campaigns: "Campaigns",

    engagement: "Engagement",

    delivery: "Delivery & QA",

    followups: "Follow-ups",

    recipients: "Recipients"
};


function switchView(viewName) {

    document
        .querySelectorAll(".nav-item")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.view === viewName
            );

        });


    document
        .querySelectorAll(".view")
        .forEach(view => {

            view.classList.remove(
                "active"
            );

        });


    const targetView =
        getElement(`${viewName}View`);

    if (targetView) {

        targetView.classList.add(
            "active"
        );

    }


    setText(
        "pageTitle",
        VIEW_TITLES[viewName] ||
        "Overview"
    );


    closeMobileSidebar();
}


function initializeNavigation() {

    document
        .querySelectorAll(".nav-item")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    switchView(
                        button.dataset.view
                    );

                }
            );

        });
}


/**
 * ---------------------------------------------------------
 * MOBILE SIDEBAR
 * ---------------------------------------------------------
 */

function openMobileSidebar() {

    const sidebar =
        document.querySelector(".sidebar");

    const overlay =
        getElement("sidebarOverlay");


    sidebar.classList.add("open");

    overlay.classList.add("open");
}


function closeMobileSidebar() {

    const sidebar =
        document.querySelector(".sidebar");

    const overlay =
        getElement("sidebarOverlay");


    sidebar.classList.remove("open");

    overlay.classList.remove("open");
}


function initializeMobileNavigation() {

    const button =
        getElement("mobileMenuButton");

    const overlay =
        getElement("sidebarOverlay");


    if (button) {

        button.addEventListener(
            "click",
            openMobileSidebar
        );

    }


    if (overlay) {

        overlay.addEventListener(
            "click",
            closeMobileSidebar
        );

    }
}


/**
 * ---------------------------------------------------------
 * EVENTS
 * ---------------------------------------------------------
 */

function initializeEvents() {

    [
        "campaignFilter",
        "sequenceFilter",
        "versionFilter",
        "segmentFilter",
        "companyFilter"
    ].forEach(id => {

        const element =
            getElement(id);

        if (element) {

            element.addEventListener(
                "change",
                applyFilters
            );

        }

    });


    const clearButton =
        getElement("clearFilters");

    if (clearButton) {

        clearButton.addEventListener(
            "click",
            clearFilters
        );

    }


    const refreshButton =
        getElement("refreshButton");

    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            initializeApp
        );

    }
}


/**
 * ---------------------------------------------------------
 * APPLICATION STARTUP
 * ---------------------------------------------------------
 */

async function initializeApp() {

    try {

        console.log(
            "Starting Campaign Analytics..."
        );


        allData =
            normalizeData(
                await loadData()
            );


        filteredData =
            [...allData];


        initializeFilters();

        initializeNavigation();

        initializeMobileNavigation();

        initializeEvents();

        renderDashboard();


        console.log(
            "Campaign Analytics initialized successfully."
        );


    } catch (error) {

        console.error(
            "Application initialization failed:",
            error
        );


        showDataError(
            error.message
        );
    }
}


/**
 * ---------------------------------------------------------
 * ERROR STATE
 * ---------------------------------------------------------
 */

function showDataError(message) {

    const content =
        document.querySelector(".content");

    if (!content) {
        return;
    }


    content.insertAdjacentHTML(
        "afterbegin",
        `
        <div style="
            margin-bottom:20px;
            padding:16px;
            border:1px solid #fecaca;
            border-radius:10px;
            background:#fef2f2;
            color:#991b1b;
            font-size:13px;
        ">
            <strong>Unable to load analytics data.</strong>
            <div style="margin-top:5px;">
                ${message}
            </div>
        </div>
        `
    );
}


/**
 * ---------------------------------------------------------
 * START APPLICATION
 * ---------------------------------------------------------
 */

document.addEventListener(
    "DOMContentLoaded",
    initializeApp
);
