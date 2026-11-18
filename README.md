# Legacy Catalog · inRiver

The **legacy website**: a basic product listing (PLP) and product page (PDP) fed by the same
inRiver Excel export as the **enhanced website** (https://inriver-web-app.vercel.app).

It exists for customer demos. Import the same Excel file into both sites, then show:

1. **Legacy website**: only the basic attributes (1 image, 4 specifications, 1 document, no
   features, videos, certifications, related or compatible products).
2. **Enhanced website**: everything the export contains.

Every legacy product page has the **From inRiver** navigator on the right. It lists the attributes
shown, scrolls to any one of them on click and highlights it, and states how many attributes of
the export this site does **not** show. A button opens the same product on the enhanced website.

Built with **Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4**, and fully
separate from the enhanced website: its own repository, `package.json`, Vercel project and storage.

---

## What the legacy site shows

Set in [`src/config/legacy.ts`](src/config/legacy.ts):

| Setting | Default | Meaning |
| --- | --- | --- |
| `maxImages` | 1 | Images per product |
| `maxSpecs` | 4 | Specifications per product (first columns of the export) |
| `maxDocuments` | 1 | Documents per product (drawing or datasheet first) |
| `maxDescriptionParagraphs` | 1 | Paragraphs of the description |
| always hidden | | Features, videos, certifications, related, compatible products, variants |

The full export is still stored. Only what is displayed is reduced (`src/lib/legacy.ts`), so the
product page can count what is left out.

## Quick start (test machine)

Requirements: **Node.js 20.9 or newer**.

1. Create `.env.local` in this folder:

   ```bash
   ADMIN_PASSWORD=choose-a-strong-password
   ```

2. Install and run:

   ```bash
   npm install
   npm run build
   npm start
   ```

3. Open http://localhost:3000. It opens on **All products** (PLP). Go to **/admin**, sign in and
   import the Excel file. Locally the catalog is saved in `.data/` (not committed).

## Deploy to Vercel

1. Push this folder to its own GitHub repository.
2. In Vercel: **Add New → Project → Import** that repository (Next.js is detected).
3. **Environment Variables**:
   - `ADMIN_PASSWORD`: a strong password (required for `/admin`)
   - `NEXT_PUBLIC_ENHANCED_URL`: `https://inriver-web-app.vercel.app` (the default if left out)
4. Deploy. Then **Storage → Create Storage → Blob** (access **Private**, no prefix) and connect
   it to this project.
5. **Redeploy once** so the deployment sees the storage.
6. Open `https://<legacy-project>.vercel.app/admin`, sign in and import the Excel file.

## Pages

| URL | Page |
| --- | --- |
| `/` | Redirects to `/catalog` |
| `/catalog`, `/catalog/<category>` | Product listing (PLP) with filters |
| `/product/<slug>` | Product page (PDP) with the From inRiver navigator |
| `/admin` | Excel import (upload → map columns → review → publish) |

Product URLs match the enhanced website, so `/product/<slug>` opens the same part on both sites.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `ADMIN_PASSWORD` | **Required** to use `/admin`. |
| `NEXT_PUBLIC_ENHANCED_URL` | Enhanced website linked from product pages. |
| `SESSION_SECRET` | Optional extra secret for admin sessions. |
| `BLOB_READ_WRITE_TOKEN` | Added by Vercel when a Blob store is connected. |
| `BLOB_ACCESS` | `private` (default) or `public`. |
| `CATALOG_DATA_DIR` | Folder for the catalog when not using Blob (default `.data`). |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL (auto-detected on Vercel). |
| `NEXT_PUBLIC_QUOTE_EMAIL` | Address for "Request a quote". |
