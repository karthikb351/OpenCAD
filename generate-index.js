var path = require('path');
var fs = require('fs');
var async = require('async');
var jsonfile = require('jsonfile');
var moment = require('moment');
var sourceFilesPath = path.join(__dirname, 'src');

//Reading tag index files if they exist
var speakerNamesIndex = fs.existsSync(path.join(__dirname, 'indexes', 'speaker-names.json')) ? jsonfile.readFileSync(path.join(__dirname, 'indexes', 'speaker-names.json')) : {};
var mentionedNamesIndex = fs.existsSync(path.join(__dirname, 'indexes', 'mentioned-names.json')) ? jsonfile.readFileSync(path.join(__dirname, 'indexes', 'mentioned-names.json')) : {};
var importantSpeechesIndex = fs.existsSync(path.join(__dirname, 'indexes', 'important-speeches.json')) ? jsonfile.readFileSync(path.join(__dirname, 'indexes', 'important-speeches.json')) : {};
var referencedArticlesIndex = fs.existsSync(path.join(__dirname, 'indexes', 'referenced-articles.json')) ? jsonfile.readFileSync(path.join(__dirname, 'indexes', 'referenced-articles.json')) : {};
var contentCategoriesIndex = fs.existsSync(path.join(__dirname, 'indexes', 'content-category.json')) ? jsonfile.readFileSync(path.join(__dirname, 'indexes', 'content-category.json')) : {};
var foreignConstitutionsIndex = fs.existsSync(path.join(__dirname, 'indexes', 'foreign-consitutions.json')) ? jsonfile.readFileSync(path.join(__dirname, 'indexes', 'foreign-consitutions.json')) : {};

//Template function for updating the tag indexes
var updateIndex = function(index, date, paragraphNumber, element) {
  if(index.hasOwnProperty(element)) {
    if(index[element].hasOwnProperty(date)) {
      index[element][date].push(paragraphNumber);
    }
    else {
      index[element][date] = [];
      index[element][date].push(paragraphNumber);
    }
  }
  else {
    index[element] = {};
    index[element][date] = [];
    index[element][date].push(paragraphNumber);
  }
  return index;
}

//Updates tag indexes for the cleaned lines
var updateTagIndexes = function(date, paragraphNumber, speakerName, mentionedNames, importantSpeeches, referencedArticles, contentCategory, foreignConstitutions) {

  speakerNamesIndex = updateIndex(speakerNamesIndex, date, paragraphNumber, speakerName);

  var mentionedNamesLength = mentionedNames ? mentionedNames.length : 0;
  for(var i = 0; i < mentionedNamesLength; i++) {
    mentionedNamesIndex = updateIndex(mentionedNamesIndex, date, paragraphNumber, mentionedNames[i]);
  }

  var importantSpeechesLength = importantSpeeches ? importantSpeeches.length : 0;
  for(var i = 0; i < importantSpeechesLength; i++) {
    importantSpeechesIndex = updateIndex(importantSpeechesIndex, date, paragraphNumber, importantSpeeches[i]);
  }

  var referencedArticlesLength = referencedArticles ? referencedArticles.length : 0;
  for(var i = 0; i < referencedArticlesLength; i++) {
    referencedArticlesIndex = updateIndex(referencedArticlesIndex, date, paragraphNumber, referencedArticles[i]);
  }

  var contentCategoryLength = contentCategory ? contentCategory.length : 0;
  for(var i = 0; i < contentCategoryLength; i++) {
    contentCategoriesIndex = updateIndex(contentCategoriesIndex, date, paragraphNumber, contentCategory[i]);
  }

  var foreignConstitutionsLength = foreignConstitutions ? foreignConstitutions.length : 0;
  for(var i = 0; i < foreignConstitutionsLength; i++) {
    foreignConstitutionsIndex = updateIndex(foreignConstitutionsIndex, date, paragraphNumber, foreignConstitutions[i]);
  }
};

