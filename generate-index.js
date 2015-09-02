var path = require('path');
var fs = require('fs');
var async = require('async');
var jsonfile = require('jsonfile');
var moment = require('moment');
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

  var year = date.match(/[\d]{4}/g)[0];
  var month = date.match(/January|February|March|April|May|June|July|August|September|October|November|December/g)[0];
  var day = date.match(/[\d]{1,2}/g)[0];
  date = moment(year+'-'+month+'-'+day, 'YYYY-MMM-DD').format('YYYY-MM-DD');

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

//Template function to find single regex matches
var singleRegexMatch = function(text, pattern, callback) {
  var textMatch = text.match(pattern);
  if(textMatch == null) {
    callback(null, null);
  }
  else {
    callback(null, textMatch[1]);
  }
}

//Template function to find multiple regex matches
var multipleRegexMatch = function(text, pattern, callback) {
  var textMatches = [], textMatch;
  while((textMatch = pattern.exec(text)) != null) {
    textMatches.push(textMatch[1]);
  }
  if(textMatches.length == 0) {
    callback(null, null);
  }
  else {
    callback(null, textMatches);
  }
}

var removeDuplicates = function(arr) {
  if(arr == null) {
    return null;
  }
  var arrLength = arr.length;
  var arrKeys = {};
  var outputArr = [];
  for(var i = 0; i < arrLength; i++) {
    arrKeys[arr[i]] = 0;
  }
  for(var i in arrKeys) {
    if(/^\d+$/.test(i)) {
      outputArr.push(parseInt(i));
    }
    else {
      outputArr.push(i);
    }
  }
  return outputArr;
}

//Function to parse every line of the transcript
var parseLine = function(line, callback) {
  var result = {};

  //Finding the date if found in line
  var date = line.match(/\<\<(.*)\>\>/);
  result["date"] = date == null ? null : date[1];

  //Finding the paragraph number if found in line
  var paragraphNumber = line.match(/\<(.*)\>[^\>]/);
  result["paragraph_number"] = paragraphNumber == null ? null : parseInt(paragraphNumber[1]);

  //Checking if the line is a paragraph or not. To determine further markup parsing
  if(paragraphNumber != null) {

    //Defining the regexes for finding the markup :D
    var nameRegex = /[^\[]\[\[([^\[\]]*)\]\][^\]]/;
    var mentionedNameRegex = /\[\[\[([^\[\]]*)\]\]\]/g;
    var importantSpeechRegex = /\\\\(.*)\\\\/g;
    var referencedArticleRegex = /\|\|([0-9,\s]*)\|\|/g;
    var contentCategoryRegex = /\#\#([^\#]*)\#\#/g;
    var foreignConstitutionsRegex = /\#\/([^\#\/]*)\#\//g;

    /*
    Callback function to define behaviour on matching completion for speaker name,
    mentioned names, important speeches, referenced articles, content cateogries
    and foreign constitution references.
    */
    var onFinishRegexMatching = function(err, results) {
      if(err) {
        console.log("Error in Regex Matching!")
      }
      else {
        result["name"] = results[0];
        result["mentioned_names"] = removeDuplicates(results[1]);
        result["important_speeches"] = removeDuplicates(results[2]);

        //Converting list of referenced articles to an array of article numbers.
        var referencedArticles = results[3];
        if(referencedArticles == null) {
          result["referenced_articles"] = null;
        }
        else {
          var referencedArticlesNumbers = [];
          referencedArticles.map(function(referencedArticle) {
            var temp = referencedArticle.split(/\s*,\s*/);
            referencedArticlesNumbers = referencedArticlesNumbers.concat(temp.map(function(num) {
              return parseInt(num, 10);
            }));
          });
          result["referenced_articles"] = removeDuplicates(referencedArticlesNumbers);
        }

        var contentCategories = results[4];
        if(contentCategories == null) {
          result["content_category"] = null;
        }
        else {
          var completeContentCategories = [];
          contentCategories.map(function(contentCategory) {
            completeContentCategories = completeContentCategories.concat(contentCategory.split(/\s*,\s*/));
          });
          result["content_category"] = removeDuplicates(completeContentCategories);
        }

        //Converting list of foreing constitutions referred to an array of foreign constitutions
        var foreignConstitutions = results[5];
        if(foreignConstitutions == null) {
          result["foreign_consitutions"] = null;
        }
        else {
          var completeForeignConstiutions = [];
          foreignConstitutions.map(function(foreignConstitution) {
            completeForeignConstiutions = completeForeignConstiutions.concat(foreignConstitution.split(/\s*,\s*/));
          });
          result["foreign_consitutions"] = removeDuplicates(completeForeignConstiutions);
        }
        //Returning the result object containing all markup info for paragraph
        callback(null, result);
      }
    };

    //Performing the regex matching in parallel
    async.parallel([singleRegexMatch.bind(null, line, nameRegex),
    multipleRegexMatch.bind(null, line, mentionedNameRegex),
    multipleRegexMatch.bind(null, line, importantSpeechRegex),
    multipleRegexMatch.bind(null, line, referencedArticleRegex),
    multipleRegexMatch.bind(null, line, contentCategoryRegex),
    multipleRegexMatch.bind(null, line, foreignConstitutionsRegex)], onFinishRegexMatching);
  }
  else {
    callback(null, result);
  }
};

//Function to read the transcript file and split to line by line
var readSourceFile = function(err, result) {
  var lines = result.toString().split('\n');
  async.map(lines, parseLine, finishParsingLines);
};

//Function to get all the transcript files in the src/ directory
var getSourceFiles = function(err, files) {
  for(var i = 0; i < files.length; i++) {
    if(path.extname(files[i]) == '.txt') {
      fs.readFile(path.join(__dirname, 'src', files[i]), readSourceFile);
    }
  }
};

fs.readdir(sourceFilesPath, getSourceFiles);
