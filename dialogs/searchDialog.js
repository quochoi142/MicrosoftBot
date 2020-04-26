// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { InputHints, MessageFactory } = require('botbuilder');
const { TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');
const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');
const { CardFactory } = require('botbuilder-core');
const LocationCard = require('../resources/locationCard.json');
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
                this.SearchStep.bind(this)


            ]));

        this.initialDialogId = WATERFALL_DIALOG;


    }



    async GetStopStep(stepContext) {
        //code lấy vị trí để tra cứu trong đây
        const result = stepContext.options;
        if (!result.stop) {
            const locationMessageText = 'Trạm bạn tra cứu là?';
            await stepContext.context.sendActivity(locationMessageText, locationMessageText, InputHints.IgnoringInput);

            const locationCard = CardFactory.adaptiveCard(LocationCard);
            await stepContext.context.sendActivity({ attachments: [locationCard] });

            const locationMessageText_Hint = 'Ngoài các lựa chọn trên bạn cũng có thể nhập điểm đến vào';
            const locationMessageText_Example = 'VD: tra cứu xe bus tại trạm suối tiên';
            await stepContext.context.sendActivity(locationMessageText_Hint, locationMessageText_Hint, InputHints.IgnoringInput);
            await stepContext.context.sendActivity(locationMessageText_Example, locationMessageText_Example, InputHints.IgnoringInput);

            const messageText = null;
            const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
            return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });
        }
        return await stepContext.next(result.stop);

    }

    async SearchStep(stepContext) {

        const place = (stepContext.options.stop) ? stepContext.options.stop : stepContext.result;
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
                    const boards=data.boards;
                    for(var i=0;i<boards.length;i++){
                       
                        if(boards[i].place.name.toLowerCase()==place.toLowerCase()){
                            const departures=boards[i].departures;
                            var msg='';
                            departures.forEach(e => {
                                msg+=e.time+': Bus '+e.transport.name+'\n';
                            });
                          

                            stepContext.context.sendActivity(msg);
                        }
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
