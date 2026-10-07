/**
 * Normalize category names for duplicate detection.
 * "Cyber Security", "Cybersecurity", "cyber-security" → same key.
 * Keeps Latin alphanumerics and Myanmar letters.
 */
function categoryKey(name) {
  return String(name || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u1000-\u109f]+/g, '');
}

module.exports = { categoryKey };
