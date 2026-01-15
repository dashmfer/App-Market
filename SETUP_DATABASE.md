# Database Setup Guide

## Option 1: Vercel Postgres (Recommended - Easiest)

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Link your project:**
   ```bash
   vercel link
   ```

4. **Create Postgres database:**
   - Go to: https://vercel.com/dashboard
   - Select your project
   - Go to Storage tab
   - Click "Create Database"
   - Select "Postgres"
   - Click "Create"

5. **Pull environment variables:**
   ```bash
   vercel env pull .env.local
   ```
   This will automatically add DATABASE_URL to your .env.local

6. **Run migrations:**
   ```bash
   npx prisma migrate dev
   ```

7. **Start the app:**
   ```bash
   npm run dev
   ```

---

## Option 2: Local PostgreSQL

### macOS (using Homebrew):
```bash
# Install PostgreSQL
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb appmarket

# Update .env.local
DATABASE_URL="postgresql://$(whoami)@localhost:5432/appmarket?schema=public"

# Run migrations
npx prisma migrate dev

# Start app
npm run dev
```

### Linux (Ubuntu/Debian):
```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql

# Create user and database
sudo -u postgres createuser -s $USER
createdb appmarket

# Update .env.local
DATABASE_URL="postgresql://$USER@localhost:5432/appmarket?schema=public"

# Run migrations
npx prisma migrate dev

# Start app
npm run dev
```

### Windows:
1. Download PostgreSQL: https://www.postgresql.org/download/windows/
2. Install and note the password you set
3. Open pgAdmin
4. Create database named "appmarket"
5. Update .env.local:
   ```
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/appmarket?schema=public"
   ```
6. Run migrations:
   ```bash
   npx prisma migrate dev
   ```
7. Start app:
   ```bash
   npm run dev
   ```

---

## Option 3: Docker PostgreSQL (Cross-platform)

```bash
# Start PostgreSQL in Docker
docker run --name appmarket-db \
  -e POSTGRES_PASSWORD=password123 \
  -e POSTGRES_DB=appmarket \
  -p 5432:5432 \
  -d postgres:15

# Update .env.local
DATABASE_URL="postgresql://postgres:password123@localhost:5432/appmarket?schema=public"

# Run migrations
npx prisma migrate dev

# Start app
npm run dev
```

---

## Option 4: Neon Database (Free Cloud Option)

1. Go to: https://neon.tech
2. Sign up for free account
3. Create a new project
4. Copy the connection string
5. Update .env.local:
   ```
   DATABASE_URL="postgresql://username:password@xxx.neon.tech/neondb?sslmode=require"
   ```
6. Run migrations:
   ```bash
   npx prisma migrate dev
   ```
7. Start app:
   ```bash
   npm run dev
   ```

---

## Verify Database Connection

Test that your database is working:

```bash
# Should connect without errors
npx prisma db pull

# Should show your database tables
npx prisma studio
```

---

## After Database Setup

Once database is working, you can sign in with:

1. **✅ Wallet (Phantom, Solflare, etc.)** - Works immediately!
2. **✅ Email/Password** - Go to /auth/signup first
3. **❌ GitHub** - Needs OAuth credentials setup
4. **❌ Google** - Needs OAuth credentials setup

