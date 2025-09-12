# LocalStock Product Availability Extension

## Overview

LocalStock is a browser extension and web service that shows real-time local product availability on e-commerce sites like Amazon and Walmart. The system extracts product information from product detail pages, queries local inventory from nearby stores, and displays available pickup/delivery options through an unobtrusive floating UI. The architecture consists of a browser extension (content scripts + service worker), a Node.js/Express backend API, and a React admin dashboard.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Browser Extension**: Built with Manifest V3 using vanilla JavaScript for content scripts and service worker
- **Admin Dashboard**: React application with TypeScript, built using Vite
- **UI Framework**: Tailwind CSS with shadcn/ui components for consistent design
- **State Management**: React Query for server state, React hooks for local state
- **Routing**: Wouter for lightweight client-side routing

### Backend Architecture
- **API Server**: Express.js with TypeScript running on Node.js
- **Database Layer**: Drizzle ORM with PostgreSQL for data persistence
- **Caching Strategy**: In-memory caching with 5-minute TTL for resolve requests
- **Request Processing**: Debounced product resolution to prevent duplicate API calls

### Data Storage Solutions
- **Primary Database**: PostgreSQL via Neon serverless
- **ORM**: Drizzle with schema-first approach
- **Caching**: Session storage (extension) + in-memory cache (server)
- **Schema Design**: Products, stores, offers, and resolve request tracking tables

### Extension Content Processing
- **Platform Detection**: Automatic identification of Amazon/Walmart product pages
- **Data Extraction**: DOM scraping with fallback to structured data (JSON-LD)
- **Product Identification**: Support for GTIN, UPC, EAN, ASIN, and SKU identifiers
- **Mutation Handling**: MutationObserver for dynamic page updates

### API Design
- **Core Endpoint**: `/api/resolve` for product availability queries
- **Health Monitoring**: `/api/health` for system status
- **Recent Activity**: `/api/resolve/recent` for request history
- **Cache Management**: `/api/cache` for manual cache clearing

### Guard Filters and Business Logic
- **Quality Gates**: Minimum margin, trust score, and maximum ETA thresholds
- **Prioritization**: Pickup over delivery, then lowest ETA, then lowest price
- **Silent Operation**: Only shows UI when all guard conditions are satisfied
- **Privacy Focused**: Minimal permissions, no broad data collection

## External Dependencies

### Third-Party Services
- **Neon Database**: Serverless PostgreSQL hosting
- **Replit**: Development and deployment platform

### Key NPM Packages
- **Backend**: express, drizzle-orm, @neondatabase/serverless, zod
- **Frontend**: react, vite, @tanstack/react-query, wouter
- **UI Components**: @radix-ui components, tailwindcss, class-variance-authority
- **Development**: typescript, tsx, esbuild, drizzle-kit

### Browser APIs
- **Extension APIs**: chrome.storage, chrome.runtime, chrome.scripting
- **Web APIs**: fetch, MutationObserver, sessionStorage, JSON-LD parsing
- **Permissions**: activeTab, storage, specific host patterns for supported sites