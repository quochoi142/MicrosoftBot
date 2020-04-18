// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { InputHints, MessageFactory, ActivityTypes } = require('botbuilder');
const { TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');
const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');
const { CardFactory } = require('botbuilder-core');
const OriginCard = require('../resources/originCard.json');
const DestinationCard = require('../resources/destinationCard.json');
const ConfirmODCard = require('../resources/confirmODCard.json');
const WrongCard = require('../resources/wrongCard.json');

const TEXT_PROMPT = 'TextPrompt_RouteDetail';
const WATERFALL_DIALOG = 'waterfallDialog_RouteDetail';
const LOCATION = 'location_prompt';

const utf8 = require('utf8');
const fetch = require("node-fetch");
const utils = require('../firebaseConfig/utils');

var encodeUrl = require('encodeurl')

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

class RouteDialog extends CancelAndHelpDialog {
    constructor(id) {
        super(id);
        this.addDialog(new TextPrompt(TEXT_PROMPT))
            .addDialog(new TextPrompt(LOCATION, this.locationValidator))
            .addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.destinationStep.bind(this),
                this.originStep.bind(this),
                this.finalStep.bind(this)
            ]));

        this.initialDialogId = WATERFALL_DIALOG;


    }
    async locationValidator(promptContext) {
        if (promptContext.recognized.succeeded) {
            const obj = promptContext.recognized.value;
            promptContext.context.sendActivity(JSON.stringify(obj));
            return true;
        }
        else {
            return false;
        }
        // var location = activity.entry[0];
        // if (location != null) {
        //     return true;
        // }
        // return false
        // return promptContext.recognized.succeeded && promptContext.recognized.value > 0 && promptContext.recognized.value < 150;
    }

    async destinationStep(stepContext) {
        const route = stepContext.options;
        if (!route.destination) {
            //Init card destination
            const destinationMessageText = 'Nơi bạn muốn đến là?';
            await stepContext.context.sendActivity(destinationMessageText, destinationMessageText, InputHints.IgnoringInput);

            const destinationCard = CardFactory.adaptiveCard(DestinationCard);
            await stepContext.context.sendActivity({ attachments: [destinationCard] });

            const destinationMessageText_Hint = 'Ngoài các lựa chọn trên bạn cũng có thể nhập điểm đến vào';
            const destinationMessageText_Example = 'VD: tôi muốn đến suối tiên';
            await stepContext.context.sendActivity(destinationMessageText_Hint, destinationMessageText_Hint, InputHints.IgnoringInput);
            await stepContext.context.sendActivity(destinationMessageText_Example, destinationMessageText_Example, InputHints.IgnoringInput);

            //const messageText = 'Nơi bạn muốn đến là?';
            const messageText = null;
            const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
            return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });
        }

        return await stepContext.next(route.destination);
    }

    async originStep(stepContext) {
        const route = stepContext.options;
        route.destination = stepContext.result;
        if (!route.origin) {


            //Init card destination
            const originMessageText = 'Bạn sẽ đi từ đâu?';
            await stepContext.context.sendActivity(originMessageText, originMessageText, InputHints.IgnoringInput);

            const originCard = CardFactory.adaptiveCard(OriginCard);
            await stepContext.context.sendActivity({ attachments: [originCard] });

            const originMessageText_Hint = 'Ngoài các lựa chọn trên bạn cũng có thể nhập điểm xuất phát vào';
            const originMessageText_Example = 'VD: tôi muốn đi từ suối tiên';
            await stepContext.context.sendActivity(originMessageText_Hint, originMessageText_Hint, InputHints.IgnoringInput);
            await stepContext.context.sendActivity(originMessageText_Example, originMessageText_Example, InputHints.IgnoringInput);

            const messageText = null;
            const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
            return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });



        }
        return await stepContext.next(route.origin);
    }

    async finalStep(stepContext) {

        // code tìm đường nằm trong đây
        //if ('Đúng' == stepContext.result || 'đúng' == stepContext.result || "\"Đúng\"" == stepContext.result) {
        var result = stepContext.options;
        result.origin = stepContext.result;

        //cho người dùng biết 2 điểm O-D
        const confirmMsg = "Đi từ " + result.origin + " đến " + result.destination + ".";
        stepContext.context.sendActivity(confirmMsg, confirmMsg, InputHints.IgnoringInput);

        const http_request = process.env.GgAPI + "&origin=" + result.origin + ' tphcm' + "&destination=" + result.destination + ' tphcm';
        var prompt = '';

        try {
            const response = await fetch(utf8.encode(http_request));

            const json = await response.json();
            if (response.status != 200 || json.routes.length == 0) {
                prompt = 'Không tìm thấy đường đi bạn có thể cung cấp địa chỉ cụ thể hơn không?';

            }
            else {

                const route = json.routes[0].legs[0];


                const geoOrigin = route.start_location.lat + ',' + route.start_location.lng;
                const geoDest = route.end_location.lat + ',' + route.end_location.lng;

                // const start_address = route.start_address;
                // const end_address = route.end_address;

                const urls = [];
                urls.push('https://transit.router.hereapi.com/v1/routes?changes=1&pedestrian[speed]=0.5&lang=vi&modes=bus&pedestrian[maxDistance]=1000&origin=' + geoOrigin + '&destination=' + geoDest + '&return=intermediate,polyline,travelSummary');
                urls.push('https://transit.router.hereapi.com/v1/routes?pedestrian[speed]=0.5&lang=vi&modes=bus&origin=' + geoOrigin + '&destination=' + geoDest + '&return=intermediate,polyline,travelSummary');

                var urlImage = 'https://image.maps.ls.hereapi.com/mia/1.6/route?apiKey=a0EUQVr4TtxyS9ZkBWKSR1xonz0FUZIuSBrRIDl7UiY&h=2048&w=2048&ml=vie&ppi=250&q=100'

                var myHeaders = new fetch.Headers();
                myHeaders.append("Authorization", 'Bearer ' + process.env.token);

                var requestOptions = {
                    method: 'GET',
                    headers: myHeaders,
                    redirect: 'follow'
                };

                var data;
                for (var i = 0; i < urls.length; i++) {
                    const response = await fetch(urls[i], requestOptions)
                    data = await response.json();
                    if (data.routes.length) {
                        break;
                    }
                }


                console.log(JSON.stringify(data));
                const steps = data.routes[0].sections;

                var duration = 0;
                var length = 0;
                var index = 0;

                var time = 0;
                var instuctions = [];
                var indexGeo = 0;

                steps.forEach(step => {
                    var queryRoute = '';
                    if (index == 0 || index == steps.length - 1) {
                        queryRoute = '&r0' + '=' + utils.convertPolylineX1(step.polyline);
                    } else {
                        queryRoute = '&r0' + '=' + utils.convertPolylineX2(step.polyline);
                    }

                    duration = duration + step.travelSummary.duration;
                    length = length + step.travelSummary.length;
                    var pivot = '';

                    var instuction = '';
                    const type = step.type;
                    var queryPoint = ''
                    if (type === "pedestrian") {
                        var queryPoint1 = '', queryPoint2 = '';
                        if (index == 0) {
                            instuction = 'Từ ' + result.origin + ' đi bộ đến trạm ' + step.arrival.place.name;
                            queryPoint1 = '&poix0' + '=' + step.departure.place.location.lat + ',' + step.departure.place.location.lng + ';white;blue;25;' + result.origin;
                            queryPoint2 = '&poix1' + '=' + step.arrival.place.location.lat + ',' + step.arrival.place.location.lng + ';white;blue;25;đến trạm: ' + step.arrival.place.name;
                        } else if (index == steps.length - 1 && step.arrival.place.type == 'place') {
                            instuction = 'Đi bộ đến ' + result.destination;
                            queryPoint1 = '&poix0' + '=' + step.departure.place.location.lat + ',' + step.departure.place.location.lng + ';white;blue;25;Đi bộ từ trạm:  ' + step.departure.place.name;
                            queryPoint2 = '&poix1' + '=' + step.arrival.place.location.lat + ',' + step.arrival.place.location.lng + ';white;blue;25;' + result.destination;
                        }
                        else if (pivot != '' && step.departure.place.name != pivot) {
                            instuction = 'Đi bộ đến ' + step.departure.place.name;
                            pivot = '';
                            queryPoint1 = '&poix0' + '=' + step.departure.place.location.lat + ',' + step.departure.place.location.lng + ';white;blue;25;Đi bộ từ ' + 'trạm: ' + step.departure.place.name;
                            queryPoint2 = '&poix1' + '=' + step.arrival.place.location.lat + ',' + step.arrival.place.location.lng + ';white;blue;25;đến trạm: ' + step.arrival.place.name;
                        }
                        queryPoint = queryPoint1 + queryPoint2;

                    } else if (type === 'transit') {
                        const queryPoint1 = '&poix0' + '=' + step.departure.place.location.lat + ',' + step.departure.place.location.lng + ';white;blue;25;Buýt ' + step.transport.name + ': Trạm ' + step.departure.place.name;
                        const queryPoint2 = '&poix1' + '=' + step.arrival.place.location.lat + ',' + step.arrival.place.location.lng + ';white;blue;25;Xuống trạm: ' + step.arrival.place.name;
                        queryPoint = queryPoint1 + queryPoint2;
                        pivot = step.arrival.place.name;
                        instuction = 'Bắt xe số ' + step.transport.name + ' đi đến trạm ' + step.arrival.place.name
                        //   indexGeo++;
                    }

                    index++;
                    const Image = urlImage + queryRoute + queryPoint;

                    if (instuction != '') {
                        var object = {};
                        object.instuction = instuction;
                        object.urlImage = Image;
                        instuctions.push(object);

                    }
                });

                const summary_direction = "Tổng quãng đường là " + parseFloat(length / 1000).toFixed(1) + "km đi mất khoảng " + utils.convertDuration(duration);
                console.log(urlImage);
                await stepContext.context.sendActivity(summary_direction, summary_direction, InputHints.IgnoringInput);
                for (var i = 0; i < instuctions.length; i++) {
                    // await stepContext.context.sendActivity(instuctions[i].instuction, instuctions[i].instuction, InputHints.IgnoringInput);


                    const url = encodeUrl(instuctions[i].urlImage);

                    await stepContext.context.sendActivity({
                        text: instuctions[i].instuction,
                        channelData: {
                            "attachment": {
                                "type": "image",
                                "payload": {
                                    "url": url,
                                    "is_reusable": true
                                }
                            }
                        }
                    });

                    // await utils.sleep(500);
                }
                // instuctions.forEach(async (element) => {
                //     await stepContext.context.sendActivity(element.instuction, element.instuction, InputHints.IgnoringInput);

                //     const json = {

                //         "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                //         "type": "AdaptiveCard",
                //         "version": "1.0",
                //         "body": [
                //             {
                //                 "type": "Image",
                //                 "url": element.urlImage,
                //                 "width": "stretch",
                //                 "style": "default"
                //             }
                //         ],


                //     };

                //     console.log(element.urlImage);
                //     await stepContext.context.sendActivity({ attachments: [json] });

                //     await utils.sleep(500);
                // })

                const id = utils.getIdUser(stepContext.context);
                utils.saveRoute(id, result.destination);
                prompt = "Tôi có thể giúp gì thêm cho bạn?";
            }


        }
        catch (error) {
            prompt = error.message;
            console.log(error.message);


        }

        prompt = "Bạn cần giúp gì thêm không?";
        return await stepContext.endDialog(prompt);
    }

}

module.exports.RouteDialog = RouteDialog;
