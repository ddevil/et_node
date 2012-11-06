var express = require('express');
var sys = require('util');
var oauth = require('oauth');
var connect = require('connect')
var https = require('https')
var io = require('socket.io')
var fs = require('fs')
var path = require('path')
var oauth = require('oauth')
var querystring = require('querystring')
var port = (process.env.PORT || 8081);


var app = express.createServer();

//CORS middleware
var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*'); //define the list of domains that you want to enable for CORS
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
};
app.configure(function(){
    app.set('views', __dirname + '/views');
    app.set('view options', { layout: false });
    app.use(connect.bodyParser());
    app.use(express.cookieParser());
    app.use(express.session({ secret: "shhhhhhhhh!"}));
    app.use(connect.static(__dirname + '/static'));
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
    app.use(express.logger());
    app.use(allowCrossDomain);
    app.use(app.router);
});

var GET_METHOD = 'GET';
var POST_METHOD = 'POST';
var DELETE_METHOD = 'DELETE';
var PUT_METHOD='PUT';


//Define ET Specific variables
var API_REQUEST_TOKEN = 'https://api.etrade.com/oauth/request_token';
var API_ACCESS_TOKEN = 'https://api.etrade.com/oauth/access_token';
var API_RENEW_TOKEN = '/oauth/renew_access_token'
var API_BASE_URL='https://api.etrade.com';
var API_BASE_PORT='443';
var ET_CONSUMER_KEY = '<ET_API_CONSUMER_KEY>';
var ET_CONSUMER_SECRET = '<ET_API_CONSUMER_SECRET>';
var ET_ACCESS_TOKEN = ''; //variable to store access token
var ET_ACCESS_TOKEN_SECRET = ''; //variable to store access token secret
var ET_AUTHORIZE_URL = 'https://us.etrade.com/e/t/etws/authorize?key=';
var CALLBACK_URL = 'oob';
var CONTENT_TYPE = 'application/json';


//app redirect URL after getting the request token

var APP_REDIRECT_URL = '<Define app redirect url here...>';


//Setup Socket.IO
var io = io.listen(app);

//API calls over sockets
io.sockets.on('connection', function(socket){
  console.log('Client Connected');
  socket.on('quote', function (data) {
   get_quote();
  });
   socket.on('news', function (data) {
    get_news();
  });
   socket.on('market_movers', function (data) {
    get_market_movers();
  });
   socket.on('indices', function (data) {
    get_indices();
  });
   socket.on('accounts', function (data) {
    get_accounts();
  });
   socket.on('portfolio', function (data) {
    get_portfolio(data.accountIdKey);
  });
  socket.on('alerts', function (data) {
    get_alerts();
  });
   socket.on('alertdetail', function (data) {
    get_alert_detail(data.id);
  });
  socket.on('watchlists', function (data) {
    get_watchlists();
  });
  socket.on('accountchart', function (data) {
    get_accounts_chart_data();
  });
  socket.on('accountperformance', function (data) {
    get_accounts_performance_data();
  });
  socket.on('disconnect', function(){
    console.log('Client Disconnected.');
  });
});

//function to do oauth
function etconsumer(){
  return new oauth.OAuth(API_REQUEST_TOKEN, 
                          API_ACCESS_TOKEN,
                          ET_CONSUMER_KEY,
                          ET_CONSUMER_SECRET,
                          "1.0",
                          CALLBACK_URL,
                          "HMAC-SHA1");
}

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  app.use(express.logger());
  app.use(express.cookieParser());
  app.use(express.session({
    secret: "secretkey"
  }));
});

//app.dynamicHelpers({
app.locals({
  session: function(req, res){
    return req.session;
  }
});

//market
function get_market_movers(){

  console.log('inside get_market_movers api....');
    var MOVERS_URL = '/v1/market/movers/most_active.json';
    get_et_api_stream('market_movers', MOVERS_URL, '', GET_METHOD, '');
}

//get_market
function get_markets(){
  console.log('inside quote api....');
    var MARKETS_SYMBOL = 'DJIND,NSDQ,SPX';
    var url = '/v1/market/quote/' + MARKETS_SYMBOL +'.json';
    get_et_api_stream('markets', url, '', GET_METHOD, '');
}
function get_news(){
  console.log('inside get_news api....');
  var NEWS_URL= '/v1/market/news/BusinessWire,PRNewswire,DowJones,Marketwire,GlobeNewswire.json';
  get_et_api_stream('news', NEWS_URL,'', GET_METHOD, '');
}

