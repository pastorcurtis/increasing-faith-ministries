# IFM Email Agent Setup Guide

This Google Apps Script automatically drafts replies to incoming emails using AI.
You review and approve before anything is sent.

## Setup Instructions (10 minutes)

### Step 1: Get Your Free Gemini API Key

1. Go to: https://aistudio.google.com/apikey
2. Sign in with your Google account (use increasingfaithministry@gmail.com)
3. Click "Create API Key"
4. Copy the key (looks like: AIzaSy...)
5. Save it somewhere safe - you'll need it in Step 3

### Step 2: Create the Google Apps Script

1. Go to: https://script.google.com
2. Sign in with increasingfaithministry@gmail.com
3. Click "+ New Project"
4. Delete any code in the editor
5. Copy ALL the code from `email-agent.gs` (in this folder)
6. Paste it into the editor
7. Click the project name "Untitled project" at the top
8. Rename it to "IFM Email Agent"
9. Click "Save" (disk icon) or press Ctrl+S

### Step 3: Add Your API Key

1. In the script editor, click the gear icon (Project Settings) on the left
2. Scroll down to "Script Properties"
3. Click "Add script property"
4. Property name: `GEMINI_API_KEY`
5. Value: Paste your API key from Step 1
6. Click "Save script properties"

### Step 4: Authorize the Script

1. In the editor, make sure `processNewEmails` is selected in the dropdown (near the Run button)
2. Click "Run"
3. A popup will ask for permissions - click "Review Permissions"
4. Choose your Gmail account
5. Click "Advanced" then "Go to IFM Email Agent (unsafe)"
   - (It says "unsafe" because it's your own script, not verified by Google - this is normal)
6. Click "Allow"

### Step 5: Set Up Automatic Running

1. Click the clock icon (Triggers) on the left sidebar
2. Click "+ Add Trigger"
3. Configure:
   - Function: `processNewEmails`
   - Event source: `Time-driven`
   - Type: `Hour timer`
   - Hour interval: `Every hour`
4. Click "Save"

## How to Use

### Automatic Mode
- The script runs every hour automatically
- New emails get labeled and draft replies are created
- Check your Gmail Drafts folder to review and send

### Manual Mode
- Go to script.google.com
- Open "IFM Email Agent"
- Click "Run" to process emails immediately

### Check the Logs
- In the script editor, click "Executions" on the left
- See what emails were processed and any errors

## Email Labels Created

The script automatically labels emails:
- `IFM/Prayer Request` - Prayer submissions
- `IFM/General Question` - General inquiries
- `IFM/Event Inquiry` - Questions about services/events
- `IFM/Giving` - Donation-related
- `IFM/Processed` - Already has a draft reply

## Customizing Responses

Edit the `MINISTRY_CONTEXT` variable in the script to adjust:
- Tone and style
- Ministry information
- Common responses

## Troubleshooting

**"API key not found" error:**
- Make sure you added the script property correctly in Step 3

**"Permission denied" error:**
- Re-run the script and authorize again

**No drafts appearing:**
- Check that you have unread emails
- Look at Executions log for errors

**Wrong tone in responses:**
- Edit the MINISTRY_CONTEXT in the script

## Need Help?

The script is designed to be safe - it NEVER sends emails automatically.
All replies are saved as drafts for your review.
