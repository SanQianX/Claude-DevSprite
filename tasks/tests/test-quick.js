const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({headless:true});
  const p = await b.newPage();
  await p.goto('http://127.0.0.1:38888/settings', {timeout:10000});
  await p.waitForTimeout(2000);
  const sv = await p.$('.settings-view, [class*="settings"]');
  console.log('Settings:', !!sv);
  const inputs = await p.$$('input, select, textarea');
  console.log('Form elements:', inputs.length);
  await b.close();
})().catch(e => console.error(e.message));
