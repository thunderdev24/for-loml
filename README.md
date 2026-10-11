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
