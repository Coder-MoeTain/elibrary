#!/bin/bash
set -euo pipefail
cd /var/www/elibrary
echo '=== book resolveSort ==='
sed -n '104,112p' services/book.service.js
echo '=== ebook orders ==='
grep -n "eBooksId" services/ebook.service.js | head -20
echo '=== pm2 ==='
pm2 status elibrary
echo '=== live samples ==='
node <<'NODE'
require('dotenv').config();
const bookService = require('./services/book.service');
const ebookService = require('./services/ebook.service');
(async () => {
  const books = await bookService.findPage({ page: 1, limit: 3 });
  console.log('books', books.data.map((b) => ({ id: b.bookId, name: String(b.bookName).slice(0,40) })));
  const booksAsc = await bookService.findPage({ page: 1, limit: 3, sortBy: 'bookId', sortDir: 'asc' });
  console.log('booksAscExplicit', booksAsc.data.map((b) => ({ id: b.bookId, name: String(b.bookName).slice(0,40) })));
  const ebooks = await ebookService.findPage({ page: 1, limit: 3, contentType: 'ebook' });
  console.log('ebooks', ebooks.data.map((e) => ({ id: e.eBooksId, name: String(e.eBookName).slice(0,40) })));
  const papers = await ebookService.findPage({ page: 1, limit: 3, contentType: 'paper' });
  console.log('papers', papers.data.map((e) => ({ id: e.eBooksId, name: String(e.eBookName).slice(0,40) })));
  await require('./models').sequelize.close();
})().catch(async (e) => { console.error(e); process.exit(1); });
NODE
