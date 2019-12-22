const fs = require('fs');
const rp = require('request-promise');
const csv = require('csv-parser');
const cheerio = require('cheerio');
const { Parser } = require('json2csv');

const results = [];
const list = [];

let count = 0;

let filename = 'dist/data.csv';
let loadfile = 'url.csv';

fs.createReadStream(loadfile)
.pipe(csv())
.on('data', function(data){
    results.push(data);
})
.on('end', function(){
    crawl(results[count]);
});


function crawl(result){
    let url = result.url;

    let _include_headers = function(body, response, resolveWithFullResponse) {
        return {
            response : response,
            $ : cheerio.load(body),
            body : body
        };
    };

    const options = {
        method: 'GET',
        uri: url,
        json: true,
        transform: _include_headers,
    };

    rp.get(url, options)
        .then((data) => {
            scrp(data.$, url, data.response, data.body);
        })
        .catch((error) => {
            console.log(error);
        });
}

function scrp($,url,response,body) {

    let category = $('.newsFeedTab_item-current').text();

    $('.newsFeed_item').each(function() {
        let title = $(this).find('.newsFeed_item_title').text();
        let date = $(this).find('.newsFeed_item_date').text();
        let href = $(this).find('.newsFeed_item_link').attr('href');
        let thumbnail = $(this).find('.thumbnail img').attr('src');
        
        if(href!==undefined){
            let obj = {
                category : category,
                title : title,
                date : date,
                href : href,
                thumbnail : thumbnail,
            }
            list.push(obj);
        }
    });

    count++;

    console.log('Complete:' + url);

    if(count < results.length ){
        crawl(results[count]);
    }else{
        write();
    }
}

function write(){
    let fields = ['category', 'title', 'date', 'href', 'thumbnail'];
    const opts = { fields };

    try {
        const parser = new Parser(opts);
        const csv = parser.parse(list);
        fs.writeFile(filename , csv, function(err) {
            if (err) throw err;
        });
    } catch (err) {
        console.error(err);
    }

}