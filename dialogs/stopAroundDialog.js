const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');

const { InputHints, MessageFactory, ActivityTypes } = require('botbuilder');
const { TextPrompt, WaterfallDialog, AttachmentPrompt } = require('botbuilder-dialogs');
const { CardFactory } = require('botbuilder-core');

const WATERFALL_DIALOG = 'STOP_AROUND_WATERFALL'
const LOCATION = 'CONFIRM_LOCATION'
const TEXT_PROMPT = 'TextPrompt_StopAround';

const OpenMapCard = require('../resources/openMapCard.json');

const utf8 = require('utf8');
const fetch = require("node-fetch");
var encodeUrl = require('encodeurl');
const utils = require('../firebaseConfig/utils');

const randomstring = require('randomstring')

class StopArounDialog extends CancelAndHelpDialog {
    constructor(id) {
        super(id);
        this.addDialog(new TextPrompt(TEXT_PROMPT))
            .addDialog(new TextPrompt(LOCATION, this.locationValidator))
            .addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                //this.getLocationStep.bind(this),
                this.openMapStep.bind(this),
                this.searchStopsStep.bind(this)
            ]));

        this.initialDialogId = WATERFALL_DIALOG;


    }

    async test(stepContext) {
        await stepContext.context.sendActivity('waiting');
        // var x;
        // const a = await utils.wait().then(res=>{
        //     console.log(res);
        //     x='suối tiên tphcm';
        // })
        // await utils.sleep(5000)
        var a = await utils.wait();
        return await stepContext.next();

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

        // const result = stepContext.options;
        // if (!result.origin) {


        //     const messageText = 'Cho tôi biết nơi bạn muốn tìm';
        //     const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
        //     return await stepContext.prompt(LOCATION, { prompt: msg });

        // }

        // return await stepContext.next(result.origin);

        var result = stepContext.options;
        const id = utils.getIdUser(stepContext.context);

        if (!result.origin) {
            var promise = new Promise(function (resolve, reject) {
                var token;
                var firebase = utils.getFirebase();
                firebase.database().ref('users/' + id + '/token').once('value', (snap) => {
                    token = snap.val();
                    var url = 'https://botbusvqh.herokuapp.com/map?id=' + id + '&token=' + token;
                    setTimeout(function () {
                        firebase.database().ref('users/' + id + '/token').set(randomstring.generate(10));

                    }, 30000);
                    resolve(url)

                })


            });
            var myUrl;
            await promise.then(url => {
                myUrl = url;
            }).catch(err => {
                console.log(err);
            })

            const messageText = myUrl;
            const msg = MessageFactory.text(messageText, messageText, InputHints.IgnoringInput);
            await stepContext.prompt(TEXT_PROMPT, { prompt: msg });

            var map = utils.openMap(id);

            await map.then(geo => {

                result.origin = geo;
            })
        }

        return await stepContext.next(result.origin)

    }

    //  async openMap(stepContext) {
    //     if (stepContext.result != 'map')
    //         const result = stepContext.options;

    //     return await stepContext.next(result.origin);

    //     var timeOutObj = utils.openMap();

    //     await timeOutObj.then(function (result) {


    //     });

    //     //Cancel it.

    // }

    //code here
    async openMapStep(stepContext) {

        var result = stepContext.options;

        const id = utils.getIdUser(stepContext.context);

        if (!result.origin) {
            utils.setToken(stepContext.context);
            var promise = new Promise(function (resolve, reject) {
                var token;
                var firebase = utils.getFirebase();
                firebase.database().ref('users/' + id + '/token').once('value', (snap) => {
                    token = snap.val();
                    var url = 'https://botbusvqh.herokuapp.com/map?id=' + id + '&token=' + token;
                    setTimeout(function () {
                        firebase.database().ref('users/' + id + '/token').set(randomstring.generate(10));

                    }, 5 * 60000);
                    resolve(url)

                })


            });
            var myUrl;
            await promise.then(url => {
                myUrl = url;
            }).catch(err => {
                console.log(err);
            })

            // Moi them
            // Get origin from Firebase
            try {
                const id = await utils.getIdUser(stepContext.context);
                var myInfo = await utils.readStop(id);

            } catch (error) {
                console.log(error);
            }

            //Send card 
            try {
                await stepContext.context.sendActivity({
                    text: "Bạn cũng có thể nhập trực tiếp",
                    channelData: {
                        "attachment": {
                            "type": "template",
                            "payload": {
                                "template_type": "button",
                                "text": "Chọn nơi bạn muốn tìm",
                                "buttons": [
                                    {

                                        "type": "postback",
                                        "title": myInfo,
                                        "payload": myInfo

                                    },
                                    {
                                        "type": "web_url",
                                        "url": myUrl,
                                        "title": "Mở map chọn"
                                    }

                                ]
                            }
                        }
                    }
                });
            } catch (error) {
                await stepContext.context.sendActivity({
                    text: "Bạn cũng có thể nhập trực tiếp",
                    channelData: {
                        "attachment": {
                            "type": "template",
                            "payload": {
                                "template_type": "button",
                                "text": "Chọn nơi bạn muốn tra cứu",
                                "buttons": [

                                    {
                                        "type": "web_url",
                                        "url": myUrl,
                                        "title": "Mở map chọn"
                                    }

                                ]
                            }
                        }
                    }
                });
            }




            var map = utils.openMap(id);

            await map.then(geo => {

                result.origin = geo;
            })
        }
        
        if (stepContext.result == null) {
            console.log(stepContext.result);
            await stepContext.context.sendActivity(stepContext.result, stepContext.result,InputHints.IgnoringInput);
            return await stepContext.beginDialog('STOP_AROUND_DIALOG', location);
        }

        return await stepContext.next(result.origin)
    }


    async searchStopsStep(stepContext) {

        const place = (stepContext.options.origin) ? stepContext.options.origin : stepContext.result;
        var prompt = '';
        var flag = true;

        try {
            var result;
            if (utils.isGeo(place) == true) {

                result = utils.getGeo(place)
            } else {
                const urlRequestGeo = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json?key=AIzaSyBuTd5eFJwpova9M3AGpPrSwmzp_hHWVuE&inputtype=textquery&language=vi&fields=formatted_address,geometry&input=' + place + ' tphcm';

                const response = await fetch(utf8.encode(urlRequestGeo));
                const json = await response.json();

                if (json.candidates.length == 0) {
                    prompt = 'Không tìm thấy trạm nào xung quanh cả, bạn có thể cung cấp địa chỉ cụ thể hơn không?';
                    flag = false;
                } else {
                    //request get Geo(lat,lng)
                    result = {};
                    result.address = json.candidates[0].formatted_address;
                    result.geo = json.candidates[0].geometry.location;

                    //request get departures around the place


                }
            }
            if (flag == true) {
                const url = 'https://transit.hereapi.com/v8/stations?in=' + result.geo.lat + ',' + result.geo.lng;
                var myHeaders = new fetch.Headers();
                myHeaders.append("Authorization", 'Bearer ' + process.env.token);

                var requestOptions = {
                    method: 'GET',
                    headers: myHeaders,
                    redirect: 'follow'
                };
                const response = await fetch(url, requestOptions)
                const data = await response.json();

                if (data.stations.length == 0) {
                    prompt = 'Không tìm thấy trạm xung quanh vị trí ' + result.address;
                    flag = false;
                } else {
                    var urlGetImage = 'https://image.maps.ls.hereapi.com/mia/1.6/mapview?apiKey=a0EUQVr4TtxyS9ZkBWKSR1xonz0FUZIuSBrRIDl7UiY&h=2048&w=2048&ml=vie&ppi=250&q=100'
                    var i = 0;
                    var dataStations = [];
                    const elements = [];
                    const id = utils.getIdUser(stepContext.context)

                    for (i = 0; i < data.stations.length; i++) {
                        // const point = '&poix' + i + '=' + data.stations[i].place.location.lat + ',' + data.stations[i].place.location.lng + ';white;blue;25;' + data.stations[i].place.name;
                        // urlGetImage += point;
                        dataStations.push({
                            name: data.stations[i].place.name,
                            geo: data.stations[i].place.location
                        })
                        elements.push({
                            title: data.stations[i].place.name,
                            image_url: 'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/ec2fa697-24a3-453e-98aa-9daa19ff5d78/d71vcxa-fac81fad-a040-4e7a-8a94-dea6b887d4b7.jpg?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiJcL2ZcL2VjMmZhNjk3LTI0YTMtNDUzZS05OGFhLTlkYWExOWZmNWQ3OFwvZDcxdmN4YS1mYWM4MWZhZC1hMDQwLTRlN2EtOGE5NC1kZWE2Yjg4N2Q0YjcuanBnIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.pSs3E4-pFgzoVZ0BdT-bO60U7EulFSRvgVwPvL3OOaQ',
                            buttons: [
                                {
                                    "type": "web_url",
                                    "url": 'https://botbusvqh.herokuapp.com/nearstop?id=' + id,
                                    "title": "Vị trí"
                                }

                            ]
                        })
                    }

                    await utils.saveNearestStop(id, dataStations);
                    const template = {
                        "attachment": {
                            "type": "template",
                            "payload": {
                                "template_type": "generic",
                                "elements": elements
                            }
                        }

                    }

                    await stepContext.context.sendActivity({
                        text: "Các trạm xung quanh",
                        channelData: template
                    });
                    // const url = 'https://botbusvqh.herokuapp.com/nearstop?id=' + id;
                    // await stepContext.context.sendActivity(url);

                    // urlGetImage += '&poix' + i + '=' + result.geo.lat + ',' + result.geo.lng + ';white;blue;25;' + result.address.replace("700000", "");;

                    // const url = encodeUrl(urlGetImage);

                    // await stepContext.context.sendActivity({

                    //     channelData: {
                    //         "attachment": {
                    //             "type": "image",
                    //             "payload": {
                    //                 "url": url,
                    //                 "is_reusable": true
                    //             }
                    //         }
                    //     }
                    // });



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