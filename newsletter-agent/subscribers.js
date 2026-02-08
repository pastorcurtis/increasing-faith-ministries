/**
 * Subscriber Management Utility for Increasing Faith Ministries
 *
 * Connects to the Netlify API to manage newsletter subscribers.
 * Submissions are captured by Netlify Forms (data-netlify="true"),
 * and this utility retrieves them for sending newsletters.
 *
 * SETUP:
 *   1. Set NETLIFY_ACCESS_TOKEN env var (Netlify > User Settings > Applications)
 *   2. Set NETLIFY_SITE_ID env var (Site Settings > General > Site ID)
 *   3. Run: node subscribers.js
 *
 * Usage as a module:
 *   const { getSubscribers, getNewSubscribers } = require("./subscribers");
 */

try {
    require("dotenv").config();
} catch (e) {
    // dotenv is optional -- env vars can be set directly in the shell
}

// --- Configuration -----------------------------------------------------------

const NETLIFY_ACCESS_TOKEN = process.env.NETLIFY_ACCESS_TOKEN;
const NETLIFY_SITE_ID = process.env.NETLIFY_SITE_ID;

// This must match the "name" attribute on your HTML form
const FORM_NAME = "newsletter-subscribers";

// Netlify API base URL
const API_BASE = "https://api.netlify.com/api/v1";

// --- Validation --------------------------------------------------------------

/**
 * Checks that required environment variables are set.
 * Throws a helpful error message if anything is missing.
 */
function validateConfig() {
    if (!NETLIFY_ACCESS_TOKEN) {
        throw new Error(
            "Missing NETLIFY_ACCESS_TOKEN. " +
            "Get one at: Netlify > User Settings > Applications > Personal Access Tokens."
        );
    }
    if (!NETLIFY_SITE_ID) {
        throw new Error(
            "Missing NETLIFY_SITE_ID. " +
            "Find it at: Netlify Dashboard > Site Settings > General > Site ID."
        );
    }
}

// --- API Helpers -------------------------------------------------------------

/**
 * Makes an authenticated GET request to the Netlify API.
 * Uses built-in fetch (Node 18+) so no extra dependencies are needed.
 *
 * @param {string} endpoint - API path appended to API_BASE
 * @returns {Promise<any>} - Parsed JSON response
 */
async function netlifyGet(endpoint) {
    const url = `${API_BASE}${endpoint}`;

    const response = await fetch(url, {
        headers: {
            "Authorization": `Bearer ${NETLIFY_ACCESS_TOKEN}`,
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Netlify API error (${response.status}): ${errorBody}`);
    }

    return response.json();
}

/**
 * Looks up the Netlify form ID for our newsletter form by name.
 * Netlify assigns each form a unique ID we need for fetching submissions.
 *
 * @returns {Promise<string>} - The form ID
 */
async function getFormId() {
    const forms = await netlifyGet(`/sites/${NETLIFY_SITE_ID}/forms`);

    // Find the form that matches our newsletter form name
    const newsletterForm = forms.find(form => form.name === FORM_NAME);

    if (!newsletterForm) {
        throw new Error(
            `Form "${FORM_NAME}" not found on this site. ` +
            `Make sure your HTML form has name="${FORM_NAME}" and data-netlify="true", ` +
            "and that at least one submission has been made."
        );
    }

    return newsletterForm.id;
}

// --- Core Functions ----------------------------------------------------------

/**
 * Fetches ALL subscribers from the Netlify Forms API.
 * Handles pagination automatically (Netlify returns max 100 per page).
 *
 * @returns {Promise<Array<{name: string, email: string, subscribedAt: string}>>}
 */
async function getSubscribers() {
    validateConfig();
    const formId = await getFormId();

    let allSubmissions = [];
    let page = 1;
    const perPage = 100; // Netlify max per request

    // Keep fetching pages until we get them all
    while (true) {
        const submissions = await netlifyGet(
            `/sites/${NETLIFY_SITE_ID}/forms/${formId}/submissions?per_page=${perPage}&page=${page}`
        );

        if (submissions.length === 0) break;
        allSubmissions = allSubmissions.concat(submissions);

        // If we got fewer than a full page, we have reached the end
        if (submissions.length < perPage) break;
        page++;
    }

    // Transform raw Netlify submissions into clean subscriber objects
    const subscribers = allSubmissions.map(submission => ({
        name: submission.data.name || submission.data.Name || "",
        email: submission.data.email || submission.data.Email || "",
        subscribedAt: submission.created_at
    }));

    // Filter out entries without a valid email
    return subscribers.filter(sub => sub.email && sub.email.includes("@"));
}

/**
 * Fetches subscribers who signed up AFTER a given date.
 * Useful for targeting welcome emails or tracking growth.
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

    // Filter to only subscribers who signed up after the given date
    return allSubscribers.filter(sub => {
        const subDate = new Date(sub.subscribedAt);
        return subDate > sinceDate;
    });
}

/**
 * Removes duplicate subscribers by email address.
 * Keeps the FIRST (earliest) subscription for each email.
 * Since the same form appears on every page, someone could subscribe twice.
 *
 * @param {Array<{name: string, email: string, subscribedAt: string}>} subscribers
 * @returns {Array<{name: string, email: string, subscribedAt: string}>}
 */
function deduplicateSubscribers(subscribers) {
    const seen = new Set();
    const unique = [];

    for (const sub of subscribers) {
        // Normalize email to lowercase so "John@Email.com" and "john@email.com"
        // are treated as the same person
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
 * Great for reviewing who is subscribed or for logging.
 *
 * @param {Array<{name: string, email: string, subscribedAt: string}>} subscribers
 * @returns {string} - Formatted subscriber list
 */
function formatSubscriberList(subscribers) {
    if (subscribers.length === 0) return "No subscribers found.";

    // Header with count
    let output = `Newsletter Subscribers (${subscribers.length} total)\n`;
    output += "=".repeat(50) + "\n\n";

    // Each subscriber on its own line
    subscribers.forEach((sub, index) => {
        const name = sub.name || "Subscriber";
        const date = new Date(sub.subscribedAt).toLocaleDateString("en-US", {
            year: "numeric", month: "short", day: "numeric"
        });
        output += `${index + 1}. ${name} <${sub.email}> (joined ${date})\n`;
    });

    output += "\n" + "=".repeat(50);
    output += `\nGenerated: ${new Date().toLocaleString("en-US")}`;
    return output;
}

/**
 * Returns subscriber emails as a comma-separated list.
 * Handy for pasting into BCC fields or importing into email tools.
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
    console.log("Fetching newsletter subscribers from Netlify...\n");

    try {
        // Get all subscribers and remove duplicates
        const raw = await getSubscribers();
        const subscribers = deduplicateSubscribers(raw);

        // Print the formatted list
        console.log(formatSubscriberList(subscribers));

        // Also print a quick email-only list for easy copy-paste
        console.log("\nEmail list (for BCC):");
        console.log(formatEmailsOnly(subscribers));
    } catch (error) {
        console.error("Error:", error.message);
        console.error("\nTroubleshooting:");
        console.error("  1. Make sure NETLIFY_ACCESS_TOKEN is set");
        console.error("  2. Make sure NETLIFY_SITE_ID is set");
        console.error("  3. Verify the form newsletter-subscribers exists on your site");
        process.exit(1);
    }
}

// Run main() if this file is executed directly (not imported as a module)
if (require.main === module) main();

// --- Exports -----------------------------------------------------------------

module.exports = {
    getSubscribers,
    getNewSubscribers,
    deduplicateSubscribers,
    formatSubscriberList,
    formatEmailsOnly
};