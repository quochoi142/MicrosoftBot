// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// index.js is used to setup and configure your bot

// Import required packages
const path = require('path');
const restify = require('restify');
const setAccessToken = require('./API/oauth1');

// Import required bot services.
// See https://aka.ms/bot-services to learn more about the different parts of a bot.
const { BotFrameworkAdapter, ConversationState, InputHints, MemoryStorage, UserState } = require('botbuilder');

const { BusRecognizer } = require('./dialogs/BusRecognizer');

// This bot's main dialog.
const { DialogAndWelcomeBot } = require('./bots/dialogAndWelcomeBot');
const { MainDialog } = require('./dialogs/mainDialog');

// the bot's booking dialog
const { RouteDialog } = require('./dialogs/routeDialog');
const ROUTE_DIALOG = 'routeDialog';
const { SearchDialog } = require('./dialogs/searchDialog');
const SEARCH_DIALOG = 'searchDialog';


// Note: Ensure you have a .env file and include LuisAppId, LuisAPIKey and LuisAPIHostName.
const ENV_FILE = path.join(__dirname, '.env');
require('dotenv').config({ path: ENV_FILE });

// Create adapter.
// See https://aka.ms/about-bot-adapter to learn more about adapters.
const adapter = new BotFrameworkAdapter({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword
});

// Catch-all for errors.
const onTurnErrorHandler = async (context, error) => {
    // This check writes out errors to console log .vs. app insights.
    // NOTE: In production environment, you should consider logging this to Azure
    //       application insights.
    console.error(`\n [onTurnError] unhandled error: ${error}`);

    // Send a trace activity, which will be displayed in Bot Framework Emulator
    await context.sendTraceActivity(
        'OnTurnError Trace',
        `${error}`,
        'https://www.botframework.com/schemas/error',
        'TurnError'
    );

    // Send a message to the user
    let onTurnErrorMessage = 'The bot encountered an error or bug.';
    await context.sendActivity(onTurnErrorMessage, onTurnErrorMessage, InputHints.ExpectingInput);
    onTurnErrorMessage = 'To continue to run this bot, please fix the bot source code.';
    await context.sendActivity(onTurnErrorMessage, onTurnErrorMessage, InputHints.ExpectingInput);
    // Clear out state
    await conversationState.delete(context);
};

// Set the onTurnError for the singleton BotFrameworkAdapter.
adapter.onTurnError = onTurnErrorHandler;

// Define a state store for your bot. See https://aka.ms/about-bot-state to learn more about using MemoryStorage.
// A bot requires a state store to persist the dialog and user state between messages.

// For local development, in-memory storage is used.
// CAUTION: The Memory Storage used here is for local bot debugging only. When the bot
// is restarted, anything stored in memory will be gone.
const memoryStorage = new MemoryStorage();
const conversationState = new ConversationState(memoryStorage);
const userState = new UserState(memoryStorage);

// If configured, pass in the FlightBookingRecognizer.  (Defining it externally allows it to be mocked for tests)
const { LuisAppId, LuisAPIKey, LuisAPIHostName } = process.env;
const luisConfig = { applicationId: LuisAppId, endpointKey: LuisAPIKey, endpoint: `https://${LuisAPIHostName}` };

const luisRecognizer = new BusRecognizer(luisConfig);

// Create the main dialog.
const routeDialog = new RouteDialog(ROUTE_DIALOG);
const searchDialog = new SearchDialog(SEARCH_DIALOG);
const dialog = new MainDialog(luisRecognizer, routeDialog, searchDialog);
const bot = new DialogAndWelcomeBot(conversationState, userState, dialog);

//Initialize Firebase
const Firebase = require('./firebaseConfig/utils')
Firebase.initialize_FireBase();
//Get bearer
setAccessToken()
// Create HTTP server
const render = require('restify-render-middleware')
const server = restify.createServer();
// process.env.url=server.url;
// console.log('url '+process.env.url);
server.use(render({
    engine: {
        name: 'swig',
        extname: 'hbs'
    },
    dir: __dirname
}))

server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log(`\n${server.name} listening to ${server.url}`);
    console.log('\nGet Bot Framework Emulator: https://aka.ms/botframework-emulator');
    console.log('\nTo talk to your bot, open the emulator select "Open Bot"');
});

//server.use(bodyParser.json());
server.use(restify.plugins.queryParser({
    mapParams: true
}));
server.use(restify.plugins.bodyParser({
    mapParams: true
}));
// Listen for incoming activities and route them to your bot main dialog.
server.post('/api/messages', (req, res) => {


    // Route received a request to adapter for processing
    adapter.processActivity(req, res, async (turnContext) => {
        // route to bot activity handler.
        await bot.run(turnContext);
    });
});


server.get('/map', (req, res) => {
   
    res.render('map', { 
        id: req.params.id,
        token:req.params.token
     })
});

server.get('/route',(req,res)=>{
    res.render('./Views/route', { 
        id: req.params.id,
     })
});



// Listen for Upgrade requests for Streaming.
server.on('upgrade', (req, socket, head) => {
    // Create an adapter scoped to this WebSocket connection to allow storing session data.
    const streamingAdapter = new BotFrameworkAdapter({
        appId: process.env.MicrosoftAppId,
        appPassword: process.env.MicrosoftAppPassword
    });
    // Set onTurnError for the BotFrameworkAdapter created for each connection.
    streamingAdapter.onTurnError = onTurnErrorHandler;

    streamingAdapter.useWebSocket(req, socket, head, async (context) => {
        // After connecting via WebSocket, run this logic for every request sent over
        // the WebSocket connection.
        await bot.run(context);
    });
});
