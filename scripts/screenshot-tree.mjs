import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4ZjE5ZjQ0Zi0zZWYzLTQwZTctODNhZi00NWYxNThmYjI2NGIiLCJlbWFpbCI6InRlc3QtdWlAZXhhbXBsZS5jb20iLCJyb2xlIjoiVVNFUiIsImlhdCI6MTc4MTMzMjAzNCwiZXhwIjoxNzgxOTM2ODM0fQ.NX3o6n-uVvwUkUMjYSpn4vkqDbaXmGrRbQsPQzvWNG4';
await page.context().addCookies([{
  name: 'skill-token',
  value: token,
  domain: 'localhost',
  path: '/',
  httpOnly: false,
  secure: false,
  sameSite: 'Lax',
}]);

await page.goto('http://localhost:3001/skills/fae94b32-352a-49da-85f5-5cbd45def18c/tree');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'D:/MGit-Projects/cogni-tree/tmp-tree-screenshot.png', fullPage: false });
await browser.close();
console.log('Screenshot saved');
