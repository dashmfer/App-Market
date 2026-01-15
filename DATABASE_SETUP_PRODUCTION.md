# Production Database Setup Guide

## Problem
Your environment variables are correctly set in Vercel, but your production database doesn't have the required tables (Account, User, Session, etc.).

## Solution

### Step 1: Connect to Your Production Database Locally

1. **Get your production DATABASE_URL from Vercel:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Copy the `DATABASE_URL` value

2. **Add it to your local `.env` file temporarily:**
   ```bash
   # Create/edit .env in project root (NOT .env.local)
   DATABASE_URL="your-production-database-url-here"
   ```

### Step 2: Generate and Push the Schema

Run these commands in your project directory:

```bash
# Generate Prisma Client
npx prisma generate

# Push the schema to production database (creates all tables)
npx prisma db push

# Optional: Seed initial data if you have a seed script
npx prisma db seed
```

**Alternative: Use Migrations (Recommended for production)**

```bash
# Create a migration
npx prisma migrate dev --name init

# Deploy the migration to production
npx prisma migrate deploy
```

### Step 3: Verify the Database

Check that tables were created:

```bash
# Open Prisma Studio to view your database
npx prisma studio
```

You should see all tables including:
- User
- Account
- Session
- Listing
- Bid
- Transaction
- etc.

### Step 4: Redeploy on Vercel

After the database schema is set up:

1. Go to Vercel Dashboard → Your Project → Deployments
2. Click **Redeploy** on the latest deployment
3. This ensures your app connects to the now-initialized database

## Important Notes

⚠️ **Security Warning:**
- Never commit your `.env` file with production credentials
- Remove the production `DATABASE_URL` from your local `.env` after you're done
- Keep your local `.env.local` for development database

⚠️ **Database URL Format:**
Your DATABASE_URL should look like:
```
postgresql://username:password@host:5432/database?sslmode=require
```

## Troubleshooting

### Error: "Can't reach database server"
- Check that your IP is allowed in your database's firewall settings
- For PostgreSQL (common providers):
  - **Supabase**: Add your IP in Settings → Database → Connection Pooling
  - **Neon**: Should work automatically
  - **Railway**: Add your IP in the database service settings

### Error: "SSL connection required"
Add `?sslmode=require` to the end of your DATABASE_URL

### Still having issues?
1. Check Vercel logs: Vercel Dashboard → Your Project → Logs
2. Check database connection: Try connecting with a PostgreSQL client
3. Verify DATABASE_URL is correct and has proper permissions

## Alternative: Vercel CLI Method

You can also push schema using Vercel CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Link your project
vercel link

# Pull environment variables
vercel env pull .env.production

# Use production env and push schema
DATABASE_URL="$(grep DATABASE_URL .env.production | cut -d '=' -f2-)" npx prisma db push
```

---

After completing these steps, your authentication and all database operations should work on production!
