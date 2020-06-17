const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');

const { InputHints, MessageFactory, ActivityTypes } = require('botbuilder');
const { TextPrompt, WaterfallDialog, AttachmentPrompt } = require('botbuilder-dialogs');
const { CardFactory } = require('botbuilder-core');
const { LuisRecognizer } = require('botbuilder-ai');
const { BusRecognizer } = require('../dialogs/BusRecognizer');

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
        if (!result.origin) {

            // Get destiantion from Firebase
            try {
                const id = await utils.getIdUser(stepContext.context);
                var myStop = await utils.readStop(id);
            } catch (error) {
                console.log(error);
            }

            //Send message
            try {
                await stepContext.context.sendActivity({
                    channelData: {
                        "attachment": {
                            "type": "template",
                            "payload": {
                                "template_type": "generic",
                                "elements": [
                                    {
                                        "title": "Bạn muốn tìm trạm xung quanh vị trí nào",
                                        "image_url": "https://i.pcmag.com/imagery/articles/05ADBV1ymnSvbBWkkDkQIzv-5.fit_scale.size_2698x1517.v1569489490.jpg",
                                        "subtitle": "Bạn có thể chọn 1 trong các lựa chọn bên dưới hoặc nhập trực tiếp.",
                                        "buttons": [
                                            {
                                                "type": "postback",
                                                "title": myStop,
                                                "payload": myStop
                                            },
                                            {
                                                "type": "postback",
                                                "title": "Mở map chọn vị trí",
                                                "payload": "Mở map chọn vị trí"
                                            }
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                });

            } catch (error) {
                await stepContext.context.sendActivity({
                    channelData: {
                        "attachment": {
                            "type": "template",
                            "payload": {
                                "template_type": "generic",
                                "elements": [
                                    {
                                        "title": "Bạn muốn tìm trạm xung quanh vị trí nào",
                                        "image_url": "https://i.pcmag.com/imagery/articles/05ADBV1ymnSvbBWkkDkQIzv-5.fit_scale.size_2698x1517.v1569489490.jpg",
                                        "subtitle": "Bạn có thể chọn 1 trong các lựa chọn bên dưới hoặc nhập trực tiếp.",
                                        "buttons": [
                                            {
                                                "type": "postback",
                                                "title": "Mở map chọn vị trí",
                                                "payload": "Mở map chọn vị trí"
                                            }
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                });
            }

            const msg = null;
            return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });
        }
        return await stepContext.next(result.origin)
    }

    async searchStopsStep(stepContext) {

        var result = stepContext.options;

        const { LuisAppId, LuisAPIKey, LuisAPIHostName } = process.env;
        const luisConfig = { applicationId: LuisAppId, endpointKey: LuisAPIKey, endpoint: `https://${LuisAPIHostName}` };
        const luis = new BusRecognizer(luisConfig);

        var luisResult = await luis.executeLuisQuery(stepContext.context);

        var origin = null;
        const originDetails = {};

        if (LuisRecognizer.topIntent(luisResult) == "Tìm_trạm") {
            origin = luis.getOriginEntities(luisResult);
        }

        if (origin == "đây" || origin == "nơi đây" || origin == "chổ này" || origin == "nơi này" || stepContext.result == "Mở map chọn vị trí" || stepContext.result == "\"Mở map chọn vị trí\"" || LuisRecognizer.topIntent(luisResult) == "Tại_đây") {
            try {
                const id = await utils.getIdUser(stepContext.context);

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
                        resolve({ url, token })

                    })

                });
                var myUrl;
                var myToken;
                await promise.then(res => {
                    myUrl = res.url;
                    myToken = res.token
                }).catch(err => {
                    console.log(err);
                })

                //Send card 
                try {
                    await stepContext.context.sendActivity({

                        channelData: {
                            "attachment": {
                                "type": "template",
                                "payload": {
                                    "template_type": "generic",
                                    "elements": [
                                        {
                                            "title": "Bấm nút bên dưới để mở map xác nhận vị trí.",
                                            "image_url": "https://previews.123rf.com/images/vadmary/vadmary1302/vadmary130200031/17960600-street-map-with-gps-icons-navigation.jpg",
                                            "subtitle": "Sẽ có 1 tab trình duyệt mới hiển thị map",
                                            "buttons": [
                                                {
                                                    "type": "web_url",
                                                    "url": myUrl,
                                                    "title": "Mở map",
                                                }
                                            ]
                                        }
                                    ]
                                }
                            }
                        }
                    });
                } catch (error) {
                    await stepContext.context.sendActivity('không lấy được vị trí hiện tại', '', InputHints.IgnoringInput);
                }

                var map = utils.openMap(id, myToken);

                await map.then(async res => {

                    var token = await utils.getTokenbyId(id)
                    if (res.token != token) {
                        result.origin = null;
                    } else {
                        result.origin = res.location;
                    }

                })
            } catch (error) {
                //chưa sửa xong

                await stepContext.context.sendActivity('không lấy được vị trí hiện tại', '', InputHints.IgnoringInput);
                await stepContext.endDialog();
                return await stepContext.beginDialog('stopAroundDialog');

            }
        }
        else if (LuisRecognizer.topIntent(luisResult) == "None") {

            await stepContext.context.sendActivity('Câu trả lời không hợp lệ', '', InputHints.IgnoringInput);
            await stepContext.endDialog();
            return await stepContext.beginDialog('stopAroundDialog');
        }
        else if (origin) {
            result.origin = origin;
        }
        else if (!origin) {
            result.origin = stepContext.result;
        }

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
                const url = 'https://transit.hereapi.com/v8/stations?in=' + result.geo.lat + ',' + result.geo.lng + '&maxPlaces=7';
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
                    if (utils.isGeo(place) == true) {

                        await stepContext.context.sendActivity(result.address)

                    }
                    var urlGetImage = 'https://image.maps.ls.hereapi.com/mia/1.6/mapview?apiKey=a0EUQVr4TtxyS9ZkBWKSR1xonz0FUZIuSBrRIDl7UiY&h=2048&w=2048&ml=vie&ppi=250&q=100'
                    var i = 0;
                    //var dataStations = [];
                    const elements = [];
                    const id = utils.getIdUser(stepContext.context)

                    for (i = 0; i < data.stations.length; i++) {
                        // const point = '&poix' + i + '=' + data.stations[i].place.location.lat + ',' + data.stations[i].place.location.lng + ';white;blue;25;' + data.stations[i].place.name;
                        // urlGetImage += point;
                        // dataStations.push({
                        //     name: data.stations[i].place.name,
                        //     id: data.stations[i].place.id
                        // })
                        elements.push({
                            title: data.stations[i].place.name,
                            image_url: 'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/ec2fa697-24a3-453e-98aa-9daa19ff5d78/d71vcxa-fac81fad-a040-4e7a-8a94-dea6b887d4b7.jpg?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiJcL2ZcL2VjMmZhNjk3LTI0YTMtNDUzZS05OGFhLTlkYWExOWZmNWQ3OFwvZDcxdmN4YS1mYWM4MWZhZC1hMDQwLTRlN2EtOGE5NC1kZWE2Yjg4N2Q0YjcuanBnIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.pSs3E4-pFgzoVZ0BdT-bO60U7EulFSRvgVwPvL3OOaQ',
                            buttons: [
                                {
                                    "type": "web_url",
                                    "url": 'https://botbusvqh.herokuapp.com/nearstop?id=' + data.stations[i].place.id,
                                    "title": "Vị trí"
                                }

                            ]
                        })


                    }

                    await utils.saveNearestStop(id, stepContext.options.origin);
                    const template = {
                        "attachment": {
                            "type": "template",
                            "payload": {
                                "template_type": "generic",
                                "elements": elements
                            }
                        }

                    }

                    await stepContext.context.sendActivity('Các trạm xung quanh');
                    await stepContext.context.sendActivity({
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