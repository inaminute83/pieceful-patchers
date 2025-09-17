# Quilt Guild Website

A simple, elegant, and responsive multi-page website for a quilt guild. Built with plain HTML/CSS/JS so anyone can edit it easily.

## Pages
- Home (`index.html`)
- About (`about.html`)
- Events (`events.html`)
- Gallery (`gallery.html`)
- Membership (`membership.html`)
- Contact (`contact.html`)

## Features
- Mobile-friendly navigation
- Lightbox photo gallery (`gallery.html`)
- Contact and membership forms (Netlify forms-ready)

## How to use
- Open `index.html` in your browser to preview locally.
- Place your quilt images in `assets/img/` and update `gallery.html` paths.
- Replace placeholder text with your guild details.
- Replace `assets/forms/membership.pdf` with your real PDF.

## How to Update (Pieceful Patchers)
- Hero title/subtext: `quilt/index.html` (hero section)
- Featured Quilts images: drop files into `quilt/assets/img/` and update the `src` values in the `Featured Quilts` section of `quilt/index.html`.
- Spotlight image on Home: quick preview by dropping a file into the spotlight dropzone; to make it permanent, place a file in `quilt/assets/img/` and change the `img src` next to `id="spotlight-image"` in `quilt/index.html`.
- Gallery images: put images in `quilt/assets/img/` and add `<a><img/></a>` items in `quilt/gallery.html`.
- Members-only password: change `const PASSWORD = 'Quilt2025'` in `quilt/assets/js/main.js`.
- Email destination for forms: change `RECIPIENT` in `quilt/assets/js/main.js`.

## Forms (no middleman)
Forms open the user’s email app via `mailto:` and copy details to the clipboard as a fallback, then redirect to `thank-you.html`.

## Deploying to Netlify
- This project includes `netlify.toml` set to publish from `quilt/`.
- Options:
  - Drag & Drop: Zip the `quilt/` folder and upload in Netlify → Deploys.
  - Git-based: Connect your repo to Netlify; builds will auto-deploy on push.
  - Netlify CLI: `netlify deploy --prod` from the project root.

## Domain (piecefulpatchers.com)
- In Netlify → Domain management: add `piecefulpatchers.com` and enable HTTPS.
- Use Netlify DNS (recommended) or add a CNAME/ALIAS at your registrar.

## Push-to-Deploy (Git) – quick start
1. Initialize git in the project root.
2. Commit the current files.
3. Create a remote repository (GitHub/GitLab/Bitbucket) and push.
4. Connect the repo to Netlify (publish dir: `quilt/`).


## Deploying
- Easy: drag-and-drop the folder to Netlify for instant hosting.
- Or publish via GitHub Pages.

## Customizing Brand
- Edit colors and typography in `assets/css/styles.css`.
- Update the site name by changing the `.logo` text and page titles.
