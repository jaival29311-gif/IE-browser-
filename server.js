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
        // These flags force the browser to use minimum memory
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
        const page = await browser.newPage({ viewport: { width: 360, height: 640 } });

        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(1000);

        const screenshot = await page.screenshot({ type: 'jpeg', quality: 50 });
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(screenshot);

    } catch (error) {
        // This will send the exact error message to your PC so we can see it
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
