# SRRM Frontend - Next.js Application

Production-grade Next.js 14 frontend for the Supplier Risk & Relationship Management system.

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui** (component library)
- **Supabase JS Client** (server-side only)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Create a `.env.local` file in the `frontend/` directory:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   AIRFLOW_API=http://localhost:8080/api/v1
   AIRFLOW_USER=admin
   AIRFLOW_PASS=admin
   ```

   ⚠️ **Important:** The `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to the browser. All Supabase operations are performed server-side via API routes and Server Components.

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Pages

- **/** - Executive Overview Dashboard (KPIs, top high-risk suppliers, risk distribution)
- **/suppliers** - View supplier profiles and risk master data, add new suppliers
- **/predictions** - Full prediction history (paginated, filterable)
- **/shap** - SHAP explanations for latest 3 predictions
- **/upload** - CSV upload for supplier risk master data
- **/pipeline** - Trigger Airflow DAG for ML predictions

## Architecture

### Server-Side Data Fetching
- All Supabase queries are performed server-side using Server Components
- API routes (`/api/supabase/*`, `/api/airflow/*`) handle client-initiated actions
- Secrets (service role key, Airflow credentials) are never exposed to the browser

### Latest Prediction Logic
- All dashboards use the **latest prediction per supplier** rule
- Implemented via `getLatestPredictionsPerSupplier()` in `lib/queries.ts`
- Ensures no stale counts or outdated risk assessments

### SHAP Explanations
- SHAP values are matched to predictions by `supplier_id` and `prediction_date`
- Only the latest 3 predictions are shown on the `/shap` page
- Top 3 features by absolute SHAP impact are displayed with direction (increases/reduces risk)

## Building for Production

```bash
npm run build
npm start
```

## Project Structure

```
frontend/
├── app/
│   ├── layout.tsx          # Root layout with navigation
│   ├── page.tsx             # Executive Overview
│   ├── suppliers/           # Supplier management
│   ├── predictions/         # Prediction history
│   ├── shap/                # SHAP explanations
│   ├── upload/              # CSV upload
│   ├── pipeline/            # Airflow trigger
│   └── api/                 # API routes (server-side only)
├── components/
│   ├── ui/                  # shadcn/ui components
│   └── risk-badge.tsx       # Risk category badge
├── lib/
│   ├── supabase.ts         # Supabase admin client
│   ├── queries.ts          # Data query functions
│   ├── airflow.ts          # Airflow API client
│   └── utils.ts            # Utility functions
└── types/
    └── db.ts               # TypeScript types for database
```