function get_quote(){
  var QUOTE_URL = '/v1/market/quote/goog,AAPL.json';
  get_et_api_stream('quote', QUOTE_URL, '', GET_METHOD, '');
}
function get_indices(){
  var URL_QUOTE = '/v1/market/quote/DJIND,COMP.IDX,SPX,TNX,NYA,XMI,RUT,OEX,DJTRA,DJUTL.json?detailFlag=INTRADAY';
  get_et_api_stream('indices', URL_QUOTE, '', 'GET', '');
}

function get_accounts(){
  var URL_ACCOUNTS =  '/v1/accounts.json';
  get_et_api_stream('accounts', URL_ACCOUNTS, '', 'GET', '');
}

function get_accounts_chart_data(){
  var URL_ACCOUNTS =  '/v1/accounts/brokerage.json';
  renew_token();
  get_et_api_callback(handle_response, handle_error, URL_ACCOUNTS, '', 'GET', '', '');
}


function get_portfolio(accountIdKey){
  console.log('accountidkey:' + accountIdKey);
  if(accountIdKey == null)
    URL_PORTFOLIO = '/v1/accounts/portfolio.json';
  else
    URL_PORTFOLIO =  '/v1/accounts/' + accountIdKey +'/portfolio.json';
  get_portfolio_totals(accountIdKey);
  get_et_api_callback(handle_response, handle_error, URL_PORTFOLIO, '', 'GET', '', accountIdKey);
}

function get_portfolio_totals(accountIdKey){
  console.log('accountidkey:' + accountIdKey);
  var URL_PORTFOLIO_TOTALS = "/v1/accounts/" + accountIdKey + "/portfolio/portfoliosummary.json";
  get_et_api_callback(handle_response, handle_error, URL_PORTFOLIO_TOTALS, '', 'GET', '', accountIdKey);
}

function get_portfolio_news(accountIdKey){
  console.log('accountidkey:' + accountIdKey);
  var URL_PORTFOLIO_NEWS = "/v1/accounts/" + accountIdKey + "/portfolio/news.json?sortBy=toppctgainers";
  get_et_api_callback(handle_response, handle_error, URL_PORTFOLIO_NEWS, '', 'GET', '', accountIdKey);
}

function get_alerts(){
  var URL_ALERTS =  '/v1/user/alerts.json';
  get_et_api_stream('alerts', URL_ALERTS, '', 'GET', '');
}
function get_alert_detail(alertId){
  var URL_ALERTS =  '/v1/user/alerts/' + alertId + '.json';
  get_et_api_stream('alertdetail', URL_ALERTS, '', 'GET', '');
}
function get_watchlists(){
  var URL = '/v1/user/watchlists.json';
  get_et_api_stream('watchlists', URL, '', 'GET', '');
}
function get_account_allocation(accountIdKey){
  var URL = '/v1/user/' + accountIdKey + '/charts/allocation.json';
  //var URL = "/v1/user/charts/allocation.json";
  console.log('URL:' + URL);
  get_et_api_callback(handle_response, handle_error, URL, '', 'GET', '', accountIdKey);
}
function get_account_overview(accountIdKey){
  //var URL = '/v1/user/' + accountIdKey + '/charts/overview.json';
  var URL = "/v1/user/charts/overview.json";
  console.log('URL:' + URL);
  get_et_api_callback(handle_response, handle_error, URL, '', 'GET', '', accountIdKey);
}

//v1/user/charts/performance
function get_account_performance(accountIdKey){
  //var URL = '/v1/user/' + accountIdKey + '/charts/performance.json?period=6M';
  var URL = "/v1/user/charts/performance.json?period=6M";
  console.log('URL:' + URL);
  get_et_api_callback(handle_response, handle_error, URL, '', 'GET', '', accountIdKey);
}

function get_transactions(accountIdKey){
  var URL = '/v1/accounts/' + accountIdKey + '/transactions.json'; //transactions
  console.log('URL:' + URL);
  get_et_api_callback(handle_response, handle_error, URL, '', 'GET', '', accountIdKey );
}


function authenticate(){
  res.redirect('/sessions/etconnect');
}

