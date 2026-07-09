# Oddtopsy Reports

Oddtopsy Reports is a peer-reviewed digital journal for anatomical pathology and cadaveric education. It provides a modern submission and editorial workflow for case reports, including rich-text authoring, PDF uploads, editorial review, revision history, and publication.

Built with:

- Next.js 16
- Payload CMS 3
- PostgreSQL
- Lexical Editor
- Docker
- TypeScript

---

## Screenshots

### Homepage

![Homepage](docs/home.png)

## Design Goals

Oddtopsy Reports was designed as a lightweight alternative to traditional academic publishing platforms. The focus is on:

- streamlined editorial workflows
- long-term maintainability
- clean separation between author and editor experiences
- modern responsive UI
- minimal administrative overhead

## Features

### Authors

- Submit manuscripts as either:
  - Rich text (Lexical editor)
  - PDF upload
- Upload featured and supporting images
- Edit submissions
- Draft support
- Submission workflow tracking

### Editorial

- Editorial review queue
- Preview mode
- Edit mode
- Publish workflow
- Payload version history
- Revision history

### Public Site

- Homepage
- Featured papers
- Papers archive
- Individual article pages
- Responsive design

---

## Development

### Requirements

- Docker Desktop

### Local Setup

```bash
git clone <repo>
cd oddtopsy-reports
cp .env.example .env
docker compose up --build
```

After the application starts:

```bash
docker compose exec payload npm run seed:focus-areas
```

Visit:

```
http://localhost:3000
```

On first launch you'll be prompted to create an administrator account.

---

## Available Scripts

```bash
pnpm dev
pnpm build
pnpm lint
pnpm seed:focus-areas
```

---

## Project Structure

```
src/
    app/
    collections/
    components/
    hooks/
    scripts/
    utilities/
```

---

## Current Architecture

Submission lifecycle:

```
Draft
    ↓
Submitted
    ↓
In Review
    ↓
Revision Requested
    ↓
Approved
    ↓
Published
```

Payload Version History stores every editorial revision.

---

## Roadmap

Current sprint:

- Payload Version History
- Search
- Filters
- Pagination
- Homepage carousel
- Editorial Board

Future:

- Reviewer notes
- Author revision requests
- Rich text enhancements
- Author profiles
- DOI support
- Subscriptions
- Payments
- Article metrics

---

## License

Private repository.