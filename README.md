# Librairian Web

A web application focused on accessing, analyzing, and visualizing data related to JFK assassination documents.

## Overview

Librairian Web provides an interface for interacting with a collection of JFK-related documents and associated data. Key functionalities include:

- Browsing and viewing documents within the `/jfk-files` section.
- Detailed views for specific documents and related individuals.
- Capturing new data points or sources.
- Searching and exploring the dataset.
- Various data visualizations to understand connections and timelines.

## Features

- **Document Hub (`/jfk-files`)**: Central interface for browsing, viewing, and managing JFK documents. Includes pagination and status tracking.
- **Detailed Views**:
    - View specific document details (`/jfk-files/[id]`).
    - View profiles and connections for individuals (`/jfk-files/person/[name]`).
- **Data Visualizations**: Includes multiple visualization types:
    - Chronosphere
    - Force Graph
    - Geographic Map
    - Timeline Chart
    - Enhanced Map & Timeline Visualizations
- **Backend API**: Comprehensive API routes under `/api/` handle authentication, data retrieval (documents, connections, profiles), processing, capture, and search functionalities.

## Getting Started

### Prerequisites

- Node.js 18+
- NPM or Yarn
- PostgreSQL 12+ (running on port 5432)

### Database Setup

1. Create a PostgreSQL database named `jfk_documents`:
   ```
   createdb jfk_documents
   ```
   
   If you need to specify a user or different configuration, update the `DATABASE_URL` in your `.env.local` file.

2. Run the database migrations:
   ```
   npx prisma migrate dev
   ```

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/devonjames/librairian-web.git
   cd librairian-web
   ```

2. Install dependencies:
   ```
   npm install
   # or
   yarn install
   ```

3. Configure environment variables:
   Create a `.env.local` file in the root directory with the following variables:
   ```
   DATABASE_URL="postgresql://user@localhost:5432/jfk_documents?schema=public"
   NEXT_PUBLIC_API_URL=https://api.oip.onl
   NEXT_PUBLIC_WEBSITE_URL=http://localhost:3000
   JWT_SECRET=your-jwt-secret
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-nextauth-secret
   ```

### Running the Application

You can run the application using the provided shell script, which will run the database migrations and start the development server:

```bash
chmod +x run-jfk-files.sh
./run-jfk-files.sh
```

Alternatively, you can run the commands manually:

1. Run Prisma migrations:
   ```
   npx prisma migrate dev
   ```

2. Start the development server:
   ```
   npm run dev
   # or
   yarn dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Project Structure

The project follows a structure typical for Next.js applications using the App Router:

- `/app`: Contains core application logic, including pages (routes) and API routes.
- `/components`: Shared React components used across the application.
- `/hooks`: Custom React hooks.
- `/lib`: Core library functions, potentially including database interactions or external API clients.
- `/prisma`: Prisma schema and related database files.
- `/public`: Static assets (images, fonts, etc.) directly accessible via the web server.
- `/scripts`: Utility scripts for various tasks (e.g., database seeding, deployment).
- `/utils`: General utility functions.

## Technology Stack

- **Frontend**: Next.js (App Router), React, Tailwind CSS
- **Backend**: Next.js API Routes
- **Authentication**: Likely NextAuth.js or similar (based on `/api/auth/`) (not yet included)
- **Data Storage**: Local storage (client-side) with optional database integration

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).