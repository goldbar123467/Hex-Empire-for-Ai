const {defineConfig}=require('@playwright/test');
const path=require('node:path');
module.exports=defineConfig({
 testDir:'./ui-tests',timeout:120000,workers:1,retries:0,forbidOnly:!!process.env.CI,
 outputDir:'test-results/browser',reporter:'list',
 use:{baseURL:'http://127.0.0.1:3002',viewport:{width:1360,height:1000},headless:true,actionTimeout:10000,
  launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{},
  screenshot:'only-on-failure',trace:'retain-on-failure'},
 webServer:{command:'node server.js',url:'http://127.0.0.1:3002/api/version',reuseExistingServer:false,
  env:{PORT:'3002',HEX_LOG_DIR:path.resolve('test-results/browser-logs')}}
});
