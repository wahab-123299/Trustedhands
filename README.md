# TrustedHand - Nigerian Marketplace Platform

TrustedHand is a full-stack marketplace platform connecting verified skilled workers (artisans) with homeowners, organizations, and estate managers in Nigeria.

## Features

### User System (Role-Based)
- **Customer**: Browse artisans, post jobs, book services, make payments, chat with artisans, leave reviews
- **Artisan**: Create profile, showcase skills, set availability, accept jobs, receive payments, chat with customers, manage bookings

### Authentication System
- JWT access tokens (15 min) + refresh tokens (7 days)
- bcrypt password hashing (12 salt rounds)
- Protected routes middleware with role checking
- Email verification on registration
- Password reset via secure token

### Payment System (Paystack Integration)
- Customer pays for Job (Escrow-style)
- Direct Payment for quick jobs
- Platform commission: 10% per transaction
- Wallet system for artisans
- Withdrawal to bank accounts

### Real-Time Chat System (Socket.io)
- One-on-one chat between customer and artisan
- Real-time message delivery
- Message read receipts
- Typing indicators
- Online/offline status
- Chat history persisted in MongoDB

## Tech Stack

### Backend
- Node.js + Express
- MongoDB + Mongoose
- Socket.io for real-time chat
- Paystack API for payments
- JWT for authentication
- bcrypt for password hashing
- Cloudinary for image uploads
- Nodemailer for emails

### Frontend
- React + TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- shadcn/ui components
- React Router for routing
- Axios for API calls
- Socket.io-client for real-time features
- React Paystack for payments

## Project Structure

```
trustedhand/
├── backend/
│   ├── config/           # Database configuration
│   ├── controllers/      # Route controllers
│   ├── middleware/       # Express middleware
│   ├── models/           # Mongoose models
│   ├── routes/           # API routes
│   ├── socket/           # Socket.io handlers
│   ├── utils/            # Utility functions
│   ├── .env.example      # Environment variables template
│   ├── app.js            # Express app setup
│   ├── package.json      # Backend dependencies
│   └── server.js         # Server entry point
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── contexts/     # React contexts
│   │   ├── hooks/        # Custom hooks
│   │   ├── lib/          # Utility functions
│   │   ├── pages/        # Page components
│   │   ├── services/     # API services
│   │   ├── types/        # TypeScript types
│   │   ├── App.tsx       # Main App component
│   │   ├── index.css     # Global styles
│   │   └── main.tsx      # Entry point
│   ├── index.html        # HTML template
│   ├── package.json      # Frontend dependencies
│   ├── tailwind.config.js # Tailwind configuration
│   ├── tsconfig.json     # TypeScript configuration
│   └── vite.config.ts    # Vite configuration
└── README.md
```

## Setup Instructions

### Prerequisites
- Node.js 18+ 
- MongoDB Atlas account
- Paystack account (for payments)
- Cloudinary account (for image uploads)

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

4. Update the `.env` file with your credentials:
```env
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret_min_32_chars
JWT_REFRESH_SECRET=your_refresh_secret_min_32_chars
PAYSTACK_SECRET_KEY=your_paystack_secret_key
PAYSTACK_PUBLIC_KEY=your_paystack_public_key
PAYSTACK_WEBHOOK_SECRET=your_webhook_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASS=your_app_password
```

