const jwt = require('jsonwebtoken');

// יצירת אדמין טוקן קבוע
function generateAdminToken() {
    const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

    // יצירת טוקן עם תאריך תפוגה רחוק (10 שנים)
    const payload = {
        id: 'admin-cron-service',
        role: 'admin',
        type: 'cron-service'
    };

    const options = {
        expiresIn: '10y', // 10 שנים
        issuer: 'barbershop-api',
        audience: 'cron-service'
    };

    return jwt.sign(payload, JWT_SECRET, options);
}

// פונקציה לבדיקת תקינות הטוקן
function validateAdminToken(token) {
    try {
        const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
        const decoded = jwt.verify(token, JWT_SECRET);

        return decoded.role === 'admin' && decoded.type === 'cron-service';
    } catch (error) {
        return false;
    }
}

// יצירת טוקן חדש
if (require.main === module) {
    const token = generateAdminToken();
    console.log('🔑 Admin Token for Cron:');
    console.log(token);
    console.log('\n📋 Add this to your .env file:');
    console.log(`ADMIN_TOKEN=${token}`);
}

module.exports = { generateAdminToken, validateAdminToken };