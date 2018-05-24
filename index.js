/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require("ask-sdk-core");
const questions = require("./questions");

const ANSWER_COUNT = 4;
const GAME_LENGTH = 5;

function populateGameQuestions(categoryQuestions) {
  const gameQuestions = [];
  const indexList = [];
  let index = categoryQuestions.length;
  if (GAME_LENGTH > index) {
    throw new Error("Invalid Game Length.");
  }

  for (let i = 0; i < categoryQuestions.length; i += 1) {
    indexList.push(i);
  }

  for (let j = 0; j < GAME_LENGTH; j += 1) {
    const rand = Math.floor(Math.random() * index);
    index -= 1;

    const temp = indexList[index];
    indexList[index] = indexList[rand];
    indexList[rand] = temp;
    gameQuestions.push(indexList[index]);
  }
  return gameQuestions;
}

function populateRoundAnswers(
  gameQuestionIndexes,
  correctAnswerIndex,
  correctAnswerTargetLocation,
  categoryQuestions
) {
  console.log("inside populateanswers");
  const answers = [];
  const translatedQuestion =
    categoryQuestions[gameQuestionIndexes[correctAnswerIndex]];
  const answersCopy = translatedQuestion[
    Object.keys(translatedQuestion)[0]
  ].slice();
  let index = answersCopy.length;

  if (index < ANSWER_COUNT) {
    throw new Error("Not enough answers for question.");
  }

  // Shuffle the answers, excluding the first element which is the correct answer.
  for (let j = 1; j < answersCopy.length; j += 1) {
    const rand = Math.floor(Math.random() * (index - 1)) + 1;
    index -= 1;

    const swapTemp1 = answersCopy[index];
    answersCopy[index] = answersCopy[rand];
    answersCopy[rand] = swapTemp1;
  }

  // Swap the correct answer into the target location
  for (let i = 0; i < ANSWER_COUNT; i += 1) {
    answers[i] = answersCopy[i];
  }
  const swapTemp2 = answers[0];
  answers[0] = answers[correctAnswerTargetLocation];
  answers[correctAnswerTargetLocation] = swapTemp2;
  return answers;
}

function isAnswerSlotValid(intent) {
  const answerSlotFilled =
    intent && intent.slots && intent.slots.Answer && intent.slots.Answer.value;
  const answerSlotIsInt =
    answerSlotFilled && !Number.isNaN(parseInt(intent.slots.Answer.value, 10));
  return (
    answerSlotIsInt &&
    parseInt(intent.slots.Answer.value, 10) < ANSWER_COUNT + 1 &&
    parseInt(intent.slots.Answer.value, 10) > 0
  );
}

function handleUserGuess(userGaveUp, handlerInput) {
  const { requestEnvelope, attributesManager, responseBuilder } = handlerInput;
  const { intent } = requestEnvelope.request;

  const answerSlotValid = isAnswerSlotValid(intent);

  let speechOutput = "";
  let speechOutputAnalysis = "";

  const sessionAttributes = attributesManager.getSessionAttributes();
  const gameQuestions = sessionAttributes.questions;
  let correctAnswerIndex = parseInt(sessionAttributes.correctAnswerIndex, 10);
  let currentScore = parseInt(sessionAttributes.score, 10);
  let currentQuestionIndex = parseInt(
    sessionAttributes.currentQuestionIndex,
    10
  );
  const { correctAnswerText } = sessionAttributes;
  const requestAttributes = attributesManager.getRequestAttributes();
  const categoryQuestions = questions[sessionAttributes.category.toUpperCase()];

  console.log(
    { sessionAttributes },
    sessionAttributes.category,
    { correctAnswerText },
    { correctAnswerIndex },
    intent.slots.Answer.value
  );
  if (
    answerSlotValid &&
    parseInt(intent.slots.Answer.value, 10) ===
      sessionAttributes.correctAnswerIndex
  ) {
    currentScore += 1;
    speechOutputAnalysis = ANSWER_CORRECT_MESSAGE;
  } else {
    if (!userGaveUp) {
      speechOutputAnalysis = ANSWER_WRONG_MESSAGE;
    }

    speechOutputAnalysis += `${CORRECT_ANSWER_MESSAGE} ${correctAnswerIndex}: ${correctAnswerText}`;
  }

  // Check if we can exit the game session after GAME_LENGTH questions (zero-indexed)
  if (sessionAttributes.currentQuestionIndex === GAME_LENGTH - 1) {
    const GAME_OVER_MESSAGE = getFinalScore(currentScore, GAME_LENGTH);
    speechOutput = userGaveUp ? "" : `${ANSWER_IS_MESSAGE}`;
    speechOutput += `${speechOutputAnalysis} ${GAME_OVER_MESSAGE}`;
    return responseBuilder.speak(speechOutput).getResponse();
  }
  currentQuestionIndex += 1;
  correctAnswerIndex = Math.floor(Math.random() * ANSWER_COUNT);

  const spokenQuestion = Object.keys(
    categoryQuestions[gameQuestions[currentQuestionIndex]]
  )[0];
  console.log({ spokenQuestion });
  const roundAnswers = populateRoundAnswers(
    gameQuestions,
    currentQuestionIndex,
    correctAnswerIndex,
    categoryQuestions
  );
  const questionIndexForSpeech = currentQuestionIndex + 1;
  let repromptText = `${TELL_QUESTION_MESSAGE}  
    ${questionIndexForSpeech.toString()}. ${spokenQuestion}`;

  for (let i = 0; i < ANSWER_COUNT; i += 1) {
    repromptText += `${i + 1}. ${roundAnswers[i]}. `;
  }

  speechOutput += userGaveUp ? "" : `${ANSWER_IS_MESSAGE}`;
  speechOutput += `${speechOutputAnalysis} ${SCORE_IS_MESSAGE} ${currentScore.toString()} ${repromptText}`;

  const translatedQuestion =
    categoryQuestions[gameQuestions[currentQuestionIndex]];
  Object.assign(sessionAttributes, {
    speechOutput: repromptText,
    repromptText,
    currentQuestionIndex,
    correctAnswerIndex: correctAnswerIndex + 1,
    questions: gameQuestions,
    score: currentScore,
    correctAnswerText: translatedQuestion[Object.keys(translatedQuestion)[0]][0]
  });

  return responseBuilder
    .speak(speechOutput)
    .reprompt(repromptText)
    .withSimpleCard(`${GAME_NAME} ${repromptText}`)
    .getResponse();
}

