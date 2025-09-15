# מערכת Push Notifications - Barbershop App

## סקירה כללית

מערכת ה-push notifications מאפשרת שליחת הודעות מיידיות למשתמשים במספרה. המערכת משתמשת ב-Expo Push Notifications ומתאימה לאפליקציות React Native.

## תכונות

### הודעות אוטומטיות
- **קביעת תור**: הודעה ללקוח ולספר על תור חדש
- **ביטול תור**: הודעה ללקוח ולספר על ביטול תור
- **יום חופש**: הודעה לכל הלקוחות על יום חופש של הספר
- **תזכורות תורים**: הודעות תזכורת 24 שעות לפני התור

### הודעות מותאמות אישית
- שליחת הודעות למשתמשים ספציפיים
- שליחת הודעות לכל הספרים
- שליחת הודעות לכל הלקוחות

## API Endpoints

### משתמשים

#### `POST /users/push-token`
עדכון push token של המשתמש

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Body:**
```json
{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "platform": "ios" // או "android"
}
```

**Response:**
```json
{
  "message": "Push token updated successfully",
  "user": {
    "_id": "...",
    "email": "...",
    "pushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    "platform": "ios"
  }
}
```

### הודעות (Admin Only)

#### `POST /notifications/reminders`
שליחת תזכורות תורים למחר

**Headers:**
```
Authorization: Bearer <admin_access_token>
```

**Response:**
```json
{
  "message": "Appointment reminders sent",
  "totalAppointments": 5,
  "successCount": 4,
  "failedCount": 1,
  "date": "2024-01-15"
}
```

#### `POST /notifications/custom`
שליחת הודעה מותאמת אישית

**Headers:**
```
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

**Body:**
```json
{
  "userIds": ["user_id_1", "user_id_2"],
  "title": "כותרת ההודעה",
  "body": "תוכן ההודעה",
  "data": {
    "customField": "value"
  }
}
```

#### `POST /notifications/barbers`
שליחת הודעה לכל הספרים

**Headers:**
```
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

**Body:**
```json
{
  "title": "כותרת ההודעה",
  "body": "תוכן ההודעה",
  "data": {
    "type": "announcement"
  }
}
```

#### `POST /notifications/customers`
שליחת הודעה לכל הלקוחות

**Headers:**
```
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

**Body:**
```json
{
  "title": "כותרת ההודעה",
  "body": "תוכן ההודעה",
  "data": {
    "type": "promotion"
  }
}
```

#### `POST /notifications/cleanup-tokens`
ניקוי טוקנים לא תקינים

**Headers:**
```
Authorization: Bearer <admin_access_token>
```

## שימוש בפרונט

### רישום לקבלת הודעות

```javascript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

// רישום לקבלת הודעות
async function registerForPushNotifications() {
    let token;
    
    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        
        if (finalStatus !== 'granted') {
            console.log('Failed to get push token!');
            return;
        }
        
        token = (await Notifications.getExpoPushTokenAsync()).data;
        
        // שליחת הטוקן לבקנד
        await fetch(`${API_BASE_URL}/users/push-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                token: token,
                platform: Platform.OS
            })
        });
    }
    
    return token;
}
```

### הגדרת מאזינים להודעות

```javascript
// מאזין להודעות נכנסות
const notificationListener = Notifications.addNotificationReceivedListener(notification => {
    console.log('Notification received:', notification);
    // טיפול בהודעה
});

// מאזין ללחיצה על הודעה
const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
    console.log('Notification response:', response);
    // ניווט לפי סוג ההודעה
    const data = response.notification.request.content.data;
    if (data.type === 'appointment_confirmation') {
        // ניווט לעמוד התורים
    }
});

// ניקוי מאזינים
return () => {
    Notifications.removeNotificationSubscription(notificationListener);
    Notifications.removeNotificationSubscription(responseListener);
};
```

## סוגי הודעות

### הודעות תורים
- `appointment_confirmation` - אישור קביעת תור
- `appointment_cancellation` - ביטול תור
- `appointment_update` - עדכון תור
- `appointment_reminder` - תזכורת תור

### הודעות ספר
- `new_appointment` - תור חדש לספר
- `barber_day_off` - יום חופש של הספר

## הגדרות Android

עבור Android, המערכת יוצרת ערוץ התראות מותאם אישית:

```javascript
await Notifications.setNotificationChannelAsync('barbershop-notifications', {
    name: 'התראות הספר',
    description: 'התראות על תורים ופעילויות במספרה',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#3b82f6',
    sound: 'default',
    enableLights: true,
    enableVibrate: true,
});
```

## טיפול בשגיאות

המערכת מטפלת בשגיאות באופן הבא:

1. **טוקן לא תקין**: המערכת מזהה ומסירה טוקנים לא תקינים
2. **שליחה נכשלת**: המערכת ממשיכה לפעול גם אם שליחת הודעה נכשלת
3. **לוגים**: כל הפעולות נרשמות בקונסול לצורך דיבוג

## תחזוקה

### ניקוי טוקנים
מומלץ להריץ את endpoint הניקוי באופן קבוע:

```bash
curl -X POST http://localhost:3000/notifications/cleanup-tokens \
  -H "Authorization: Bearer <admin_token>"
```

### שליחת תזכורות
מומלץ להגדיר cron job לשליחת תזכורות יומיות:

```bash
# כל יום ב-09:00
0 9 * * * curl -X POST http://localhost:3000/notifications/reminders \
  -H "Authorization: Bearer <admin_token>"
```

## דרישות מערכת

- Node.js 16+
- MongoDB
- Expo SDK 49+
- React Native 0.72+

## התקנה

1. התקנת התלויות:
```bash
npm install expo-server-sdk
```

2. הגדרת משתני סביבה:
```env
# אין צורך בהגדרות נוספות עבור push notifications
```

3. הפעלת השרת:
```bash
npm run dev
```

## הערות חשובות

1. **אבטחה**: כל ה-endpoints של הודעות דורשים הרשאות admin
2. **ביצועים**: שליחת הודעות למספר רב של משתמשים יכולה לקחת זמן
3. **תקינות**: המערכת בודקת תקינות טוקנים לפני שליחה
4. **לוגים**: כל הפעולות נרשמות לצורך מעקב ודיבוג

