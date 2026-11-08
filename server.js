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
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--single-process',
                '--no-zygote',
                '--disable-gpu'
            ]
        });
        
        const context = await browser.newContext({
            viewport: { width: 360, height: 640 },
            // THE MAGIC TRICK: Pretending to be the official Google App!
            userAgent: 'GoogleApp/14.30.13.26.arm64 (Linux; U; Android 13; en_US; Pixel 7; Build/TQ3A.230805.001; Cronet/117.0.5938.60)',
            isMobile: true, hasTouch: true, deviceScaleFactor: 1,
            locale: 'en-US',
            extraHTTPHeaders: {
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });
        
        const page = await context.newPage();

        // Load the page
        await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});

        // Wait 3 seconds for Google to render the results
        await page.waitForTimeout(3000); 

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
