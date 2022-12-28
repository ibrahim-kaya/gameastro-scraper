const express = require('express')
const puppeteer = require('puppeteer');
const fs = require('fs');

const app = express();

app.get('/getPageContent', async (req, res) => {
    if(!req.query.site) return res.status(400).json({ status: false, content: 'Invalid request!' });

    const sites = {
        'prime' : {
            url: 'https://gaming.amazon.com/home',
            selector: '.item-card__availability-callout__container'
        },
        'indiegala' : {
            url: 'https://freebies.indiegala.com/',
            selector: '.contents-wrapper'
        }
    }

    if (!sites.hasOwnProperty(req.query.site)) return res.status(400).json({ status: false, content: 'Invalid request!' });

    try {

        //-- These are some header options for the Puppeteer not to be recognized as a bot.
        //-- I got these undetection codes from here: https://gist.github.com/tegansnyder/c3aeae4d57768c58247ae6c4e5acd3d1

        const args = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-infobars',
            '--enable-javascript',
            '--window-position=0,0',
            '--ignore-certifcate-errors',
            '--ignore-certifcate-errors-spki-list',
            '--user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3312.0 Safari/537.36"'
        ];

        const options = {
            args,
            headless: true,
            ignoreHTTPSErrors: true,
            userDataDir: './tmp'
        };

        //--------------------------------------------------------------

        const browser = await puppeteer.launch(options);
        const preloadFile = fs.readFileSync('./preload.js', 'utf8'); // This is the file that contains the code to overwrite the navigator properties for undetection.
        const page = await browser.newPage();
        await page.evaluateOnNewDocument(preloadFile);
        await page.goto(sites[req.query.site].url);
        await page.waitForSelector(sites[req.query.site].selector);
        const pageContent = await page.evaluate(() => document.body.innerHTML);
        await browser.close();

        res.send(pageContent);
    } catch (error) {
        res.status(500).json({ status: false, content: error.toString() });
    }
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`API listening on port ${port}`));