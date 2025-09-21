// Simple database seeding script
const seedData = {
  users: [
    {
      email: 'admin@surterreproperties.com',
      password: 'admin123',
      firstName: 'System',
      lastName: 'Administrator',
      roles: ['Admin'],
      org: 'Surterre Properties'
    },
    {
      email: 'agent@surterreproperties.com',
      password: 'admin123',
      firstName: 'John',
      lastName: 'Agent',
      roles: ['Agent'],
      org: 'Surterre Properties'
    },
    {
      email: 'user@surterreproperties.com',
      password: 'admin123',
      firstName: 'Jane',
      lastName: 'Smith',
      roles: ['Requester'],
      org: 'Surterre Properties'
    }
  ],
  tickets: [
    {
      title: 'Cannot access email account',
      description: 'I am unable to access my email account since this morning. Getting authentication errors when trying to log in. I have tried resetting my password but the issue persists.',
      status: 'OPEN',
      priority: 'HIGH',
      category: 'Account Access',
      requester: 'user@surterreproperties.com',
      assignee: 'agent@surterreproperties.com'
    },
    {
      title: 'Printer not working in Office 201',
      description: 'The printer in Office 201 is showing error code E-5-2. It was working fine yesterday but today it won\'t print anything. Multiple people have tried printing but all jobs are stuck in the queue.',
      status: 'NEW',
      priority: 'NORMAL',
      category: 'Hardware Problem',
      requester: 'user@surterreproperties.com'
    },
    {
      title: 'Request for software installation',
      description: 'I need Adobe Photoshop installed on my workstation for the marketing project. Please let me know the process and timeline for software installation requests.',
      status: 'PENDING',
      priority: 'LOW',
      category: 'Feature Request',
      requester: 'user@surterreproperties.com',
      assignee: 'agent@surterreproperties.com'
    },
    {
      title: 'VPN connection issues',
      description: 'I cannot connect to the company VPN from home. The connection times out after attempting to connect. This is blocking me from accessing internal resources for remote work.',
      status: 'NEW',
      priority: 'HIGH',
      category: 'Network Issue',
      requester: 'user@surterreproperties.com'
    },
    {
      title: 'Laptop running very slowly',
      description: 'My laptop has been running extremely slowly for the past week. Applications take forever to load and the system often freezes. I have tried restarting multiple times but the issue persists.',
      status: 'SOLVED',
      priority: 'NORMAL',
      category: 'Technical Issue',
      requester: 'user@surterreproperties.com',
      assignee: 'agent@surterreproperties.com'
    }
  ]
}

// Export for manual API seeding
if (typeof module !== 'undefined' && module.exports) {
  module.exports = seedData
}

// Browser-friendly version
if (typeof window !== 'undefined') {
  window.seedData = seedData
}

console.log('Seed data structure:', JSON.stringify(seedData, null, 2))