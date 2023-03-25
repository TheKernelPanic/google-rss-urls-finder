# Google RSS urls finder :mag_right: :newspaper:

Script to search rss links via Google using Puppeteer library.

## Set up

Install dependencies

```bash 
npm i
```

Initialize variables 

Example:

```javascript
    const language      = 'español';
    const category      = 'noticias';
    const inputCriteria = `rss ${language} ${category}`;
```

Run script

```bash 
npm run start
```