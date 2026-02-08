/**
 * Newsletter Form Updater for Increasing Faith Ministries
 *
 * This script updates all HTML files in the IFM website to convert
 * the existing mailto-based newsletter forms to Netlify Forms.
 *
 * What it changes:
 *   - Adds data-netlify="true" and name="newsletter-subscribers" to forms
 *   - Adds a hidden form-name input (required by Netlify)
 *   - Adds a honeypot field for spam protection
 *   - Replaces the old mailto JavaScript with inline success message handling
 *   - Optionally calls the newsletter-signup Netlify Function for welcome emails
 *
 * Run with: node update-forms.js
 * Run with --dry-run to preview changes without writing: node update-forms.js --dry-run
 */

const fs = require("fs");
const path = require("path");

// --- Configuration -----------------------------------------------------------

// Website root directory (one level up from newsletter-agent)
const SITE_ROOT = path.resolve(__dirname, "..");

// Dry run mode -- preview changes without writing files
const DRY_RUN = process.argv.includes("--dry-run");

// --- New Form HTML -----------------------------------------------------------

/**
 * Generates the updated Netlify Forms newsletter form HTML.
 * This replaces the old mailto-based form in the footer.
 *
 * @param {string} formId - The form element ID (e.g., "newsletter-form")
 * @param {string} formClass - The form CSS class (e.g., "signup-form")
 * @returns {string} - Updated form HTML
 */
function getUpdatedFormHTML(formId, formClass) {
    return [
        `<form class="${formClass}" id="${formId}" name="newsletter-subscribers" method="POST" data-netlify="true" netlify-honeypot="bot-field">`,
        "                        <!-- Hidden field required by Netlify Forms -->",
        '                        <input type="hidden" name="form-name" value="newsletter-subscribers">',
        "                        <!-- Honeypot field for spam protection (hidden from real users) -->",
        '                        <p style="display:none"><label>Do not fill this out: <input name="bot-field"></label></p>',
        '                        <input type="email" name="email" placeholder="Enter your email" required>',
        '                        <button type="submit">Subscribe</button>',
        "                        <!-- Success message (shown after submission) -->",
        '                        <p class="form-success" style="display:none; color: #c9a84c; margin-top: 0.5rem; font-size: 0.9rem;">Thank you! Welcome to the Kingdom Report.</p>',
        "                    </form>",
    ].join("\n");
}

// --- New JavaScript Handler --------------------------------------------------

/**
 * Generates the updated JavaScript that handles form submission.
 * Replaces the old mailto handler with Netlify Forms + optional Function call.
 *
 * @param {string} formId - The form element ID
 * @returns {string} - Updated JavaScript block
 */
function getUpdatedJS(formId) {
    return [
        `        // Newsletter form handler -- Netlify Forms with optional welcome email`,
        `        const ${formId.replace(/-/g, "")}El = document.getElementById("${formId}");`,
        `        if (${formId.replace(/-/g, "")}El) {`,
        `            ${formId.replace(/-/g, "")}El.addEventListener("submit", async function(e) {`,
        "                e.preventDefault();",
        "                const form = e.target;",
        '                const email = form.querySelector(\'input[type="email"]\').value;',
        "                const submitBtn = form.querySelector('button[type="submit"]');",
        "                const successMsg = form.querySelector('.form-success');",
        "",
        "                // Disable button while submitting",
        '                submitBtn.textContent = "Subscribing...";',
        "                submitBtn.disabled = true;",
        "",
        "                try {",
        "                    // Submit to Netlify Forms",
        "                    const formData = new URLSearchParams(new FormData(form));",
        "                    await fetch('/', {",
        "                        method: 'POST',",
        "                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },",
        "                        body: formData.toString()",
        "                    });",
        "",
        "                    // Also call the newsletter-signup function for welcome email",
        "                    fetch('/.netlify/functions/newsletter-signup', {",
        "                        method: 'POST',",
        "                        headers: { 'Content-Type': 'application/json' },",
        "                        body: JSON.stringify({ email })",
        "                    }).catch(() => {}); // Fire and forget -- do not block on this",
        "",
        "                    // Show success message",
        "                    if (successMsg) successMsg.style.display = 'block';",
        '                    submitBtn.textContent = "Subscribed!";',
        "                    form.querySelector('input[type="email"]').value = '';",
        "",
        "                    // Reset button after 3 seconds",
        "                    setTimeout(() => {",
        '                        submitBtn.textContent = "Subscribe";',
        "                        submitBtn.disabled = false;",
        "                        if (successMsg) successMsg.style.display = 'none';",
        "                    }, 3000);",
        "",
        "                } catch (error) {",
        "                    console.error('Newsletter signup error:', error);",
        '                    submitBtn.textContent = "Try Again";',
        "                    submitBtn.disabled = false;",
        "                }",
        "            });",
        "        }",
    ].join("\n");
}

