---
description: How to update the Cloudflare Pages domain name
---

To get the domain `snaprecorder.pages.dev`, you **cannot** simply rename an existing project (Cloudflare permanently locks the subdomain at creation). You must create a **new** project:

1. **Log in to Cloudflare**: Go to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. **Delete the Old Project (Recommended)**: 
   - Since `snaprecorder` might be "reserved" by your current renamed project, go to **Settings** > **General** and **Delete** the current project first to free up the name.
3. **Create a New Project**:
   - Go to **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
   - Select your repository.
   - **CRITICAL**: In the **Project Name** field, enter exactly `snaprecorder`.
4. **Configure Build Settings**:
   - Framework preset: `Vite`.
   - Build command: `npm run build`
   - Root directory: `apps/web` (or ensure it's set to the web app folder).
5. **Deploy**: Click **Save and Deploy**.
6. **Verify**: Once the build finishes, your site will be live at `https://snaprecorder.pages.dev`.

> [!IMPORTANT]
> Since we've already updated the code to point to `snaprecorder.pages.dev` in our current branch, everything will work perfectly once this new project finishes its first deployment.
