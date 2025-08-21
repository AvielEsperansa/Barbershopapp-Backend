# 🪒 Barbershop Appointment API

Backend API for a modern barbershop appointment booking system with AI-powered haircut try-on features.

## ✨ Features

- **User Management**: Registration, login, and profile management
- **Appointment Booking**: Smart scheduling with conflict detection
- **Service Management**: Dynamic service catalog with pricing
- **Barber Management**: Working hours and availability tracking
- **Role-based Access**: Customer, Barber, and Admin roles
- **JWT Authentication**: Secure API access
- **MongoDB Integration**: Scalable data storage

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- MongoDB (local or Atlas)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd Backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/barbershop
   JWT_SECRET=your-super-secret-jwt-key
   PORT=4000
   CLIENT_ORIGIN=http://localhost:3000
   NODE_ENV=development
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

5. **Build for Production**
   ```bash
   npm run build
   npm start
   ```

## 📚 API Endpoints

### Authentication
- `POST /api/users/register` - User registration
- `POST /api/users/login` - User login
- `GET /api/users/profile` - Get user profile (protected)
- `PUT /api/users/profile` - Update user profile (protected)

### Appointments
- `POST /api/appointments` - Create new appointment (protected)
- `GET /api/appointments/slots` - Get available time slots (protected)
- `GET /api/appointments/my-appointments` - Get user appointments (protected)
- `PUT /api/appointments/:id/status` - Update appointment status (protected)
- `DELETE /api/appointments/:id` - Cancel appointment (protected)

### Services
- `GET /api/services` - Get all services
- `POST /api/services` - Create new service (admin only)
- `PUT /api/services/:id` - Update service (admin only)
- `DELETE /api/services/:id` - Delete service (admin only)

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## 🗄️ Database Models

### User
- Customer, Barber, and Admin roles
- Profile information and authentication
- Active/inactive status

### Service
- Service name, description, and pricing
- Duration and category classification
- Active/inactive status

### Appointment
- Customer, barber, and service references
- Date, time, and status tracking
- Conflict detection and validation

### WorkingHours
- Barber availability by day of week
- Start/end times and break periods
- Working day configuration

## 🛠️ Development

### Project Structure
```
src/
├── controllers/     # Business logic
├── middleware/      # Authentication & validation
├── models/         # Database schemas
├── routes/         # API endpoints
├── db.ts          # Database connection
├── env.ts         # Environment configuration
└── index.ts       # Main application
```

### Scripts
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server

## 🔧 Configuration

### Environment Variables
- `MONGO_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `PORT` - Server port (default: 4000)
- `CLIENT_ORIGIN` - Allowed CORS origin
- `NODE_ENV` - Environment (development/production)

### MongoDB Atlas Setup
1. Create a MongoDB Atlas account
2. Create a new cluster
3. Add your IP to Network Access
4. Create a database user
5. Get your connection string
6. Update `.env` file

## 🚨 Security Features

- Password hashing with bcrypt
- JWT token authentication
- Role-based access control
- Input validation and sanitization
- CORS configuration
- Environment variable protection

## 📱 Frontend Integration

The API is designed to work with modern frontend frameworks:
- React/Vue/Angular
- Mobile apps (React Native, Flutter)
- Desktop applications

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the API documentation
- Review the code examples

---

**Happy Coding! 🎉**
