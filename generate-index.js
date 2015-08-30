var path = require('path');
var fs = require('fs');
var async = require('async');
var jsonfile = require('jsonfile');
var sourceFilesPath = path.join(__dirname, 'src');

var finishParsingLines = function(err, results) {
  //Cleaning up the parsed lines to remove lines without paragraphs
  var date;
  for(var i = 0; i < results.length; i++) {
    if(results[i].date != null) {
      date = results[i].date;
      break;
    }
  }
  var cleanedLines = [];
  for(var i = 0; i < results.length; i++) {
    if(results[i]["paragraph_number"] == null) {
      continue;
    }
    var line = results[i];
    line["date"] = date;
    cleanedLines.push(line);
  }

  //Creating indexes directory if it isn't present
  var indexDirPath = path.join(__dirname, 'indexes');
  if (!fs.existsSync(indexDirPath)){
    fs.mkdirSync(indexDirPath);
  }

  //Creating index file
  var indexPath = path.join(__dirname, 'indexes', date + '.json');
  var obj = {paragraphs: cleanedLines};
  jsonfile.writeFile(indexPath, obj, function(err) {
    console.log(err);
  });
};

var singleRegexMatch = function(text, pattern) {
  var textMatch = text.match(pattern);
  if(textMatch == null) {
    return null;
  }
  else {
    return textMatch[1];
  }
}

var multipleRegexMatch = function(text, pattern) {
  var textMatches = [], textMatch;
  while((textMatch = pattern.exec(text)) != null) {
    textMatches.push(textMatch[1]);
  }
  if(textMatches.length == 0) {
    return null;
  }
  else {
    return textMatches;
  }
}

var parseLine = function(line, callback) {
  var result = {};
  var date = line.match(/\<\<(.*)\>\>/);
  result["date"] = date == null ? null : date[1];
  var paragraphNumber = line.match(/\<(.*)\>[^\>]/);
  result["paragraph_number"] = paragraphNumber == null ? null : parseInt(paragraphNumber[1]);
  if(paragraphNumber != null) {

    var nameRegex = /[^\[]\[\[([^\[\]]*)\]\][^\]]/
    result["name"] = singleRegexMatch(line, nameRegex);

    var mentionedNameRegex = /\[\[\[([^\[\]]*)\]\]\]/g;
    result["mentioned_names"] = multipleRegexMatch(line, mentionedNameRegex);

    var importantSpeechRegex = /\\\\(.*)\\\\/g;
    result["important_speeches"] = multipleRegexMatch(line, importantSpeechRegex);

    var referencedArticleRegex = /\|\|([0-9,\s]*)\|\|/g;
    var referencedArticles = [];
    if((referencedArticles = multipleRegexMatch(line, referencedArticleRegex)) == null) {
      referencedArticles = [];
    }
    var referencedArticlesNumbers = [];
    for(var i = 0; i < referencedArticles.length; i++) {
      var temp = referencedArticles[i].split(',');
      for(var j = 0; j < temp.length; j++) {
        temp[j] = parseInt(temp[j].replace( /^\D+/g, ''));
      }
      referencedArticlesNumbers = referencedArticlesNumbers.concat(temp);
    }
    result["referenced_articles"] = referencedArticles.length == 0 ? null : referencedArticlesNumbers;

    var contentCategoryRegex = /\#\#(.*)\#\#/;
    result["content_category"] = singleRegexMatch(line, contentCategoryRegex);

    var foreignConstitutionsRegex = /\#\/(.*)\#\//;
    var foreignConstitutions;
    if((foreignConstitutions = singleRegexMatch(line, foreignConstitutionsRegex)) != null) {
      foreignConstitutions = foreignConstitutions.split(',');
      for(var i = 0; i < foreignConstitutions.length; i++) {
        foreignConstitutions[i] = foreignConstitutions[i].trim();
      }
    }
    result["foreign_consitutions"] = foreignConstitutions;
  }
  callback(null, result);
};

var readSourceFile = function(err, result) {
  var lines = result.toString().split('\n');
  async.map(lines, parseLine, finishParsingLines);
};

var getSourceFiles = function(err, files) {
  for(var i = 0; i < files.length; i++) {
    if(path.extname(files[i]) == '.txt') {
      fs.readFile(path.join(__dirname, 'src', files[i]), readSourceFile);
    }
  }
};

fs.readdir(sourceFilesPath, getSourceFiles);
