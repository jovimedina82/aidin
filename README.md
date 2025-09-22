# AIDIN Helpdesk System

A comprehensive, AI-powered helpdesk system built with Next.js, Prisma, and modern web technologies.

## Features

- 🎫 **Ticket Management**: Complete ticket lifecycle management with status tracking
- 👥 **User Management**: Role-based access control with admin and staff roles
- 🤖 **AI Integration**: Automated ticket categorization and response generation
- 📊 **Analytics & Reporting**: Comprehensive dashboards and report generation
- 🔐 **Authentication**: Secure JWT-based auth with optional Azure SSO
- 📱 **Responsive Design**: Modern, mobile-friendly interface
- 🏢 **Organization Chart**: Visual representation of company hierarchy
- 📧 **Email Integration**: Automated notifications and updates

## Tech Stack

- **Frontend**: Next.js 14, React 18, TailwindCSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: SQLite (dev), PostgreSQL (production ready)
- **Authentication**: JWT, Azure AD (optional)
- **AI**: OpenAI API integration
- **UI Components**: Radix UI, Lucide Icons

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd helpdesk-project
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` with your configuration values.

4. **Set up the database**
   ```bash
   npm run db:push
   npm run db:seed
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Default Login Credentials

- **Admin**: admin@surterreproperties.com / password
- **Staff**: amendez@surterreproperties.com / password
- **Client**: client@surterreproperties.com / password

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:seed` - Seed database with test data
- `npm run db:studio` - Open Prisma Studio
- `npm run db:reset` - Reset database and reseed
- `npm run clean` - Clean build artifacts

## Features

- **AI-Powered Responses**: Automated ticket responses using OpenAI integration
- **Hierarchical Ticket Views**: Organize tickets by staff with drag-and-drop functionality
- **Role-Based Access Control**: Admin, Staff, and User roles with appropriate permissions
- **Azure AD Integration**: Single Sign-On support with Microsoft Azure AD
- **Real-Time Statistics**: Live dashboard with effectiveness metrics
- **Weekly Reporting**: Automated weekly statistics storage for historical reporting
- **Automatic Assignment**: Unassigned tickets are automatically assigned when status changes
- **Status Management**: Complete ticket lifecycle from NEW to CLOSED
- **Comment System**: Internal and public comments with user notifications
- **Responsive Design**: Mobile-friendly interface with modern UI components

## Technology Stack

- **Frontend**: Next.js 14.2.3 with React 18
- **Backend**: Next.js API Routes
- **Database**: SQLite with Prisma ORM
- **Authentication**: JWT with Azure AD SSO support
- **AI Integration**: OpenAI API for automated responses
- **Styling**: Tailwind CSS with shadcn/ui components
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd helpdesk-project
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Initialize the database:
```bash
npx prisma migrate dev
npm run seed
```

5. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Default Test Accounts

After running the seed script, these test accounts are available:

- **Admin**: admin@surterreproperties.com / admin123
- **Staff**: staff@surterreproperties.com / admin123
- **User**: user@surterreproperties.com / admin123

## Key Features

### Intelligent Ticket Management
- Automatic ticket categorization and priority assignment
- AI-powered initial responses to common issues
- Hierarchical views organized by assigned agents

### User-Friendly Interface
- Modern, responsive design
- Drag-and-drop ticket organization
- Real-time status updates
- Mobile-optimized interface

### Advanced Analytics
- Weekly effectiveness reporting
- Historical statistics storage
- Performance metrics dashboard
- Automated report generation

### Security & Access Control
- Role-based permissions
- Azure AD single sign-on
- Secure JWT authentication
- Data encryption and protection

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── tickets/           # Ticket management pages
│   └── layout.js          # Root layout
├── components/            # Reusable UI components
├── lib/                   # Utility libraries
│   ├── auth.js           # Authentication logic
│   ├── email.js          # Email notifications
│   └── openai.js         # AI integration
├── prisma/               # Database schema and migrations
├── public/               # Static assets including logos
└── styles/              # Global styles
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is proprietary software developed for Surterre Properties.

---

**AIDEN** - Intelligent Assistance, Delivered Efficiently Now