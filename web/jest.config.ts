import nextJest from 'next/jest'

const createJestConfig = nextJest({
  // Path to Next.js app to load next.config.ts and .env files
  dir: './',
})

// Custom configurations
const config = {
  coverageProvider: 'v8',
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
}

export default createJestConfig(config)
