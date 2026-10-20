process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/unused';
process.env.JWT_SECRET = 'test-secret-that-is-long-enough';
process.env.KPI_CACHE_TTL_SECONDS = '60';
process.env.ASK_RATE_LIMIT_PER_MIN = '5';
process.env.RATE_LIMIT_PER_15_MIN = '1000';
delete process.env.GEMINI_API_KEY;