//start of sample AJAX request

app.get('/api/lookup', function(req,res){
    console.log('inside quote api....' + req.query['sym']);
    var sym = req.query['sym'];
    var URL = '/v1/market/lookup/' + sym + '.json';
    var response = get_et_api(res, URL, sym, 'GET', '');
});

app.get('/api/news', function(req, res) {
  var URL_NEWS = '/v1/market/news/BusinessWire,PRNewswire,DowJones,Marketwire,GlobeNewswire.json';
  var sym = req.query['sym'];
  var response = etapi.get_et_api(res, URL_NEWS, sym, 'GET', '');
});

app.get('/api/quote', function(req, res) {
  var sym = req.query['sym'];
  console.log('symbol:' + sym);
  var URL_QUOTE = '/v1/market/quote/' + sym + '.json';
  var response = get_et_api(res, URL_QUOTE, '', 'GET', '');
});

app.get('/api/indices', function(req, res) {
  var URL_QUOTE = '/v1/market/quote/DJIND,COMP.IDX,SPX,TNX,NYA,XMI,RUT,OEX,DJTRA,DJUTL.json?detailFlag=INTRADAY';
  var response = get_et_api(res, URL_QUOTE, '', 'GET', '');
});

app.get('/api/movers', function(req, res) {
  var exh = req.query['exh'];
  var type = req.query['type'];
  var URL = '/v1/market/movers/' + type + '.json?exchange=' + exh  ;
  var response = get_et_api(res, URL, '', 'GET', '');
});


app.get('/api/accounts', function(req, res) {
  var URL_ACCOUNTS = '/v1/accounts.json';
  var response = get_et_api(res, URL_ACCOUNTS, '', 'GET', '');
});
app.get('/api/watchlists', function(req, res) {
  var URL_WATCHLIST = 'v1/user/watchlists.json';
  var response = get_et_api(res, URL_WATCHLIST, '', 'GET', '');
});

app.get('/api/portfolio', function(req, res) {
  var ac = req.query['account'];
  var URL = '/v1/accounts/' + ac + '/portfolio.json';
  var response = get_et_api(res, URL, '', 'GET', '');
});

app.get('/api/transactions', function(req, res) {
  var ac = req.query['account'];
  var URL = '/v1/accounts/' + ac + '/transactions.json';
  var response = get_et_api(res, URL, '', 'GET', '');
});

//end of sample AJAX requests
//static

app.get('/main', function(req,res){
    res.sendfile(__dirname + '/index.html');
});

//common function to handle response over socket

function get_et_api_stream(res_topic,url, parameters, http_method, post_data){
  var url = API_BASE_URL + url;
  console.log('url:' + url);
  console.log('parameters:' + parameters);
  etconsumer().getProtectedResource(
    url,
    http_method,
    ET_ACCESS_TOKEN,
    ET_ACCESS_TOKEN_SECRET,
    function (error, data, response) {
      if(error){
        console.log("StatusCode is:" +response.statusCode);
        io.sockets.emit('error', error, error);
      }
      else {
        console.log("StatusCode is:" +response.statusCode);
        if(response.statusCode == 204){
          io.sockets.emit('info', 'NO_DATA', 'No Data Found!!!');
        }
        else{
          io.sockets.emit(res_topic, data, data);
        }
      }
    });
}

//common function to handle request/response
function get_et_api(res,url, parameters, http_method, post_data){
  var url = API_BASE_URL + url;
  console.log('url:' + url);
  console.log('parameters:' + parameters);
  etconsumer().getProtectedResource(
    url,
    http_method,
    ET_ACCESS_TOKEN,
    ET_ACCESS_TOKEN_SECRET,
    function (error, data, response) {
      if(error){
        console.log("StatusCode is:" +response.statusCode);
        res.send(error);
        
      }
      else {
        var feed = JSON.parse(data);
        res.send(feed);
      }
    });
}

