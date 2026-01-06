# Keaton Taylor Portfolio

Personal portfolio website built with Jekyll and Tailwind CSS.

## Tech Stack

- **Jekyll** - Static site generator
- **Tailwind CSS** - Utility-first CSS framework
- **PostCSS** - CSS processing
- **GitHub Pages** - Hosting

## Setup

### Prerequisites

- Ruby (with Bundler)
- Node.js and npm

### Installation

1. Clone the repository:
```bash
git clone https://github.com/keaton-taylor/keaton-taylor.github.io.git
cd keaton-taylor.github.io
```

2. Install Ruby dependencies:
```bash
bundle install
```

3. Install Node dependencies:
```bash
npm install
```

4. Build CSS:
```bash
npm run build:css
```

## Development

Start the development server with live reload:

```bash
npm run dev
```

Or use the start script for port 5000:

```bash
npm start
```

The site will be available at `http://localhost:4000` (or `http://localhost:5000`).

## Building

Build the site for production:

```bash
npm run build
```

This will:
1. Build the CSS from `assets/css/styles.css` to `assets/css/main.css`
2. Build the Jekyll site to `_site/`

## Project Structure

```
.
├── _config.yml          # Jekyll configuration
├── _data/               # Data files (blog posts, case studies, etc.)
├── _includes/           # Reusable HTML components
├── _layouts/            # Page layouts
├── _posts/              # Blog posts and case studies
├── assets/              # Static assets (CSS, images, favicons)
├── index.html           # Homepage
└── package.json         # Node dependencies and scripts
```

## Features

- Responsive design with mobile-first approach
- Case study portfolio
- Blog/thoughts section
- Design principles showcase
- SEO optimized with structured data
- Accessibility features (skip links, ARIA labels)

## License

All work and words by Keaton Taylor © 2025
