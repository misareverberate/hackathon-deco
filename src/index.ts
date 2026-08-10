import { CrawlerPipeline } from './crawler/crawler.js';

const crawler = new CrawlerPipeline();

const url = process.argv[2] || 'https://example.com';

crawler.crawl(url)
  .then((snapshot) => {
    console.log(JSON.stringify(snapshot, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
