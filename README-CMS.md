# Decap CMS Setup for IFM Website

This document explains how to set up and use Decap CMS (formerly Netlify CMS) to manage content on the Increasing Faith Ministries website.

## What is Decap CMS?

Decap CMS is a free, open-source content management system that allows you to edit your website content through a user-friendly admin interface, without needing to edit code directly.

---

## Deploying to Netlify

### Step 1: Push Your Code to GitHub

1. Create a GitHub account if you don't have one: https://github.com
2. Create a new repository for your website
3. Push your website files to the repository:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ifm-website.git
git push -u origin main
```

### Step 2: Deploy on Netlify

1. Go to https://www.netlify.com and create a free account
2. Click **"Add new site"** > **"Import an existing project"**
3. Choose **GitHub** and authorize Netlify to access your repositories
4. Select your IFM website repository
5. Configure build settings:
   - **Build command:** Leave blank (static site)
   - **Publish directory:** `/` or `.` (root directory)
6. Click **"Deploy site"**

Your site will be live at a Netlify URL like `https://your-site-name.netlify.app`

---

## Enabling Identity and Git Gateway

These services allow users to log in and edit content through the CMS.

### Step 1: Enable Netlify Identity

1. In your Netlify dashboard, go to **Site settings**
2. Click **Identity** in the sidebar
3. Click **"Enable Identity"**
4. Under **Registration preferences**, choose:
   - **Invite only** (recommended for security)
5. Under **External providers** (optional), you can enable Google login

### Step 2: Enable Git Gateway

1. Still in **Identity** settings, scroll down to **Services**
2. Click **"Enable Git Gateway"**
3. This connects the CMS to your GitHub repository

### Step 3: Invite Users

1. Go to **Identity** > **Invite users**
2. Enter email addresses for people who should have admin access
3. They'll receive an email with a link to set their password

---

## Accessing the Admin Panel

Once deployed and configured:

1. Go to `https://your-site.netlify.app/admin/`
2. Click **"Login with Netlify Identity"**
3. Enter your email and password (or use Google if enabled)
4. You'll see the CMS dashboard where you can edit content

---

## Editing Content

### Pages

Edit content for the Homepage and About page:

- **Homepage:** Hero text, values, pathway steps, call-to-action sections
- **About Page:** Ministry story, mission cards, pastor bios, beliefs

### Site Settings

Configure global settings:

- Church name and tagline
- Contact email and phone
- Service times (in-person and online)
- Location
- Social media links
- SEO settings

### Testimonials

Add, edit, or remove testimonials:

1. Go to **Testimonials** in the CMS
2. Click **"New Testimonial"** to add one
3. Fill in name, role, quote, and upload a photo
4. Set **Featured: true** to show on the homepage
5. Use **Display Order** to control the sequence

### Teachings

Manage sermon/teaching entries:

1. Go to **Teachings** in the CMS
2. Click **"New Teaching"** to add one
3. Enter title, date, speaker, video URL
4. Add a description and scripture reference
5. Choose a category (Kingdom Teaching, Worship Service, etc.)
6. Mark as **Featured** to highlight on the teachings page

### Prayer Page

Edit prayer page content:

- Hero section text
- Introduction paragraph
- Form submission email
- Confirmation message
- Featured scripture

---

## How Content Works

When you save changes in the CMS:

1. Decap CMS creates a commit in your GitHub repository
2. Netlify automatically detects the change
3. Your site rebuilds and deploys (usually in under a minute)
4. The new content appears on your live site

**Note:** The current website is static HTML, so content changes in the CMS will update the JSON files but won't automatically reflect on the pages unless you integrate JavaScript to read from these JSON files, or use a static site generator like Hugo, Jekyll, or 11ty.

---

## File Structure

```
IFM website/
├── admin/
│   ├── index.html      # CMS admin page
│   └── config.yml      # CMS configuration
├── content/
│   ├── home.json       # Homepage content
│   ├── about.json      # About page content
│   ├── settings.json   # Site-wide settings
│   ├── prayer.json     # Prayer page settings
│   ├── testimonials/   # Individual testimonial files
│   └── teachings/      # Individual teaching files
├── images/             # Media uploads will go here
└── ... (other website files)
```

---

## Troubleshooting

### Can't log in to admin panel

- Make sure Identity is enabled in Netlify settings
- Check that Git Gateway is enabled
- Verify you've been invited and set your password
- Try clearing browser cache/cookies

### Changes not appearing on site

- Wait 1-2 minutes for Netlify to rebuild
- Check Netlify dashboard for deploy status
- Verify the deploy succeeded without errors

### Getting "Git Gateway Error"

- Re-enable Git Gateway in Netlify Identity settings
- Check your GitHub repository permissions

---

## Need Help?

- **Decap CMS Docs:** https://decapcms.org/docs/
- **Netlify Docs:** https://docs.netlify.com/
- **Netlify Identity Docs:** https://docs.netlify.com/visitor-access/identity/

---

## Future Enhancements

To fully integrate the CMS content with your website, consider:

1. **Using a Static Site Generator** (recommended):
   - Hugo, Jekyll, or Eleventy can read JSON/YAML files and generate HTML
   - This gives you the full power of CMS-driven content

2. **Client-side JavaScript**:
   - Fetch JSON files and dynamically render content
   - Simpler but requires JavaScript to be enabled

3. **Build Script**:
   - Create a script that reads JSON and updates HTML files
   - Run as part of your Netlify build process

The CMS is ready to use, and the content structure is in place for any of these approaches!
