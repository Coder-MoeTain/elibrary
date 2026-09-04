const OpenAI = require('openai');
const AppError = require('../utils/AppError');
const { HTTP_STATUS } = require('../constants');

/** Singleton — created before pdf-parse/pdfjs can polyfill browser globals in Node. */
let openAiClient = null;

function getOpenAiClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new AppError('OPENAI_API_KEY is missing in environment variables', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
  if (!openAiClient) {
    openAiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 600000,
      maxRetries: 2,
      // Server-only module. pdfjs (via pdf-parse) may set window/document on globalThis in Node.
      dangerouslyAllowBrowser: true,
    });
  }
  return openAiClient;
}

module.exports = {
  getOpenAiClient,
};
