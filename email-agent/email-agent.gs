/**
 * IFM Email Agent - Google Apps Script
 * Automatically drafts replies to incoming emails using Gemini AI
 * All drafts require manual review before sending
 *
 * Increasing Faith Ministries
 * https://increasingfaith.net
 */

// ============================================
// CONFIGURATION - Customize these settings
// ============================================

const CONFIG = {
  // How many emails to process per run (to stay within free limits)
  maxEmailsPerRun: 3,

  // Only process emails from the last N days
  daysToLookBack: 7,

  // Skip emails from these addresses (newsletters, spam, etc.)
  ignoreFromAddresses: [
    'noreply@',
    'no-reply@',
    'mailer-daemon@',
    'newsletter@',
    'notifications@',
    'alert@',
    'donotreply@'
  ],

  // Label names for organization
  labels: {
    prayer: 'IFM/Prayer Request',
    question: 'IFM/General Question',
    event: 'IFM/Event Inquiry',
    giving: 'IFM/Giving',
    processed: 'IFM/Processed'
  }
};

// Ministry context for AI responses
const MINISTRY_CONTEXT = `
You are responding on behalf of Increasing Faith Ministries (IFM), a Kingdom-centered Christian ministry.

ABOUT IFM:
- Mission: Making mature disciples who proclaim the Kingdom, form counter-cultural community, and carry Kingdom influence into every sphere of society
- Location: 24301 Telegraph, Southfield, MI 48033
- In-Person Worship: First Saturday of each month at 12:00 Noon
- Online Teaching: Monday-Friday at 8:15 AM on Facebook Live
- Website: https://increasingfaith.net
- Founded by Pastor Curtis Stephens Jr.

RESPONSE GUIDELINES:
- Be warm, welcoming, and pastoral in tone
- Keep responses concise but caring (2-4 paragraphs max)
- For prayer requests: Express compassion, assure them of prayer, mention they can join us in person or online
- For questions about visiting: Provide service times and address, express excitement to meet them
- For giving questions: Direct them to https://giv.li/129ina (Givelify)
- For general questions: Be helpful and invite them to connect further
- Always sign off warmly with "In His Service," or "Blessings," followed by "Increasing Faith Ministries"
- Never make up information you don't know - offer to have someone follow up instead
- Include relevant links when appropriate

IMPORTANT: You are drafting a reply. The ministry team will review before sending.
`;

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * Main function - processes new emails and creates draft replies
 * Run this manually or set up a time-based trigger
 */
function processNewEmails() {
  console.log('Starting IFM Email Agent...');

  // Get API key from script properties
  const apiKey = PropertiesService.getScriptProperties().getProperty('GROQ_API_KEY');
  if (!apiKey) {
    console.error('ERROR: Gemini API key not found. Please add it to Script Properties.');
    return;
  }

  // Create labels if they don't exist
  createLabelsIfNeeded();

  // Search for unread emails not yet processed
  const searchQuery = buildSearchQuery();
  console.log('Searching with query:', searchQuery);

  const threads = GmailApp.search(searchQuery, 0, CONFIG.maxEmailsPerRun);
  console.log(`Found ${threads.length} email thread(s) to process`);

  let processedCount = 0;
  let errorCount = 0;

  for (const thread of threads) {
    try {
      const result = processThread(thread, apiKey);
      if (result) {
        processedCount++;
        console.log(`Processed: "${thread.getFirstMessageSubject()}"`);
      }
    } catch (error) {
      errorCount++;
      console.error(`Error processing thread: ${error.message}`);
    }

    // Longer delay to avoid rate limits (5 seconds)
    Utilities.sleep(5000);
  }

  console.log(`Finished! Processed: ${processedCount}, Errors: ${errorCount}`);
}

/**
 * Process a single email thread
 */
function processThread(thread, apiKey) {
  const messages = thread.getMessages();
  const latestMessage = messages[messages.length - 1];

  // Skip if we sent the last message (it's a reply to us)
  if (isFromUs(latestMessage)) {
    console.log('Skipping - last message is from us');
    return false;
  }

  // Skip ignored addresses
  const fromEmail = latestMessage.getFrom().toLowerCase();
  if (shouldIgnoreEmail(fromEmail)) {
    console.log('Skipping - from ignored address');
    return false;
  }

  // Check if draft already exists for this thread
  if (draftExistsForThread(thread)) {
    console.log('Skipping - draft already exists');
    labelThread(thread, CONFIG.labels.processed);
    return false;
  }

  // Extract email content
  const emailData = {
    from: latestMessage.getFrom(),
    subject: latestMessage.getSubject(),
    body: getPlainTextBody(latestMessage),
    date: latestMessage.getDate()
  };

  // Categorize the email
  const category = categorizeEmail(emailData);
  console.log(`Category: ${category}`);

  // Generate AI response
  const draftResponse = generateResponse(emailData, category, apiKey);
  if (!draftResponse) {
    console.error('Failed to generate response');
    return false;
  }

  // Create draft reply
  createDraftReply(latestMessage, draftResponse);

  // Apply labels
  labelThread(thread, CONFIG.labels[category] || CONFIG.labels.question);
  labelThread(thread, CONFIG.labels.processed);

  // Mark as read (optional - comment out if you want to keep unread)
  // thread.markRead();

  return true;
}

// ============================================
// AI RESPONSE GENERATION
// ============================================

/**
 * Generate a response using Groq AI
 */
function generateResponse(emailData, category, apiKey) {
  const prompt = buildPrompt(emailData, category);

  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const payload = {
    model: 'llama-3.1-8b-instant',
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 1024
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + apiKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());

    if (json.error) {
      console.error('Groq API error:', json.error.message);
      return null;
    }

    const generatedText = json.choices?.[0]?.message?.content;
    if (!generatedText) {
      console.error('No text in Groq response');
      return null;
    }

    return generatedText.trim();
  } catch (error) {
    console.error('Error calling Groq API:', error.message);
    return null;
  }
}

