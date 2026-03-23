# Family App

A comprehensive family management application built with **Astro**, **React**, and **AWS Amplify Gen 2**.

## Features

### 🏖️ Vacations Module

- Create and manage family vacations
- Track dates, transportation (flight/car/boat), and accommodations
- Add activities to vacations
- Family members can rate activities (1-5 stars) and leave comments
- Planners can add trip details; all family members can view and provide feedback

### 🏠 Property Module

- Manage family properties
- Track income and expenses for each property
- View financial summaries with total income, expenses, and net income
- Categorize transactions for better organization

### 🚗 Cars Module

- Maintain a registry of family vehicles
- Record VIN, mileage, and vehicle details
- Track service history including:
  - Service type and description
  - Mileage at time of service
  - Cost and service provider
  - Date of service

### 📅 Calendar

- Integrated FullCalendar view
- Placeholder for displaying family events and vacation dates

## Technology Stack

- **Frontend Framework**: Astro with React
- **Styling**: Tailwind CSS with Royal Blue theme
- **Backend**: AWS Amplify Gen 2
- **Authentication**: Amazon Cognito
- **Database**: AWS AppSync with DynamoDB
- **Calendar**: FullCalendar
- **Language**: TypeScript

## Prerequisites

- Node.js 18+ and npm
- AWS Account
- AWS Amplify CLI

## Installation

1. Clone the repository:

```bash
git clone https://github.com/liljoker919/family-app.git
cd family-app
```

2. Install dependencies:

```bash
npm install
```

3. Set up AWS Amplify:

```bash
npx ampx sandbox
```

4. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Fill in your AWS Amplify configuration values after deployment

5. Start the development server:

```bash
npm run dev
```

## Project Structure

```
family-app/
├── amplify/                  # AWS Amplify backend configuration
│   ├── auth/                 # Cognito authentication setup
│   ├── data/                 # GraphQL schema and data models
│   └── backend.ts            # Backend configuration
├── src/
│   ├── components/           # React components
│   │   ├── modules/          # Feature modules (Vacations, Property, Cars, Calendar)
│   │   ├── AuthPage.tsx      # Authentication page
│   │   └── Dashboard.tsx     # Main dashboard
│   ├── layouts/              # Astro layouts
│   ├── pages/                # Astro pages (routing)
│   └── amplifyconfiguration.ts  # Amplify client configuration
├── public/                   # Static assets
└── tailwind.config.mjs       # Tailwind CSS configuration
```

## Data Models

### Vacation

- Title, description
- Start and end dates
- Transportation type (flight/car/boat)
- Accommodations
- Created by user

### Activity

- Belongs to a vacation
- Name, description
- Date and location
- Associated feedback

### Feedback

- Belongs to an activity
- User rating (1-5 stars)
- Comments
- User ID and timestamp

### Property

- Name and address
- Property type

### PropertyTransaction

- Belongs to a property
- Type (income/expense)
- Amount and date
- Description and category

### Car

- Make, model, year
- VIN (Vehicle Identification Number)
- Current mileage
- Color

### CarService

- Belongs to a car
- Service type and description
- Mileage at service
- Date, cost, and service provider

### Chores

## Authentication

The app uses AWS Cognito for authentication with email-based login. Only authenticated family members can access the application.

## UI Theme

The application features a Royal Blue color scheme throughout the interface:

- Primary color: Royal Blue (#0046a7)
- Navigation and headers use royal blue styling
- Consistent color palette for a cohesive user experience

## Automated Testing

### Unit Tests

| Workflow | Trigger | Non-blocking |
|----------|---------|--------------|
| **Unit Tests** | Every push to `main` | ✅ Yes (`continue-on-error`) |

The unit test workflow runs [Vitest](https://vitest.dev/) on every merge/push to `main`. Test results are always uploaded as a GitHub Actions artifact named **`unit-test-results`** and are retained for 30 days.

To access reports:

1. Go to **Actions** → **Unit Tests** → select a run.
2. Scroll to **Artifacts** and download **`unit-test-results`**.

### Playwright UI Tests

| Workflow | Trigger | Timezone | Non-blocking |
|----------|---------|----------|--------------|
| **Playwright UI Tests** | Weekly – Sunday at 11 PM UTC | UTC (= 6 PM US Central / 7 PM US Eastern) | ✅ Yes (`continue-on-error`) |

The Playwright workflow installs Chromium and runs headless end-to-end smoke tests every Sunday night. You can also trigger it manually via **workflow_dispatch** from the Actions tab.

Two artifacts are uploaded on every run:

- **`playwright-report`** – Playwright HTML report (open `index.html` after downloading)
- **`playwright-test-results`** – screenshots, videos, and traces captured on failure

To access reports:

1. Go to **Actions** → **Playwright UI Tests** → select a run.
2. Scroll to **Artifacts** and download **`playwright-report`**.
3. Extract the zip and open `playwright-report/index.html` in your browser.

> **Note:** Failures in either workflow are visible in the run summary and artifact reports but **do not block** the Amplify build or deploy pipeline.

## Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

### Deploy Backend

```bash
npx ampx sandbox   # For development
npx ampx deploy    # For production
```

### Deploy Frontend

The application can be deployed to various hosting platforms:

- AWS Amplify Hosting
- Vercel
- Netlify
- Any static hosting service

## License

ISC

## Author

liljoker919
