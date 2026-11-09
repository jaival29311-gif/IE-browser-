const http = require('http');
const { chromium } = require('playwright');

// GLOBAL VARIABLES: Keeps the browser alive between requests
let globalBrowser = null;
let globalContext = null;
let globalPage = null;

// A helper function to get the browser, or launch it if it's not running
async function getBrowserPage() {
    try {
        if (globalBrowser && globalBrowser.isConnected()) {
            return globalPage;
        }
    } catch (e) {
        console.log("Browser was disconnected. Restarting...");
    }

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

    return globalPage;
}

const server = http.createServer(async (req, res) => {
    // 1. CORS HEADERS (Allows Android to connect)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Expose-Headers', 'X-Current-Url');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    // 2. ANDROID TEST PAGE
    if (req.url === '/test') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(`
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
        body { margin: 0; padding: 0; background: #000; overflow: hidden; }
        #screen { width: 100vw; height: 100vh; object-fit: contain; touch-action: none; }
        #status { position: absolute; top: 10px; left: 10px; color: white; font-family: sans-serif; background: rgba(0,0,0,0.7); padding: 5px; border-radius: 5px; z-index: 10; }
    </style>
</head>
<body>
    <div id="status">Tap the screen to click. Swipe to scroll.</div>
    <img id="screen" src="" />
    
    <script>
        // Use relative URL so it always matches the current domain
        const CLOUD_URL = window.location.origin + "/";
        let currentUrl = "https://google.com";
        let startY = 0;

        const img = document.getElementById('screen');
        const status = document.getElementById('status');

        // 1. Initial Load
        loadPage("open");

        function loadPage(action, x = 0, y = 0, dy = 0) {
            status.innerText = "Loading... (Waking up server)";
            let reqUrl = CLOUD_URL + "?url=" + encodeURIComponent(currentUrl) + "&action=" + action;
            if (action === 'tap') reqUrl += "&x=" + x + "&y=" + y;
            if (action === 'scroll') reqUrl += "&dy=" + dy;

            fetch(reqUrl)
                .then(res => {
                    const newUrl = res.headers.get('X-Current-Url');
                    if (newUrl) currentUrl = newUrl;
                    return res.blob();
                })
                .then(blob => {
                    const url = URL.createObjectURL(blob);
                    img.src = url;
                    status.innerText = "Page Loaded";
                    setTimeout(() => status.innerText = "", 2000);
                })
                .catch(err => {
                    status.innerText = "Error: Server sleeping. Tap to retry.";
                });
        }

        img.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startY = e.touches[0].clientY;
        });

        img.addEventListener('touchend', (e) => {
            e.preventDefault();
            const endY = e.changedTouches[0].clientY;
            const diffY = startY - endY;

            if (Math.abs(diffY) > 30) {
                loadPage('scroll', 0, 0, diffY);
            } else {
                const rect = img.getBoundingClientRect();
                const x = Math.round((e.changedTouches[0].clientX - rect.left) * (360 / rect.width));
                const y = Math.round((e.changedTouches[0].clientY - rect.top) * (640 / rect.height));
                loadPage('tap', x, y);
            }
        });
    </script>
</body>
</html>
        `);
    }

    // 3. STANDARD ROUTES
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

        // OPEN
        if (action === 'open') {
            await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
            await page.waitForTimeout(2000);
        } 
        // REFRESH
        else if (action === 'refresh') {
            await page.reload({ waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
            await page.waitForTimeout(4000); 
        }
        // TAP (With Coiled Mouse trick)
        else if (action === 'tap') {
            const x = parseInt(url.searchParams.get('x') || '0');
            const y = parseInt(url.searchParams.get('y') || '0');
            
            let startX = Math.max(0, x - 50);
            let startY = Math.max(0, y - 50);
            await page.mouse.move(startX, startY);
            
            for (let i = 1; i <= 5; i++) {
                const moveX = startX + ((x - startX) * (i / 5));
                const moveY = startY + ((y - startY) * (i / 5)) + (Math.random() * 10);
                await page.mouse.move(moveX, moveY);
                await page.waitForTimeout(50); 
            }
            
            await page.mouse.click(x, y);
            await page.waitForTimeout(2000); 
        } 
        // SCROLL
        else if (action === 'scroll') {
            const dy = parseInt(url.searchParams.get('dy') || '300');
            await page.mouse.wheel(0, dy);
            await page.waitForTimeout(1000); 
        }

        const currentUrl = page.url();
        const screenshot = await page.screenshot({ type: 'jpeg', quality: 60 });
        
        res.writeHead(200, { 
            'Content-Type': 'image/jpeg',
            'X-Current-Url': currentUrl 
        });
        res.end(screenshot);

    } catch (error) {
        console.error("Render Error:", error.message);
        
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