// --- Form Pattern Matching ---------------------------------------------------

/**
 * Replaces an old newsletter form HTML block with the new Netlify Forms version.
 *
 * @param {string} html - The full HTML file content
 * @param {string} formId - The form ID to find and replace
 * @param {string} formClass - The form CSS class
 * @returns {string} - Updated HTML content
 */
function replaceFormHTML(html, formId, formClass) {
    // Match the old form block: <form class="..." id="formId">...</form>
    // Note: we use replace() directly instead of test() + replace(),
    // because test() with the "g" flag advances lastIndex and breaks the next replace()
    const formRegex = new RegExp(
        `<form\\s+class="${formClass}"\\s+id="${formId}"[^>]*>[\\s\\S]*?</form>`,
        "g"
    );

    return html.replace(formRegex, getUpdatedFormHTML(formId, formClass));
}

/**
 * Replaces the old mailto JavaScript handler with the new Netlify Forms handler.
 *
 * @param {string} html - The full HTML file content
 * @param {string} formId - The form ID referenced in the JS
 * @returns {string} - Updated HTML content
 */
function replaceFormJS(html, formId) {
    // Match the old mailto handler block for this form ID
    // Pattern: "// Newsletter form handler with mailto" ... closing }",
    // Note: we use replace() directly -- test() with "g" flag would break the match
    const varName = formId === "newsletter-form" ? "newsletterForm" : "footerNewsletterForm";

    const jsRegex = new RegExp(
        `(\\s*//\\s*(Footer )?[Nn]ewsletter form handler with mailto\\n)` +
        `\\s*const ${varName}[\\s\\S]*?\\n\\s*\\}\\n\\s*\\}`,
        "g"
    );

    return html.replace(jsRegex, "\n" + getUpdatedJS(formId));
}

// --- Main Processing ---------------------------------------------------------

/**
 * Processes a single HTML file: updates form HTML and replaces mailto JS.
 *
 * @param {string} filePath - Absolute path to the HTML file
 * @returns {boolean} - True if changes were made
 */
function processFile(filePath) {
    let html = fs.readFileSync(filePath, "utf-8");
    const original = html;

    // Update footer newsletter form (present on most pages)
    // Some pages use id="newsletter-form", some use id="footer-newsletter-form"
    html = replaceFormHTML(html, "newsletter-form", "signup-form");
    html = replaceFormHTML(html, "footer-newsletter-form", "signup-form");

    // Also handle the main-body newsletter form on community.html and journey.html
    html = replaceFormHTML(html, "newsletter-form", "newsletter-form");

    // Replace the old mailto JS handlers
    html = replaceFormJS(html, "newsletter-form");
    html = replaceFormJS(html, "footer-newsletter-form");

    // Check if anything changed
    if (html === original) {
        return false;
    }

    if (DRY_RUN) {
        console.log(`  [DRY RUN] Would update: ${path.basename(filePath)}`);
    } else {
        fs.writeFileSync(filePath, html, "utf-8");
        console.log(`  Updated: ${path.basename(filePath)}`);
    }

    return true;
}

// --- Entry Point -------------------------------------------------------------

function main() {
    console.log("IFM Newsletter Form Updater");
    console.log("=".repeat(40));
    if (DRY_RUN) console.log("Running in DRY RUN mode (no files will be changed)\n");
    console.log(`Site root: ${SITE_ROOT}\n`);

    // Find all HTML files in the website root
    const htmlFiles = fs.readdirSync(SITE_ROOT)
        .filter(f => f.endsWith(".html"))
        .map(f => path.join(SITE_ROOT, f));

    console.log(`Found ${htmlFiles.length} HTML files\n`);

    let updatedCount = 0;

    for (const filePath of htmlFiles) {
        const wasUpdated = processFile(filePath);
        if (wasUpdated) updatedCount++;
    }

    console.log(`\nDone! ${updatedCount} file(s) updated.`);

    if (DRY_RUN && updatedCount > 0) {
        console.log("\nRun again without --dry-run to apply changes:");
        console.log("  node update-forms.js");
    }

    if (updatedCount > 0) {
        console.log("\nNext steps:");
        console.log("  1. Test the forms locally or deploy to Netlify");
        console.log("  2. Submit a test subscription to verify Netlify captures it");
        console.log("  3. Check the Netlify dashboard > Forms to see submissions");
    }
}

main();