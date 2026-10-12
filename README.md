# Ifra site v2 (Netlify)

## What is new
- 📖 **Our Story** button above the proposal button: cinematic pages, your heading + text, background song from the second you choose, optional voice per page.
- 🎶 Upload songs from your phone/PC in the admin (Playlist tab).
- 🔔 **Birthday reminders**: she taps one button, then gets "X days until your birthday" notifications.

## Update your GitHub repo
Upload these (replace the old ones), by dragging the folders into Add file > Upload files:
- `public/` (all files inside, including the new `sw.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`)
- `netlify/` (new files: media.mjs, push.mjs, birthday-reminder.mjs, lib/)
- `package.json` (now includes web-push)
Keep your songs and photos in `public/` as before. Netlify redeploys by itself.

## After deploying
1. Admin > **Our Story**: pick the song (bewajah), set the start second, write pages, add voice. Press **Publish live**.
2. Admin > **Dates & delivery** > Birthday reminders: choose the days, edit the message, set the birthday date. Press Publish live.
3. She taps "Remind me before my birthday" on the site. Use "Send a test notification now" to try it.
4. Notifications are sent every day at 9:00 Pakistan time (04:00 UTC). Change the hour in `netlify/functions/birthday-reminder.mjs` (`schedule`).

## iPhone note
iPhones only allow notifications for sites added to the Home Screen (Share > Add to Home Screen, then open it from there).

## 🔐 Logins (gallery, Our Story, proposal)
Where the new / changed files go:
- `public/`: `ifra.js`, `ifra.css`, `site-loader.js`, `admin.html` (replace the old ones)
- `netlify/functions/`: `auth.mjs` (new), `live.mjs`, `admin.mjs` (replace)
- `netlify/functions/lib/`: `authlib.mjs` (new)

How to use it:
1. Deploy, open the admin panel > **Login** tab (🔐 Logins).
2. Create **your** login and **her** login (email + password of at least 8 characters). Saved instantly, no Publish needed.
3. Press **Publish live** once on the admin so the server holds a full copy of your photos, story and proposal.
4. From then on the gallery, Our Story and the proposal ask for an email and password. She stays logged in on her phone.
- To change an email or password later, open the same tab and save. That person is logged out and logs in again.
- To turn the login off, remove both logins.
- Logged in as yourself, the proposal does not send "she said yes" to you, so you can test it freely.

Good to know:
- The private parts are no longer in the public page data. Your old `content.js` still contains the built-in copy, though; once you have published, you can delete `memories`, `story`, `proposalScenes`, `yesScenes` and `noTexts` from it to keep them out of the source too (this also makes the original-photo filenames in `public/` unlisted).
- Photos already sitting in `public/` as plain files stay reachable by their exact file name. Photos uploaded through the admin panel have random names that are only revealed after login.
