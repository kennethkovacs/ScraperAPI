# Puppeteer Web Scraper with Stealth and Recaptcha

This project is a web scraper built using Puppeteer with extra plugins for stealth and recaptcha solving. It allows for automated browsing and data extraction while bypassing bot detection mechanisms.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/kennethkovacs/ScraperAPI.git
   cd ScraperAPI

2. **Install the required packages:**
   ```bash
   npm install puppeteer-extra user-agents puppeteer-extra-plugin-stealth puppeteer-extra-plugin-recaptcha dotenv

## Usage

1. **Set up your environment variables:**

   Create a .env file in the root directory of your project and add the necessary environment variables:
   
   ```env
   2CAPTCHA_TOKEN=your_2captcha_token
   USER_DATA_DIR=path_to_user_data_directory
   OXYLABS_ENDPOINT=your_oxylabs_endpoint
   STORMPROXY_ENDPOINT=your_stormproxy_endpoint
   SCRAPERAPI_ENDPOINT=your_scraperapi_endpoint
   TOR_ENDPOINT=your_tor_endpoint
   SCRAPERAPI_USER=your_scraperapi_username
   SCRAPERAPI_PASSWORD=your_scraperapi_password
   ```

2. **Create a script to run the web scraper:**
   
   Create a new JavaScript file (e.g., index.js) and use the ScraperAPI class:
    ```javascript
   const ScraperAPI = require('./path_to_your_scraperapi_file'); // Adjust the path accordingly

   (async () => {
       const scraper = new ScraperAPI();
       scraper.set_row_selector('.your-css-selector'); // Set your row selector here

       try {
           await scraper.launch();
           const page = await scraper.new_page();
           await scraper.go_to('https://example.com'); // Set the URL you want to scrape

       // Add your scraping logic here
       const rows = await scraper.get_rows();
       console.log(rows);

       await scraper.close_browser();
    } catch (error) {
       console.error('Error:', error);
    }
   })();

3. **Run the script:**

   Run the script using Node.js:
   ```bash
   node index.js