5. Start the development server:
```bash
npm run dev
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file:
```bash
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_PAYSTACK_PUBLIC_KEY=your_paystack_public_key
```

4. Start the development server:
```bash
npm run dev
```

## API Documentation

### Authentication Routes
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/verify-email/:token` - Verify email
- `POST /api/auth/resend-verification` - Resend verification email
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password/:token` - Reset password

### User Routes
- `GET /api/users/me` - Get current user
- `PUT /api/users/me` - Update user profile
- `PUT /api/users/location` - Update location
- `PUT /api/users/profile-image` - Update profile image
- `DELETE /api/users/me` - Delete account
- `GET /api/users/:id` - Get user by ID

### Artisan Routes
- `GET /api/artisans` - List artisans with filters
- `GET /api/artisans/search` - Search artisans
- `GET /api/artisans/nearby` - Find nearby artisans
- `GET /api/artisans/:id` - Get artisan details
- `GET /api/artisans/:id/reviews` - Get artisan reviews
- `PUT /api/artisans/profile` - Update artisan profile
- `PUT /api/artisans/availability` - Update availability
- `PUT /api/artisans/bank-details` - Update bank details
- `POST /api/artisans/portfolio-images` - Upload portfolio images

### Job Routes
- `POST /api/jobs` - Create job (customer)
- `GET /api/jobs` - Get my jobs
- `GET /api/jobs/all` - Get all jobs (public)
- `GET /api/jobs/:id` - Get job details
- `PUT /api/jobs/:id/accept` - Accept job (artisan)
- `PUT /api/jobs/:id/start` - Start job (artisan)
- `PUT /api/jobs/:id/complete` - Complete job (artisan)
- `PUT /api/jobs/:id/confirm-completion` - Confirm completion (customer)
- `PUT /api/jobs/:id/cancel` - Cancel job
- `POST /api/jobs/:id/review` - Add review (customer)
- `POST /api/jobs/:id/apply` - Apply for job (artisan)

### Payment Routes
- `POST /api/payments/initialize` - Initialize payment
- `GET /api/payments/verify/:reference` - Verify payment
- `POST /api/payments/webhook` - Paystack webhook
- `GET /api/payments/history` - Get transaction history
- `GET /api/payments/wallet` - Get wallet balance
- `POST /api/payments/withdraw` - Request withdrawal
- `GET /api/payments/banks` - Get bank list
- `POST /api/payments/verify-account` - Verify bank account

### Chat Routes
- `GET /api/chat/conversations` - Get conversations
- `POST /api/chat/conversations` - Create conversation
- `GET /api/chat/conversations/:id/messages` - Get messages
- `POST /api/chat/conversations/:id/messages` - Send message
- `PUT /api/chat/conversations/:id/read` - Mark as read
- `DELETE /api/chat/conversations/:id` - Delete conversation
- `GET /api/chat/unread-count` - Get unread count

## Environment Variables

### Backend
| Variable | Description |
|----------|-------------|
| `NODE_ENV` | Environment (development/production) |
| `PORT` | Server port |
| `FRONTEND_URL` | Frontend URL for CORS |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | JWT signing secret |
| `JWT_REFRESH_SECRET` | JWT refresh token secret |
| `PAYSTACK_SECRET_KEY` | Paystack secret key |
| `PAYSTACK_PUBLIC_KEY` | Paystack public key |
| `PAYSTACK_WEBHOOK_SECRET` | Paystack webhook secret |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |

### Frontend
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL |
| `VITE_SOCKET_URL` | Socket.io server URL |
| `VITE_PAYSTACK_PUBLIC_KEY` | Paystack public key |

## Deployment

### Backend (Render/Railway/Heroku)
1. Push code to GitHub
2. Connect repository to deployment platform
3. Set environment variables
4. Deploy

### Frontend (Netlify/Vercel)
1. Build the project: `npm run build`
2. Deploy the `dist` folder
3. Set environment variables
4. Configure redirect rules for SPA

## Security Features

- Helmet.js for security headers
- CORS properly configured
- Rate limiting (100 requests per 15 minutes)
- express-mongo-sanitize for NoSQL injection prevention
- xss-clean for XSS prevention
- hpp for HTTP Parameter Pollution prevention
- bcrypt password hashing (12 salt rounds)
- JWT with short expiry (15 min access, 7 days refresh)
- File upload validation and size limits
- Paystack webhook signature verification

## License

MIT License

## Support

For support, email support@trustedhand.com or join our Slack channel.
