/**
 * Subscriber Management Utility for Increasing Faith Ministries
 *
 * Reads the newsletter subscriber list from subscribers.json in this folder.
 *
 * WHY A FILE INSTEAD OF AN API:
 * This previously pulled submissions from the Netlify Forms API. The site moved
 * to GitHub Pages on 2026-02-05, which meant data-netlify="true" stopped doing
 * anything, and the Netlify token eventually went 401. Every monthly send from
 * April through August 2026 failed on that one call.
 *
 * Signup forms now post to FormSubmit.co, which emails each signup to
 * curtisstephensjr@gmail.com but offers no API to list them. So the list lives
 * here in the repo: version-controlled, greppable, and impossible to lose to an
 * expired third-party token.
 *
 * TO ADD A SUBSCRIBER:
 *   node add-subscriber.js "Jane Smith" jane@example.com
 *
 * Usage as a module:
 *   const { getSubscribers, getNewSubscribers } = require("./subscribers");
 */

const fs = require("fs");
const path = require("path");

// --- Configuration -----------------------------------------------------------

const SUBSCRIBERS_FILE = path.join(__dirname, "subscribers.json");

// --- Storage -----------------------------------------------------------------

/**
 * Reads the raw subscriber file.
 *
 * @returns {{subscribers: Array}} - Parsed file contents
 */
function readStore() {
    if (!fs.existsSync(SUBSCRIBERS_FILE)) {
        return { subscribers: [] };
    }

    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, "utf8"));
    } catch (error) {
        // A corrupt list must not read as an empty one. Silently sending to zero
        // recipients is the exact failure this rewrite exists to prevent.
        throw new Error(
            `subscribers.json is not valid JSON (${error.message}). ` +
            "Fix the file rather than letting a send proceed to nobody."
        );
    }

    if (!Array.isArray(parsed.subscribers)) {
        throw new Error('subscribers.json must contain a "subscribers" array.');
    }

    return parsed;
}

/**
 * Writes the subscriber store back to disk.
 *
 * @param {{subscribers: Array}} store
 */
function writeStore(store) {
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(store, null, 2) + "\n", "utf8");
}

// --- Core Functions ----------------------------------------------------------

/**
 * Fetches all active subscribers, deduplicated, with invalid entries dropped.
 *
 * @returns {Promise<Array<{name: string, email: string, subscribedAt: string}>>}
 */
async function getSubscribers() {
    const store = readStore();

    const subscribers = store.subscribers
        .filter(sub => sub && sub.email && sub.email.includes("@"))
        .filter(sub => !sub.unsubscribed)
        .map(sub => ({
            name: sub.name || "",
            email: sub.email,
            subscribedAt: sub.subscribedAt || new Date().toISOString()
        }));

    return deduplicateSubscribers(subscribers);
}

/**
 * Adds a subscriber, ignoring duplicates.
 *
 * @param {string} name
 * @param {string} email
 * @returns {{added: boolean, reason?: string, total: number}}
 */
function addSubscriber(name, email) {
    if (!email || !email.includes("@")) {
        return { added: false, reason: `"${email}" is not a valid email address.`, total: 0 };
    }

    const store = readStore();
    const normalized = email.toLowerCase().trim();

    if (store.subscribers.some(s => (s.email || "").toLowerCase().trim() === normalized)) {
        return { added: false, reason: "already subscribed", total: store.subscribers.length };
    }

    store.subscribers.push({
        name: (name || "").trim(),
        email: normalized,
        subscribedAt: new Date().toISOString()
    });

    writeStore(store);
    return { added: true, total: store.subscribers.length };
}

/**
 * Fetches subscribers who signed up AFTER a given date.
 *
 * @param {string|Date} since - Only return subscribers after this date
 * @returns {Promise<Array<{name: string, email: string, subscribedAt: string}>>}
 */
async function getNewSubscribers(since) {
    const sinceDate = new Date(since);
    if (isNaN(sinceDate.getTime())) {
        throw new Error(
            `Invalid date: "${since}". Use a format like "2025-01-15" or a Date object.`
        );
    }

    const allSubscribers = await getSubscribers();

    return allSubscribers.filter(sub => new Date(sub.subscribedAt) > sinceDate);
}

/**
 * Removes duplicate subscribers by email address.
 * Keeps the FIRST (earliest) subscription for each email.
 *
 * @param {Array<{name: string, email: string, subscribedAt: string}>} subscribers
 * @returns {Array<{name: string, email: string, subscribedAt: string}>}
 */
function deduplicateSubscribers(subscribers) {
    const seen = new Set();
    const unique = [];

    for (const sub of subscribers) {
        // Normalize so "John@Email.com" and "john@email.com" are one person
        const normalizedEmail = sub.email.toLowerCase().trim();

        if (!seen.has(normalizedEmail)) {
            seen.add(normalizedEmail);
            unique.push({ ...sub, email: normalizedEmail });
        }
    }

    return unique;
}

/**
 * Formats the subscriber list into a human-readable string.
 *
 * @param {Array<{name: string, email: string, subscribedAt: string}>} subscribers
 * @returns {string}
 */
function formatSubscriberList(subscribers) {
    if (subscribers.length === 0) {
        return "No subscribers yet.";
    }

    const lines = [`${subscribers.length} subscriber(s):`, ""];
    subscribers.forEach((sub, i) => {
        const date = new Date(sub.subscribedAt).toLocaleDateString();
        lines.push(`  ${i + 1}. ${sub.name || "(no name)"} <${sub.email}> -- ${date}`);
    });

    return lines.join("\n");
}

/**
 * Returns just the email addresses, comma-separated.
 *
 * @param {Array<{name: string, email: string}>} subscribers
 * @returns {string} - Comma-separated email list
 */
function formatEmailsOnly(subscribers) {
    return subscribers.map(sub => sub.email).join(", ");
}

// --- CLI Mode ----------------------------------------------------------------
// Runs when you execute this script directly: node subscribers.js

async function main() {
    console.log(`Reading subscribers from ${path.basename(SUBSCRIBERS_FILE)}...\n`);

    try {
        const subscribers = await getSubscribers();

        console.log(formatSubscriberList(subscribers));

        if (subscribers.length > 0) {
            console.log("\nEmail list (for BCC):");
            console.log(formatEmailsOnly(subscribers));
        } else {
            console.log('\nAdd one with:  node add-subscriber.js "Jane Smith" jane@example.com');
        }
    } catch (error) {
        console.error("Error:", error.message);
        process.exit(1);
    }
}

if (require.main === module) main();

// --- Exports -----------------------------------------------------------------

module.exports = {
    getSubscribers,
    getNewSubscribers,
    addSubscriber,
    deduplicateSubscribers,
    formatSubscriberList,
    formatEmailsOnly
};
