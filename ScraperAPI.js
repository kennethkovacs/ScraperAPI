const puppeteer = require("puppeteer-extra");
const UserAgent = require("user-agents");
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const RecaptchaPlugin = require("puppeteer-extra-plugin-recaptcha");
const {executablePath} = require('puppeteer')
const {spawn} = require("child_process");
const dotenv = require('dotenv').config()

// Manual captcha solving
// puppeteer.use(
//     RecaptchaPlugin({
//         provider: {
//             id: '2captcha',
//             token: process.env.2CAPTCHA.TOKEN
//         },
//         visualFeedback: true
//     })
// );

class ScraperAPI {
    proxy = "none";
    browser;
    page;
    row_selector;

    constructor() {
        puppeteer.use(StealthPlugin());
    }

    async close_browser() {
        await this.browser.close();
    }

    async random_delay(min, max) {
        let random_number = await this.random_number(min, max);
        await new Promise(resolve => setTimeout(resolve, random_number * 1000));
    }

    async random_number(min, max) {
        return Math.floor(Math.random() * (max + 1 - min) + min);
    }

    // Set the css selector for the row element containing the data we need
    set_row_selector(selector) {
        this.row_selector = selector;
    }

    async get_rows() {
        return await this.page.$$(this.row_selector);
    }

    async get_element(selector, func) {
        try {
            return await this.page.$eval(selector, func);
        } catch (err) {
            console.log("Could not find element.");
        }
    }

    async get_elements(selector, func = null) {
        if (func == null) {
            try {
                return await this.page.$$(selector);
            } catch (err) {
                console.log("Could not find element.");
            }
        } else {
            try {
                return await this.page.$$eval(selector, func);
            } catch (err) {
                console.log("Could not find element.");
            }
        }
    }

    async click_button(selector) {
        let show_more_button = await this.page.$$(selector);
        if (show_more_button.length > 0) {
            await this.page.click(selector);
        }
    }

    async human_click(selector) {
        const element = await this.page.$(selector);
        const box = await element.boundingBox();
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;

        await this.page.mouse.move(x, y, { steps: 20 });
        await this.page.waitForTimeout(50 + Math.random() * 100);
        await this.page.mouse.down();
        await this.page.waitForTimeout(50 + Math.random() * 100);
        await this.page.mouse.up();
    }

    async human_scroll(scroll_to, scroll_step = 100) {
        const scroll_height = await this.page.evaluate(_scrollTo => {
            window.scrollBy(0, _scrollTo);
            return window.pageYOffset;
        }, scroll_to);

        let scroll_position = 0;
        while (scroll_position < scroll_to) {
            await this.page.waitForTimeout(50 + Math.random() * 100);
            scroll_position += scroll_step;
            if (scroll_position > scroll_to) {
                scroll_step = scroll_to - (scroll_position - scroll_step);
            }
            await this.page.evaluate(_scrollStep => {
                window.scrollBy(0, _scrollStep);
            }, scroll_step);
        }
    }

    async launch(proxy="none") {
        /**
         * Launch new browser
         */

        // Browser settings if we are not using a proxy
        if (this.proxy === "none" || this.proxy === "localhost") {
            this.browser = await puppeteer.launch({
                executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                userDataDir: process.env.USER_DATA_DIR,
                headless: false,
                timeout: 0,
                defaultViewport: null
            });
        }

        // Browser settings if we are using a proxy
        else {
            let args = this.get_proxy_args(this.proxy);

            this.browser = await puppeteer.launch({
                executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                userDataDir: process.env.USER_DATA_DIR,
                headless: false,
                timeout: 0,
                defaultViewport: null,
                ignoreHTTPSErrors: true,
                args: [args]
            });
        }
        return this.browser;
    }

    get_proxy_args() {
        /**
         * Proxy arguments
         * To use tor:
         *  1. Start tor: brew services start tor (restart if necessary)
         *  2. Turn off VPN
         */
        let args;

        if (this.proxy === "oxylabs") {
            args = process.env.OXYLABS_ENDPOINT;
        }
        else if (this.proxy === "stormproxy") {
            args = process.env.STORMPROXY_ENDPOINT;
        }
        else if (this.proxy === "scraperapi") {
            args = process.env.SCRAPERAPI_ENDPOINT;
        }
        else if (this.proxy === "tor"){
            args = process.env.TOR_ENDPOINT;
        }

        return args;
    }

