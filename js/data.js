/**
 * =========================================================
 * DATA NORMALIZATION
 * =========================================================
 *
 * Converts raw CSV values into predictable JavaScript
 * values that the analytics engine can safely use.
 * =========================================================
 */


/**
 * Convert common Yes/No values into boolean.
 */
function toBoolean(value) {

    if (value === null || value === undefined) {
        return false;
    }

    const normalized = String(value)
        .trim()
        .toLowerCase();

    return (
        normalized === "yes" ||
        normalized === "true" ||
        normalized === "1"
    );
}


/**
 * Normalize text.
 */
function cleanText(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value).trim();
}


/**
 * Normalize sequence.
 *
 * Examples:
 *     "Sequence 1" → "Sequence 1"
 *     "1"          → "Sequence 1"
 */
function normalizeSequence(value) {

    const text = cleanText(value);

    if (!text) {
        return "Unknown";
    }

    if (/^\d+$/.test(text)) {
        return `Sequence ${text}`;
    }

    return text;
}


/**
 * Normalize status.
 */
function normalizeStatus(value) {

    return cleanText(value)
        .toLowerCase()
        .replace(/\s+/g, " ");
}


/**
 * Normalize a single record.
 */
function normalizeRecord(row) {

    return {

        // ---------------------------------------------
        // Recipient information
        // ---------------------------------------------

        firstName: cleanText(row["First Name"]),

        emailAddress: cleanText(row["Email Address"])
            .toLowerCase(),

        company: cleanText(row["Company"]),


        // ---------------------------------------------
        // Campaign information
        // ---------------------------------------------

        campaignName: cleanText(row["Campaign Name"]),

        sequence: normalizeSequence(row["Sequence"]),

        emailVersion: cleanText(row["Email Version"]),

        targetSegment: cleanText(row["Target Segment"]),


        // ---------------------------------------------
        // Pre-delivery QA
        // ---------------------------------------------

        preDeliveryCheckStatus:
            cleanText(row["Pre Delivery Check Status"]),

        preDeliveryCheckMessage:
            cleanText(row["Pre Delivery Check Message"]),


        // ---------------------------------------------
        // Delivery
        // ---------------------------------------------

        mailSentStatus:
            cleanText(row["Mail Sent Status"]),

        sentTimestamp:
            cleanText(row["Sent Timestamp"]),

        messageId:
            cleanText(row["Message ID"]),


        // ---------------------------------------------
        // Post-delivery QA
        // ---------------------------------------------

        postDeliveryCheckStatus:
            cleanText(row["Post Delivery Check Status"]),

        postDeliveryCheckMessage:
            cleanText(row["Post Delivery Check Message"]),


        // ---------------------------------------------
        // Engagement
        // ---------------------------------------------

        isOpened:
            toBoolean(row["Is Opened?"]),

        firstOpenTime:
            cleanText(row["First Open Time"]),

        linkClicked:
            toBoolean(row["Link Clicked"]),

        isReplied:
            toBoolean(row["Is Replied?"]),

        replyTimestamp:
            cleanText(row["Reply Timestamp"]),


        // ---------------------------------------------
        // Compliance
        // ---------------------------------------------

        unsubscribed:
            toBoolean(row["Unsubscribed"]),


        // ---------------------------------------------
        // Follow-up
        // ---------------------------------------------

        followUpStatus:
            cleanText(row["Follow-Up Status"])
    };
}


/**
 * Normalize entire dataset.
 */
function normalizeData(rawData) {

    if (!Array.isArray(rawData)) {
        throw new Error(
            "Expected analytics data to be an array."
        );
    }

    const normalized = rawData
        .map(normalizeRecord)
        .filter(record => {

            // A valid analytics record should have
            // at least an email or message ID.

            return (
                record.emailAddress ||
                record.messageId
            );
        });

    console.log(
        `Normalized ${normalized.length} records.`
    );

    return normalized;
}
