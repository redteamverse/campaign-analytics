/**
 * =========================================================
 * ANALYTICS METRICS
 * =========================================================
 *
 * All KPI calculations live here.
 *
 * UI code should NEVER calculate metrics directly.
 * =========================================================
 */


/**
 * Count records.
 */
function countRecords(data) {

    return Array.isArray(data)
        ? data.length
        : 0;
}


/**
 * Count unique values.
 */
function countUnique(data, accessor) {

    const values = new Set();

    data.forEach(record => {

        const value = accessor(record);

        if (value) {
            values.add(value);
        }

    });

    return values.size;
}


/**
 * Count records matching condition.
 */
function countWhere(data, condition) {

    return data.filter(condition).length;
}


/**
 * Calculate percentage.
 */
function percentage(numerator, denominator) {

    if (!denominator || denominator <= 0) {
        return 0;
    }

    return (numerator / denominator) * 100;
}


/**
 * ---------------------------------------------------------
 * CORE COUNTS
 * ---------------------------------------------------------
 */

function getTotalRecipients(data) {

    return countUnique(
        data,
        record => record.emailAddress
    );
}


function getTotalMessages(data) {

    return countUnique(
        data,
        record => record.messageId
    );
}


function getSentCount(data) {

    return countWhere(
        data,
        record =>
            record.mailSentStatus.toLowerCase() === "sent"
    );
}


function getVerifiedCount(data) {

    return countWhere(
        data,
        record =>
            record.postDeliveryCheckStatus
                .toLowerCase() === "passed"
    );
}


function getOpenedCount(data) {

    return countWhere(
        data,
        record => record.isOpened
    );
}


function getClickedCount(data) {

    return countWhere(
        data,
        record => record.linkClicked
    );
}


function getReplyCount(data) {

    return countWhere(
        data,
        record => record.isReplied
    );
}


function getUnsubscribeCount(data) {

    return countWhere(
        data,
        record => record.unsubscribed
    );
}


/**
 * ---------------------------------------------------------
 * RATES
 * ---------------------------------------------------------
 *
 * We use verified/post-delivery-passed messages as the
 * denominator for engagement rates.
 * ---------------------------------------------------------
 */

function getOpenRate(data) {

    const opened = getOpenedCount(data);

    const verified = getVerifiedCount(data);

    return percentage(
        opened,
        verified
    );
}


function getClickRate(data) {

    const clicked = getClickedCount(data);

    const verified = getVerifiedCount(data);

    return percentage(
        clicked,
        verified
    );
}


function getReplyRate(data) {

    const replies = getReplyCount(data);

    const verified = getVerifiedCount(data);

    return percentage(
        replies,
        verified
    );
}


function getUnsubscribeRate(data) {

    const unsubscribed =
        getUnsubscribeCount(data);

    const verified =
        getVerifiedCount(data);

    return percentage(
        unsubscribed,
        verified
    );
}


/**
 * ---------------------------------------------------------
 * ADDITIONAL ENGAGEMENT RATES
 * ---------------------------------------------------------
 */

function getClickToOpenRate(data) {

    const clicked =
        getClickedCount(data);

    const opened =
        getOpenedCount(data);

    return percentage(
        clicked,
        opened
    );
}


function getReplyToOpenRate(data) {

    const replies =
        getReplyCount(data);

    const opened =
        getOpenedCount(data);

    return percentage(
        replies,
        opened
    );
}


/**
 * ---------------------------------------------------------
 * OVERVIEW METRICS
 * ---------------------------------------------------------
 */

function calculateOverviewMetrics(data) {

    return {

        recipients:
            getTotalRecipients(data),

        messages:
            getTotalMessages(data),

        sent:
            getSentCount(data),

        verified:
            getVerifiedCount(data),

        opened:
            getOpenedCount(data),

        clicked:
            getClickedCount(data),

        replied:
            getReplyCount(data),

        unsubscribed:
            getUnsubscribeCount(data),

        openRate:
            getOpenRate(data),

        clickRate:
            getClickRate(data),

        replyRate:
            getReplyRate(data),

        unsubscribeRate:
            getUnsubscribeRate(data),

        clickToOpenRate:
            getClickToOpenRate(data),

        replyToOpenRate:
            getReplyToOpenRate(data)
    };
}
