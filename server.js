const http = require('http');
const { chromium } = require('playwright');

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const targetUrl = url.searchParams.get('url');
    
    // Health check
    if (req.url === '/') {
        res.writeHead(200);
        return res.end('Fast Explorer Cloud is running!');
    }

    if (!targetUrl) {
        res.writeHead(400);
        return res.end('Please provide a valid ?url=');
    }

    let browser;
    try {
        // Added flags to prevent crashes on low-memory servers
        browser = await chromium.launch({ 
            headless: true,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--single-process',
                '--no-zygote'
            ] 
        });
        const page = await browser.newPage({ viewport: { width: 360, height: 640 } });

        // Ad blocker
        await page.route('**/*', (route) => {
            const reqUrl = route.request().url().toLowerCase();
            if (reqUrl.match(/.*(ads|banners|analytics|trackers|pixel|beacon|doubleclick).*/)) {
                return route.abort();
            }
            return route.continue();
        });

        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(1500);

        const screenshot = await page.screenshot({ type: 'jpeg', quality: 50 });
        
        // Log success to Render dashboard
        console.log(`Successfully captured ${targetUrl}`);
        
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(screenshot);

    } catch (error) {
        console.error("CRASH ERROR:", error.message);
        res.writeHead(500);
        res.end('Server error: ' + error.message);
    } finally {
        if (browser) await browser.close();
    }
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
