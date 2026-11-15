# Elizabeth Taye — Résumé Website

A résumé site for college applications, hosted on Netlify:

- **Home page** (`/`): profile, education timeline, programs, leadership, honors and skills.
- **Achievement pages** (`/achievements/<id>`): one page per achievement, with photos and PDFs of its certificates.
- **Project pages** (`/projects/<id>`): school or personal projects with files and a GitHub link (live repo details from GitHub's public API).
- **Document pages** (`/documents/<id>`): transcripts and certificates, with every PDF page shown in a viewer. Documents can be hidden from the public.
- **Admin** (`/admin`): password-protected editor for all text, the profile photo, a résumé PDF, projects (with "Fill in from GitHub"), transcripts, certificates and achievement credentials.

Edits and uploads are saved in Netlify Blobs (Netlify's built-in storage), so changes go live without touching GitHub.

## Set up

1. **Upload this folder to a GitHub repository** (keep the folder structure).
2. **Link it in Netlify:** open the `elizabeth-taye` project → *Project configuration → Build & deploy → Continuous deployment → Link repository*, and pick the repo. The settings come from `netlify.toml`, so leave the build fields as they are.
3. **Add two environment variables** under *Project configuration → Environment variables* (scope: Functions, all contexts):
   - `ADMIN_PASSWORD`: the admin password (at least 8 characters).
   - `SESSION_SECRET`: a long random string (at least 32 characters). Never share it.
4. **Redeploy** (*Deploys → Trigger deploy*), then open `/admin` and log in.

## Security

- The password is checked on the server; it never appears in the page code.
- Logins use a signed, HttpOnly, SameSite=Strict cookie that expires after 8 hours.
- Login attempts are limited to 8 per minute per IP address.
- Uploads are checked by their actual file contents (JPG, PNG, WebP, GIF, PDF only; 4 MB max).
- To change the password, edit `ADMIN_PASSWORD` and redeploy. Every device is signed out.

## Files

```
public/               static pages (index, achievement, admin) and assets
netlify/functions/    API: login, logout, session, content, upload, file, file-delete
netlify/lib/          shared code: auth, storage, validation, starting content
netlify.toml          build settings, /achievements/* rewrite, headers
```