function startGame(newGame, handlerInput) {
  const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
  const category =
    handlerInput.requestEnvelope.request.intent.slots.Category.value;

  let speechOutput = newGame ? `${WELCOME_MESSAGE}` : "";
  const categoryQuestions = questions[category.toUpperCase()];
  const gameQuestions = populateGameQuestions(categoryQuestions);
  const correctAnswerIndex = Math.floor(Math.random() * ANSWER_COUNT);

  const roundAnswers = populateRoundAnswers(
    gameQuestions,
    0,
    correctAnswerIndex,
    categoryQuestions
  );
  const currentQuestionIndex = 0;
  const spokenQuestion = Object.keys(
    categoryQuestions[gameQuestions[currentQuestionIndex]]
  );
  console.log({ spokenQuestion });
  let repromptText = `${TELL_QUESTION_MESSAGE} ${spokenQuestion}`;
  for (let i = 0; i < ANSWER_COUNT; i += 1) {
    repromptText += `${i + 1}. ${roundAnswers[i]}. `;
  }

  speechOutput += repromptText;
  const sessionAttributes = {};

  const translatedQuestion =
    categoryQuestions[gameQuestions[currentQuestionIndex]];

  Object.assign(sessionAttributes, {
    speechOutput: repromptText,
    repromptText,
    currentQuestionIndex,
    category,
    correctAnswerIndex: correctAnswerIndex + 1,
    questions: gameQuestions,
    score: 0,
    correctAnswerText: translatedQuestion[Object.keys(translatedQuestion)[0]][0]
  });

  handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

  return handlerInput.responseBuilder
    .speak(speechOutput)
    .reprompt(repromptText)
    .withSimpleCard(`${GAME_NAME} ${repromptText}`)
    .getResponse();
}

function helpTheUser(newGame, handlerInput) {
  const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
  const askMessage = newGame
    ? `${ASK_MESSAGE_START}`
    : `${REPEAT_QUESTION_MESSAGE} ${STOP_MESSAGE}`;
  const speechOutput = `${HELP_MESSAGE} ${GAME_LENGTH} ${askMessage}`;
  const repromptText = `${HELP_REPROMPT} ${askMessage}`;

  return handlerInput.responseBuilder
    .speak(speechOutput)
    .reprompt(repromptText)
    .getResponse();
}

/* jshint -W101 */

const GAME_NAME = "Medical quiz";
const HELP_MESSAGE =
  "Respond with the number of the answer. For example, say one, two, three, or four. To start a new game at any time, say, start game. ";
const REPEAT_QUESTION_MESSAGE = "To repeat the last question, say, repeat.";
const ASK_MESSAGE_START = "Would you like to start playing?";
const HELP_REPROMPT =
  "To give an answer to a question, respond with the number of the answer. ";
const STOP_MESSAGE = "Would you like to keep playing?";
const CANCEL_MESSAGE = "Ok, let's play again soon.";
const NO_MESSAGE = "Ok, we'll play another time. Goodbye!";
const TRIVIA_UNHANDLED = "Try saying a number between 1 and %s";
const HELP_UNHANDLED = "Say yes to continue, or no to end the game.";
const START_UNHANDLED = "Say start to start a new game.";
const NEW_GAME_MESSAGE = "Welcome to";
const WELCOME_MESSAGE =
  "I will ask you a series of questions, try to get as many right as you can. Just say the number of the answer. Let's begin. ";
const ANSWER_CORRECT_MESSAGE = "correct. ";
const ANSWER_WRONG_MESSAGE = "wrong. ";
const CORRECT_ANSWER_MESSAGE = "The correct answer is";
const ANSWER_IS_MESSAGE = "That answer is ";
const TELL_QUESTION_MESSAGE = "Question";
const SCORE_IS_MESSAGE = "Your score is";