/**
 * Build the prompt for the AI
 */
function buildPrompt(emailData, category) {
  return `${MINISTRY_CONTEXT}

EMAIL CATEGORY: ${category}

INCOMING EMAIL:
From: ${emailData.from}
Subject: ${emailData.subject}
Date: ${emailData.date}

Message:
${emailData.body}

---

Please write a warm, pastoral reply to this email. Remember to:
1. Address their specific question or need
2. Be concise but caring
3. Include relevant ministry information if helpful
4. Sign off appropriately

Write ONLY the email body (no subject line needed). Start directly with the greeting.`;
}

// ============================================
// EMAIL CATEGORIZATION
// ============================================

/**
 * Categorize email based on content
 */
function categorizeEmail(emailData) {
  const text = (emailData.subject + ' ' + emailData.body).toLowerCase();

  // Prayer-related keywords
  if (containsAny(text, ['prayer', 'pray for', 'praying', 'healing', 'sick', 'struggling', 'help me', 'need prayer', 'prayer request'])) {
    return 'prayer';
  }

  // Event/visit-related keywords
  if (containsAny(text, ['visit', 'service', 'worship', 'attend', 'directions', 'address', 'location', 'what time', 'when do you meet', 'sunday', 'saturday'])) {
    return 'event';
  }

  // Giving-related keywords
  if (containsAny(text, ['give', 'giving', 'donate', 'donation', 'tithe', 'offering', 'support', 'contribute'])) {
    return 'giving';
  }

  // Default to general question
  return 'question';
}

/**
 * Check if text contains any of the keywords
 */
function containsAny(text, keywords) {
  return keywords.some(keyword => text.includes(keyword));
}

// ============================================
// GMAIL HELPERS
// ============================================

/**
 * Build Gmail search query
 */
function buildSearchQuery() {
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - CONFIG.daysToLookBack);
  const dateStr = Utilities.formatDate(daysAgo, 'GMT', 'yyyy/MM/dd');

  // Find unread emails not already processed
  return `is:unread after:${dateStr} -label:${CONFIG.labels.processed.replace('/', '-')} -from:me`;
}

/**
 * Check if message is from our email
 */
function isFromUs(message) {
  const myEmail = Session.getActiveUser().getEmail().toLowerCase();
  const fromEmail = message.getFrom().toLowerCase();
  return fromEmail.includes(myEmail);
}

/**
 * Check if email should be ignored
 */
function shouldIgnoreEmail(fromEmail) {
  return CONFIG.ignoreFromAddresses.some(ignore => fromEmail.includes(ignore));
}

/**
 * Get plain text body from message
 */
function getPlainTextBody(message) {
  let body = message.getPlainBody();

  // If no plain text, try to extract from HTML
  if (!body || body.trim() === '') {
    body = message.getBody().replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  }

  // Limit length to avoid token limits
  if (body.length > 3000) {
    body = body.substring(0, 3000) + '... [truncated]';
  }

  return body.trim();
}

/**
 * Check if a draft already exists for this thread
 */
function draftExistsForThread(thread) {
  const drafts = GmailApp.getDrafts();
  const threadId = thread.getId();

  for (const draft of drafts) {
    const draftThread = draft.getMessage().getThread();
    if (draftThread && draftThread.getId() === threadId) {
      return true;
    }
  }
  return false;
}

/**
 * Create a draft reply to a message
 */
function createDraftReply(originalMessage, responseBody) {
  // Add a note that this is an AI draft
  const draftNote = '\n\n---\n[AI-drafted response - please review before sending]';
  const fullBody = responseBody + draftNote;

  // Create the draft as a reply
  originalMessage.createDraftReply(fullBody);

  console.log('Draft created successfully');
}

/**
 * Apply a label to a thread, creating it if needed
 */
function labelThread(thread, labelName) {
  let label = GmailApp.getUserLabelByName(labelName);
  if (!label) {
    label = GmailApp.createLabel(labelName);
  }
  thread.addLabel(label);
}

/**
 * Create all necessary labels if they don't exist
 */
function createLabelsIfNeeded() {
  // Create parent label
  const parentLabel = 'IFM';
  if (!GmailApp.getUserLabelByName(parentLabel)) {
    GmailApp.createLabel(parentLabel);
  }

  // Create child labels
  Object.values(CONFIG.labels).forEach(labelName => {
    if (!GmailApp.getUserLabelByName(labelName)) {
      GmailApp.createLabel(labelName);
    }
  });

  console.log('Labels created/verified');
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Test function - processes a single email for testing
 * Use this to test without processing all emails
 */
function testWithLatestEmail() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GROQ_API_KEY');
  if (!apiKey) {
    console.error('API key not found');
    return;
  }

  const threads = GmailApp.search('is:unread', 0, 1);
  if (threads.length === 0) {
    console.log('No unread emails found');
    return;
  }

  console.log('Testing with:', threads[0].getFirstMessageSubject());
  processThread(threads[0], apiKey);
}

/**
 * Clear all IFM labels (use with caution)
 */
function clearProcessedLabels() {
  const label = GmailApp.getUserLabelByName(CONFIG.labels.processed);
  if (label) {
    const threads = label.getThreads();
    threads.forEach(thread => thread.removeLabel(label));
    console.log(`Removed label from ${threads.length} threads`);
  }
}

/**
 * View script properties (for debugging)
 */
function viewScriptProperties() {
  const props = PropertiesService.getScriptProperties().getProperties();
  console.log('Script Properties:', Object.keys(props));
}
