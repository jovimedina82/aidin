// Test setup file
// Set up test environment variables

process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db'
process.env.APP_BASE_URL = 'http://localhost:3000'
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret'
