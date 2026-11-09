const http = require('http');
const { chromium } = require('playwright');

// GLOBAL VARIABLES: The browser stays alive here!
let globalBrowser = null;
let globalContext = null;
let globalPage = null;

// A helper function to get the browser, or launch it if it's not running
async function getBrowserPage() {
    if (!globalBrowser || !globalBrowser.isConnected()) {
        console.log("Launching new Chromium instance...");
        globalBrowser = await chromium.launch({ 
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
        
        // THE INDIAN DISGUISE (Pixel 7 in New Delhi)
        globalContext = await globalBrowser.newContext({
            viewport: { width: 360, height: 640 },
            userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            isMobile: true, 
            hasTouch: true, 
            deviceScaleFactor: 1,
            locale: 'en-IN', 
            timezoneId: 'Asia/Kolkata', 
            geolocation: { latitude: 28.6139, longitude: 77.2090 }, 
            permissions: ['geolocation']
        });
        
        globalPage = await globalContext.newPage();
        
        // Fast Ad Blocker
        await globalPage.route('**/*', (route) => {
            const reqUrl = route.request().url().toLowerCase();
            if (reqUrl.includes('doubleclick.net') || reqUrl.includes('googleadservices.com')) {
                return route.abort();
            }
            return route.continue();
        });
    }
    return globalPage;
}

const server = http.createServer(async (req, res) => {
    // --- CORS HEADERS (Allows your Android phone to connect) ---
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    // Handle preflight request for CORS
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const targetUrl = url.searchParams.get('url');
    const action = url.searchParams.get('action') || 'open';
    
    if (req.url === '/') {
        res.writeHead(200);
        return res.end('Server is running. Browser alive: ' + (globalBrowser !== null));
    }

    if (!targetUrl) {
        res.writeHead(400);
        return res.end('Missing URL');
    }

    try {
        const page = await getBrowserPage();

        // 1. OPEN: Navigate to a new URL
        if (action === 'open') {
            await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
            await page.waitForTimeout(2000);
        } 
        
        // 2. REFRESH: Deep reload to catch missing images
        else if (action === 'refresh') {
            await page.reload({ waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
            await page.waitForTimeout(4000); 
        }
        
        // 3. TAP: Click on X/Y coordinates
        else if (action === 'tap') {
            const x = parseInt(url.searchParams.get('x') || '0');
            const y = parseInt(url.searchParams.get('y') || '0');
            
            // --- THE COILED MOUSE TRICK ---
            // Move the mouse in a small curve to look human before clicking
            let startX = Math.max(0, x - 50);
            let startY = Math.max(0, y - 50);
            await page.mouse.move(startX, startY);
            
            for (let i = 1; i <= 5; i++) {
                const moveX = startX + ((x - startX) * (i / 5));
                const moveY = startY + ((y - startY) * (i / 5)) + (Math.random() * 10);
                await page.mouse.move(moveX, moveY);
                await page.waitForTimeout(50); // Random tiny delay
            }
            
            await page.mouse.click(x, y);
            await page.waitForTimeout(2000); 
        } 
        
        // 4. SCROLL: Swipe up or down
        else if (action === 'scroll') {
            const dy = parseInt(url.searchParams.get('dy') || '300');
            await page.mouse.wheel(0, dy);
            await page.waitForTimeout(1000); 
        }

        const currentUrl = page.url();
        const screenshot = await page.screenshot({ type: 'jpeg', quality: 60 });
        
        // Return the image and the new URL
        res.writeHead(200, { 
            'Content-Type': 'image/jpeg',
            'X-Current-Url': currentUrl 
        });
        res.end(screenshot);

    } catch (error) {
        console.error("Render Error:", error.message);
        
        // If the browser crashed due to memory, kill it so the next request starts fresh
        if (globalBrowser) { 
            await globalBrowser.close().catch(()=>{}); 
            globalBrowser = null; 
        }
        
        res.writeHead(500);
        res.end('Error: ' + error.message);
    }
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
