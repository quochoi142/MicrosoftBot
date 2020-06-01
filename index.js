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
//const bot = new DialogAndWelcomeBot(conversationState, userState, dialog);


const { ProactiveBot } = require('./bots/proactiveBot');
const conversationReferences = {};
//const botDiaglog = new ProactiveBot(conversationReferences);
const bot = new ProactiveBot(conversationReferences, conversationState, userState, dialog);

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

    res.render('./Views/map', {
        id: req.params.id,
        token: req.params.token,
        steps: [{ step: "a" }, { step: "b" }]
    })
});

server.get('/route', (req, res) => {
    res.render('./Views/route', {
        id: req.params.id,
    })
});

server.get('/nearstop', (req, res) => {
    res.render('./Views/nearStop', {
        id: req.params.id,
        token: process.env.token
    })
});



server.get('/api/notify', async (req, res) => {
    // const time = 85800000;
    // setTimeout( async()=>{ 
    // 	for (const conversationReference of Object.values(conversationReferences)) {
    //     await adapter.continueConversation(conversationReference, async turnContext => {
    //         // If you encounter permission-related errors when sending this message, see
    //         // https://aka.ms/BotTrustServiceUrl
    //         await turnContext.sendActivity('proactive hello');
    //     });
    // }
    // }, 5*60*1000);
    res.send(200)
    for (const conversationReference of Object.values(conversationReferences)) {
        await adapter.continueConversation(conversationReference, async turnContext => {
            const fetch = require("node-fetch");
            var encodeUrl = require('encodeurl');
            const geo = req.params.geo
            const place = req.params.place
            const bus = req.params.bus
            const url = 'https://transit.hereapi.com/v8/departures?maxPerBoard=10&lang=vi&in=' + geo + ';r=1000&name=' + place;
            var myHeaders = new fetch.Headers();
            myHeaders.append("Authorization", 'Bearer ' + process.env.token);

            var requestOptions = {
                method: 'GET',
                headers: myHeaders,
                redirect: 'follow'
            };
            const response = await fetch(encodeUrl(url), requestOptions)
            const data = await response.json();

            if (data.boards.length == 0) {
                prompt = 'Không tìm thấy trạm ' + place;

            } else {
                const boards = data.boards;
                var isExistsBus = false;
                for (var i = 0; i < boards.length; i++) {
                    var msg = '';
                    if (boards[i].place.name.toLowerCase() == place.toLowerCase()) {
                        const departures = boards[i].departures;


                        for (var j = 0; j < departures.length; j++) {
                            if (bus.match('(\\d+)')[0] == parseInt(departures[j].transport.name)) {
                                isExistsBus = true
                                var time = departures[j].time;
                                const moment = require('moment')
                                var now = moment().format("YYYY-MM-DDTHH:mm:ssZ");

                                time = moment.utc(moment(time, "YYYY-MM-DDTHH:mm:ssZ").diff(now)).format('HH:mm')
                                const tokens = time.split(":");
                                const h = tokens[0]
                                const m = tokens[1]
                                time = "";
                                if (h != 0) {
                                    time += parseInt(h) + "h";
                                }
                                if (m != 0) {
                                    time += parseInt(m) + "'";
                                }
                                time = (time == "") ? "1'" : time;

                                msg = "Xe bus số " + departures[j].transport.name + " xuất phát từ " + departures[j].transport.headsign + " khoảng " + time + " sẽ đi qua trạm " + boards[i].place.name;
                                break;
                            }
                        }


                    }
                    if (msg !== "") {
                        //await stepContext.context.sendActivity(msg);
                        await turnContext.sendActivity(msg);
                    }

                }
                if (!isExistsBus) {
                    await turnContext.sendActivity("Có vẻ như xe bus này không đi qua trạm");
                    //await stepContext.context.sendActivity("Có vẻ như xe bus này không đi qua trạm")
                }
            }
        });
    }




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
