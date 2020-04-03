const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');

const { InputHints, MessageFactory, ActivityTypes } = require('botbuilder');
const { TextPrompt, WaterfallDialog, AttachmentPrompt } = require('botbuilder-dialogs');

const WATERFALL_DIALOG = 'STOP_AROUND_WATERFALL'
const LOCATION = 'CONFIRM_LOCATION'
const TEXT_PROMPT = 'TextPrompt_StopAround';

const utf8 = require('utf8');
const fetch = require("node-fetch");
var encodeUrl = require('encodeurl');

class StopArounDialog extends CancelAndHelpDialog {
    constructor(id) {
        super(id);
        this.addDialog(new TextPrompt(TEXT_PROMPT))
            .addDialog(new TextPrompt(LOCATION, this.locationValidator))
            .addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.getLocationStep.bind(this),
                this.searchStopsStep.bind(this)
            ]));

        this.initialDialogId = WATERFALL_DIALOG;

    }

    async locationValidator(promptContext) {
        promptContext.context.sendActivity(JSON.stringify(promptContext));

        // if (promptContext.recognized.succeeded) {
        //     const obj = promptContext.recognized.value;
        //     promptContext.context.sendActivity(JSON.stringify(obj));
        //     return true;
        // }
        // else {
        //     return false;
        // }
        return true;
    }



    async getLocationStep(stepContext) {
        const result = stepContext.options;
        if (!result) {
            const messageText = 'Cho tôi biết nơi bạn muốn tìm';
            const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
            await stepContext.prompt(LOCATION, { prompt: msg });
            // stepContext.context.sendActivity()
        }
        return await stepContext.next(result);

    }


    async searchStopsStep(stepContext) {
        const place = stepContext.options;
        var prompt = '';
        const urlRequestGeo = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json?key=AIzaSyBuTd5eFJwpova9M3AGpPrSwmzp_hHWVuE&inputtype=textquery&language=vi&fields=formatted_address,geometry&input=' + place + ' tphcm';
        var flag = true;

        try {
            const response = await fetch(utf8.encode(urlRequestGeo));
            const json = await response.json();

            if (json.candidates.length == 0) {
                prompt = 'Không tìm thấy trạm nào xung quanh cả, bạn có thể cung cấp địa chỉ cụ thể hơn không?';
                flag = false;
            } else {
                //request get Geo(lat,lng)
                const result = {};
                result.address = json.candidates[0].formatted_address;
                result.geo = json.candidates[0].geometry.location;

                //request get departures around the place
                var myHeaders = new fetch.Headers();
                myHeaders.append("Authorization", 'Bearer ' + process.env.token);

                var requestOptions = {
                    method: 'GET',
                    headers: myHeaders,
                    redirect: 'follow'
                };

                const url = 'https://transit.hereapi.com/v8/stations?in=' + result.geo.lat + ',' + result.geo.lng;
                const response = await fetch(url, requestOptions)
                const data = await response.json();

                if (data.stations.length == 0) {
                    prompt = 'Không tìm thấy trạm xung quanh vị trí ' + result.address;
                    flag = false;
                } else {
                    var urlGetImage = 'https://image.maps.ls.hereapi.com/mia/1.6/mapview?apiKey=a0EUQVr4TtxyS9ZkBWKSR1xonz0FUZIuSBrRIDl7UiY&h=2048&w=2048&ml=vie&ppi=250&q=100'
                    var i = 0;
                    for (i = 0; i < data.stations.length; i++) {
                        const point = '&poix' + i + '=' + data.stations[i].place.location.lat + ',' + data.stations[i].place.location.lng + ';white;blue;25;' + data.stations[i].place.name;
                        urlGetImage += point;
                    }
                    urlGetImage += '&poix' + i + '=' + result.geo.lat + ',' + result.geo.lng + ';white;blue;25;' + result.address;

                    const url = encodeUrl(urlGetImage);

                    await stepContext.context.sendActivity({

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


module.exports.StopArounDialog = StopArounDialog;