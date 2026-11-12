const http = require('http');
const { chromium } = require('playwright');

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Expose-Headers', 'X-Current-Url');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    if (req.url === '/test') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(`
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
        html, body { margin: 0; padding: 0; background: #000; height: 100%; overflow: hidden; }
        body { display: flex; flex-direction: column; }
        #screen-container { flex: 1; position: relative; overflow: hidden; }
        #screen { width: 100%; height: 100%; object-fit: contain; touch-action: none; }
        #status { position: absolute; top: 10px; left: 10px; color: white; background: rgba(0,0,0,0.7); padding: 5px; border-radius: 5px; z-index: 10; font-family: sans-serif; font-size: 12px; }
        #keyboard-bridge { background: #222; padding: 10px; display: flex; gap: 5px; flex-shrink: 0; }
        #text-input { flex: 1; padding: 10px; font-size: 16px; border-radius: 5px; border: none; }
        #send-btn { padding: 10px 15px; font-size: 16px; background: #007bff; color: white; border: none; border-radius: 5px; font-weight: bold; }
    </style>
</head>
<body>
    <div id="screen-container">
        <div id="status">Tap to click. Swipe to scroll.</div>
        <img id="screen" src="" />
    </div>
    
    <div id="keyboard-bridge">
        <input type="text" id="text-input" placeholder="Type here..." />
        <button id="send-btn" onclick="sendText()">Send</button>
    </div>

    <script>
        const CLOUD_URL = window.location.origin + "/";
        let currentUrl = "https://www.youtube.com"; 
        let startY = 0;

        const img = document.getElementById('screen');
        const status = document.getElementById('status');
        const textInput = document.getElementById('text-input');

        loadPage("open");

        function loadPage(action, x = 0, y = 0, dy = 0, text = "") {
            status.innerText = "Loading... (Please wait)";
            let reqUrl = CLOUD_URL + "?url=" + encodeURIComponent(currentUrl) + "&action=" + action;
            if (action === 'tap') reqUrl += "&x=" + x + "&y=" + y;
            if (action === 'scroll') reqUrl += "&dy=" + dy;
            if (action === 'type') reqUrl += "&text=" + encodeURIComponent(text);

            fetch(reqUrl)
                .then(res => {
                    const newUrl = res.headers.get('X-Current-Url');
                    if (newUrl) currentUrl = newUrl;
                    return res.blob();
                })
                .then(blob => {
                    img.src = URL.createObjectURL(blob);
                    status.innerText = "Page Loaded";
                    setTimeout(() => status.innerText = "", 1500);
                })
                .catch(err => {
                    status.innerText = "Error: Server busy.";
                });
        }

        function sendText() {
            const text = textInput.value;
            if (text) {
                loadPage('type', 0, 0, 0, text);
                textInput.value = ""; 
            }
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

    const url = new URL(req.url, `http://${req.headers.host}`);
    let targetUrl = url.searchParams.get('url');
    
    // --- THE MAGIC URL STITCHER ---
    // If the URL was split by '&', we grab all the extra pieces and glue them back!
    const serverParams = ['url', 'action', 'x', 'y', 'dy', 'text'];
    let extraParams = [];
    
    for (const [key, value] of url.searchParams.entries()) {
        if (!serverParams.includes(key)) {
            extraParams.push(key + '=' + value);
        }
    }
    
    if (targetUrl && extraParams.length > 0) {
        const separator = targetUrl.includes('?') ? '&' : '?';
        targetUrl += separator + extraParams.join('&');
    }
    // -----------------------------

    // The Magic YouTube Shortcut (Still works!)
    const youtubeQuery = url.searchParams.get('youtube');
    if (youtubeQuery) {
        targetUrl = "https://www.youtube.com/results?search_query=" + encodeURIComponent(youtubeQuery);
    }

    const action = url.searchParams.get('action') || 'open';
    const textToType = url.searchParams.get('text');
    
    if (req.url === '/') {
        res.writeHead(200);
        return res.end('Server is running FAST.');
    }

    if (!targetUrl) {
        res.writeHead(400);
        return res.end('Missing URL');
    }

    let browser;
    try {
        browser = await chromium.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process', '--no-zygote', '--disable-gpu']
        });
        
        const context = await browser.newContext({
            viewport: { width: 360, height: 640 },
            userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            isMobile: true, hasTouch: true, deviceScaleFactor: 1,
            locale: 'en-IN', timezoneId: 'Asia/Kolkata'
        });
        
        const page = await context.newPage();

        await page.route('**/*', (route) => {
            const reqUrl = route.request().url().toLowerCase();
            const type = route.request().resourceType();
            
            if (reqUrl.includes('doubleclick.net') || reqUrl.includes('googleadservices.com')) {
                return route.abort();
            }
            if (reqUrl.includes('instagram.com') || reqUrl.includes('facebook.com')) {
                if (type === 'image' || type === 'media' || type === 'font') {
                    return route.abort();
                }
            }
            return route.continue();
        });

        if (action === 'open' || action === 'refresh') {
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
            
            if (targetUrl.includes('youtube.com')) {
                await page.waitForTimeout(4500); 
            } else if (targetUrl.includes('bing.com') || targetUrl.includes('google.com')) {
                await page.waitForTimeout(3500); 
            } else {
                await page.waitForTimeout(2500); 
            }

        } 
        else if (action === 'tap') {
            const x = parseInt(url.searchParams.get('x') || '0');
            const y = parseInt(url.searchParams.get('y') || '0');
            await page.mouse.click(x, y);
            await page.waitForTimeout(1500); 
        } 
        else if (action === 'scroll') {
            const dy = parseInt(url.searchParams.get('dy') || '300');
            await page.mouse.wheel(0, dy);
            await page.waitForTimeout(1000); 
        }
        else if (action === 'type' && textToType) {
            await page.keyboard.type(textToType, { delay: 50 }); 
            await page.waitForTimeout(1000); 
        }

        const currentUrl = page.url();
        const screenshot = await page.screenshot({ type: 'jpeg', quality: 50 });
        
        res.writeHead(200, { 
            'Content-Type': 'image/jpeg',
            'X-Current-Url': currentUrl 
        });
        res.end(screenshot);

    } catch (error) {
        res.writeHead(500);
        res.end('Error: ' + error.message);
    } finally {
        if (browser) await browser.close();
    }
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