const welcomeMessage = `Welcome to the Medical Quiz!  Choose a category to start. The categories cardivascular, paediactrics or orthopedics.`;
const startQuizMessage = `OK.  I will ask you a series of questions. `;
const exitSkillMessage = `Thank you for using the medical quiz!  Let's play again soon!`;
const repromptSpeech = `Which category would you like? You can choose from cardivascular, paediactrics or orthopedics.`;
const helpMessage = `You can restart the quiz by saying start medical quiz.`;

function getFinalScore(score, counter) {
  return `Your final score is ${score} out of ${counter}. `;
}

const LaunchRequest = {
  canHandle(handlerInput) {
    const { request } = handlerInput.requestEnvelope;
    console.log({ request });

    return (
      request.type === "LaunchRequest" ||
      (request.type === "IntentRequest" &&
        request.intent &&
        request.intent.name === "AMAZON.StartOverIntent")
    );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak(welcomeMessage)
      .reprompt(helpMessage)
      .getResponse();
  }
};

const CategoryRequest = {
  canHandle(handlerInput) {
    const { request } = handlerInput.requestEnvelope;
    return request.intent.name === "CategoryIntent";
  },
  handle(handlerInput) {
    return startGame(true, handlerInput);
  }
};

const HelpIntent = {
  canHandle(handlerInput) {
    const { request } = handlerInput.requestEnvelope;

    return (
      request.type === "IntentRequest" &&
      request.intent.name === "AMAZON.HelpIntent"
    );
  },
  handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

    const newGame = !sessionAttributes.questions;
    return helpTheUser(newGame, handlerInput);
  }
};

const UnhandledIntent = {
  canHandle() {
    return true;
  },
  handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    if (Object.keys(sessionAttributes).length === 0) {
      const speechOutput = `${START_UNHANDLED}`;
      return handlerInput.attributesManager
        .speak(speechOutput)
        .reprompt(speechOutput)
        .getResponse();
    } else if (sessionAttributes.questions) {
      const speechOutput = `${TRIVIA_UNHANDLED} ${ANSWER_COUNT.toString()}`;
      return handlerInput.attributesManager
        .speak(speechOutput)
        .reprompt(speechOutput)
        .getResponse();
    }
    const speechOutput = `${HELP_UNHANDLED}`;
    return handlerInput.attributesManager
      .speak(speechOutput)
      .reprompt(speechOutput)
      .getResponse();
  }
};

const SessionEndedRequest = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === "SessionEndedRequest";
  },
  handle(handlerInput) {
    console.log(
      `Session ended with reason: ${
        handlerInput.requestEnvelope.request.reason
      }`
    );

    return handlerInput.responseBuilder.getResponse();
  }
};

const AnswerIntent = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      (handlerInput.requestEnvelope.request.intent.name === "AnswerIntent" ||
        handlerInput.requestEnvelope.request.intent.name === "DontKnowIntent")
    );
  },
  handle(handlerInput) {
    if (handlerInput.requestEnvelope.request.intent.name === "AnswerIntent") {
      return handleUserGuess(false, handlerInput);
    }
    return handleUserGuess(true, handlerInput);
  }
};

const RepeatIntent = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "AMAZON.RepeatIntent"
    );
  },
  handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    return handlerInput.responseBuilder
      .speak(sessionAttributes.speechOutput)
      .reprompt(sessionAttributes.repromptText)
      .getResponse();
  }
};

const YesIntent = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "AMAZON.YesIntent"
    );
  },
  handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    if (sessionAttributes.questions) {
      return handlerInput.responseBuilder
        .speak(sessionAttributes.speechOutput)
        .reprompt(sessionAttributes.repromptText)
        .getResponse();
    }
    return startGame(false, handlerInput);
  }
};

const StopIntent = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "AMAZON.StopIntent"
    );
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const speechOutput = `${STOP_MESSAGE}`;

    return handlerInput.responseBuilder
      .speak(speechOutput)
      .reprompt(speechOutput)
      .getResponse();
  }
};

const CancelIntent = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "AMAZON.CancelIntent"
    );
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const speechOutput = `${CANCEL_MESSAGE}`;

    return handlerInput.responseBuilder.speak(speechOutput).getResponse();
  }
};

const NoIntent = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "AMAZON.NoIntent"
    );
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const speechOutput = `${NO_MESSAGE}`;
    return handlerInput.responseBuilder.speak(speechOutput).getResponse();
  }
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`);

    return handlerInput.responseBuilder
      .speak("Sorry, I can't understand the command. Please say again.")
      .reprompt("Sorry, I can't understand the command. Please say again.")
      .getResponse();
  }
};

const skillBuilder = Alexa.SkillBuilders.custom();
exports.handler = skillBuilder
  .addRequestHandlers(
    LaunchRequest,
    CategoryRequest,
    HelpIntent,
    AnswerIntent,
    RepeatIntent,
    YesIntent,
    StopIntent,
    CancelIntent,
    NoIntent,
    SessionEndedRequest,
    UnhandledIntent
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();
