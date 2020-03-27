// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { InputHints, MessageFactory } = require('botbuilder');
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
                this.confirmODStep.bind(this),
                this.finalStep.bind(this),
                this.errorStep.bind(this)


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

    async confirmODStep(stepContext) {
        const route = stepContext.options;
        route.origin = stepContext.result;

        // return await stepContext.endDialog(route);
        /*----------------------------------------------*/

        //Cho người dùng biết 2 điểm O-D
        const confirmODmessageText = "Bạn muốn đi từ " + route.origin + " đến " + route.destination + " có phải không?";
        await stepContext.context.sendActivity(confirmODmessageText, confirmODmessageText, InputHints.IgnoringInput);

        //Init card confirmOD
        const confirmODCard = CardFactory.adaptiveCard(ConfirmODCard);
        await stepContext.context.sendActivity({ attachments: [confirmODCard] });

        const messageText = null;
        const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
        return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });
    }
    async finalStep(stepContext) {

        // code tìm đường nằm trong đây
        if ('Đúng' == stepContext.result || 'đúng' == stepContext.result || "\"Đúng\"" == stepContext.result) {

            var result = stepContext.options;
            //result.origin = stepContext.result;

            const http_request = process.env.GgAPI + "&origin=" + result.origin + ' tphcm' + "&destination=" + result.destination + ' tphcm';
            var prompt = '';

            try {
                const response = await fetch(utf8.encode(http_request));

                const json = await response.json();
                if (response.status != 200 || json.routes.length == 0) {
                    prompt = 'Không tìm thấy đường đi bạn có thể cung cấp địa chỉ cụ thể hơn không';

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

                    steps.forEach(step => {
                        duration = duration + step.travelSummary.duration;
                        length = length + step.travelSummary.length;
                        var pivot = '';

                        var instuction = '';
                        const type = step.type;
                        if (type === "pedestrian") {
                            if (index == 0) {
                                instuction = 'Từ ' + result.origin + ' đi bộ đến trạm ' + step.arrival.place.name
                            } else if (index == steps.length - 1) {
                                instuction = 'Đi bộ đến ' + result.destination
                            }
                            else if (pivot != '' && step.departure.place.name != pivot) {
                                instuction = 'Đi bộ đến ' + step.departure.place.name;
                                pivot = '';
                            }
                        } else if (type === 'transit') {
                            pivot = step.arrival.place.name;
                            instuction = 'Bắt xe số ' + step.transport.name + ' đi đến trạm ' + step.arrival.place.name
                        }

                        index++;
                        if (instuction != '')
                            instuctions.push(instuction);

                    });

                    const summary_direction = "Tổng quãng đường là " + parseFloat(length / 1000).toFixed(1) + "km đi mất khoảng " + utils.convertDuration(duration);

                    await stepContext.context.sendActivity(summary_direction, summary_direction, InputHints.IgnoringInput);
                    instuctions.forEach(async (element) => {
                        await stepContext.context.sendActivity(element, element, InputHints.IgnoringInput);
                        await sleep(200);

                    })

                    const id = utils.getIdUser(stepContext.context);
                    utils.saveRoute(id, result.destination);
                    prompt = "Tôi có thể giúp gì thêm cho bạn?";
                }

                //else thì kiểm tra sai ở đâu
                //IF destination thì quay lại bước lấy điểm đến 
                //IF origin thì quay lại bước lấy điểm xuất phát
                //IF cả hai thì ...

            } catch (error) {
                prompt = error.message;


            }

            prompt = "Bạn cần giúp gì thêm không?";
            return await stepContext.endDialog(prompt);
        }
        else {
            const wrongCardMessagetext = "Bạn hãy cho tôi biết là sai ở đâu?";
            await stepContext.context.sendActivity(wrongCardMessagetext, wrongCardMessagetext, InputHints.IgnoringInput);

            const wrongCard = CardFactory.adaptiveCard(WrongCard);
            await stepContext.context.sendActivity({ attachments: [wrongCard] });

            const messageText = null;
            const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
            return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });

        }
    }

    async errorStep(stepContext) {
        const route = stepContext.options;
        switch (stepContext.result) {
            case 'Sai điểm xuất phát': {
                route.origin = null;
                return await stepContext.beginDialog('routeDialog', route);
            }
            case 'Sai điểm đến': {
                route.destination = null;
                return await stepContext.beginDialog('routeDialog', route);
            }
            case 'Sai cả hai': {
                route.origin = null;
                route.destination = null;
                return await stepContext.beginDialog('routeDialog', route);
            }
            case '\"Sai điểm xuất phát\"': {
                route.origin = null;
                return await stepContext.beginDialog('routeDialog', route);
            }
            case '\"Sai điểm đến\"': {
                route.destination = null;
                return await stepContext.beginDialog('routeDialog', route);
            }
            case '\"Sai cả hai\"': {
                route.origin = null;
                route.destination = null;
                return await stepContext.beginDialog('routeDialog', route);
            }
            default: {
                const didntUnderstandMessageText = "Lựa chọn của bạn không phù hợp?";
                await stepContext.context.sendActivity(didntUnderstandMessageText, didntUnderstandMessageText, InputHints.IgnoringInput);

                return await stepContext.beginDialog('routeDialog', route);
            }
        }
    }

}

module.exports.RouteDialog = RouteDialog;
