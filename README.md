# Aidin - AI-Powered Helpdesk

![Aidin Logo](public/images/aidin-logo.png)

**Aidin Helpdesk** is an intelligent IT support ticket management system with AI-powered automation, designed to streamline helpdesk operations and enhance user experience.

## Features

- **AI-Powered Responses**: Automated ticket responses using OpenAI integration
- **Hierarchical Ticket Views**: Organize tickets by agent with drag-and-drop functionality
- **Role-Based Access Control**: Admin, Agent, and User roles with appropriate permissions
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
- **Agent**: agent@surterreproperties.com / admin123
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