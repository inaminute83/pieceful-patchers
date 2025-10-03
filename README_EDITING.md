# How to Edit the Pieceful Patchers Website

This site is deployed on Netlify and content is managed with Decap CMS (Netlify CMS). All editable content lives in JSON files under `quilt/content/` and can be edited through the admin UI at `/admin/`.

## Admin Login
- URL: `https://piecefulpatchers.com/admin/`
- Netlify Identity must be enabled (Invite only). Ask an admin to invite your email.
- After you accept the invite, you can log in and edit content.

## What You Can Edit
- `quilt/content/site.json`
  - Homepage headings, hero text, featured quilts, spotlight bio/image
  - Navigation labels, contact email, meeting line
- `quilt/content/events.json`
  - List of events for `events.html`
- `quilt/content/newsletters.json`
  - Newsletter entries (title, date, URL). Page automatically shows recent vs archive
- `quilt/content/member_sections.json`
  - Tabs on `resources.html` (e.g., Patterns, Charity)
  - Add images (cards with captions) and PDF links. If a PDF link has `"url": "#"`, the page can auto‑generate a PDF from the tab’s images via a button
  - Tabs with `allowLocalDrop: true` allow drag‑and‑drop for a local preview (does not upload)
- `quilt/content/hospitality.json`
  - Monthly grid for `hospitality.html` with 6 editable lines per month

## Images & Files
- CMS uploads go to: `quilt/assets/img/uploads/`
- Refer to images with paths like: `assets/img/uploads/your-image.jpg`
- PDFs can be uploaded and linked in the `pdfs` section, or set `url` to `#` to enable on‑page PDF generation from images

## Members Area
- Protected pages: `resources.html`, `hospitality.html`
- Password: `Quilt2025` (client‑side gate)

## Publishing Flow
- Edits in `/admin/` create commits in GitHub repo: `inaminute83/pieceful-patchers`
- Netlify auto‑deploys after each commit
- To roll back, use Netlify Deploys or revert in GitHub

## Troubleshooting
- Changes not visible yet: wait 10–30 seconds for deploy, hard refresh the page
- Image not showing: ensure path is correct (`assets/img/...`) and file exists in uploads
- Cannot save in admin: ensure Identity is enabled, your email is invited, and Git Gateway is enabled
- Members gate not unlocking: check Caps Lock; password is `Quilt2025`

## Optional Improvements
- Hash the members password in `quilt/assets/js/main.js` to avoid plaintext (functionally the same for users)
- Add/replace images in `quilt/assets/img/`
- Add a custom 404 page
