const cron = require('node-cron');
const axios = require('axios');
const { generateAdminToken } = require('./utils/adminToken');

// הגדרת URL של השרת
const SERVER_URL = process.env.CLIENT_ORIGIN || 'http://localhost:3000';

// פונקציה לשליחת בקשה לשרת
async function sendRequest(endpoint, adminToken) {
    try {
        const response = await axios.post(`${SERVER_URL}${endpoint}`, {}, {
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`✅ ${endpoint}: ${response.data.message}`);
        return response.data;
    } catch (error) {
        console.error(`❌ ${endpoint}:`, error.response?.data || error.message);
        return null;
    }
}

// הגדרת Cron Jobs
function setupCronJobs(adminToken) {
    console.log('🕐 Setting up cron jobs...');

    // תזכורות תורים - כל יום בשעה 18:00
    cron.schedule('0 18 * * *', async () => {
        console.log('📅 Sending appointment reminders...');
        await sendRequest('/notifications/reminders', adminToken);
    });

    // תזכורות דירוג - כל שעה
    cron.schedule('0 * * * *', async () => {
        console.log('⭐ Sending rating reminders...');
        await sendRequest('/notifications/rating-reminders', adminToken);
    });

    // ניקוי טוקנים - כל יום בשעה 02:00
    cron.schedule('0 2 * * *', async () => {
        console.log('🧹 Cleaning up invalid tokens...');
        await sendRequest('/notifications/cleanup-tokens', adminToken);
    });

    console.log('✅ Cron jobs scheduled:');
    console.log('  - Appointment reminders: Daily at 18:00');
    console.log('  - Rating reminders: Every hour');
    console.log('  - Token cleanup: Daily at 02:00');
}

// הפעלה
if (require.main === module) {
    let adminToken = process.env.ADMIN_TOKEN;

    // אם אין טוקן ב-env, יוצר טוקן חדש
    if (!adminToken) {
        console.log('🔑 No ADMIN_TOKEN found, generating new one...');
        adminToken = generateAdminToken();
        console.log('📋 Add this to your .env file:');
        console.log(`ADMIN_TOKEN=${adminToken}`);
        console.log('');
    }

    setupCronJobs(adminToken);

    console.log('🚀 Cron service started');
    console.log(`📡 Server URL: ${SERVER_URL}`);
}

module.exports = { setupCronJobs };
