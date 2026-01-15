#!/usr/bin/env node

/**
 * Authentication Diagnostic Script
 * Run this to check if your auth setup is correct
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 App Market Authentication Diagnostic\n');

// Check 1: .env.local exists
console.log('1️⃣  Checking environment file...');
const envPath = path.join(__dirname, '.env.local');
if (!fs.existsSync(envPath)) {
  console.log('   ❌ .env.local not found!');
  console.log('   📝 Copy .env.example to .env.local\n');
} else {
  console.log('   ✅ .env.local exists\n');

  // Check 2: Read environment variables
  console.log('2️⃣  Checking required environment variables...');
  const envContent = fs.readFileSync(envPath, 'utf-8');

  const checks = [
    { name: 'DATABASE_URL', required: true, placeholder: 'postgresql://username:password@localhost' },
    { name: 'NEXTAUTH_URL', required: true, placeholder: null },
    { name: 'NEXTAUTH_SECRET', required: true, placeholder: null },
    { name: 'GITHUB_ID', required: false, placeholder: 'your-github-oauth-client-id' },
    { name: 'GITHUB_SECRET', required: false, placeholder: 'your-github-oauth-client-secret' },
    { name: 'GOOGLE_ID', required: false, placeholder: 'your-google-oauth-client-id' },
    { name: 'GOOGLE_SECRET', required: false, placeholder: 'your-google-oauth-client-secret' },
  ];

  let hasIssues = false;

  checks.forEach(check => {
    const regex = new RegExp(`${check.name}=["']?([^"'\\n]+)["']?`);
    const match = envContent.match(regex);

    if (!match) {
      if (check.required) {
        console.log(`   ❌ ${check.name} is missing`);
        hasIssues = true;
      } else {
        console.log(`   ⚠️  ${check.name} is missing (optional for OAuth)`);
      }
    } else {
      const value = match[1];
      if (check.placeholder && value.includes(check.placeholder)) {
        if (check.required) {
          console.log(`   ❌ ${check.name} has placeholder value`);
          hasIssues = true;
        } else {
          console.log(`   ⚠️  ${check.name} has placeholder value (OAuth won't work)`);
        }
      } else {
        console.log(`   ✅ ${check.name} is set`);
      }
    }
  });

  console.log();
}

// Check 3: Database connection
console.log('3️⃣  Checking database connection...');
console.log('   Run this command to test: npx prisma db pull');
console.log();

// Check 4: Node modules
console.log('4️⃣  Checking dependencies...');
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
  console.log('   ❌ node_modules not found!');
  console.log('   📝 Run: npm install\n');
} else {
  console.log('   ✅ Dependencies installed\n');
}

// Check 5: Prisma client
console.log('5️⃣  Checking Prisma client...');
const prismaClientPath = path.join(__dirname, 'node_modules', '.prisma', 'client');
if (!fs.existsSync(prismaClientPath)) {
  console.log('   ❌ Prisma client not generated!');
  console.log('   📝 Run: npx prisma generate\n');
} else {
  console.log('   ✅ Prisma client generated\n');
}

// Summary
console.log('\n📋 Summary:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n✅ WHAT WORKS:');
console.log('   • Wallet authentication (Phantom, Solflare, etc.)');
console.log('   • Email/Password authentication');
console.log('\n⚠️  WHAT NEEDS SETUP:');
console.log('   • Database connection (required for ALL auth)');
console.log('   • GitHub OAuth (optional - needs credentials)');
console.log('   • Google OAuth (optional - needs credentials)');
console.log('\n🚀 QUICK START:');
console.log('   1. Make sure DATABASE_URL is correct in .env.local');
console.log('   2. Run: npx prisma migrate dev');
console.log('   3. Run: npm run dev');
console.log('   4. Go to: http://localhost:3000/auth/signup');
console.log('   5. Create an account with wallet OR email');
console.log('\n💡 TIP: Wallet auth works even without OAuth setup!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
