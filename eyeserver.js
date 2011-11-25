var express = require('express'),
    Eye = require('./eye');

var eyeFlagNames = {};
Eye.flagNames.forEach(function (option) {
  eyeFlagNames[option.toLowerCase()] = option;
});

function EyeServer(options) {
  options = options || {};
  
  // dummy constructor to enable EyeServer construction without new
  function F() {};
  F.prototype = EyeServer.prototype;
  
  // create new EyeServer, inheriting from express.HTTPServer
  eyeServer = new F();
  eyeServer.constructor = EyeServer;
  express.HTTPServer.call(eyeServer, []);
  
  // intialize reasoner
  var eye = new Eye();
  
  // initialize server
  eyeServer.use(express.bodyParser());
  eyeServer.get (/^\/$/, handleEyeRequest);
  eyeServer.post(/^\/$/, handleEyeRequest);
  eyeServer.options(/^\/$/, handleOptions);
  
  function handleEyeRequest (req, res, next) {
    var reqParams = req.query,
        body = req.body || {},
        data = reqParams.data || [],
        query = reqParams.query || body.query,
        jsonpCallback = reqParams.callback,
        settings = {};
    
    // make sure data is an array
    if(typeof(data) === 'string')
      data = data.split(',');
    
    // add body data
    if(typeof(body.data) === 'string')
      data.push(body.data);
    else if(body.data instanceof Array)
      data.push.apply(data, body.data);
    
    // collect data and data URIs
    settings.data = [];
    // inspect all data parameters in request parameters
    data.forEach(function (item) {
      if(!item.match(/^https?:\/\//))
        // item is N3 data – push it
        settings.data.push(item);
      else
        // item is list of URIs – push each of them
        settings.data.push.apply(settings.data, item.split(','));
    });
    
    // do a reasoner pass by default
    settings.pass = true;
    
    // add query if present
    if(query) {
      settings.query = query;
      delete settings.pass;
    }
    
    // add boolean flags
    for(var param in reqParams) {
      var eyeFlagName = eyeFlagNames[param.replace(/-/g, '').toLowerCase()];
      if(eyeFlagName)
        settings[eyeFlagName] = !reqParams[param].match(/^0|false$/i);
    }

    // add debug information if requested
    if(options.debug)
      settings.originalUrl = req.originalUrl;

    // execute the reasoner and return result or error
    (options.eye || eye).execute(settings, function (error, result) {
      if(!jsonpCallback) {
        setHeaders(req, res);
        if(!error) {
          res.header('Content-Type', 'text/n3');
          res.send(result + '\n');
        }
        else {
          res.header('Content-Type', 'text/plain');
          res.send(error + '\n', 400);
        }
      }
      else {
        res.header('Content-Type', 'application/javascript');
        if(jsonpCallback.match(/^[\w\d-_]+$/i))
          res.send(jsonpCallback + '(' + JSON.stringify(error || result) + ')');
        else
          res.send('alert("Illegal callback name.")', 400);
      }
    });
  }
  
  function handleOptions(req, res, next) {
    setHeaders(req, res);
    res.header('Content-Type', 'text/plain');
    res.send('');
  }
  
  function setHeaders(req, res) {
    res.header('X-Powered-By', 'EYE Server');
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  return eyeServer;
}

// inherit from express.HTTPServer
EyeServer.prototype.constructor = EyeServer;
EyeServer.prototype.__proto__ = express.HTTPServer.prototype;

module.exports = EyeServer;
