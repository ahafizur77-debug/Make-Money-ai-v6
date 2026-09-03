MoneyMind AI Final V6
What is real in this code
Account registration/login with bcrypt password hashing and JWT tokens
9-agent planner and plan history
JSON persistence for demos
Notifications and audit APIs
Razorpay order creation + server-side signature verification when Razorpay credentials are configured
Twilio SMS sending when Twilio credentials are configured
Resend email sending when Resend credentials are configured
Provider-configurable KYC request flow
Firebase push integration boundary + stored notifications
Admin statistics/audit APIs
Helmet, CORS and rate limiting
Render Blueprint and mobile UI
Important production truth
A "real" integration still requires the owner's verified provider accounts, credentials, compliance, webhook configuration and testing. This project never fakes payment success, KYC approval, SMS delivery, email delivery or push delivery.
Run locally
npm install
cp .env.example .env
npm start
Open http://localhost:3000.
Required provider configuration
Razorpay
Set:
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
Use /api/payment/order and /api/payment/verify.
KYC
Choose a legally appropriate KYC provider for your country and set:
KYC_PROVIDER_URL
KYC_PROVIDER_API_KEY
The provider endpoint must be your verified provider's documented API.
Twilio SMS
Set:
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
Resend Email
Set:
RESEND_API_KEY
EMAIL_FROM
Push
For production device delivery, add Firebase Admin/service-account server credentials and implement OAuth-based FCM sending. V6 deliberately does not claim a notification was delivered unless the provider confirms delivery.
PostgreSQL
V6 includes DATABASE_URL as the production configuration contract. Before a public production launch, replace the JSON demo adapter with migrations/queries or a production ORM and run backups. The JSON fallback is not suitable for multi-instance production.
Render
Create a Node Web Service:
Build command: npm install
Start command: npm start
Health check: /api/health
Add secrets in Render Environment settings. Never commit .env.
Admin
Register normally, then promote a verified owner account in the production database before using:
/api/admin/stats
/api/admin/audit
Security and compliance
Do not store raw card data. Use payment-provider checkout/tokenization. KYC, tax, privacy, consumer protection, messaging consent and data-retention requirements depend on jurisdiction and must be completed before public launch.
MoneyMind AI never guarantees earnings and must not fabricate jobs, customers, payments, reviews or market data.
