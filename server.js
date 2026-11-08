const http = require('http');
const { chromium } = require('playwright');

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const targetUrl = url.searchParams.get('url');
    
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
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process', '--no-zygote']
        });
        
        const context = await browser.newContext({
            viewport: { width: 360, height: 640 },
            userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            isMobile: true,
            hasTouch: true,
            deviceScaleFactor: 1
        });
        
        const page = await context.newPage();

        await page.route('**/*', (route) => {
            const reqUrl = route.request().url().toLowerCase();
            if (reqUrl.match(/.*(ads|banners|analytics|trackers|pixel|beacon|doubleclick).*/)) {
                return route.abort();
            }
            return route.continue();
        });

        // WAIT FOR FULL LOAD (30 seconds timeout, wait for network to be completely idle)
        await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
        
        // EXTRA PATIENCE: Wait 2 seconds to ensure animations/images are drawn
        await page.waitForTimeout(2000); 

        const screenshot = await page.screenshot({ type: 'jpeg', quality: 60 });
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
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
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
