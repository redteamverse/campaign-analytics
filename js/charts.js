/**
 * =========================================================
 * CAMPAIGN ANALYTICS - CHARTS
 * =========================================================
 *
 * Responsible only for visualizing analytics data.
 *
 * Charts receive already-filtered data from app.js.
 *
 * Current charts:
 *
 * 1. Engagement Funnel
 * 2. Sending Trend
 *
 * =========================================================
 */


let engagementFunnelChart = null;
let sendingTrendChart = null;


/**
 * =========================================================
 * CHART DEFAULTS
 * =========================================================
 */

const CHART_FONT = {
    family: "Arial, sans-serif"
};


/**
 * =========================================================
 * ENGAGEMENT FUNNEL
 * =========================================================
 *
 * Funnel stages:
 *
 * Messages
 * Sent
 * Verified
 * Opened
 * Clicked
 * Replied
 *
 * =========================================================
 */

function renderEngagementFunnel(data) {

    const canvas =
        document.getElementById("engagementFunnelChart");

    if (!canvas) {
        console.warn(
            "Engagement funnel canvas not found."
        );

        return;
    }


    const metrics =
        calculateOverviewMetrics(data);


    const values = [

        metrics.messages,

        metrics.sent,

        metrics.verified,

        metrics.opened,

        metrics.clicked,

        metrics.replied
    ];


    const labels = [

        "Messages",

        "Sent",

        "Verified",

        "Opened",

        "Clicked",

        "Replied"
    ];


    /**
     * Destroy previous chart.
     *
     * This is important because filters cause the chart
     * to be redrawn.
     */

    if (engagementFunnelChart) {

        engagementFunnelChart.destroy();

    }


    engagementFunnelChart =
        new Chart(canvas, {

            type: "bar",

            data: {

                labels: labels,

                datasets: [{

                    label: "Messages",

                    data: values,

                    borderRadius: 4,

                    borderSkipped: false

                }]
            },


            options: {

                responsive: true,

                maintainAspectRatio: false,


                plugins: {

                    legend: {

                        display: false

                    },


                    tooltip: {

                        callbacks: {

                            label: function(context) {

                                return `${context.raw.toLocaleString()} messages`;

                            }

                        }

                    }

                },


                scales: {

                    x: {

                        grid: {

                            display: false

                        },

                        ticks: {

                            font: CHART_FONT

                        }

                    },


                    y: {

                        beginAtZero: true,

                        ticks: {

                            precision: 0,

                            font: CHART_FONT

                        },

                        grid: {

                            drawBorder: false

                        }

                    }

                }

            }

        });
}


/**
 * =========================================================
 * SENDING TREND
 * =========================================================
 *
 * Uses:
 *
 * Sent Timestamp
 *
 * Groups successfully sent messages by date.
 *
 * =========================================================
 */

function getSendingTrendData(data) {

    const dateCounts = {};


    data.forEach(record => {

        /**
         * Only count messages that were actually sent.
         */

        if (
            record.mailSentStatus
                .toLowerCase() !== "sent"
        ) {

            return;

        }


        if (!record.sentTimestamp) {

            return;

        }


        const parsedDate =
            new Date(record.sentTimestamp);


        /**
         * Ignore invalid timestamps.
         */

        if (isNaN(parsedDate.getTime())) {

            return;

        }


        /**
         * Convert to YYYY-MM-DD.
         */

        const date =
            parsedDate
                .toISOString()
                .split("T")[0];


        if (!dateCounts[date]) {

            dateCounts[date] = 0;

        }


        dateCounts[date]++;

    });


    const sortedDates =
        Object.keys(dateCounts)
            .sort();


    return {

        labels: sortedDates,

        values: sortedDates.map(
            date => dateCounts[date]
        )

    };
}


/**
 * Format date for chart.
 *
 * YYYY-MM-DD
 * →
 * Aug 07
 */

function formatChartDate(dateString) {

    const date =
        new Date(`${dateString}T00:00:00`);

    if (isNaN(date.getTime())) {

        return dateString;

    }


    return date.toLocaleDateString(
        "en-US",
        {
            month: "short",
            day: "numeric"
        }
    );
}


/**
 * Render sending trend.
 */

function renderSendingTrend(data) {

    const canvas =
        document.getElementById(
            "sendingTrendChart"
        );


    if (!canvas) {

        console.warn(
            "Sending trend canvas not found."
        );

        return;

    }


    const trend =
        getSendingTrendData(data);


    if (sendingTrendChart) {

        sendingTrendChart.destroy();

    }


    sendingTrendChart =
        new Chart(canvas, {

            type: "line",


            data: {

                labels:
                    trend.labels.map(
                        formatChartDate
                    ),


                datasets: [{

                    label: "Messages Sent",

                    data: trend.values,

                    tension: 0.3,

                    fill: false,

                    pointRadius: 4,

                    pointHoverRadius: 6

                }]

            },


            options: {

                responsive: true,

                maintainAspectRatio: false,


                plugins: {

                    legend: {

                        display: false

                    },


                    tooltip: {

                        callbacks: {

                            label: function(context) {

                                return `${context.raw.toLocaleString()} sent`;

                            }

                        }

                    }

                },


                scales: {

                    x: {

                        grid: {

                            display: false

                        },

                        ticks: {

                            font: CHART_FONT,

                            maxRotation: 0

                        }

                    },


                    y: {

                        beginAtZero: true,

                        ticks: {

                            precision: 0,

                            font: CHART_FONT

                        },

                        grid: {

                            drawBorder: false

                        }

                    }

                }

            }

        });
}


/**
 * =========================================================
 * RENDER ALL CHARTS
 * =========================================================
 */

function renderCharts(data) {

    renderEngagementFunnel(data);

    renderSendingTrend(data);

}
