const express = require('express')
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const moment = require('moment');
const fs = require('fs');

const app = express();

app.get('/getPageContent', async (req, res) => {
    if (!req.query.site) return res.status(400).json({status: false, content: 'Invalid request!'});

    const sites = {
        'prime': {
            url: 'https://gaming.amazon.com/home',
            selector: 'div[data-a-target="offer-list-FGWP_FULL"]'
        },
        'indiegala': {
            url: 'https://freebies.indiegala.com/',
            selector: '.contents-wrapper'
        },
        'ubisoft': {
            url: 'https://www.ubisoft.com/en-gb/games/free',
            selector: '.promo__content__title'
        },
        'bdo': {
            url: 'https://www.tr.playblackdesert.com/Community/Detail?topicNo=23669',
            selector: '.contents_area'
        }
    }

    if (!sites.hasOwnProperty(req.query.site)) return res.status(400).json({
        status: false,
        content: 'Invalid request!'
    });

    //-- These are some header options for the Puppeteer not to be recognized as a bot.
    //-- I got these undetection codes from here: https://gist.github.com/tegansnyder/c3aeae4d57768c58247ae6c4e5acd3d1

    const args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--window-position=0,0',
        '--ignore-certifcate-errors',
        '--ignore-certifcate-errors-spki-list',
        '--user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3312.0 Safari/537.36"'
    ];

    const options = {
        args,
        headless: 'new',
        ignoreHTTPSErrors: true,
        userDataDir: './tmp'
    };

    const browser = await puppeteer.launch(options);
    let primeGames = [];
    let ubisoftGames = [];

    try {

        //--------------------------------------------------------------

        const preloadFile = fs.readFileSync('./preload.js', 'utf8'); // This is the file that contains the code to overwrite the navigator properties for undetection.
        const page = await browser.newPage();

        page.on('response', async response => {
            try {
                const request = response.request();

                if (request.method() === 'POST') {
                    const responseBody = await response.json();

                    if (responseBody.data && responseBody.data.games) {
                        primeGames = responseBody.data.games.items;
                    }

                    if (responseBody.news) {
                        ubisoftGames = responseBody.news;
                        console.log(ubisoftGames);
                    }
                }
            } catch (error) {
            }
        });

        await page.evaluateOnNewDocument(preloadFile);
        await page.goto(sites[req.query.site].url);
        await page.waitForSelector(sites[req.query.site].selector);

        if (req.query.site === 'bdo') {
            const formattedTextArray = await page.evaluate(() => {
                const spanElements = document.querySelectorAll('span');
                const formattedText = [];

                for (const spanElement of spanElements) {
                    const text = spanElement.textContent.trim();
                    const match = text.match(/^\w{4}-\w{4}-\w{4}-\w{4}$/);
                    if (match) {
                        formattedText.push(match[0]);
                    }
                }

                return formattedText;
            });

            const jsonData = {
                "data": formattedTextArray,
            };

            await browser.close();

            res.json(jsonData);
        } else if (req.query.site === 'prime') {
            const htmlContent = await page.evaluate(() => document.body.innerHTML);
            const $ = cheerio.load(htmlContent);

            let result = [];

            primeGames.forEach((game) => {
                result.push({
                    name: game.assets.title,
                    startDate: game.offers[0].startTime,
                    endDate: game.offers[0].endTime,
                    link: game.assets.externalClaimLink
                });
            });

            await browser.close();
            res.json(result);
        } else if (req.query.site === 'indiegala') {
            const htmlContent = await page.evaluate(() => document.body.innerHTML);
            const $ = cheerio.load(htmlContent);

            let result = [];

            $('.products-row').each(function () {
                $(this).find('.products-col > .products-col-inner').each(function () {
                    try {
                        const productName = $(this).find('.product-title-cont > .product-title').first().text();
                        result.push({
                            name: productName,
                            startDate: moment().utc().format(),
                            endDate: null,
                            link: $(this).find('a').first().attr('href')
                        });
                    } catch (e) {
                        console.log('Hata:', e.message);
                    }
                });
            });

            await browser.close();
            res.json(result);
        } else if (req.query.site === 'ubisoft') {
            const htmlContent = await page.evaluate(() => document.body.innerHTML);
            const $ = cheerio.load(htmlContent);

            let result = [];

            $('.free-event').each(function () {
                try {
                    const eventLogoAlt = $(this).find('.eventlogo img').first().attr('alt');
                    const eventType = $(this).find('a').first().attr('data-type');

                    res.push({
                        name: eventLogoAlt,
                        startDate: moment().utc().format(),
                        endDate: null,
                        link: $(this).find('a').first().attr('data-url')
                    });

                } catch (e) {
                    console.error('Hata:', e.message);
                }
            });
        } else {
            const pageContent = await page.evaluate(() => document.body.innerHTML);
            await browser.close();
            res.send(pageContent);
        }
    } catch (error) {
        await browser.close();
        res.status(500).json({status: false, content: error.toString()});
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API listening on port ${port}`));
