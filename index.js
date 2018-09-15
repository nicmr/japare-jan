var assert = require('assert');
var rp = require('request-promise-native');
var cheerio = require('cheerio');
const ean = require('ean');


//for utility
String.prototype.formatUnicorn = String.prototype.formatUnicorn ||
function () {
    "use strict";
    var str = this.toString();
    if (arguments.length) {
        var t = typeof arguments[0];
        var key;
        var args = ("string" === t || "number" === t) ?
            Array.prototype.slice.call(arguments)
            : arguments[0];

        for (key in args) {
            str = str.replace(new RegExp("\\{" + key + "\\}", "gi"), args[key]);
        }
    }
    return str;
};

var utility = {
    scrape_by_class: function(html, keyword){
        let results = [];
        
        var $ = cheerio.load(html);
        var class_keyword = ".{0}".formatUnicorn(keyword);
        $(class_keyword).each(function(i, elem){
            let item = $(this).text();
            results[i] = item;
        });
        return results;

    },
    streamline_price: function(string){
        let streamlined = []

        for (i=0; i< string.length; i++){
            let c = string.charAt(i);
            if (c>= '0' && c <= '9'){
                //isnumeric
                streamlined.push(c);
            }else if (c == '%'){
                // previous 2 characters were most likely a sale percentage
                // possible issue: single digit percentages
                streamlined.pop();
                streamlined.pop();
                //remove sale percentage digits
            }
            //else: character gets dropped
        }
        let result = streamlined.join("");
        return result;
    },
    result_to_float: function(string){
    let s = utility.streamline_price(string);
    let float = parseFloat(s);
    if (isNaN(float)){
        float = (-1.0);
    }
    return float;
    }
};


var CDJapanSearch = {
    search: function(keywords){

        let joined = keywords.join("+");
        let base = "http://www.cdjapan.co.jp/searches?term.media_format=&q=pikachu";

        let uri = "{0}{1}".formatUnicorn(base, joined);
        let options = {
            url: uri,
        };
        rp(options)
            .then(html =>
            {
                console.log(html); //works
                CDJapanSearch.parse_search(html).forEach(element =>
                {
                    console.log(element);
                    //doesn't work: issue: tag is not found in html right away, probably generated by javascript
                    rp(element).then((html) => CDJapanSearch.extract_jan(html));
                });     
            });  
    },
    parse_search: function(html){
        let $ = cheerio.load(html);
        let results = [];

        $('a[class=item-wrap]').each((_, elem) => console.log(elem)); //doesn't work


        $('a[class=item-wrap]').each((_, elem)=> {results.push(elem.attr('href'))});
        //alternatively  $('li[class=item]).child() ...

        return results;
    },

    extract_jan: function(html){

        let $ = cheerio.load(html);
        let jan = $('span[itemprop=gtin13]').text();
        console.log(jan);
        return jan;
    }
}

var MFCSearch = {
    search: async function(keywords){
        let joined = keywords.join("+");
        let base = "https://myfigurecollection.net/browse.v4.php?keywords=";

        let uri = "{0}{1}".formatUnicorn(base, joined);
        let options = {
            url: uri,
        }
        //rp(options).then(html => console.log(html)); //works
        rp(options)
            .then(html => {
                let search_results = MFCSearch.parse_search(html)
                //console.log(search_results); // works!
                let base = "https://myfigurecollection.net";

                let tasks = search_results.map(item => {
                    let uri = "{0}{1}".formatUnicorn(base, item);
                    let item_options = {
                        url: uri,
                    };
                    return rp(item_options);
                });
                
                return Promise.all(tasks);
            });
    },
    parse_search: function(html){
        let $ = cheerio.load(html);
        let match = [];
        $('.tbx-tooltip').each((_, elem) => match.push(elem.attribs['href']));

        let result  = match.filter(elem => elem.includes('item'));
        //console.log(result);
        return result; 
    },

    extract_job: async function(request_options){
        rp(request_options)
            .then(item_html =>{
                return MFCSearch.extract_jan(item_html);
                // let jan = MFCSearch.extract_jan(item_html);
                // if (jan != -1){
                //     console.log(jan);
                //     return jan;
                // }
            });
    },

    extract_jan: function(html){

        let re = RegExp('meta itemprop="productID" content="jan:(\\d+)');
        let match = re.exec(html);       
        let jan = -1;

        // console.log(html.includes('meta itemprop="productID" content="jan:'));


        if (match !== undefined && match !== null){
            jan = match[1];
            if (jan !== undefined && jan !== null){
                //console.log("jan", jan);
                if (ean.isValid(jan)){
                    return jan;
                } else {
                    return -1;
                }
            } else {
                //console.log('failed to find jan(1)');
            }
        } else {
            //console.log('failed to find jan(2)');
        }

        return jan;
    },
}

function lookup(keywords){
    MFCSearch.search(keywords);
}


var test = function(){
    let keywords = ["Pikachu","figure"];
    
    lookup(keywords);
};

module.exports = {
    lookup:  lookup,
}

if (require.main === module){
    test();
}


