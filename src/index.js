/**
    Copyright 2014-2015 Amazon.com, Inc. or its affiliates. All Rights Reserved.

    Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at

        http://aws.amazon.com/apache2.0/

    or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

'use strict';

/**
 * This sample shows how to create a Lambda function for handling Alexa Skill requests that:
 * - Web service: communicate with an external web service to get tide data from NOAA CO-OPS API (http://tidesandcurrents.noaa.gov/api/)
 * - Multiple optional slots: has 2 slots (city and date), where the user can provide 0, 1, or 2 values, and assumes defaults for the unprovided values
 * - DATE slot: demonstrates date handling and formatted date responses appropriate for speech
 * - Custom slot type: demonstrates using custom slot types to handle a finite set of known values
 * - Dialog and Session state: Handles two models, both a one-shot ask and tell model, and a multi-turn dialog model.
 *   If the user provides an incorrect slot in a one-shot model, it will direct to the dialog model. See the
 *   examples section for sample interactions of these models.
 * - Pre-recorded audio: Uses the SSML 'audio' tag to include an ocean wave sound in the welcome response.
 *
 * Examples:
 * One-shot model:
 *  User:  "Alexa, ask TV Guide when is Strictly Come Dancing next on?"
 *  Alexa: "Strictly Come Dancing is on next at 8:00 pm on Wednesday November 23rd on BBC One"
 * Dialog model:
 *  User:  "Alexa, open TV Guide"
 *  Alexa: "Welcome to TV Guide. Which program would you like schedule information for?"
 *  User:  "Watchdog"
 *  Alexa: "Watchdog is on next at 8:00 pm on Wednesday November 23rd on BBC One"
 */
const TvGuide = require('./TvGuide')

// Create the handler that responds to the Alexa Request.
exports.handler = function (event, context) {
  const tvGuide = new TvGuide();
  tvGuide.execute(event, context);
};
