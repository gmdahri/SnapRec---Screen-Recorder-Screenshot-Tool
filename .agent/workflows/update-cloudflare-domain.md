---
description: How to update the Cloudflare Pages domain name
---

To update your domain to `snaprec.pages.dev`, you need to rename your Cloudflare Pages project. Follow these steps:

1. **Log in to Cloudflare**: Go to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. **Navigate to Pages**: Click on **Workers & Pages** in the sidebar.
3. **Select Your Project**: Find and click on your current project (e.g., `snaprec---screen-recorder...`).
4. **Go to Settings**: Click the **Settings** tab at the top.
5. **Rename Project**:
   - In the **General** section, look for **Project name**.
   - Click **Rename**.
   - Enter `snaprec` as the new name.
   - Confirm the rename.
6. **Verify the New URL**: Once renamed, your site will be available at `https://snaprec.pages.dev`.

> [!IMPORTANT]
> Renaming the project will break the old `*.pages.dev` URL. Ensure you've updated all references in your code (which we have already done in the `fix/editor-and-upload-issues` branch).

7. **Update Production Deployment**: If you have a CI/CD pipeline (like GitHub Actions), ensure it points to the new project name if required.
