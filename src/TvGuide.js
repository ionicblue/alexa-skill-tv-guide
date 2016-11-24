'use strict';

/**
 * App ID for the skill
 */
const APP_ID = process.env.SKILL_APP_ID; //replace with 'amzn1.ask.skill.[your-unique-value-here]';

const http = require('http');
const alexaDateUtil = require('./alexaDateUtil');

/**
 * The AlexaSkill prototype and helper functions
 */
const AlexaSkill = require('./AlexaSkill');

/**
 * TvGuide is a child of AlexaSkill.
 */
var TvGuide = function () {
  AlexaSkill.call(this, APP_ID);
};

// Extend AlexaSkill
TvGuide.prototype = Object.create(AlexaSkill.prototype);
TvGuide.prototype.constructor = TvGuide;

// ----------------------- Override AlexaSkill request and intent handlers -----------------------

TvGuide.prototype.eventHandlers.onSessionStarted = function (sessionStartedRequest, session) {
  console.log("onSessionStarted requestId: " + sessionStartedRequest.requestId +
    ", sessionId: " + session.sessionId);
  // any initialization logic goes here
};

TvGuide.prototype.eventHandlers.onLaunch = function (launchRequest, session, response) {
  console.log("onLaunch requestId: " + launchRequest.requestId + ", sessionId: " + session.sessionId);
  handleWelcomeRequest(response);
};

TvGuide.prototype.eventHandlers.onSessionEnded = function (sessionEndedRequest, session) {
  console.log("onSessionEnded requestId: " + sessionEndedRequest.requestId +
    ", sessionId: " + session.sessionId);
  // any cleanup logic goes here
};

/**
 * override intentHandlers to map intent handling functions.
 */
TvGuide.prototype.intentHandlers = {
  "OneshotScheduleIntent": function (intent, session, response) {
    handleOneshotScheduleRequest(intent, session, response);
  },

  "DialogTvGuideIntent": function (intent, session, response) {
    // Determine if this turn is for city, for date, or an error.
    // We could be passed slots with values, no slots, slots with no value.
    var citySlot = intent.slots.City;
    var dateSlot = intent.slots.Date;
    if (citySlot && citySlot.value) {
      handleCityDialogRequest(intent, session, response);
    } else if (dateSlot && dateSlot.value) {
      handleDateDialogRequest(intent, session, response);
    } else {
      handleNoSlotDialogRequest(intent, session, response);
    }
  },

  "AMAZON.HelpIntent": function (intent, session, response) {
    handleHelpRequest(response);
  },

  "AMAZON.StopIntent": function (intent, session, response) {
    var speechOutput = "Goodbye";
    response.tell(speechOutput);
  },

  "AMAZON.CancelIntent": function (intent, session, response) {
    var speechOutput = "Goodbye";
    response.tell(speechOutput);
  }
};

// -------------------------- TvGuide Domain Specific Business Logic --------------------------

function handleWelcomeRequest(response) {
  var whichCityPrompt = "Which city would you like tide information for?",
    speechOutput = {
      speech: "<speak>Welcome to Tide Pooler. " +
        "<audio src='https://s3.amazonaws.com/ask-storage/TvGuide/OceanWaves.mp3'/>" +
        whichCityPrompt +
        "</speak>",
      type: AlexaSkill.speechOutputType.SSML
    },
    repromptOutput = {
      speech: "I can lead you through providing a city and " +
        "day of the week to get tide information, " +
        "or you can simply open Tide Pooler and ask a question like, " +
        "get tide information for Seattle on Saturday. " +
        "For a list of supported cities, ask what cities are supported. " +
        whichCityPrompt,
      type: AlexaSkill.speechOutputType.PLAIN_TEXT
    };

  response.ask(speechOutput, repromptOutput);
}

function handleHelpRequest(response) {
  var repromptText = "Which city would you like tide information for?";
  var speechOutput = "I can lead you through providing a city and " +
    "day of the week to get tide information, " +
    "or you can simply open Tide Pooler and ask a question like, " +
    "get tide information for Seattle on Saturday. " +
    "For a list of supported cities, ask what cities are supported. " +
    "Or you can say exit. " +
    repromptText;

  response.ask(speechOutput, repromptText);
}

/**
 * Handles the case where the user asked or for, or is otherwise being with supported cities
 */