    async new_page() {
        /**
         * Launch new page
         */
        this.page = await this.browser.newPage();
        await this.authenticate();
        await this.setup_page();

        return this.page;
    }

    async authenticate() {
        /**
         * Proxy API authentication
         */
        if (this.proxy === "scraperapi") {
            await this.page.authenticate({
                username: process.env.SCRAPERAPI_USER,
                password: process.env.SCRAPERAPI_PASSWORD,
            });
        } else if (this.proxy === "oxylabs") {
            await this.page.authenticate({
                username: process.env.OXYLABS_USER,
                password: process.env.OXYLABS_PASSWORD,
            });
        }
    }

    async setup_page() {
        /**
         * Bot detection bypass settings and other page settings
         */

        // Bot settings
        await this.page.setViewport({
            width: 1920,
            height: 1080,
        });
        let useragent = await this.useragent();
        await this.page.setUserAgent(useragent);
        await this.page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'vendor', {get: () => ""});
        })

        // Print user agent
        // console.log(await this.page.evaluate("navigator.userAgent"));

        // Other settings
        await this.page.setDefaultNavigationTimeout(0);
    }

    async useragent() {
        /**
         * Create random user-agent to be set through plugin
         */

        // Adjust user agent attributes
        // const userAgent = new UserAgent({ platform: 'MacIntel', deviceCategory: 'desktop' });

        return new UserAgent().toString();

        // Print user agent data
        // console.log("User Agent: " + userAgent.toString());
        // console.log("User Agent Data: ");
        // console.log(JSON.stringify(userAgent.data, null, 2));
    }

    async access(url) {
        /**
         * Attempt to access url and locate given elem.
         * If not found, repeat attempt n times with the given method,
         * then try another method.
         */

        const proxy_types = [
            {name: "stormproxy", retries: 0},
            {name: "tor", retries: 0},
            {name: "scraperapi", retries: 0},
            {name: "localhost", retries: 1},
            {name: "oxylabs", retries: 0},
        ];

        for (const proxy_type of proxy_types) {
            this.proxy = proxy_type.name;

            // Attempt to visit website with each proxy
            for (let i = 0; i < proxy_type.retries; i++) {
                await this.launch(proxy_type.name);
                console.log("Attempt " + (i + 1).toString() + " with " + proxy_type.name + "...");
                await this.new_page();

                // Visit website
                try {
                    await this.go_to(url);
                } catch (err) {
                    console.log(err);
                    await this.random_delay(5, 15);
                    await this.browser.close();
                    continue;
                }

                // Look for row selector
                try {
                    console.log("Waiting for selector...");
                    let delay = await this.random_number(15, 25) * 1000;
                    await this.page.waitForSelector(this.row_selector, { timeout: delay });
                    // await this.page.waitForSelector(this.row_selector, { timeout: 20000 });
                } catch (err) {
                    console.log("Selector not found...");
                    await this.browser.close();
                    await this.random_delay(5, 15);
                    // await new Promise(r => setTimeout(r, this.random() * 1000));
                    continue;
                }

                console.log("Found selector...");
                return this.page;
            }
        }

        // If all attempts failed, return null
        return null;
    }

    // Access URL
    async go_to(url) {
        await this.page.goto(
            url,
            {waitUntil: 'domcontentloaded'});
    }

    async getCurrentTimestamp () {
        return Date.now()
    }

    async shuffle_array(array) {
        for (let i = array.length - 1; i > 0; i--) {
            // Generate a random index
            let j = Math.floor(Math.random() * (i + 1));

            // Swap elements at i and j
            let temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }

        return array;
    }

    pyProg() {
        /**
         * Accesses js_to_py_sample_code.py python script
         * Accepts arguments arg1, and arg2
         * Data is returned from the python script from a print function
         */

        const spawn = require("child_process").spawn;
        const pythonProcess = spawn('python3',["js_to_py_sample_code.py", "agr1", "agr2"]);

        pythonProcess.stdout.on('data', (data) => {
            console.log(data.toString());
            return data.toString();
        });
    }
}

module.exports = ScraperAPI;