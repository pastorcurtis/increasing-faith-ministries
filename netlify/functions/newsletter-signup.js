/**
 * Netlify Function: Newsletter Signup
 *
 * Enhanced newsletter signup handler for Increasing Faith Ministries.
 * This function runs server-side when someone subscribes to the newsletter.
 *
 * What it does:
 *   1. Validates the submitted email address
 *   2. Sends a welcome email to the new subscriber (via Resend API)
 *   3. Returns a success response with a custom message
 *
 * SETUP:
 *   Set these environment variables in Netlify (Site Settings > Environment):
 *   - RESEND_API_KEY: Your Resend API key (get one at https://resend.com)
 *   - FROM_EMAIL: Verified sender email (e.g., newsletter@increasingfaith.net)
 *
 * The form submission itself is handled automatically by Netlify Forms.
 * This function provides the EXTRA welcome email experience on top of that.
 */

// --- Email Validation --------------------------------------------------------

/**
 * Validates an email address format.
 * Checks for basic structure: something@something.something
 *
 * @param {string} email - The email address to validate
 * @returns {boolean} - True if the email looks valid
 */
function isValidEmail(email) {
    if (!email || typeof email !== "string") return false;
    // Standard email regex covers the vast majority of real-world addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
}

// --- Welcome Email -----------------------------------------------------------

/**
 * Sends a welcome email to a new subscriber via the Resend API.
 * Resend is a simple email API that is free for up to 3,000 emails/month.
 *
 * @param {string} email - Subscriber email address
 * @param {string} name - Subscriber name (optional)
 * @returns {Promise<object>} - Resend API response
 */
async function sendWelcomeEmail(email, name) {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const FROM_EMAIL = process.env.FROM_EMAIL || "newsletter@increasingfaith.net";

    // If no Resend key is set, skip sending but do not fail
    // (the form submission is still captured by Netlify Forms)
    if (!RESEND_API_KEY) {
        console.log("RESEND_API_KEY not set -- skipping welcome email.");
        return { skipped: true };
    }

    // Personalize the greeting if we have their name
    const greeting = name ? `Dear ${name}` : "Dear Friend";

    // Build the welcome email HTML
    const htmlBody = `
    <div style="font-family: Georgia, Times New Roman, serif; max-width: 600px; margin: 0 auto; background: #0a0612; color: #f5f0eb; padding: 40px 30px; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #c9a84c; font-size: 24px; margin: 0;">Increasing Faith Ministries</h1>
            <p style="color: #a09888; font-size: 14px; letter-spacing: 2px; margin-top: 5px;">THE KINGDOM REPORT</p>
        </div>

        <h2 style="color: #c9a84c; font-size: 20px;">Welcome to the Kingdom Report!</h2>

        <p>${greeting},</p>

        <p>Thank you for subscribing to the Kingdom Report newsletter from Increasing Faith Ministries. We are glad you have joined us on this journey of advancing the reign of God.</p>

        <p>Here is what you can expect:</p>
        <ul style="color: #d4c5b0; line-height: 1.8;">
            <li><strong style="color: #c9a84c;">Kingdom Teachings</strong> - Deep insights from Pastor Curtis on the Kingdom of God</li>
            <li><strong style="color: #c9a84c;">Kingdom Intelligence</strong> - Reports of God's Kingdom advancing around the world</li>
            <li><strong style="color: #c9a84c;">Prayer Focus</strong> - Monthly prayer points for intercession</li>
            <li><strong style="color: #c9a84c;">Kingdom Living</strong> - Practical ways to live out Kingdom principles daily</li>
        </ul>

        <p>In the meantime, visit our website to explore teachings, join a cohort, or learn about our mission:</p>

        <div style="text-align: center; margin: 30px 0;">
            <a href="https://increasingfaith.net" style="display: inline-block; background: linear-gradient(135deg, #c9a84c, #b8943f); color: #0a0612; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Visit IncreasingFaith.net</a>
        </div>

        <p style="color: #a09888; font-size: 13px; margin-top: 30px; border-top: 1px solid rgba(201, 168, 76, 0.2); padding-top: 20px;">
            Increasing Faith Ministries<br>
            24301 Telegraph, Southfield, MI 48033<br>
            <a href="mailto:increasingfaithministry@gmail.com" style="color: #c9a84c; text-decoration: none;">increasingfaithministry@gmail.com</a>
        </p>
    </div>
    `;

    // Send the email via Resend API
    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            from: `Increasing Faith Ministries <${FROM_EMAIL}>`,
            to: [email],
            subject: "Welcome to the Kingdom Report - Increasing Faith Ministries",
            html: htmlBody
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Resend API error (${response.status}): ${errorBody}`);
        // Do not throw -- a failed email should not break the signup
        return { error: true, status: response.status };
    }

    return response.json();
}

// --- Netlify Function Handler ------------------------------------------------

/**
 * Main handler for the Netlify Function.
 * Triggered by a POST request from the newsletter signup form.
 *
 * @param {object} event - Netlify Function event (contains request data)
 * @returns {object} - HTTP response with status and JSON body
 */
exports.handler = async function(event) {
    // CORS headers -- allow requests from the IFM website
    const headers = {
        "Access-Control-Allow-Origin": "https://increasingfaith.net",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Content-Type": "application/json"
    };

    // Handle preflight CORS requests (browser sends OPTIONS before POST)
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 204, headers, body: "" };
    }

    // Only accept POST requests
    if (event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({
                success: false,
                message: "Method not allowed. Please use POST."
            })
        };
    }

    try {
        // Parse the request body (could be JSON or form-encoded)
        let data;
        const contentType = event.headers["content-type"] || "";

        if (contentType.includes("application/json")) {
            data = JSON.parse(event.body);
        } else {
            // Parse URL-encoded form data
            const params = new URLSearchParams(event.body);
            data = Object.fromEntries(params);
        }

        const { email, name } = data;

        // Validate the email
        if (!isValidEmail(email)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: "Please provide a valid email address."
                })
            };
        }

        // Send the welcome email (will not fail the request if email sending fails)
        const emailResult = await sendWelcomeEmail(email.trim(), name || "");

        // Log for Netlify Function logs (visible in your Netlify dashboard)
        console.log(`New subscriber: ${email} | Welcome email: ${
            emailResult.skipped ? "skipped (no API key)" :
            emailResult.error ? "failed" : "sent"
        }`);

        // Return success to the frontend
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: "Welcome to the Kingdom Report! Check your inbox for a welcome message.",
                emailSent: !emailResult.skipped && !emailResult.error
            })
        };

    } catch (error) {
        console.error("Newsletter signup error:", error);

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: "Something went wrong. Please try again or email us directly at increasingfaithministry@gmail.com."
            })
        };
    }
};