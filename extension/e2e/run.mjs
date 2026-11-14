import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const root=fileURLToPath(new URL('../', import.meta.url));
execFileSync(process.execPath,[join(root,'node_modules/wxt/bin/wxt.mjs'),'build'],{cwd:root,env:{...process.env,SLC_E2E:'1'},stdio:'pipe'});
const extension=resolve(root,'.output-e2e/chrome-mv3');
const profile=await mkdtemp(join(tmpdir(),'ayr-extension-test-'));
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Extension test</title><iframe srcdoc="<!doctype html><p>frame</p>"></iframe>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try {
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||puppeteer.executablePath(),headless:true,pipe:true,userDataDir:profile,enableExtensions:[extension]});
  const target=await browser.waitForTarget(t=>t.type()==='service_worker'&&t.url().startsWith('chrome-extension://'));
  const worker=await target.worker();
  const url=`http://127.0.0.1:${server.address().port}/`;
  const page=await browser.newPage();
  await page.goto(url);
  const probe=()=>({zone:Intl.DateTimeFormat().resolvedOptions().timeZone,language:navigator.language,locale:Intl.NumberFormat().resolvedOptions().locale,offset:new Date('2026-01-15T12:00:00Z').getTimezoneOffset()});
  const baseline=await page.evaluate(probe);
  const settings={enabled:true,timezone:true,timezoneOffset:true,language:true,intlLocale:true,fonts:true,webrtc:true,uaPreset:'native',timeZoneId:'Europe/Stockholm',languageTag:'en-US',sites:[{host:'127.0.0.1',includeSubdomains:false}]};
  await worker.evaluate(async settings=>chrome.storage.local.set({'slc-settings':settings}),settings);
  await page.waitForFunction(async()=>{const scripts=await fetch('/');return Boolean(scripts)}, {timeout:5000});
  const deadline=Date.now()+10000;
  while(true){const ready=await worker.evaluate(async()=>{const scripts=await chrome.scripting.getRegisteredContentScripts();return scripts.length>0});if(ready)break;if(Date.now()>deadline)throw new Error('script registration timeout');await new Promise(r=>setTimeout(r,100));}
  await page.reload();
  const active=await page.evaluate(probe);
  assert.equal(active.zone,'Europe/Stockholm');assert.equal(active.language,'en-US');assert.equal(active.offset,-60);
  const frame=page.frames().find(f=>f!==page.mainFrame());
  assert.equal((await frame.evaluate(probe)).zone,'Europe/Stockholm');
  await worker.evaluate(async settings=>chrome.storage.local.set({'slc-settings':{...settings,enabled:false}}),settings);
  const restoreDeadline=Date.now()+10000;
  while(await worker.evaluate(async()=>(await chrome.scripting.getRegisteredContentScripts()).length)){if(Date.now()>restoreDeadline)throw new Error('restore timeout');await new Promise(r=>setTimeout(r,100));}
  await page.reload();
  assert.deepEqual(await page.evaluate(probe),baseline);
  assert.equal((await worker.evaluate(async()=>chrome.declarativeNetRequest.getDynamicRules())).length,0);
  console.log('PASS: selected-site injection, Stockholm zone and UTC offset, language, srcdoc iframe, restoration, DNR cleanup');
} catch(error) { console.error(error); process.exitCode=1; } finally {
  await browser?.close();
  await new Promise(r=>server.close(r));
  const checked=resolve(profile);
  if(!checked.startsWith(resolve(tmpdir())+'\\')&&!checked.startsWith(resolve(tmpdir())+'/'))throw new Error('Unsafe cleanup path');
  await rm(checked,{recursive:true,force:true,maxRetries:10,retryDelay:300}).catch(error=>console.warn('Temporary profile cleanup:',error.code));
}
