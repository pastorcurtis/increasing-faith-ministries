#!/usr/bin/env node
/**
 * Add a subscriber to The Kingdom Report.
 *
 * FormSubmit.co emails each signup to curtisstephensjr@gmail.com. When one
 * arrives, add them here so the monthly send picks them up.
 *
 * Usage:
 *   node add-subscriber.js "Jane Smith" jane@example.com
 *   node add-subscriber.js jane@example.com              (name optional)
 *   node add-subscriber.js --list                        (show everyone)
 *
 * Remember to commit and push subscribers.json afterwards, or the GitHub
 * Actions run will not see the new subscriber.
 */

const { addSubscriber, getSubscribers, formatSubscriberList } = require("./subscribers");

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
        console.log('Usage: node add-subscriber.js "Jane Smith" jane@example.com');
        console.log("       node add-subscriber.js --list");
        process.exit(args.length === 0 ? 1 : 0);
    }

    if (args[0] === "--list") {
        console.log(formatSubscriberList(await getSubscribers()));
        return;
    }

    // Name is optional, so the email is simply whichever argument has an "@".
    const email = args.find(a => a.includes("@"));
    const name = args.filter(a => a !== email).join(" ");

    if (!email) {
        console.error("No email address found in the arguments.");
        process.exit(1);
    }

    const result = addSubscriber(name, email);

    if (result.added) {
        console.log(`Added ${name || "(no name)"} <${email.toLowerCase()}>`);
        console.log(`Total subscribers: ${result.total}`);
        console.log("\nNow commit it so the monthly send sees them:");
        console.log("  git add newsletter-agent/subscribers.json");
        console.log('  git commit -m "Add newsletter subscriber"');
        console.log("  git push");
    } else {
        console.log(`Not added -- ${result.reason}.`);
        process.exit(1);
    }
}

main().catch(err => {
    console.error("Error:", err.message);
    process.exit(1);
});