//common function to handle request/response
function get_et_api_callback(callback,error_callback,url, parameters, http_method, post_data, accountIdKey){
  var url = API_BASE_URL + url;
  console.log('url:' + url);
  console.log('parameters:' + parameters);
  etconsumer().getProtectedResource(
    url,
    http_method,
    ET_ACCESS_TOKEN,
    ET_ACCESS_TOKEN_SECRET,
    function (error, data, response) {
      if(error){
        console.log(error);
        try {
          if(response == null || response == undefined)
            error_callback("error calling api....");
          console.log("StatusCode is:" +response.statusCode);
          error_callback(error);
        }
        catch(error){
          error_callback('error calling api...');
        }
      }
      else {
        //console.log('data:' + data);
        if(data == null || data == undefined)
          error_callback("error calling api....");
        var feed = '';
        try {
          feed = JSON.parse(data);
          callback(data, accountIdKey);
        }
        catch (err){
          console.log(err);
          error_callback("error calling api....");  
        }
        
      }
    });
}

//logging
function logMonitor(req){
  console.log ('ipaddress:' + req.ip);
}

//et oauth connect to get request token

app.get('/sessions/etconnect', function(req, res){
  etconsumer().getOAuthRequestToken(function(error, oauthToken, oauthTokenSecret, results){
    if (error) {
      console.log(error);
      res.send("Error getting OAuth request token : " + sys.inspect(error), 500);
    } else {  
      req.session.oauthRequestToken = oauthToken;
      req.session.oauthRequestTokenSecret = oauthTokenSecret;
      ET_ACCESS_TOKEN = oauthToken;
      ET_ACCESS_TOKEN_SECRET = oauthTokenSecret;
      console.log ('URL Redirect:' + ET_AUTHORIZE_URL + ET_CONSUMER_KEY + '&token=' + req.session.oauthRequestToken);
      res.redirect( ET_AUTHORIZE_URL + ET_CONSUMER_KEY + '&token=' +  req.session.oauthRequestToken);          
    }
  });
});

//et oauth connect to get access token after customer authorize it

app.get('/sessions/etcallback', function(req, res){
  console.log("INSIDE ET CALLBACK...");
  console.log('Token:' + ET_ACCESS_TOKEN);
  console.log('Token Secret :' + ET_ACCESS_TOKEN_SECRET);
  sys.puts(">>"+ET_ACCESS_TOKEN);
  sys.puts(">>"+ET_ACCESS_TOKEN_SECRET);
  sys.puts(">>"+req.query.oauth_verifier);
  etconsumer().getOAuthAccessToken(ET_ACCESS_TOKEN, 
    ET_ACCESS_TOKEN_SECRET, req.query.oauth_verifier, 
    function(error, oauthAccessToken, oauthAccessTokenSecret, results) {

    if (error) {
      res.send("Error getting OAuth access token : " + sys.inspect(error) + "["+oauthAccessToken+"]"+ "["+oauthAccessTokenSecret+"]"+ "["+sys.inspect(results)+"]", 500);
      console.log("Error getting OAuth access token : " + sys.inspect(error) + "["+oauthAccessToken+"]"+ "["+oauthAccessTokenSecret+"]"+ "["+sys.inspect(results)+"]", 500);
      
    } else {
      req.session.etoauthAccessToken = oauthAccessToken;
      req.session.etoauthAccessTokenSecret = oauthAccessTokenSecret;
      ET_ACCESS_TOKEN = oauthAccessToken;
      ET_ACCESS_TOKEN_SECRET = oauthAccessTokenSecret;
      console.log('Access Token:' + ET_ACCESS_TOKEN);
      console.log('Access Token Secret:' + ET_ACCESS_TOKEN_SECRET);
      console.log('access token received...');
      res.redirect(APP_REDIRECT_URL);

    }
  });
});

function renew_token(){
  //get_et_api_callback(handle_renew_token, handle_error, API_RENEW_TOKEN, '', 'GET', '');

  var url = API_BASE_URL + API_RENEW_TOKEN;
  console.log('url:' + url);
  etconsumer().getProtectedResource(
    url,
    'GET',
    ET_ACCESS_TOKEN,
    ET_ACCESS_TOKEN_SECRET,
    function (error, data, response) {
      if(error){
        console.log(error);
        console.log("StatusCode is:" +response.statusCode);
      }
      else {
        console.log('data:' + data);
      }
    });
}

function handle_renew_token(response){
  console.log('renew token response:' + response);
}
<!-- end of et oauth -->


function handle_response(response){
  console.log(response);
}

function handle_error(error)
{
  console.log('printing the error:' + error);
  io.sockets.emit('error', 'Error', error);
}

app.listen(parseInt(process.env.PORT || 8018));
