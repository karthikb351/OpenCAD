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

var parseLine = function(line, callback) {
  var result = {};
  var date = line.match(/\<\<(.*)\>\>/);
  result["date"] = date == null ? null : date[1];
  var paragraphNumber = line.match(/\<(.*)\>[^\>]/);
  result["paragraph_number"] = paragraphNumber == null ? null : parseInt(paragraphNumber[1]);
  if(paragraphNumber != null) {
    var name = line.match(/[^\[]\[\[([^\[\]]*)\]\][^\]]/);
    result["name"] = name == null ? null : name[1];
    var mentionedNames = [], mentionedName;
    var mentionedNameRegex = /\[\[\[([^\[\]]*)\]\]\]/g;
    while((mentionedName = mentionedNameRegex.exec(line)) != null) {
      mentionedNames.push(mentionedName[1]);
    }
    result["mentioned_names"] = mentionedNames.length == 0 ? null : mentionedNames;


    var importantSpeeches = [], importantSpeech;
    var importantSpeechRegex = /\\\\(.*)\\\\/g;
    while((importantSpeech = importantSpeechRegex.exec(line)) != null) {
      importantSpeeches.push(importantSpeech[1]);
    }
    result["important_speeches"] = importantSpeeches.length == 0 ? null : importantSpeeches;

    var referencedArticles = [], referencedArticle;
    var referencedArticleRegex = /\|\|([0-9,\s]*)\|\|/g;
    while((referencedArticle = referencedArticleRegex.exec(line)) != null) {
      referencedArticles.push(referencedArticle[1]);
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

    var contentCategory = line.match(/\#\#(.*)\#\#/);
    result["content_category"] = contentCategory == null ? null : contentCategory[1];

    var foreignConstitutions = line.match(/\#\/(.*)\#\//);
    result["foreign_consitutions"] = foreignConstitutions == null ? null : foreignConstitutions[1];

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
