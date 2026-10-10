# Ifra site, live-editable on Netlify

## Folder layout
- `public/`  the website (index.html, ifra.js, ifra.css, content.js, site-loader.js, admin.html)
- `netlify/functions/`  the small backend (saves your edits, stores photos, forwards her answer to you)
- `package.json`, `netlify.toml`  settings

## 1. Add your media
Copy your existing photos (the `.webp` files) and songs (`Bayaan_1.mp4`, `reflections.m4a`, `makeen.m4a`, `bewajah.m4a`, `majboor.m4a`) into `public/`.
New photos you add later are uploaded from the admin panel and need no files.

## 2. Deploy (drag-and-drop will NOT work, the backend needs its package installed)
Option A, GitHub: push this folder to a GitHub repo, then in Netlify choose "Add new site > Import an existing project".
Option B, CLI:
    npm install -g netlify-cli
    npm install
    netlify deploy --prod

## 3. Set your admin password
Netlify > Site configuration > Environment variables > add `ADMIN_PASSWORD` (a long one). Then redeploy once.
The admin panel refuses to work until this is set.

## 4. Use it
Open `https://YOUR-SITE.netlify.app/admin.html`, sign in, edit anything, press "Publish live".
Her page shows the new content on the next refresh. "Preview" shows your draft before publishing.

## Her answer reaches you
In the admin panel > "Dates & delivery", enter your ntfy topic and/or Discord webhook. They are stored on the server and never appear in the page source.
