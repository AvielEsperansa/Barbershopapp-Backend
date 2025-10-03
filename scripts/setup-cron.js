#!/usr/bin/env node

const { generateAdminToken } = require('../src/utils/adminToken');
const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up Cron Service...\n');

// יצירת טוקן אדמין
const adminToken = generateAdminToken();

console.log('🔑 Generated Admin Token:');
console.log(adminToken);
console.log('');

// בדיקה אם קיים קובץ .env
const envPath = path.join(process.cwd(), '.env');
let envContent = '';

if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
    console.log('📄 Found existing .env file');
} else {
    console.log('📄 Creating new .env file');
}

// הוספת/עדכון ADMIN_TOKEN
const adminTokenLine = `ADMIN_TOKEN=${adminToken}`;
const lines = envContent.split('\n');
let updated = false;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('ADMIN_TOKEN=')) {
        lines[i] = adminTokenLine;
        updated = true;
        break;
    }
}

if (!updated) {
    lines.push(adminTokenLine);
}

requiredVars.forEach(varLine => {
    const varName = varLine.split('=')[0];
    const exists = lines.some(line => line.startsWith(varName + '='));

    if (!exists) {
        lines.push(varLine);
    }
});

// שמירת הקובץ
fs.writeFileSync(envPath, lines.join('\n'));

console.log('✅ .env file updated with ADMIN_TOKEN');
console.log('');
console.log('🚀 To start the cron service:');
console.log('   npm run cron');
console.log('');
console.log('📋 Or manually:');
console.log('   node src/cron.js');
console.log('');
console.log('🔍 To test the token:');
console.log(`   curl -X POST http://localhost:3000/notifications/rating-reminders \\`);
console.log(`     -H "Authorization: Bearer ${adminToken}"`);