function handleSupportedCitiesRequest(intent, session, response) {
  // get city re-prompt
  var repromptText = "Which city would you like tide information for?";
  var speechOutput = "Currently, I know tide information for these coastal cities: " + getAllStationsText() +
    repromptText;

  response.ask(speechOutput, repromptText);
}

/**
 * Handles the dialog step where the user provides a city
 */
function handleCityDialogRequest(intent, session, response) {

  var cityStation = getCityStationFromIntent(intent, false),
    repromptText,
    speechOutput;
  if (cityStation.error) {
    repromptText = "Currently, I know tide information for these coastal cities: " + getAllStationsText() +
      "Which city would you like tide information for?";
    // if we received a value for the incorrect city, repeat it to the user, otherwise we received an empty slot
    speechOutput = cityStation.city ? "I'm sorry, I don't have any data for " + cityStation.city + ". " + repromptText : repromptText;
    response.ask(speechOutput, repromptText);
    return;
  }

  // if we don't have a date yet, go to date. If we have a date, we perform the final request
  if (session.attributes.date) {
    getFinalScheduleResponse(cityStation, session.attributes.date, response);
  } else {
    // set city in session and prompt for date
    session.attributes.city = cityStation;
    speechOutput = "For which date?";
    repromptText = "For which date would you like tide information for " + cityStation.city + "?";

    response.ask(speechOutput, repromptText);
  }
}

/**
 * Handles the dialog step where the user provides a date
 */
function handleDateDialogRequest(intent, session, response) {

  var date = getDateFromIntent(intent),
    repromptText,
    speechOutput;
  if (!date) {
    repromptText = "Please try again saying a day of the week, for example, Saturday. " +
      "For which date would you like tide information?";
    speechOutput = "I'm sorry, I didn't understand that date. " + repromptText;

    response.ask(speechOutput, repromptText);
    return;
  }

  // if we don't have a city yet, go to city. If we have a city, we perform the final request
  if (session.attributes.city) {
    getFinalScheduleResponse(session.attributes.city, date, response);
  } else {
    // The user provided a date out of turn. Set date in session and prompt for city
    session.attributes.date = date;
    speechOutput = "For which city would you like tide information for " + date.displayDate + "?";
    repromptText = "For which city?";

    response.ask(speechOutput, repromptText);
  }
}

/**
 * Handle no slots, or slot(s) with no values.
 * In the case of a dialog based skill with multiple slots,
 * when passed a slot with no value, we cannot have confidence
 * it is the correct slot type so we rely on session state to
 * determine the next turn in the dialog, and reprompt.
 */
function handleNoSlotDialogRequest(intent, session, response) {
  if (session.attributes.city) {
    // get date re-prompt
    var repromptText = "Please try again saying a day of the week, for example, Saturday. ";
    var speechOutput = repromptText;

    response.ask(speechOutput, repromptText);
  } else {
    // get city re-prompt
    handleSupportedCitiesRequest(intent, session, response);
  }
}

/**
 * This handles the one-shot interaction, where the user utters a phrase like:
 * 'Alexa, open Tide Pooler and get tide information for Seattle on Saturday'.
 * If there is an error in a slot, this will guide the user to the dialog approach.
 */
function handleOneshotScheduleRequest(intent, session, response) {

  // Determine show
  const show = getShowNameFromIntent(intent);
  let repromptText;
  let speechOutput;
  if (show.error) {
    // invalid show, move to the dialog
    repromptText = "Which show would you like to know the schedule for?";
    speechOutput = repromptText;

    response.ask(speechOutput, repromptText);
    return;
  }
  /*
      // Determine custom date
      var date = getDateFromIntent(intent);
      if (!date) {
          // Invalid date. set city in session and prompt for date
          session.attributes.city = cityStation;
          repromptText = "Please try again saying a day of the week, for example, Saturday. "
              + "For which date would you like tide information?";
          speechOutput = "I'm sorry, I didn't understand that date. " + repromptText;

          response.ask(speechOutput, repromptText);
          return;
      }
  */
  // all slots filled, either from the user or by default values. Move to final request
  getFinalScheduleResponse(show.name, response);
}

/**
 * Both the one-shot and dialog based paths lead to this method to issue the request, and
 * respond to the user with the final answer.
 */
