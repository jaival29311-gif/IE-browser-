const http = require('http');

// Use playwright-extra instead of standard playwright
const { chromium } = require('playwright-extra');
// Add the stealth plugin
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let targetUrl = url.searchParams.get('url');
    const action = url.searchParams.get('action') || 'open';
    
    if (req.url === '/') {
        res.writeHead(200);
        return res.end('Server is running');
    }

    if (!targetUrl) {
        res.writeHead(400);
        return res.end('Missing URL');
    }

    let browser;
    try {
        browser = await chromium.launch({ 
            headless: true,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--single-process',
                '--no-zygote',
                '--disable-gpu'
            ]
        });
        
        // Mobile Disguise
        const context = await browser.newContext({
            viewport: { width: 360, height: 640 },
            userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            isMobile: true, hasTouch: true, deviceScaleFactor: 1,
            locale: 'en-US',
            timezoneId: 'America/New_York'
        });
        
        const page = await context.newPage();

        await page.route('**/*', (route) => {
            const reqUrl = route.request().url().toLowerCase();
            if (reqUrl.includes('doubleclick.net') || reqUrl.includes('googleadservices.com')) {
                return route.abort();
            }
            return route.continue();
        });

        // GOOGLE SEARCH TRICK: If it's a Google search, append the Android client parameter
        if (targetUrl.includes('google.com/search')) {
            // Adding &client=ms-android-google tells Google it's the official Android App
            if (!targetUrl.includes('&client=')) {
                targetUrl += '&client=ms-android-google';
            }
        }

        await page.goto(targetUrl, { waitUntil: 'load', timeout: 20000 }).catch(() => {});

        if (action === 'tap') {
            const x = parseInt(url.searchParams.get('x') || '0');
            const y = parseInt(url.searchParams.get('y') || '0');
            await page.mouse.click(x, y);
            await page.waitForTimeout(1500);
        } else if (action === 'scroll') {
            const dy = parseInt(url.searchParams.get('dy') || '300');
            await page.mouse.wheel(0, dy);
            await page.waitForTimeout(1000);
        } else {
            await page.waitForTimeout(2500); 
        }

        const currentUrl = page.url();
        const screenshot = await page.screenshot({ type: 'jpeg', quality: 60 });
        
        res.writeHead(200, { 
            'Content-Type': 'image/jpeg',
            'X-Current-Url': currentUrl 
        });
        res.end(screenshot);

    } catch (error) {
        console.error(error);
        res.writeHead(500);
        res.end('Error: ' + error.message);
    } finally {
        if (browser) await browser.close();
    }
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
