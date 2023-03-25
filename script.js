import puppeteer from "puppeteer";
import axios from "axios";
import chalk from "chalk";
import sqlite from "sqlite3";
import sha256 from "crypto-js/sha256.js";

(async () => {

    const language      = '';
    const category      = '';
    const inputCriteria = '';

    if (!inputCriteria.length) {
        throw new Error('Mandatory input criteria variable is empty');
    }

    const urlsToFilter  = [];
    const browser       = await puppeteer.launch({headless: false});
    let   page          = await browser.newPage();

    await page.goto('https://google.com');
    await page.click('div.sy4vM');
    await page.waitForNavigation({waitUntil:"domcontentloaded"});

    await page.type('input[type=text]', inputCriteria);
    await page.keyboard.press('Enter');
    await page.waitForNavigation({waitUntil:"domcontentloaded"});

    const persist = (url) => {

        /**
         * Persist on database
         */
        const db = new sqlite.Database('rss.db');
        db.serialize(() => {
            db.run('CREATE TABLE IF NOT EXISTS rss_sources (' +
                'digest VARCHAR(64) NOT NULL,' +
                'url VARCHAR(512) NOT NULL,' +
                'language VARCHAR(225) NOT NULL,' +
                'category VARCHAR(225) NOT NULL,' +
                'PRIMARY KEY (digest)' +
                ')');

            const statement = db.prepare('INSERT OR IGNORE INTO rss_sources (digest, url, language, category) VALUES (?, ?, ?, ?)');
            statement.run(sha256(url).toString(), url, language, category);
            statement.finalize();
        });
    };

    const resultLinks = [];

    const fetchResults = async (currentPage) => {

        /**
         * Fetch google results links
         */
        const elementsLinks = await page.$$('.yuRUbf a[data-ved]');
        for (const element of elementsLinks) {
            const link = await (await element.getProperty('href')).jsonValue();
            if (link) {
                resultLinks.push(link);
            }
        }

        /**
         * Find next page link
         */
        const elementsPages = await page.$$('a.fl');
        let keepNavigation  = false;

        for (const element of elementsPages) {
            const pageElement = await (await element.getProperty('textContent')).jsonValue();

            if ((currentPage+1) == pageElement) {
                keepNavigation = true;
                await element.click();
                await page.waitForNavigation();
                break;
            }
        }
        if (!keepNavigation) {
            return;
        }
        await fetchResults(currentPage+1)
    };
    await fetchResults(1);

    /**
     * Fetch all links for each page obtained from google results
     */
    for (const resultLink of resultLinks) {

        page = await browser.newPage();
        try {
            await page.goto(resultLink);
            const rssLinkElements = await page.$$("a");
            for (const element of rssLinkElements) {
                const href = await ((await element.getProperty('href')).jsonValue());
                if (href.toString().trim().slice(0, 8) === 'https://' && (href.includes('rss') || href.includes('feed')) && !urlsToFilter.includes(href)) {
                    console.log(chalk.blue('Fetch ' + href));
                    urlsToFilter.push(href);
                }
            }
        } catch (error) {
            console.log(chalk.red(error.message));
        } finally {
            await page.close();
        }
    }

    /**
     * Filter through head request, check response content header
     */
    for (const url of urlsToFilter) {
        try {
            const response = await axios.head(url);

            if (response.headers.getContentType().includes('application/rss+xml')) {
                persist(url);
                console.log(chalk.green('requested ' + url + ' ' + response.headers.getContentType()));
            } else {
                console.log(chalk.gray('requested ' + url + ' ' + response.headers.getContentType()));
            }
        } catch (error) {
            if (error.hasOwnProperty('response') && error.response.hasOwnProperty('status')) {
                console.log(chalk.red('Cannot resolve ' + url + ' respond with ' + error.response.status.toString() + ' code'));
            }
        }
    }

    browser.close();
})();