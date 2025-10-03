# הפעלה אוטומטית של מערכת הדירוגים

## אפשרויות הפעלה

### 1. הפעלה ידנית (לבדיקות)
```bash
# שליחת תזכורות דירוג
curl -X POST http://localhost:3000/notifications/rating-reminders \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

### 2. הפעלה אוטומטית עם Cron Job

#### התקנת dependencies:
```bash
npm install axios node-cron
```

#### הגדרה אוטומטית (מומלץ):
```bash
# יצירת טוקן אדמין והגדרת .env אוטומטית
npm run setup-cron
```

#### הגדרה ידנית:
```bash
# יצירת טוקן אדמין
node src/utils/adminToken.js

# הוספה ל-.env
ADMIN_TOKEN=your-generated-token
CLIENT_ORIGIN=http://localhost:3000
```

#### הפעלת Cron Service:
```bash
# הפעלה ישירה
npm run cron

# או
node src/cron.js
```

#### הפעלה ברקע (Linux/Mac):
```bash
# הפעלה ברקע
nohup npm run cron > cron.log 2>&1 &

# או עם PM2
pm2 start src/cron.js --name "barbershop-cron"
```

### 3. הפעלה עם PM2 (מומלץ לפרודקשן)

#### התקנת PM2:
```bash
npm install -g pm2
```

#### יצירת ecosystem.config.js:
```javascript
module.exports = {
  apps: [
    {
      name: 'barbershop-api',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'barbershop-cron',
      script: 'src/cron.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

#### הפעלה:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 4. הפעלה עם Docker

#### Dockerfile:
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

#### docker-compose.yml:
```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/barbershop
      - ADMIN_TOKEN=${ADMIN_TOKEN}
    depends_on:
      - mongo
      - cron

  cron:
    build: .
    command: npm run cron
    environment:
      - MONGODB_URI=mongodb://mongo:27017/barbershop
      - ADMIN_TOKEN=${ADMIN_TOKEN}
      - SERVER_URL=http://api:3000
    depends_on:
      - mongo

  mongo:
    image: mongo:latest
    ports:
      - "27017:27017"
```

## לוח זמנים אוטומטי

- **תזכורות תורים**: כל יום בשעה 18:00
- **תזכורות דירוג**: כל שעה
- **ניקוי טוקנים**: כל יום בשעה 02:00

## בדיקת הפעלה

### בדיקת Cron Jobs:
```bash
# בדיקת תזכורות דירוג
curl -X POST http://localhost:3000/notifications/rating-reminders \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# בדיקת תזכורות תורים
curl -X POST http://localhost:3000/notifications/reminders \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### בדיקת לוגים:
```bash
# אם משתמשים ב-PM2
pm2 logs barbershop-cron

# אם משתמשים ב-nohup
tail -f cron.log
```

## פתרון בעיות

### בעיה: Cron לא עובד
- בדוק שהמשתנה `ADMIN_TOKEN` מוגדר נכון
- בדוק שהשרת רץ על `SERVER_URL`
- בדוק את הלוגים

### בעיה: הודעות לא נשלחות
- בדוק שהמשתמשים יש להם `pushToken`
- בדוק את הגדרות Cloudinary
- בדוק את חיבור MongoDB

### בעיה: דירוגים לא נוצרים
- בדוק שהתור עבר (תאריך ושעה)
- בדוק שהלקוח לא דירג כבר
- בדוק את הרשאות המשתמש