//Function that handles the end of parsing all lines in
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
    line['date'] = date;
    updateTagIndexes(line['date'], line['paragraph_number'], line['name'], line['mentioned_names'], line['important_speeches'], line['referenced_articles'], line['content_category'], line['foreign_consitutions']);
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
  jsonfile.writeFile(indexPath, obj, function(err, result) {
    if(err) {
      console.log(err);
    }
    else {
      console.log(indexPath + ' is created!');
    }
  });
};

//Template function to find single regex matches
var singleRegexMatch = function(text, pattern, callback) {
  var textMatch = text.match(pattern);
  if(textMatch == null) {
    return null;
  }
  else {
    return textMatch[1];
  }
}

//Template function to find multiple regex matches
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

var removeDuplicates = function(arr) {
  if(arr == null) {
    return null;
  }
  var arrLength = arr.length;
  var arrKeys = {};
  var outputArr = [];
  for(var i = 0; i < arrLength; i++) {
    if(!(/^\d+$/.test(arr[i]))) {
      arr[i] = arr[i].toLowerCase();
    }
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

    result['name'] = singleRegexMatch(line, nameRegex);
    result['mentioned_names'] = removeDuplicates(multipleRegexMatch(line, mentionedNameRegex));
    result['important_speeches'] = removeDuplicates(multipleRegexMatch(line, importantSpeechRegex));

    //Converting list of referenced articles to an array of article numbers.
    var referencedArticles = multipleRegexMatch(line, referencedArticleRegex);
    if(referencedArticles == null) {
      result['referenced_articles'] = null;
    }
    else {
      var referencedArticlesNumbers = [];
      referencedArticles.map(function(referencedArticle) {
        var temp = referencedArticle.split(/\s*,\s*/);
        referencedArticlesNumbers = referencedArticlesNumbers.concat(temp.map(function(num) {
          return parseInt(num, 10);
        }));
      });
      result['referenced_articles'] = removeDuplicates(referencedArticlesNumbers);
    }

    //Converting list of content cateogries to an array of individual content categories
    var contentCategories = multipleRegexMatch(line, contentCategoryRegex);
    if(contentCategories == null) {
      result['content_category'] = null;
    }
    else {
      var completeContentCategories = [];
      contentCategories.map(function(contentCategory) {
        completeContentCategories = completeContentCategories.concat(contentCategory.split(/\s*,\s*/));
      });
      result['content_category'] = removeDuplicates(completeContentCategories);
    }

    //Converting list of foreing constitutions referred to an array of foreign constitutions
    var foreignConstitutions = multipleRegexMatch(line, foreignConstitutionsRegex);
    if(foreignConstitutions == null) {
      result['foreign_consitutions'] = null;
    }
    else {
      var completeForeignConstiutions = [];
      foreignConstitutions.map(function(foreignConstitution) {
        completeForeignConstiutions = completeForeignConstiutions.concat(foreignConstitution.split(/\s*,\s*/));
      });
      result['foreign_consitutions'] = removeDuplicates(completeForeignConstiutions);
    }
    callback(null, result);
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

  //Creating tag index files
  jsonfile.writeFileSync(path.join(__dirname, 'indexes', 'speaker-names.json'), speakerNamesIndex);
  jsonfile.writeFileSync(path.join(__dirname, 'indexes', 'mentioned-names.json'), mentionedNamesIndex);
  jsonfile.writeFileSync(path.join(__dirname, 'indexes', 'important-speeches.json'), importantSpeechesIndex);
  jsonfile.writeFileSync(path.join(__dirname, 'indexes', 'referenced-articles.json'), referencedArticlesIndex);
  jsonfile.writeFileSync(path.join(__dirname, 'indexes', 'content-category.json'), contentCategoriesIndex);
  jsonfile.writeFileSync(path.join(__dirname, 'indexes', 'foreign-consitutions.json'), foreignConstitutionsIndex);
};

fs.readdir(sourceFilesPath, getSourceFiles);