function getFinalScheduleResponse(showName, response) {

  // Issue the request, and respond to the user
  makeShowRequest(showName, function showSchduleResponseCallback(err, apiResponse) {
    let speechOutput;

    if (err) {
      speechOutput = "Sorry, the TVmaze service is experiencing a problem. Please try again later";
    } else {
      speechOutput = `${apiResponse.name} is on next at 8:00 pm on Wednesday November 23rd on BBC One`;
    }

    response.tellWithCard(speechOutput, "TvGuide", speechOutput)
  });
}

const SHOWS_API_ENDPOINT = 'http://api.tvmaze.com/singlesearch/shows';

function makeShowRequest(showName, responseCallback) {

  let url = SHOWS_API_ENDPOINT;
  url += '?q=' + encodeURIComponent(showName);
  url += '&embed[]=previousepisode';
  url += '&embed[]=nextepisode';

  function processHttpResponse(response) {
    let body = '';

    // TODO: retry after pause if code = 429, as per docs: http://www.tvmaze.com/api
    console.log('Status Code: ' + response.statusCode);
    if (response.statusCode != 200) {
      responseCallback(
        new Error(`TVmaze error: Non 200 Response, ${response.statusCode} - ${response.statusMessage}`));
    }

    response.on('data', (data) => body += data);

    response.on('end', function () {
      const apiResponse = JSON.parse(body);

      if (apiResponse.error) {
        console.log("TVmaze error: " + apiResponse.error.message);
        responseCallback(new Error(apiResponse.error.message));
      } else {
        responseCallback(null, buildShowSchedule(apiResponse));
      }
    });
  }

  function httpErrorHandler(e) {
    console.log("Communications error: " + e.message);
    responseCallback(new Error(e.message));
  }

  http.get(url, processHttpResponse).on('error', httpErrorHandler);
}

function buildShowSchedule(apiResponse) {

  const showSchedule = {};
  showSchedule.name = apiResponse.name;
  showSchedule.url = apiResponse.url;
  showSchedule.channel = apiResponse.network && apiResponse.network.name;
  showSchedule.hasPreviousEpisode = !!(apiResponse._embedded && apiResponse._embedded.previousepisode);
  showSchedule.hasNextEpisode = !!(apiResponse._embedded && apiResponse._embedded.nextepisode);

  if (showSchedule.hasNextEpisode) {
    showSchedule.nextEpisodeDescription = apiResponse._embedded.nextepisode.name;
    showSchedule.nextEpisodeDate = new Date(apiResponse._embedded.nextepisode.airstamp);
  }
  if (showSchedule.hasPreviousEpisode) {
    showSchedule.previousEpisodeDescription = apiResponse._embedded.previousepisode.name;
    showSchedule.previousEpisodeDate = new Date(apiResponse._embedded.previousepisode.airstamp);
  }
  if (!showSchedule.hasNextEpisode) {
    showSchedule.isEnded = true;
  }

  console.log(showSchedule);
  return showSchedule;
}

/**
 * Gets the show name from the intent, or returns an error
 */
function getShowNameFromIntent(intent) {
  let slot = intent.slots.ShowName;
  // slots can be missing, or slots can be provided but with empty value, so must test for both.
  if (!slot || !slot.value) {
    return {
      error: true
    }
  } else {
    return {
      name: slot.value
    }
  }
}

/**
 * Gets the date from the intent, defaulting to today if none provided,
 * or returns an error
 */
function getDateFromIntent(intent) {

  var dateSlot = intent.slots.Date;
  // slots can be missing, or slots can be provided but with empty value.
  // must test for both.
  if (!dateSlot || !dateSlot.value) {
    // default to today
    return {
      displayDate: "Today",
      requestDateParam: "date=today"
    }
  } else {

    var date = new Date(dateSlot.value);

    // format the request date like YYYYMMDD
    var month = (date.getMonth() + 1);
    month = month < 10 ? '0' + month : month;
    var dayOfMonth = date.getDate();
    dayOfMonth = dayOfMonth < 10 ? '0' + dayOfMonth : dayOfMonth;
    var requestDay = "begin_date=" + date.getFullYear() + month + dayOfMonth +
      "&range=24";

    return {
      displayDate: alexaDateUtil.getFormattedDate(date),
      requestDateParam: requestDay
    }
  }
}

TvGuide.getFinalScheduleResponse = getFinalScheduleResponse;

module.exports = TvGuide;
