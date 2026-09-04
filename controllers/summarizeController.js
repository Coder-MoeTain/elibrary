const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../helpers/response.helper');
const ebookService = require('../services/ebook.service');

/** Mobile-compatible summary endpoint — delegates to shared OpenAI + DB cache service. */
const summarizePDF = asyncHandler(async (req, res) => {
  const lang = req.query.lang;
  const cachedOnly = ['1', 'true', 'yes'].includes(String(req.query.cachedOnly ?? '').toLowerCase());
  const result = await ebookService.getOrGenerateSummary(req.params.id, {
    language: lang,
    cachedOnly,
  });
  return success(res, { data: result });
});

module.exports = {
  summarizePDF,
};
