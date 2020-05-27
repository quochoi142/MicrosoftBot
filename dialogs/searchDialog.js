// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
const { LuisRecognizer } = require('botbuilder-ai');
const { BusRecognizer } = require('../dialogs/BusRecognizer');
const { InputHints, MessageFactory } = require('botbuilder');
const { TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');
const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');
const { CardFactory } = require('botbuilder-core');
const StopCard = require('../resources/locationCard.json');
const ConfirmLocationCard = require('../resources/confirmLocationCard.json');

const TEXT_PROMPT = 'TextPrompt_RouteDetail';
const WATERFALL_DIALOG = 'waterfallDialog_RouteDetail';
const LOCATION = 'location_prompt';

const utf8 = require('utf8');
const fetch = require("node-fetch");
const utils = require('../firebaseConfig/utils');
var encodeUrl = require('encodeurl')


class SearchDialog extends CancelAndHelpDialog {
    constructor(id) {
        super(id);

        this.addDialog(new TextPrompt(TEXT_PROMPT))
            .addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.GetStopStep.bind(this),
                this.GetBusNum.bind(this),
                this.SearchStep.bind(this)


            ]));

        this.initialDialogId = WATERFALL_DIALOG;


    }



    async GetStopStep(stepContext) {
        //code lấy vị trí để tra cứu trong đây
        const result = stepContext.options;
        if (!result.stop) {

            // Get origin from Firebase
            try {

                const id = await utils.getIdUser(stepContext.context);
                var myStop = await utils.readStop(id);
            } catch (error) {
                console.log(error);
            }

            //Init card destination
            var stopCard = null;


            try {
                const StopJson = {

                    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                    "type": "AdaptiveCard",
                    "version": "1.0",
                    "body": [
                        {
                            "type": "Image",
                            "url": "https://image.freepik.com/free-vector/happy-cute-kids-wait-school-bus-with-friends_97632-1086.jpg",
                            "width": "stretch",
                            "style": "default"
                        }
                    ],
                    "actions": [
                        {
                            "type": "Action.Submit",
                            "title": myStop[0].origin,
                            "data": myStop[0].origin

                        },
                        {
                            "type": "Action.Submit",
                            "title": myStop[1].origin,
                            "data": myStop[1].origin,

                        },
                        {
                            "type": "Action.Submit",
                            "title": myStop[2].origin,
                            "data": myStop[2].origin

                        }
                    ]

                };
                stopCard = CardFactory.adaptiveCard(StopJson);

            } catch (error) {
                stopCard = CardFactory.adaptiveCard(StopCard);
            }

            //Send message
            const stopMessageText = 'Trạm bạn tra cứu là?';
            await stepContext.context.sendActivity(stopMessageText, stopMessageText, InputHints.IgnoringInput);

            await stepContext.context.sendActivity({ attachments: [stopCard] });

            const messageText = null;
            const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
            return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });
        }
        return await stepContext.next(result.stop);

    }

    async GetBusNum(stepContext) {
        const result = stepContext.options;


        if (!result.bus) {

            const { LuisAppId, LuisAPIKey, LuisAPIHostName } = process.env;
            const luisConfig = { applicationId: LuisAppId, endpointKey: LuisAPIKey, endpoint: `https://${LuisAPIHostName}` };
            const luis = new BusRecognizer(luisConfig);

            // check From and To to Restart searchDialogs 
            const luisResult = await luis.executeLuisQuery(stepContext.context);
            const bus = luis.getBusEntities(luisResult);
            const stop = luis.getStopEntities(luisResult);

            const StopDetail = {};
            if (bus && stop) {
                StopDetail.stop = stop;
                StopDetail.bus = bus;
                await stepContext.endDialog();
                return await stepContext.beginDialog('searchDialog', StopDetail);
            }
            else if (bus && !stop) {
                await stepContext.context.sendActivity('Câu trả lời không hợp lệ.\r\n Vui lòng cho tôi biết tên trạm thay vì số xe', '', InputHints.IgnoringInput);
                await stepContext.endDialog();
                return await stepContext.beginDialog('searchDialog', StopDetail);
            }
            else if (!bus && stop) {
                result.stop = stop;
            }
            else if (!bus && !stop) {
                result.stop = stepContext.result;
            }


            //return await stepContext.context.sendActivity(locationMessageText_Hint, locationMessageText_Hint, InputHints.ExpectingInput);
            const messageText = "Bạn muốn bắt xe bus số mấy?"
            const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
            return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });
        }
        return stepContext.next(result.bus);
    }

    async SearchStep(stepContext) {
        const result0 = stepContext.options

        const { LuisAppId, LuisAPIKey, LuisAPIHostName } = process.env;
        const luisConfig = { applicationId: LuisAppId, endpointKey: LuisAPIKey, endpoint: `https://${LuisAPIHostName}` };
        const luis = new BusRecognizer(luisConfig);

        // check From and To to Restart searchDialogs 
        const luisResult = await luis.executeLuisQuery(stepContext.context);
        const bus = luis.getBusEntities(luisResult);
        const stop = luis.getStopEntities(luisResult);

        const StopDetail = {};
        if (bus && stop) {
            StopDetail.stop = stop;
            StopDetail.bus = bus;
            await stepContext.endDialog();
            return await stepContext.beginDialog('searchDialog', StopDetail);
        }
        else if (!bus && stop) {
            await stepContext.context.sendActivity('Câu trả lời không hợp lệ.\r\n Vui lòng cho tôi biết số xe thay vì tên trạm', '', InputHints.IgnoringInput);
            await stepContext.endDialog();
            return await stepContext.beginDialog('searchDialog', StopDetail);
        }
        else if (bus && !stop) {
            result0.bus = bus;
        }
        else if (!bus && !stop) {
            result0.bus = stepContext.result;
        }


        const place = result0.stop;
        var prompt = '';
        var flag = true;

        try {
            var result;

            const urlRequestGeo = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json?key=AIzaSyBuTd5eFJwpova9M3AGpPrSwmzp_hHWVuE&inputtype=textquery&language=vi&fields=formatted_address,geometry&input=' + place + ' tphcm';

            const response = await fetch(utf8.encode(urlRequestGeo));
            const json = await response.json();

            if (json.candidates && json.candidates.length == 0) {
                prompt = 'Không tìm thấy trạm nào xung quanh cả, bạn có thể cung cấp địa chỉ cụ thể hơn không?';
                flag = false;
            } else {
                //request get Geo(lat,lng)
                result = {};
                result.address = json.candidates[0].formatted_address;
                result.geo = json.candidates[0].geometry.location;

                //request get departures around the place


            }

            if (flag == true) {
                const url = 'https://transit.hereapi.com/v8/departures?lang=vi&in=' + result.geo.lat + ',' + result.geo.lng + ';r=1000&name=' + place;
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
                    flag = false;
                } else {
                    const boards = data.boards;
                    var isExistsBus = false;
                    for (var i = 0; i < boards.length; i++) {
                        var msg = '';
                        if (boards[i].place.name.toLowerCase() == place.toLowerCase()) {
                            const departures = boards[i].departures;


                            for (var j = 0; j < departures.length; j++) {
                                if (result0.bus.match('(\\d+)')[0] == departures[j].transport.name) {
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

                                    msg = "Xe bus số " + departures[j].transport.name + " xuất phát từ " + departures[j].transport.headsign + " khoảng " + time + " sẽ đi qua trạm " + boards[j].place.name;
                                    break;
                                }
                            }


                        }
                        if (msg !== "") {
                            await stepContext.context.sendActivity(msg);
                        }

                    }
                    if (!isExistsBus) {
                        await stepContext.context.sendActivity("Có vẻ như xe bus này không đi qua trạm")
                    }
                }

            }

        } catch (err) {
            console.log(err);
            prompt = "Có lỗi trong quá trình tìm kiếm, mong bạn thử lại";
            flag = false;
        }

        if (flag) {

            prompt = "Bạn cần giúp gì thêm không?";
        }

        return await stepContext.endDialog(prompt);
    }

}




module.exports.SearchDialog = SearchDialog;
